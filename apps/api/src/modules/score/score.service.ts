import { Injectable } from '@nestjs/common';
import { NaturezaAto, TipoOnus } from '@prisma/client';
import {
  DriverScore,
  EstadoJuridico,
  MatriculaParse,
  ResultadoIndice,
} from '../../domain/registral.types';

/**
 * M5 — Motor de Risco & Score.
 * Calcula índices 0–100 com drivers explicáveis, conforme a rubrica do §6.
 * Pesos são parametrizáveis por segmento (banco pondera litígio; REURB,
 * elegibilidade) — nesta fase usamos a rubrica padrão de Negociabilidade.
 *
 * Decisão-suporte: a nota sempre acompanha justificativa, não é certidão.
 */
@Injectable()
export class ScoreService {
  private readonly onusFinanceiros: TipoOnus[] = [
    TipoOnus.HIPOTECA,
    TipoOnus.ALIENACAO_FIDUCIARIA,
    TipoOnus.PENHORA,
    TipoOnus.ARRESTO,
  ];

  private readonly averbacoesEstruturais: NaturezaAto[] = [
    NaturezaAto.CONSTRUCAO,
    NaturezaAto.GEORREFERENCIAMENTO,
    NaturezaAto.RETIFICACAO,
  ];

  calcular(parse: MatriculaParse, estado: EstadoJuridico): ResultadoIndice[] {
    return [
      this.negociabilidade(parse, estado),
      this.regularidadeRegistral(parse, estado),
      this.riscoLitigio(estado),
    ];
  }

  // ---------- Negociabilidade ----------

  private negociabilidade(
    parse: MatriculaParse,
    estado: EstadoJuridico,
  ): ResultadoIndice {
    const drivers: DriverScore[] = [];
    const ativos = estado.onus.filter((o) => o.ativo);
    const temFinanceiro = ativos.some((o) => this.onusFinanceiros.includes(o.tipo));

    drivers.push({
      fator: 'Sem ônus financeiro ativo',
      pesoMax: 30,
      pontos: temFinanceiro ? 0 : 30,
      nota: temFinanceiro
        ? `Ônus ativo: ${ativos
            .filter((o) => this.onusFinanceiros.includes(o.tipo))
            .map((o) => o.tipo)
            .join(', ')}`
        : 'Nenhuma hipoteca/AF/penhora/arresto ativa.',
    });

    drivers.push({
      fator: 'Sem indisponibilidade',
      pesoMax: 20,
      pontos: estado.indisponivel ? 0 : 20,
      nota: estado.indisponivel
        ? 'Indisponibilidade ativa na matrícula.'
        : 'Sem indisponibilidade registrada (confirmar CNIB em produção).',
    });

    const temCadeia = estado.cadeiaDominial.length > 0;
    const titularPts = estado.titularesAtuais.length === 0 ? 0 : temCadeia ? 15 : 7;
    drivers.push({
      fator: 'Titularidade líquida e clara',
      pesoMax: 15,
      pontos: titularPts,
      nota:
        titularPts === 15
          ? `Titular atual resolvido via ${estado.titularesAtuais[0].origemAto}.`
          : titularPts === 7
            ? 'Titular apenas pela qualificação inicial — sem transmissão registrada.'
            : 'Titular atual não determinado.',
    });

    const temClausula = estado.clausulasRestritivas.length > 0;
    drivers.push({
      fator: 'Sem cláusula restritiva',
      pesoMax: 10,
      pontos: temClausula ? 0 : 10,
      nota: temClausula
        ? `Cláusula(s): ${estado.clausulasRestritivas.join('; ')}`
        : 'Sem inalienabilidade/incomunicabilidade/impenhorabilidade.',
    });

    const casados = estado.titularesAtuais.filter(
      (p) => p.estadoCivil && /casad/.test(p.estadoCivil),
    );
    drivers.push({
      fator: 'Outorga / estado civil resolvidos',
      pesoMax: 10,
      pontos: casados.length > 0 ? 5 : 10,
      nota:
        casados.length > 0
          ? 'Titular casado — conferir outorga conjugal e regime de bens.'
          : 'Sem pendência aparente de outorga.',
    });

    const temArea = typeof parse.imovel.areaM2 === 'number';
    drivers.push({
      fator: 'Geo / área conforme',
      pesoMax: 10,
      pontos: temArea ? 5 : 0,
      nota: temArea
        ? 'Área identificada; divergência espacial não verificada (camada GIS — M4 pendente).'
        : 'Área não identificada na matrícula.',
    });

    const temAverbacaoUtil = parse.atos.some((a) =>
      this.averbacoesEstruturais.includes(a.natureza),
    );
    drivers.push({
      fator: 'Averbações em dia',
      pesoMax: 5,
      pontos: temAverbacaoUtil ? 5 : 3,
      nota: temAverbacaoUtil
        ? 'Há averbações de construção/geo/retificação.'
        : 'Conferir averbações de construção/geo pendentes.',
    });

    return this.montar('NEGOCIABILIDADE', drivers);
  }

  // ---------- Regularidade Registral ----------

  private regularidadeRegistral(
    parse: MatriculaParse,
    estado: EstadoJuridico,
  ): ResultadoIndice {
    const drivers: DriverScore[] = [];

    const ruptura = estado.alertas.some((a) => /ruptura/i.test(a));
    drivers.push({
      fator: 'Cadeia dominial íntegra',
      pesoMax: 40,
      pontos: ruptura ? 10 : estado.cadeiaDominial.length > 0 ? 40 : 20,
      nota: ruptura
        ? 'Indício de ruptura na cadeia.'
        : `${estado.cadeiaDominial.length} transmissão(ões) encadeada(s).`,
    });

    const procedencia = parse.atos.some((a) => a.natureza === NaturezaAto.ABERTURA);
    drivers.push({
      fator: 'Procedência identificada',
      pesoMax: 20,
      pontos: procedencia ? 20 : 10,
      nota: procedencia
        ? 'Ato de abertura/procedência presente.'
        : 'Procedência não localizada explicitamente.',
    });

    const averbacoes = parse.atos.filter((a) =>
      this.averbacoesEstruturais.includes(a.natureza),
    ).length;
    drivers.push({
      fator: 'Averbações de construção/geo/retificação',
      pesoMax: 20,
      pontos: averbacoes > 0 ? 20 : 8,
      nota: `${averbacoes} averbação(ões) estrutural(is) identificada(s).`,
    });

    drivers.push({
      fator: 'Titular resolvido',
      pesoMax: 20,
      pontos: estado.titularesAtuais.length > 0 ? 20 : 0,
      nota:
        estado.titularesAtuais.length > 0
          ? 'Titularidade atual determinada.'
          : 'Titularidade não determinada.',
    });

    return this.montar('REGULARIDADE_REGISTRAL', drivers);
  }

  // ---------- Risco de Litígio (maior = pior) ----------

  private riscoLitigio(estado: EstadoJuridico): ResultadoIndice {
    const ativos = estado.onus.filter((o) => o.ativo);
    const drivers: DriverScore[] = [];
    let risco = 0;

    const add = (cond: boolean, pts: number, fator: string, nota: string) => {
      const p = cond ? pts : 0;
      risco += p;
      drivers.push({ fator, pesoMax: pts, pontos: p, nota });
    };

    add(
      ativos.some((o) => o.tipo === TipoOnus.PENHORA),
      40,
      'Penhora ativa',
      'Penhora aumenta fortemente a exposição contenciosa.',
    );
    add(
      ativos.some((o) => o.tipo === TipoOnus.ARRESTO),
      30,
      'Arresto ativo',
      'Arresto/sequestro indica litígio em curso.',
    );
    add(estado.indisponivel, 20, 'Indisponibilidade ativa', 'Ordem de indisponibilidade.');
    add(
      ativos.some((o) => o.tipo === TipoOnus.HIPOTECA || o.tipo === TipoOnus.ALIENACAO_FIDUCIARIA),
      10,
      'Garantia real ativa',
      'Hipoteca/AF — risco de execução da garantia.',
    );

    const valor = Math.min(100, risco);
    // semáforo invertido: risco alto = vermelho
    const faixa = valor > 50 ? 'VERMELHO' : valor >= 20 ? 'AMARELO' : 'VERDE';
    return { indice: 'RISCO_LITIGIO', valor, faixa, drivers };
  }

  // ---------- util ----------

  private montar(
    indice: ResultadoIndice['indice'],
    drivers: DriverScore[],
  ): ResultadoIndice {
    const valor = Math.round(drivers.reduce((s, d) => s + d.pontos, 0));
    const faixa = valor >= 70 ? 'VERDE' : valor >= 40 ? 'AMARELO' : 'VERMELHO';
    return { indice, valor, faixa, drivers };
  }
}
