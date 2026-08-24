import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ALL_ROLES } from '../rbac.constants';

export class SetRoleDto {
  @IsUUID('4', { message: 'O userId deve ser um UUID válido.' })
  @IsNotEmpty({ message: 'O userId é obrigatório.' })
  userId!: string;

  @IsIn(ALL_ROLES, {
    message: `A role deve ser uma das seguintes: ${ALL_ROLES.join(', ')}.`,
  })
  @IsString({ message: 'A role deve ser uma string.' })
  @IsNotEmpty({ message: 'A role é obrigatória.' })
  role!: string;
}
