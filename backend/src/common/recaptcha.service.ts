import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getEnv, requireEnv } from './env.util';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  async verify(
    token: string | undefined,
    expectedAction: string,
    remoteIp?: string,
  ): Promise<void> {
    if (!token) {
      throw new ForbiddenException('Confirmação reCAPTCHA obrigatória.');
    }

    const body = new URLSearchParams({
      secret: requireEnv('RECAPTCHA_SECRET_KEY'),
      response: token,
    });
    if (remoteIp) body.set('remoteip', remoteIp);

    let result: RecaptchaResponse;
    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) throw new Error(`reCAPTCHA HTTP ${response.status}`);
      result = (await response.json()) as RecaptchaResponse;
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível validar o reCAPTCHA. Tente novamente.',
      );
    }

    const minimumScore = Number(getEnv('RECAPTCHA_MIN_SCORE') ?? '0.5');
    const validScore =
      typeof result.score === 'number' && result.score >= minimumScore;
    if (!result.success || result.action !== expectedAction || !validScore) {
      // Loga os detalhes da resposta do Google para diagnóstico em produção
      // (ex.: invalid-input-secret, hostname-mismatch, timeout-or-duplicate)
      this.logger.warn(
        `reCAPTCHA recusado: action=${result.action ?? 'n/a'} score=${result.score ?? 'n/a'} hostname=${result.hostname ?? 'n/a'} erros=${JSON.stringify(result['error-codes'] ?? [])}`,
      );
      throw new ForbiddenException(
        'Verificação reCAPTCHA recusada. Tente novamente.',
      );
    }
  }
}
