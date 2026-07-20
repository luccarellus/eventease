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
    throw new Error(`FATAL: variáveis de ambiente ausentes: ${names.join(' / ')}`);
  }
  return value;
}

export function requireJwtRefreshSecret(): string {
  const refreshSecret = getEnv('JWT_REFRESH_SECRET');
  if (refreshSecret) return refreshSecret;

  const accessSecret = requireEnv('JWT_SECRET');
  console.warn('[config] JWT_REFRESH_SECRET ausente; usando JWT_SECRET como fallback.');
  return accessSecret;
}
