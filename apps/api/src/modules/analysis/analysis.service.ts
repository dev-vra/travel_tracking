import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, StatusMatricula } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OCR_PORT, OcrPort } from '../ingest/ocr.port';
import { ParserService } from '../parser/parser.service';
import { JuridicalService } from '../juridical/juridical.service';
import { ScoreService } from '../score/score.service';
import { DossierService } from '../dossier/dossier.service';
import {
  FILA_ANALISE,
  JOB_ANALISAR,
  JobAnalisarData,
} from './analysis.constants';
import { CriarAnaliseDto } from './dto/criar-analise.dto';

/**
 * Orquestra o pipeline unitário (M1 → M6) de forma assíncrona via BullMQ.
 * O upload enfileira; o processor consome e roda a cadeia, persistindo o estado.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OCR_PORT) private readonly ocr: OcrPort,
    private readonly parser: ParserService,
    private readonly juridical: JuridicalService,
    private readonly score: ScoreService,
    private readonly dossier: DossierService,
    @InjectQueue(FILA_ANALISE) private readonly fila: Queue<JobAnalisarData>,
  ) {}

  /** Cria a matrícula (status RECEBIDA) e enfileira o processamento. */
  async criar(dto: CriarAnaliseDto) {
    const matricula = await this.prisma.matricula.create({
      data: {
        textoBruto: dto.texto,
        acervoId: dto.acervoId,
        status: StatusMatricula.RECEBIDA,
      },
    });

    await this.prisma.auditLog.create({
      data: { matriculaId: matricula.id, acao: 'ANALISE_CRIADA' },
    });

    await this.fila.add(
      JOB_ANALISAR,
      { matriculaId: matricula.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true },
    );

    return { id: matricula.id, status: matricula.status };
  }

  /** Executa o pipeline completo e persiste o resultado. */
  async processar(matriculaId: string): Promise<void> {
    const matricula = await this.prisma.matricula.findUnique({
      where: { id: matriculaId },
    });
    if (!matricula) throw new NotFoundException('Matrícula não encontrada.');

    await this.prisma.matricula.update({
      where: { id: matriculaId },
      data: { status: StatusMatricula.PROCESSANDO, erro: null },
    });

    try {
      // M1 — OCR / normalização
      const ocr = await this.ocr.extrair({ texto: matricula.textoBruto });
      // M2 — Parser registral
      const parse = this.parser.parse(ocr.texto);
      // M3 — Interpretação jurídica
      const estado = this.juridical.interpretar(parse);
      // M5 — Score & risco
      const scores = this.score.calcular(parse, estado);
      // M6 — Dossiê
      const dossie = this.dossier.gerar(parse, estado, scores);

      await this.persistir(matriculaId, parse, estado, scores, dossie);

      await this.prisma.auditLog.create({
        data: {
          matriculaId,
          acao: 'ANALISE_CONCLUIDA',
          detalhe: { provedorOcr: ocr.provedor, atos: parse.atos.length },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao processar ${matriculaId}: ${msg}`);
      await this.prisma.matricula.update({
        where: { id: matriculaId },
        data: { status: StatusMatricula.ERRO, erro: msg },
      });
      throw err;
    }
  }

  private async persistir(
    matriculaId: string,
    parse: ReturnType<ParserService['parse']>,
    estado: ReturnType<JuridicalService['interpretar']>,
    scores: ReturnType<ScoreService['calcular']>,
    dossie: ReturnType<DossierService['gerar']>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.matricula.update({
        where: { id: matriculaId },
        data: {
          numero: parse.numero,
          cartorio: parse.cartorio,
          comarca: parse.comarca,
          uf: parse.uf,
          status: StatusMatricula.CONCLUIDA,
        },
      });

      // Imóvel
      await tx.imovel.upsert({
        where: { matriculaId },
        create: {
          matriculaId,
          tipo: parse.imovel.tipo,
          descricao: parse.imovel.descricao,
          areaM2: parse.imovel.areaM2,
          logradouro: parse.imovel.logradouro,
          municipio: parse.imovel.municipio,
          uf: parse.imovel.uf,
        },
        update: {
          tipo: parse.imovel.tipo,
          descricao: parse.imovel.descricao,
          areaM2: parse.imovel.areaM2,
          logradouro: parse.imovel.logradouro,
          municipio: parse.imovel.municipio,
          uf: parse.imovel.uf,
        },
      });

      // Reprocessamento idempotente: limpa coleções derivadas
      await tx.proprietario.deleteMany({ where: { matriculaId } });
      await tx.atoRegistral.deleteMany({ where: { matriculaId } });
      await tx.onus.deleteMany({ where: { matriculaId } });

      if (estado.titularesAtuais.length) {
        await tx.proprietario.createMany({
          data: estado.titularesAtuais.map((t) => ({
            matriculaId,
            nome: t.nome,
            documento: t.documento,
            tipoPessoa: t.tipoPessoa,
            estadoCivil: t.estadoCivil,
            fracao: t.fracao,
            atual: true,
            origemAto: t.origemAto,
          })),
        });
      }

      if (parse.atos.length) {
        await tx.atoRegistral.createMany({
          data: parse.atos.map((a) => ({
            matriculaId,
            tipo: a.tipo,
            ordem: a.ordem,
            codigo: a.codigo,
            natureza: a.natureza,
            data: a.data,
            conteudo: a.conteudo,
            cancelado: false,
            cancelaCodigo: a.cancelaCodigo,
          })),
        });
      }

      if (estado.onus.length) {
        await tx.onus.createMany({
          data: estado.onus.map((o) => ({
            matriculaId,
            tipo: o.tipo,
            ativo: o.ativo,
            credor: o.credor,
            valor: o.valor,
            origemAto: o.origemAto,
          })),
        });
      }

      for (const s of scores) {
        await tx.score.upsert({
          where: { matriculaId_indice: { matriculaId, indice: s.indice } },
          create: {
            matriculaId,
            indice: s.indice,
            valor: s.valor,
            faixa: s.faixa,
            drivers: s.drivers as unknown as Prisma.InputJsonValue,
          },
          update: {
            valor: s.valor,
            faixa: s.faixa,
            drivers: s.drivers as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await tx.dossie.upsert({
        where: { matriculaId },
        create: {
          matriculaId,
          resumo: dossie.resumo,
          conteudo: dossie.conteudo as Prisma.InputJsonValue,
          markdown: dossie.markdown,
        },
        update: {
          resumo: dossie.resumo,
          conteudo: dossie.conteudo as Prisma.InputJsonValue,
          markdown: dossie.markdown,
        },
      });
    });
  }

  // ---------- Consultas ----------

  async listar() {
    return this.prisma.matricula.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numero: true,
        comarca: true,
        uf: true,
        status: true,
        createdAt: true,
        scores: { select: { indice: true, valor: true, faixa: true } },
      },
    });
  }

  async obter(id: string) {
    const m = await this.prisma.matricula.findUnique({
      where: { id },
      include: {
        imovel: true,
        proprietarios: true,
        atos: { orderBy: { ordem: 'asc' } },
        onus: true,
        scores: true,
        dossie: true,
      },
    });
    if (!m) throw new NotFoundException('Análise não encontrada.');
    return m;
  }
}
