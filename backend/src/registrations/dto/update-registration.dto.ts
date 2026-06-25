import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateRegistrationDto {
  @IsOptional()
  @IsBoolean()
  presente?: boolean;
}
