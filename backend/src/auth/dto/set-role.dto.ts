import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

// Roles permitidas no sistema
const VALID_ROLES = ['admin', 'user'] as const;

export class SetRoleDto {
  @IsUUID('4', { message: 'O userId deve ser um UUID válido.' })
  @IsNotEmpty({ message: 'O userId é obrigatório.' })
  userId!: string;

  @IsIn(VALID_ROLES, {
    message: `A role deve ser uma das seguintes: ${VALID_ROLES.join(', ')}.`,
  })
  @IsString({ message: 'A role deve ser uma string.' })
  @IsNotEmpty({ message: 'A role é obrigatória.' })
  role!: string;
}
