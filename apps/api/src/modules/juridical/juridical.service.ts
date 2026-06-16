import { Injectable } from '@nestjs/common';
import { NaturezaAto, TipoOnus } from '@prisma/client';
import {
  EstadoJuridico,
  MatriculaParse,
  OnusEstado,
} from '../../domain/registral.types';

/**
 * M3 — Motor de Interpretação Jurídica.
 * Roda a cadeia dominial líquida (descontando cancelamentos), identifica o
 * titular atual, os ônus ativos, indisponibilidade, cláusulas e disponibilidade.
 */
@Injectable()
export class JuridicalService {
  private readonly transmissoes: NaturezaAto[] = [
    NaturezaAto.COMPRA_VENDA,
    NaturezaAto.DOACAO,
    NaturezaAto.HERANCA_PARTILHA,
    NaturezaAto.PERMUTA,
    NaturezaAto.INTEGRALIZACAO,
    NaturezaAto.ABERTURA,
  ];

  interpretar(parse: MatriculaParse): EstadoJuridico {
    const atos = [...parse.atos].sort((a, b) => a.ordem - b.ordem);
    const alertas: string[] = [];

    // --- Cadeia dominial líquida ---
    const cadeia: EstadoJuridico['cadeiaDominial'] = [];
    let titulares: (typeof parse.atos)[number]['pessoas'] = parse.proprietarioInicial ?? [];

    for (const ato of atos) {
      if (this.transmissoes.includes(ato.natureza) && ato.pessoas.length > 0) {
        titulares = ato.pessoas;
        cadeia.push({
          codigo: ato.codigo,
          data: ato.data,
          natureza: ato.natureza,
          titulares: ato.pessoas.map((p) => p.nome),
        });
      }
    }

    const titularesAtuais = titulares.map((p) => ({
      ...p,
      origemAto: cadeia.length ? cadeia[cadeia.length - 1].codigo : 'inicial',
    }));

    if (titularesAtuais.length === 0) {
      alertas.push('Titular atual não pôde ser determinado a partir da cadeia.');
    }
    if (cadeia.length === 0 && (parse.proprietarioInicial?.length ?? 0) === 0) {
      alertas.push('Cadeia dominial não identificada — possível ruptura ou leitura incompleta.');
    }

    // --- Ônus líquidos (constituição menos cancelamento) ---
    const onus: OnusEstado[] = [];
    for (const ato of atos) {
      const tipo = this.naturezaParaOnus(ato.natureza);
      if (tipo) {
        onus.push({
          tipo,
          ativo: true,
          credor: ato.credor,
          valor: ato.valor,
          origemAto: ato.codigo,
        });
      }
    }
    // aplica cancelamentos
    for (const ato of atos) {
      if (ato.natureza === NaturezaAto.CANCELAMENTO && ato.cancelaCodigo) {
        const alvo = onus.find((o) => o.origemAto === ato.cancelaCodigo && o.ativo);
        if (alvo) alvo.ativo = false;
      }
    }

    const onusAtivos = onus.filter((o) => o.ativo);
    const indisponivel = onusAtivos.some((o) => o.tipo === TipoOnus.INDISPONIBILIDADE);
    const clausulasRestritivas = atos
      .filter(
        (a) =>
          a.natureza === NaturezaAto.CLAUSULA_RESTRITIVA &&
          !this.foiCancelado(a.codigo, onus),
      )
      .map((a) => this.descreverClausula(a.conteudo));

    // --- Alertas de ônus ---
    for (const o of onusAtivos) {
      alertas.push(`${this.rotuloOnus(o.tipo)} ativo(a) (origem ${o.origemAto}).`);
    }

    const disponivel = !indisponivel && titularesAtuais.length > 0;

    return {
      titularesAtuais,
      onus,
      indisponivel,
      clausulasRestritivas,
      disponivel,
      cadeiaDominial: cadeia,
      alertas,
    };
  }

  private naturezaParaOnus(n: NaturezaAto): TipoOnus | null {
    switch (n) {
      case NaturezaAto.HIPOTECA:
        return TipoOnus.HIPOTECA;
      case NaturezaAto.ALIENACAO_FIDUCIARIA:
        return TipoOnus.ALIENACAO_FIDUCIARIA;
      case NaturezaAto.PENHORA:
        return TipoOnus.PENHORA;
      case NaturezaAto.ARRESTO:
        return TipoOnus.ARRESTO;
      case NaturezaAto.USUFRUTO:
        return TipoOnus.USUFRUTO;
      case NaturezaAto.INDISPONIBILIDADE:
        return TipoOnus.INDISPONIBILIDADE;
      case NaturezaAto.CLAUSULA_RESTRITIVA:
        return TipoOnus.CLAUSULA_RESTRITIVA;
      default:
        return null;
    }
  }

  private foiCancelado(codigo: string, onus: OnusEstado[]): boolean {
    const o = onus.find((x) => x.origemAto === codigo);
    return o ? !o.ativo : false;
  }

  private descreverClausula(conteudo: string): string {
    const t = conteudo.toLowerCase();
    const tags: string[] = [];
    if (/inalienabilidade/.test(t)) tags.push('inalienabilidade');
    if (/incomunicabilidade/.test(t)) tags.push('incomunicabilidade');
    if (/impenhorabilidade/.test(t)) tags.push('impenhorabilidade');
    return tags.length ? tags.join(', ') : 'cláusula restritiva';
  }

  private rotuloOnus(t: TipoOnus): string {
    const map: Record<TipoOnus, string> = {
      HIPOTECA: 'Hipoteca',
      ALIENACAO_FIDUCIARIA: 'Alienação fiduciária',
      PENHORA: 'Penhora',
      ARRESTO: 'Arresto',
      USUFRUTO: 'Usufruto',
      INDISPONIBILIDADE: 'Indisponibilidade',
      CLAUSULA_RESTRITIVA: 'Cláusula restritiva',
    };
    return map[t];
  }
}
