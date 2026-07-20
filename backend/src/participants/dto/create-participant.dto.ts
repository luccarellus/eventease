import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateParticipantDto {
  @IsString()
  @IsNotEmpty({ message: 'Token reCAPTCHA é obrigatório' })
  recaptchaToken!: string;

  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  nome!: string;

  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Telefone deve estar no formato E.164 (ex: +5511999998888)' })
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

  @IsString()
  @IsNotEmpty({ message: 'Código é obrigatório' })
  codigo!: string;

  @IsOptional()
  @IsBoolean()
  aceitou_termos?: boolean;

  @IsOptional()
  @IsString()
  termos_aceitos_em?: string;
}
