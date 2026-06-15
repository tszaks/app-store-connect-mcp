import { readFileSync } from 'node:fs';

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

export function resolvePrivateKey(
  env: Record<string, string | undefined> = process.env,
  readFile: (path: string, encoding: BufferEncoding) => string | Buffer = readFileSync,
): string {
  const inline = cleanEnv(env.ASC_PRIVATE_KEY);
  if (inline) return inline;

  const file = cleanEnv(env.ASC_PRIVATE_KEY_FILE);
  if (file) {
    const contents = String(readFile(file, 'utf8'));
    if (!contents.trim()) throw new Error(`ASC_PRIVATE_KEY_FILE is empty: ${file}`);
    return contents;
  }

  throw new Error('Missing required env var: ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_FILE');
}
