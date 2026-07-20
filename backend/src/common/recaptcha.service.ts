import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
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
  async verify(token: string | undefined, expectedAction: string, remoteIp?: string): Promise<void> {
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
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`reCAPTCHA HTTP ${response.status}`);
      result = (await response.json()) as RecaptchaResponse;
    } catch {
      throw new ServiceUnavailableException('Não foi possível validar o reCAPTCHA. Tente novamente.');
    }

    const minimumScore = Number(getEnv('RECAPTCHA_MIN_SCORE') ?? '0.5');
    const validScore = typeof result.score === 'number' && result.score >= minimumScore;
    if (!result.success || result.action !== expectedAction || !validScore) {
      throw new ForbiddenException('Verificação reCAPTCHA recusada. Tente novamente.');
    }
  }
}
