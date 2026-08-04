import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateRegistrationDto {
  @IsString()
  @IsNotEmpty()
  recaptchaToken!: string;

  @IsUUID('4', { message: 'ID do evento inválido' })
  eventoId!: string;

  @IsUUID('4', { message: 'ID do participante inválido' })
  participanteId!: string;
}
