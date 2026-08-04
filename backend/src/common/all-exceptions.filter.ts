import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

function getPrismaErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Filtro global de exceções:
 * - Exceções HTTP do Nest (validação, guards, etc.) são repassadas intactas.
 * - Erros conhecidos do Prisma são mapeados para status HTTP adequados
 *   (P2002 -> 409, P2025 -> 404, P2023/P2010 -> 400).
 * - Qualquer outro erro vira 500 genérico (sem vazar detalhes internos).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    const prismaCode = getPrismaErrorCode(exception);
    if (prismaCode) {
      const mapping: Record<string, { status: HttpStatus; message: string }> = {
        P2002: { status: HttpStatus.CONFLICT, message: 'Registro duplicado.' },
        P2025: {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado.',
        },
        P2023: {
          status: HttpStatus.BAD_REQUEST,
          message: 'Identificador inválido.',
        },
        P2010: {
          status: HttpStatus.BAD_REQUEST,
          message: 'Requisição inválida.',
        },
      };

      const mapped = mapping[prismaCode];
      if (mapped) {
        response.status(mapped.status).json({
          statusCode: mapped.status,
          message: mapped.message,
          error: HttpStatus[mapped.status],
        });
        return;
      }
    }

    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
      error: 'Internal Server Error',
    });
  }
}
