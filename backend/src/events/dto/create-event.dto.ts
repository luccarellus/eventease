import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3, { message: 'Título deve ter pelo menos 3 caracteres' })
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString({}, { message: 'Data inválida' })
  data!: string;

  @IsString()
  @IsNotEmpty({ message: 'Local é obrigatório' })
  local!: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}
