import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestModule } from '../ingest/ingest.module';
import { ParserService } from '../parser/parser.service';
import { JuridicalService } from '../juridical/juridical.service';
import { ScoreService } from '../score/score.service';
import { DossierService } from '../dossier/dossier.service';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { AnalysisProcessor } from './analysis.processor';
import { FILA_ANALISE } from './analysis.constants';

@Module({
  imports: [IngestModule, BullModule.registerQueue({ name: FILA_ANALISE })],
  controllers: [AnalysisController],
  providers: [
    ParserService,
    JuridicalService,
    ScoreService,
    DossierService,
    AnalysisService,
    AnalysisProcessor,
  ],
})
export class AnalysisModule {}
