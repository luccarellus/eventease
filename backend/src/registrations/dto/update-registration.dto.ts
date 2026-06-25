import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRegistrationDto {
  @IsOptional()
  @IsBoolean()
  presente?: boolean;

  @IsOptional()
  @IsString()
  confirmado_em?: string;
}
