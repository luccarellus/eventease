/**
 * Detecta erros de rede/banco (DNS, conexão recusada, timeout) que devem
 * ser convertidos em 503 (Service Unavailable) em vez de 500 genérico.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // NOTA: evite matches amplos como 'not found' — eles mascaram erros legítimos
  // (ex.: 'User not found') como indisponibilidade de serviço.
  return (
    error.message.includes('fetch failed') ||
    error.message.includes('getaddrinfo ENOTFOUND') ||
    error.message.includes('getaddrinfo') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('tenant/user')
  );
}
