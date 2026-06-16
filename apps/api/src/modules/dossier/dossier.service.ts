import { Injectable } from '@nestjs/common';
import {
  EstadoJuridico,
  MatriculaParse,
  ResultadoIndice,
} from '../../domain/registral.types';

export interface DossieGerado {
  resumo: string;
  conteudo: Record<string, unknown>;
  markdown: string;
}

/**
 * M6 — Geração de Artefatos.
 * Monta o dossiê (resumo executivo + estruturado + markdown imprimível).
 * Minuta, memorial e checklist completos pertencem às fases seguintes.
 */
@Injectable()
export class DossierService {
  gerar(
    parse: MatriculaParse,
    estado: EstadoJuridico,
    scores: ResultadoIndice[],
  ): DossieGerado {
    const negociabilidade = scores.find((s) => s.indice === 'NEGOCIABILIDADE');
    const titular = estado.titularesAtuais.map((t) => t.nome).join('; ') || 'não determinado';
    const onusAtivos = estado.onus.filter((o) => o.ativo);

    const resumo =
      `Matrícula ${parse.numero ?? 's/nº'} — titular atual: ${titular}. ` +
      `${onusAtivos.length} ônus ativo(s). ` +
      `Negociabilidade: ${negociabilidade?.valor ?? '—'}/100 (${negociabilidade?.faixa ?? '—'}). ` +
      `Disponibilidade: ${estado.disponivel ? 'sim' : 'não'}.`;

    const conteudo = {
      cabecalho: {
        numero: parse.numero,
        cartorio: parse.cartorio,
        comarca: parse.comarca,
        uf: parse.uf,
      },
      imovel: parse.imovel,
      estadoJuridico: {
        titularesAtuais: estado.titularesAtuais,
        onus: estado.onus,
        indisponivel: estado.indisponivel,
        clausulasRestritivas: estado.clausulasRestritivas,
        disponivel: estado.disponivel,
        cadeiaDominial: estado.cadeiaDominial,
        alertas: estado.alertas,
      },
      scores,
      checklist: this.checklist(estado, scores),
      disclaimer:
        'Documento de decisão-suporte/inteligência. Não substitui certidão ' +
        'oficial nem qualificação registral (art. 1º, §13 da especificação).',
    };

    return { resumo, conteudo, markdown: this.markdown(parse, estado, scores, resumo) };
  }

  private checklist(estado: EstadoJuridico, scores: ResultadoIndice[]): string[] {
    const itens: string[] = [];
    estado.onus
      .filter((o) => o.ativo)
      .forEach((o) => itens.push(`Providenciar baixa/avaliação do ônus: ${o.tipo} (${o.origemAto}).`));
    if (estado.indisponivel)
      itens.push('Verificar e sanar ordem de indisponibilidade (CNIB).');
    if (estado.clausulasRestritivas.length)
      itens.push(`Analisar cláusulas restritivas: ${estado.clausulasRestritivas.join(', ')}.`);
    if (estado.titularesAtuais.some((t) => t.estadoCivil && /casad/.test(t.estadoCivil)))
      itens.push('Conferir outorga conjugal / regime de bens.');
    const geo = scores.find((s) => s.indice === 'NEGOCIABILIDADE');
    if (geo) itens.push('Validar geometria e divergência de área (camada GIS — M4).');
    if (itens.length === 0) itens.push('Nenhuma pendência relevante identificada.');
    return itens;
  }

  private markdown(
    parse: MatriculaParse,
    estado: EstadoJuridico,
    scores: ResultadoIndice[],
    resumo: string,
  ): string {
    const l: string[] = [];
    l.push(`# Dossiê — Matrícula ${parse.numero ?? 's/nº'}`);
    l.push('');
    l.push(`> ${resumo}`);
    l.push('');
    l.push('## Identificação');
    l.push(`- **Cartório:** ${parse.cartorio ?? '—'}`);
    l.push(`- **Comarca/UF:** ${parse.comarca ?? '—'} / ${parse.uf ?? '—'}`);
    l.push(`- **Tipo:** ${parse.imovel.tipo}`);
    if (parse.imovel.areaM2) l.push(`- **Área:** ${parse.imovel.areaM2.toLocaleString('pt-BR')} m²`);
    if (parse.imovel.descricao) l.push(`- **Descrição:** ${parse.imovel.descricao}`);
    l.push('');
    l.push('## Estado Jurídico');
    l.push(`- **Titular(es) atual(is):** ${estado.titularesAtuais.map((t) => t.nome).join('; ') || '—'}`);
    l.push(`- **Disponível para negociação:** ${estado.disponivel ? 'sim' : 'não'}`);
    l.push(`- **Indisponibilidade:** ${estado.indisponivel ? 'SIM' : 'não'}`);
    const ativos = estado.onus.filter((o) => o.ativo);
    l.push(`- **Ônus ativos:** ${ativos.length ? ativos.map((o) => `${o.tipo} (${o.origemAto})`).join(', ') : 'nenhum'}`);
    if (estado.clausulasRestritivas.length)
      l.push(`- **Cláusulas restritivas:** ${estado.clausulasRestritivas.join(', ')}`);
    l.push('');
    l.push('## Cadeia Dominial');
    if (estado.cadeiaDominial.length === 0) l.push('- (não identificada)');
    estado.cadeiaDominial.forEach((c) =>
      l.push(
        `- **${c.codigo}** — ${c.natureza} ${c.data ? `(${c.data.toLocaleDateString('pt-BR')})` : ''}: ${c.titulares.join('; ')}`,
      ),
    );
    l.push('');
    l.push('## Scores');
    scores.forEach((s) => {
      l.push(`### ${this.rotuloIndice(s.indice)} — ${s.valor}/100 (${s.faixa})`);
      s.drivers.forEach((d) =>
        l.push(`- ${d.fator}: ${d.pontos}/${d.pesoMax} — ${d.nota}`),
      );
      l.push('');
    });
    if (estado.alertas.length) {
      l.push('## Alertas');
      estado.alertas.forEach((a) => l.push(`- ${a}`));
      l.push('');
    }
    l.push('---');
    l.push(
      '_Decisão-suporte/inteligência. Não substitui certidão oficial nem qualificação registral._',
    );
    return l.join('\n');
  }

  private rotuloIndice(i: ResultadoIndice['indice']): string {
    return {
      NEGOCIABILIDADE: 'Score de Negociabilidade',
      REGULARIDADE_REGISTRAL: 'Índice de Regularidade Registral',
      RISCO_LITIGIO: 'Risco de Litígio',
    }[i];
  }
}
