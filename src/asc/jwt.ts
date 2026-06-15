import { importPKCS8, SignJWT } from 'jose';

function normalizePrivateKey(raw: string): string {
  // Support env var strings with literal '\n'
  const normalized = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  return normalized.trim();
}

export type AscJwtConfig = {
  issuerId: string;
  keyId: string;
  privateKey: string;
  ttlSeconds: number;
};

export class AscJwtProvider {
  private config: AscJwtConfig;
  private cachedToken?: { token: string; expMs: number };

  constructor(config: AscJwtConfig) {
    this.config = {
      ...config,
      privateKey: normalizePrivateKey(config.privateKey),
    };
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    // Refresh when within 30s of expiry.
    if (this.cachedToken && this.cachedToken.expMs - now > 30_000) {
      return this.cachedToken.token;
    }

    const { issuerId, keyId, privateKey, ttlSeconds } = this.config;
    const alg = 'ES256';

    const key = await importPKCS8(privateKey, alg);
    const iat = Math.floor(now / 1000);
    const exp = iat + Math.max(60, ttlSeconds);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg, kid: keyId, typ: 'JWT' })
      .setIssuer(issuerId)
      .setAudience('appstoreconnect-v1')
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(key);

    this.cachedToken = { token, expMs: exp * 1000 };
    return token;
  }
}
