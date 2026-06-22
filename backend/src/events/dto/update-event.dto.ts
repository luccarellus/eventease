import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Título deve ter pelo menos 3 caracteres' })
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data inválida' })
  data?: string;

  @IsOptional()
  @IsString()
  local?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}
