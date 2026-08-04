import { Injectable, Logger } from '@nestjs/common';

export interface NevaProUserPayload {
  email: string;
  fullName?: string;
  city?: string;
  school?: string;
  gremio?: string;
}

@Injectable()
export class NevaProService {
  private readonly logger = new Logger(NevaProService.name);

  /**
   * Envia os dados do usuário/participante para o webhook do NevaPro.
   * Falhas são apenas logadas — nunca quebram o fluxo principal.
   */
  async sync(userData: NevaProUserPayload): Promise<void> {
    const webhookUrl = process.env.NEVAPRO_WEBHOOK_URL;
    const webhookSecret = process.env.NEVAPRO_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      this.logger.warn(
        '[NevaPro Sync] Variáveis NEVAPRO_WEBHOOK_URL ou NEVAPRO_WEBHOOK_SECRET não configuradas.',
      );
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookSecret,
        },
        body: JSON.stringify({
          email: userData.email,
          name: userData.fullName,
          city: userData.city,
          school: userData.school,
          gremio: userData.gremio,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `[NevaPro Sync] Webhook respondeu HTTP ${response.status}.`,
        );
        return;
      }

      const result: unknown = await response.json();
      this.logger.log(`[NevaPro Sync] Resultado: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error(
        '[NevaPro Sync] Erro ao sincronizar com NevaPro:',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
