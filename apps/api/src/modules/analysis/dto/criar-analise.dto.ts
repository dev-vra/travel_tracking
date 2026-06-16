import { IsOptional, IsString, MinLength } from 'class-validator';

export class CriarAnaliseDto {
  /** Texto da matrícula/transcrição (no provider mock é a entrada principal). */
  @IsString()
  @MinLength(20, { message: 'Forneça o texto da matrícula (mín. 20 caracteres).' })
  texto!: string;

  @IsOptional()
  @IsString()
  acervoId?: string;
}
