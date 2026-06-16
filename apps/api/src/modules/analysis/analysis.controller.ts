import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { CriarAnaliseDto } from './dto/criar-analise.dto';

@Controller('analises')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  /** Cria a análise (upload de texto) e enfileira o pipeline. */
  @Post()
  criar(@Body() dto: CriarAnaliseDto) {
    return this.analysis.criar(dto);
  }

  @Get()
  listar() {
    return this.analysis.listar();
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.analysis.obter(id);
  }
}
