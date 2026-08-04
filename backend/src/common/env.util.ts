export function getEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function requireEnv(...names: string[]): string {
  const value = getEnv(...names);
  if (!value) {
    throw new Error(
      `FATAL: variáveis de ambiente ausentes: ${names.join(' / ')}`,
    );
  }
  return value;
}

/**
 * Remove a senha de uma connection string antes de exibi-la em logs.
 * postgresql://user:password@host/db -> postgresql://user:***@host/db
 */
export function maskConnectionString(connStr: string): string {
  try {
    return connStr.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  } catch {
    return '<invalid-connection-string>';
  }
}

export function requireJwtRefreshSecret(): string {
  const refreshSecret = getEnv('JWT_REFRESH_SECRET');
  if (refreshSecret) return refreshSecret;

  const accessSecret = getEnv('JWT_SECRET');
  if (accessSecret) {
    console.warn(
      '[config] JWT_REFRESH_SECRET ausente; usando JWT_SECRET como fallback.',
    );
    return accessSecret;
  }

  throw new Error(
    'FATAL: variáveis de ambiente ausentes: JWT_REFRESH_SECRET e JWT_SECRET.',
  );
}
