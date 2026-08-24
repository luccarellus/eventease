import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { ALL_ROLES, Role } from '../rbac.constants';

export class CreateUserDto {
  @IsEmail({}, { message: 'Por favor, insira um e-mail válido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @IsString({ message: 'A senha deve ser uma string.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @MinLength(10, { message: 'A senha deve ter no mínimo 10 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      'A senha deve conter letra maiúscula, minúscula, número e caractere especial.',
  })
  password!: string;

  @IsString({ message: 'O nome completo deve ser uma string.' })
  @IsOptional()
  fullName?: string;

  @IsIn(ALL_ROLES, {
    message: `A role deve ser uma das seguintes: ${ALL_ROLES.join(', ')}.`,
  })
  @IsString({ message: 'A role deve ser uma string.' })
  @IsOptional()
  role?: Role;

  @IsUUID('4', { message: 'O tenantId deve ser um UUID válido.' })
  @IsOptional()
  tenantId?: string;
}
