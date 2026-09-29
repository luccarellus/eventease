const API_URL = import.meta.env.VITE_API_URL || '/api';

export const TENANT_STORAGE_KEY = 'eventease_tenant_id';

export function getActiveTenantId(): string | null {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveTenantId(tenantId: string | null) {
  try {
    if (tenantId) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY);
    }
  } catch {
    // Ignora erro de localStorage
  }
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_URL}${endpoint}`;

  const currentTenantId = getActiveTenantId();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(currentTenantId ? { 'x-tenant-id': currentTenantId } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  return response;
};

/**
 * Extrai a mensagem de erro do corpo JSON da resposta.
 * NestJS retorna `message` como string ou array de strings (validação).
 */
export async function extractApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(' ') : data.message;
    }
  } catch {
    // corpo não é JSON válido — usa o fallback
  }
  return fallback;
}

export const api = {
  get: (endpoint: string, options?: RequestInit) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, data?: unknown, options?: RequestInit) =>
    apiFetch(endpoint, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  patch: (endpoint: string, data?: unknown, options?: RequestInit) =>
    apiFetch(endpoint, {
      ...options,
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  delete: (endpoint: string, options?: RequestInit) => apiFetch(endpoint, { ...options, method: 'DELETE' }),
};
