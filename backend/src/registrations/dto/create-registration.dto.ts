import { IsBoolean, IsOptional, IsUUID, IsString } from 'class-validator';

export class CreateRegistrationDto {
  @IsString()
  recaptchaToken!: string;

  @IsUUID('4', { message: 'ID do evento inválido' })
  eventoId!: string;

  @IsUUID('4', { message: 'ID do participante inválido' })
  participanteId!: string;

  @IsOptional()
  @IsBoolean()
  presente?: boolean;

  @IsOptional()
  @IsString()
  confirmado_em?: string;
}
