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
