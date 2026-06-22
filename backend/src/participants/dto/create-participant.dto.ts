import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateParticipantDto {
  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  nome!: string;

  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  telefone!: string;

  @IsString()
  @IsNotEmpty({ message: 'Cidade é obrigatória' })
  cidade!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escola é obrigatória' })
  escola!: string;

  @IsOptional()
  @IsString()
  gremio?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsBoolean()
  aceitou_termos?: boolean;

  @IsOptional()
  @IsString()
  termos_aceitos_em?: string;
}
