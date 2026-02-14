function cleanEnv(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

export function getEnv(name: string): string | undefined {
  return cleanEnv(process.env[name]);
}

export function requireEnv(name: string): string {
  const v = getEnv(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getBoolEnv(name: string, defaultValue = false): boolean {
  const v = getEnv(name);
  if (!v) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
}

export function getIntEnv(name: string, defaultValue: number): number {
  const v = getEnv(name);
  if (!v) return defaultValue;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
}

