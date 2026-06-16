export type Faixa = 'VERDE' | 'AMARELO' | 'VERMELHO';

export interface Driver {
  fator: string;
  pesoMax: number;
  pontos: number;
  nota: string;
}

export interface Score {
  id: string;
  indice: 'NEGOCIABILIDADE' | 'REGULARIDADE_REGISTRAL' | 'RISCO_LITIGIO';
  valor: number;
  faixa: Faixa;
  drivers: Driver[];
}

export interface Proprietario {
  id: string;
  nome: string;
  documento?: string | null;
  tipoPessoa: 'FISICA' | 'JURIDICA';
  estadoCivil?: string | null;
  atual: boolean;
  origemAto?: string | null;
}

export interface Ato {
  id: string;
  tipo: 'REGISTRO' | 'AVERBACAO';
  ordem: number;
  codigo: string;
  natureza: string;
  data?: string | null;
  conteudo: string;
  cancelaCodigo?: string | null;
}

export interface Onus {
  id: string;
  tipo: string;
  ativo: boolean;
  credor?: string | null;
  valor?: number | null;
  origemAto?: string | null;
}

export interface Imovel {
  tipo: string;
  descricao?: string | null;
  areaM2?: number | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface Dossie {
  resumo: string;
  markdown: string;
  conteudo: Record<string, unknown>;
}

export interface Analise {
  id: string;
  numero?: string | null;
  cartorio?: string | null;
  comarca?: string | null;
  uf?: string | null;
  status: 'RECEBIDA' | 'PROCESSANDO' | 'CONCLUIDA' | 'ERRO';
  erro?: string | null;
  imovel?: Imovel | null;
  proprietarios: Proprietario[];
  atos: Ato[];
  onus: Onus[];
  scores: Score[];
  dossie?: Dossie | null;
  createdAt: string;
}

export interface AnaliseResumo {
  id: string;
  numero?: string | null;
  comarca?: string | null;
  uf?: string | null;
  status: Analise['status'];
  createdAt: string;
  scores: { indice: string; valor: number; faixa: Faixa }[];
}
