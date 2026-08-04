import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateRegistrationDto {
  @IsOptional()
  @IsBoolean()
  presente?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'confirmado_em deve ser uma data ISO válida' })
  confirmado_em?: string;
}
