import { gunzipSync } from 'node:zlib';

import { getBoolEnv } from './env.js';

export type AscHttpConfig = {
  baseUrl: string; // e.g. https://api.appstoreconnect.apple.com/v1
  getToken: () => Promise<string>;
};

type Json = any;

function redactHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  const pairs: Array<[string, string]> = Array.isArray(h)
    ? h
    : h instanceof Headers
      ? Array.from(h.entries())
      : Object.entries(h);
  for (const [k, v] of pairs) {
    if (/authorization/i.test(k)) out[k] = '[REDACTED]';
    else out[k] = String(v);
  }
  return out;
}

function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) params.append(k, String(item));
    } else if (typeof v === 'object') {
      // Allow passing nested objects by JSON encoding them explicitly.
      params.set(k, JSON.stringify(v));
    } else {
      params.set(k, String(v));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export class AscHttpClient {
  private config: AscHttpConfig;
  private debug: boolean;

  constructor(config: AscHttpConfig) {
    this.config = config;
    this.debug = getBoolEnv('ASC_DEBUG', false);
  }

  async request(args: {
    method: string;
    path: string; // must start with '/'
    query?: Record<string, unknown>;
    body?: Json;
    accept?: string;
  }): Promise<{ status: number; headers: Record<string, string>; json: Json }> {
    const raw = await this.requestBuffer(args);
    const text = raw.body.toString('utf8');
    const json = text ? safeJsonParse(text) : null;
    return { status: raw.status, headers: raw.headers, json };
  }

  async requestText(args: {
    method: string;
    path: string; // must start with '/'
    query?: Record<string, unknown>;
    body?: Json;
    accept?: string;
  }): Promise<{ status: number; headers: Record<string, string>; text: string; isCompressed: boolean }> {
    const raw = await this.requestBuffer(args);
    return {
      status: raw.status,
      headers: raw.headers,
      text: raw.body.toString('utf8'),
      isCompressed: raw.isCompressed,
    };
  }

  private async requestBuffer(args: {
    method: string;
    path: string; // must start with '/'
    query?: Record<string, unknown>;
    body?: Json;
    accept?: string;
  }): Promise<{ status: number; headers: Record<string, string>; body: Buffer; isCompressed: boolean }> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const path = args.path.startsWith('/') ? args.path : `/${args.path}`;
    const url = `${baseUrl}${path}${toQueryString(args.query)}`;

    const token = await this.config.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: args.accept ?? 'application/json',
    };
    let body: string | undefined;
    if (args.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(args.body);
    }

    const res = await this.fetchWithRetry(url, {
      method: args.method,
      headers,
      body,
    });

    const bytes = Buffer.from(await res.arrayBuffer());
    const outHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (outHeaders[k] = v));

    if (!res.ok) {
      const text = bytes.toString('utf8');
      const json = text ? safeJsonParse(text) : null;
      const msg = (json && (json.errors?.[0]?.detail || json.errors?.[0]?.title)) || res.statusText;
      throw new Error(`ASC HTTP ${res.status}: ${msg}`);
    }

    const isCompressed = looksLikeGzip(bytes) || headerHintsGzip(outHeaders);
    const bodyBuffer = looksLikeGzip(bytes) ? gunzipSync(bytes) : bytes;

    return { status: res.status, headers: outHeaders, body: bodyBuffer, isCompressed };
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const maxAttempts = 5;
    let attempt = 0;
    let lastErr: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        if (this.debug) {
          // Never log auth header contents.
          console.error('[ASC] request', {
            url,
            method: init.method,
            headers: redactHeaders(init.headers as HeadersInit),
            attempt,
          });
        }

        const res = await fetch(url, init);

        if (res.status === 429 || res.status >= 500) {
          const waitMs = backoffMs(attempt);
          if (this.debug) console.error('[ASC] retry', { status: res.status, waitMs });
          await sleep(waitMs);
          continue;
        }

        return res;
      } catch (e) {
        lastErr = e;
        const waitMs = backoffMs(attempt);
        if (this.debug) console.error('[ASC] fetch error retry', { waitMs });
        await sleep(waitMs);
      }
    }

    throw new Error(`ASC request failed after retries: ${String((lastErr as any)?.message ?? lastErr)}`);
  }
}

function looksLikeGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function headerHintsGzip(headers: Record<string, string>): boolean {
  const contentType = headers['content-type'] ?? '';
  const disposition = headers['content-disposition'] ?? '';
  return /gzip|x-gzip|a-gzip/i.test(contentType) || /\.gz\b/i.test(disposition);
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const base = Math.min(10_000, 500 * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}
