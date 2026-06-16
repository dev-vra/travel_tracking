import { Injectable, Logger } from '@nestjs/common';
import { OcrPort } from './ocr.port';
import { ResultadoOcr } from '../../domain/registral.types';

/**
 * Adapter de OCR mockado.
 * Nesta fase a entrada é o texto da matrícula (digitado/colado). Quando houver
 * upload de PDF/imagem, este adapter é substituído pelo BedrockOcrAdapter
 * (AWS Bedrock Nova, sa-east-1), preservando a interface OcrPort.
 */
@Injectable()
export class MockOcrAdapter implements OcrPort {
  private readonly logger = new Logger(MockOcrAdapter.name);

  async extrair(entrada: { texto?: string; arquivo?: Buffer }): Promise<ResultadoOcr> {
    if (entrada.texto && entrada.texto.trim().length > 0) {
      return {
        texto: this.normalizar(entrada.texto),
        confianca: 1,
        provedor: 'mock',
      };
    }

    if (entrada.arquivo) {
      this.logger.warn(
        'OCR de arquivo binário não suportado no provider "mock". Configure OCR_PROVIDER=bedrock.',
      );
    }

    throw new Error(
      'Nenhum texto fornecido. No provider "mock" envie o texto da matrícula.',
    );
  }

  /** Normalização leve: deskew/limpeza são responsabilidade do provider real. */
  private normalizar(texto: string): string {
    return texto
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
