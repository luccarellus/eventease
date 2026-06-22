import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateRegistrationDto {
  @IsOptional()
  @IsBoolean()
  presente?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'Data de confirmação inválida' })
  confirmado_em?: string;
}
