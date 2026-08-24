import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString({ message: 'O nome da organização deve ser uma string.' })
  @IsNotEmpty({ message: 'O nome da organização é obrigatório.' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  name!: string;

  @IsString({ message: 'O slug deve ser uma string.' })
  @IsNotEmpty({ message: 'O slug é obrigatório.' })
  @MinLength(2, { message: 'O slug deve ter no mínimo 2 caracteres.' })
  @MaxLength(50, { message: 'O slug deve ter no máximo 50 caracteres.' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'O slug deve conter apenas letras minúsculas, números e hífens.',
  })
  slug!: string;

  @IsString({ message: 'O domínio deve ser uma string.' })
  @IsOptional()
  @MaxLength(150, { message: 'O domínio deve ter no máximo 150 caracteres.' })
  domain?: string;

  @IsString({ message: 'A URL do logotipo deve ser uma string.' })
  @IsOptional()
  logoUrl?: string;

  @IsBoolean({ message: 'isActive deve ser um booleano.' })
  @IsOptional()
  isActive?: boolean;
}
