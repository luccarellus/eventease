import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class ParticipantEmailLookupDto {
  @IsEmail({}, { message: 'Email inválido.' })
  @MaxLength(254)
  email!: string;
}

export class ParticipantCodeLookupDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Código inválido.' })
  code!: string;
}
