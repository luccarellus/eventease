import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SetRoleDto {
  @IsUUID('4', { message: 'O userId deve ser um UUID válido.' })
  @IsNotEmpty({ message: 'O userId é obrigatório.' })
  userId!: string;

  @IsString({ message: 'A role deve ser uma string.' })
  @IsNotEmpty({ message: 'A role é obrigatória.' })
  role!: string;
}
