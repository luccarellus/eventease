/**
 * Chaves e TTLs centralizados do cache Redis com suporte a Multi-Tenancy.
 * O RedisService opera em modo fallback: se o Redis estiver fora,
 * get/set retornam null e a aplicação segue funcionando sem cache.
 */
export const CACHE_KEYS = {
  eventsPublished: (tenantId: string) => `${tenantId}:events:published`,
  eventsAll: (tenantId: string) => `${tenantId}:events:all`,
  eventById: (tenantId: string, id: string) => `${tenantId}:event:${id}`,
  participantByEmail: (tenantId: string, email: string) =>
    `${tenantId}:participant:email:${email.trim().toLowerCase()}`,
  participantByCode: (tenantId: string, code: string) =>
    `${tenantId}:participant:code:${code.trim().toUpperCase()}`,
  participantsCount: (tenantId: string) => `${tenantId}:metrics:participants-count`,
  registrationsByEvent: (tenantId: string, eventoId: string) =>
    `${tenantId}:registrations:event:${eventoId}`,
  registrationCheck: (tenantId: string, eventoId: string, participanteId: string) =>
    `${tenantId}:registration:check:${eventoId}:${participanteId}`,
} as const;

export const CACHE_TTL = {
  /** Lista pública de eventos — muda raramente (publicação/edição) */
  events: 60,
  /** Lista admin de eventos — TTL menor para refletir publicações rápido */
  eventsAdmin: 30,
  /** Recuperação de credencial (email/código) — TTL curto para não servir dado velho */
  participantLookup: 60,
  /** Contador do dashboard (stats) */
  participantsCount: 30,
  /** Inscritos do evento selecionado no dashboard */
  registrationsByEvent: 30,
} as const;

/** Faz parse seguro de um valor vindo do Redis; retorna null se ausente/corrompido. */
export function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
