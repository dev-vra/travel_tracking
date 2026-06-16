// Tipos de domínio que trafegam entre os módulos do pipeline (M1 → M6).
// Independentes do Prisma para manter as camadas desacopladas.

import {
  NaturezaAto,
  TipoAto,
  TipoImovel,
  TipoOnus,
  TipoPessoa,
} from '@prisma/client';

/** Saída do M1 (OCR multimodal). */
export interface ResultadoOcr {
  texto: string;
  // metadados de confiança / layout reconstruído (mock por enquanto)
  confianca: number;
  provedor: string;
}

/** Pessoa identificada na qualificação. */
export interface PessoaParse {
  nome: string;
  documento?: string;
  tipoPessoa: TipoPessoa;
  estadoCivil?: string;
  fracao?: string;
}

/** Ato registral estruturado (saída do M2). */
export interface AtoParse {
  tipo: TipoAto;
  ordem: number;
  codigo: string; // "R-1", "Av-2"
  natureza: NaturezaAto;
  data?: Date;
  conteudo: string;
  // partes envolvidas no ato (ex: adquirentes em uma compra e venda)
  pessoas: PessoaParse[];
  // para CANCELAMENTO: código do ato cancelado
  cancelaCodigo?: string;
  // dados de ônus quando aplicável
  credor?: string;
  valor?: number;
}

/** Saída completa do M2 (Parser Registral). */
export interface MatriculaParse {
  numero?: string;
  cartorio?: string;
  comarca?: string;
  uf?: string;
  imovel: {
    tipo: TipoImovel;
    descricao?: string;
    areaM2?: number;
    logradouro?: string;
    municipio?: string;
    uf?: string;
  };
  proprietarioInicial?: PessoaParse[];
  atos: AtoParse[];
}

/** Ônus consolidado (saída do M3). */
export interface OnusEstado {
  tipo: TipoOnus;
  ativo: boolean;
  credor?: string;
  valor?: number;
  origemAto: string;
}

/** Estado jurídico líquido (saída do M3 — Interpretação Jurídica). */
export interface EstadoJuridico {
  titularesAtuais: (PessoaParse & { origemAto: string })[];
  onus: OnusEstado[];
  indisponivel: boolean;
  clausulasRestritivas: string[];
  disponivel: boolean;
  // linha do tempo da cadeia dominial (apenas transmissões)
  cadeiaDominial: {
    codigo: string;
    data?: Date;
    natureza: NaturezaAto;
    titulares: string[];
  }[];
  alertas: string[];
}

/** Um fator explicável de um índice. */
export interface DriverScore {
  fator: string;
  pesoMax: number;
  pontos: number;
  nota: string;
}

/** Resultado de um índice (saída do M5). */
export interface ResultadoIndice {
  indice:
    | 'NEGOCIABILIDADE'
    | 'REGULARIDADE_REGISTRAL'
    | 'RISCO_LITIGIO';
  valor: number; // 0–100
  faixa: 'VERDE' | 'AMARELO' | 'VERMELHO';
  drivers: DriverScore[];
}
