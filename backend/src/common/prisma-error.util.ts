import { ConflictException } from '@nestjs/common';

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;
}

export function throwUniqueConstraintError(error: unknown, message: string): never {
  if (hasPrismaCode(error, 'P2002')) {
    throw new ConflictException(message);
  }

  throw error as Error;
}
