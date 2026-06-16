import { ResultadoOcr } from '../../domain/registral.types';

/**
 * Porta de OCR multimodal (M1).
 * Abstrai o provedor (Bedrock Nova, Tesseract, etc.) para que o pipeline
 * não dependa de credenciais AWS nesta fase.
 */
export const OCR_PORT = Symbol('OCR_PORT');

export interface OcrPort {
  /**
   * Recebe a fonte (texto já digitado, ou no futuro um buffer de PDF/imagem)
   * e devolve o texto reconstruído.
   */
  extrair(entrada: { texto?: string; arquivo?: Buffer }): Promise<ResultadoOcr>;
}
