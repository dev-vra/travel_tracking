import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalysisService } from './analysis.service';
import { FILA_ANALISE, JobAnalisarData } from './analysis.constants';

/**
 * Worker BullMQ que consome a fila de análise (roda no mesmo processo Nest).
 * Processamento assíncrono conforme §9 (unitário em segundos).
 */
@Processor(FILA_ANALISE)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly analysis: AnalysisService) {
    super();
  }

  async process(job: Job<JobAnalisarData>): Promise<void> {
    this.logger.log(`Processando matrícula ${job.data.matriculaId} (job ${job.id})`);
    await this.analysis.processar(job.data.matriculaId);
  }
}
