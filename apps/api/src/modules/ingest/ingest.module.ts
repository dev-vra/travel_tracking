import { Module } from '@nestjs/common';
import { OCR_PORT } from './ocr.port';
import { MockOcrAdapter } from './mock-ocr.adapter';

/**
 * M1 — Ingestão & OCR Multimodal.
 * Seleciona o adapter de OCR conforme OCR_PROVIDER.
 */
@Module({
  providers: [
    MockOcrAdapter,
    {
      provide: OCR_PORT,
      useFactory: (mock: MockOcrAdapter) => {
        // Quando OCR_PROVIDER=bedrock, retornar o BedrockOcrAdapter aqui.
        return mock;
      },
      inject: [MockOcrAdapter],
    },
  ],
  exports: [OCR_PORT],
})
export class IngestModule {}
