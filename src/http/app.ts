import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createHash, timingSafeEqual } from 'node:crypto';

import { getEnv, getIntEnv, requireEnv, resolvePrivateKey } from '../asc/env.js';
import { AscHttpClient } from '../asc/http.js';
import { AscJwtProvider } from '../asc/jwt.js';
import type { ToolDef } from '../tools/registry.js';
import { buildTools } from '../tools/tools.js';

// The same tools as the MCP server, served as a plain web API for agents that
// can only call HTTP (e.g. Instinct):
//   GET  /               service info (no token)
//   GET  /openapi.json   OpenAPI 3.1 description (no token; ?tools=a,b to limit)
//   GET  /tools          tool names + descriptions (token)
//   POST /tools/{name}   call a tool; JSON body = the tool's arguments (token)
//   ANY  /mcp            remote MCP endpoint, Streamable HTTP, stateless (token)

export const VERSION = '0.7.0';

// Need this Mac (Xcode, local files, Safari), so they are not served.
export const LOCAL_ONLY = new Set(['asc_upload_build', 'asc_upload_asset', 'asc_prepare_expedite']);

export type Token = { label: string; hash: Buffer; canWrite: boolean };

const sha256 = (s: string) => createHash('sha256').update(s).digest();

// "instinct:SECRET,ci:OTHER" -> tokens. Labels appear in logs, secrets never do.
export function parseTokens(value: string | undefined, canWrite: boolean): Token[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(':');
      const label = i > 0 ? part.slice(0, i) : 'token';
      const secret = i > 0 ? part.slice(i + 1) : part;
      if (secret.length < 24) throw new Error(`API token '${label}' must be at least 24 characters`);
      return { label, hash: sha256(secret), canWrite };
    });
}

function findToken(tokens: Token[], header: string | null): Token | undefined {
  const m = (header ?? '').match(/^Bearer\s+(.+)$/i);
  if (!m) return undefined;
  const hash = sha256(m[1].trim());
  return tokens.find((t) => timingSafeEqual(t.hash, hash));
}

const READ_ONLY_MESSAGE = (label: string) =>
  `Token '${label}' is read-only. It can only list/get, GET with asc_request, and download. Writes need a write-enabled token.`;

type RunOutcome =
  | { kind: 'denied'; message: string }
  | { kind: 'ok'; out: string }
  | { kind: 'error'; message: string };

// The one place a tool call is checked, run, and logged. REST and MCP both use it.
async function runTool(
  tool: ToolDef,
  args: Record<string, unknown>,
  token: Token,
  log: WriteLog,
  via?: 'mcp',
): Promise<RunOutcome> {
  const write = !isReadCall(tool, args);
  const entry = {
    event: 'write',
    token: token.label,
    tool: tool.name,
    action: args.action ?? args.method ?? null,
    id: args.id ?? null,
    reason: args.reason ?? null,
    ...(via ? { via } : {}),
  };
  if (write && !token.canWrite) {
    log({ at: new Date().toISOString(), ...entry, ok: false, error: 'denied: read-only token' });
    return { kind: 'denied', message: READ_ONLY_MESSAGE(token.label) };
  }
  const started = Date.now();
  try {
    const out = await tool.handler(args);
    if (write) log({ at: new Date().toISOString(), ...entry, ok: true, ms: Date.now() - started });
    return { kind: 'ok', out };
  } catch (e: any) {
    const message = e?.message ?? String(e);
    if (write) log({ at: new Date().toISOString(), ...entry, ok: false, error: message.slice(0, 300) });
    return { kind: 'error', message };
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } });

const MAX_BODY_BYTES = 1_000_000;
const READ_ACTIONS = new Set(['list', 'get']);
const READ_PREFIXES = ['asc_list_', 'asc_get_', 'asc_download_'];
const READ_TOOLS = new Set(['asc_ping', 'asc_analytics_overview_summary']);

// A read token may only make calls on this allowlist. It does not depend on how
// each tool checks 'confirm', so a tool bug cannot turn a read token into a writer.
export function isReadCall(tool: ToolDef, args: Record<string, unknown>): boolean {
  if ('confirm' in args && args.confirm !== false) return false;
  const actions = (tool.inputSchema as any)?.properties?.action?.enum;
  if (Array.isArray(actions)) return typeof args.action === 'string' && READ_ACTIONS.has(args.action);
  if (tool.name === 'asc_request') return typeof args.method === 'string' && args.method.toUpperCase() === 'GET';
  return READ_TOOLS.has(tool.name) || READ_PREFIXES.some((p) => tool.name.startsWith(p));
}

function errorStatus(message: string): number {
  const m = message.match(/^ASC HTTP (\d{3})/);
  if (m) return Number(m[1]) >= 500 ? 502 : Number(m[1]);
  return 400;
}

export function openApi(tools: ToolDef[], baseUrl: string): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const t of tools) {
    paths[`/tools/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: t.description.split(/(?<=\.)\s/)[0].slice(0, 120),
        description: t.description,
        security: [{ bearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: t.inputSchema } } },
        responses: {
          '200': { description: 'Tool result', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { description: 'Bad arguments or refused write' },
          '401': { description: 'Missing or wrong token' },
          '403': { description: 'Token is read-only' },
          '404': { description: 'Unknown tool, or App Store Connect returned 404' },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'App Store Connect API (agent tools)',
      version: VERSION,
      description:
        'Call any tool with POST /tools/{name} and a JSON body of its arguments. Writes (create/update/delete) need "confirm": true, a "reason", and a write-enabled token.',
    },
    servers: [{ url: baseUrl }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    paths,
  };
}

type WriteLog = (line: Record<string, unknown>) => void;

export function createApi(
  allTools: ToolDef[],
  tokens: Token[],
  log: WriteLog = (line) => console.log(JSON.stringify(line)),
): (req: Request) => Promise<Response> {
  const tools = allTools.filter((t) => !LOCAL_ONLY.has(t.name));
  const byName = new Map(tools.map((t) => [t.name, t]));
  if (!tokens.length) throw new Error('No API tokens configured (ASC_API_READ_TOKENS / ASC_API_WRITE_TOKENS)');

  // Stateless remote MCP: a fresh server + transport per request, no sessions.
  const handleMcp = async (req: Request, token: Token): Promise<Response> => {
    const server = new Server({ name: 'app-store-connect-mcp', version: VERSION }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as any })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (r) => {
      const tool = byName.get(r.params.name);
      if (!tool) return { content: [{ type: 'text' as const, text: `Unknown tool: ${r.params.name}` }], isError: true };
      const args = (r.params.arguments ?? {}) as Record<string, unknown>;
      const outcome = await runTool(tool, args, token, log, 'mcp');
      if (outcome.kind === 'ok') return { content: [{ type: 'text' as const, text: outcome.out }] };
      return { content: [{ type: 'text' as const, text: outcome.message }], isError: true };
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(req);
  };

  return async (req) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '').replace(/\/+$/, '') || '/';

    if (req.method === 'GET' && path === '/') {
      return json(200, { name: 'app-store-connect-api', version: VERSION, tools: tools.length, docs: '/openapi.json', mcp: '/mcp' });
    }
    if (req.method === 'GET' && path === '/openapi.json') {
      const only = url.searchParams.get('tools');
      const wanted = only ? new Set(only.split(',').map((s) => s.trim())) : undefined;
      return json(200, openApi(wanted ? tools.filter((t) => wanted.has(t.name)) : tools, url.origin));
    }

    const token = findToken(tokens, req.headers.get('authorization'));
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing or wrong token. Send Authorization: Bearer <token>.' }, null, 2),
        { status: 401, headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' } },
      );
    }

    if (path === '/mcp') return handleMcp(req, token);

    if (req.method === 'GET' && path === '/tools') {
      return json(200, { ok: true, tools: tools.map((t) => ({ name: t.name, description: t.description })) });
    }

    const m = path.match(/^\/tools\/([a-z0-9_]+)$/);
    if (req.method !== 'POST' || !m) return json(404, { ok: false, error: `No route ${req.method} ${path}` });
    const tool = byName.get(m[1]);
    if (!tool) {
      const hint = LOCAL_ONLY.has(m[1]) ? " It only works in the MCP server on Tyler's Mac." : '';
      return json(404, { ok: false, error: `Unknown tool '${m[1]}'.${hint}` });
    }

    let args: Record<string, unknown>;
    try {
      if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw new Error('body too large');
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) throw new Error('body too large');
      const parsed = text ? JSON.parse(text) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be a JSON object');
      args = parsed as Record<string, unknown>;
    } catch (e: any) {
      return json(400, { ok: false, error: `Invalid JSON body: ${e?.message ?? e}` });
    }

    const outcome = await runTool(tool, args, token, log);
    if (outcome.kind === 'denied') return json(403, { ok: false, error: outcome.message });
    if (outcome.kind === 'error') return json(errorStatus(outcome.message), { ok: false, error: outcome.message });
    let result: unknown = outcome.out;
    try {
      result = JSON.parse(outcome.out);
    } catch {
      // plain-text tool output (e.g. performance data) stays a string
    }
    return json(200, { ok: true, result });
  };
}

// Builds the API from environment variables (used by the local server and Vercel).
export function createApiFromEnv(): (req: Request) => Promise<Response> {
  const jwt = new AscJwtProvider({
    issuerId: requireEnv('ASC_ISSUER_ID'),
    keyId: requireEnv('ASC_KEY_ID'),
    privateKey: resolvePrivateKey(),
    ttlSeconds: getIntEnv('ASC_TOKEN_TTL_SECONDS', 600),
  });
  const asc = new AscHttpClient({
    baseUrl: (getEnv('ASC_BASE_URL') ?? 'https://api.appstoreconnect.apple.com/v1').replace(/\/+$/, ''),
    getToken: () => jwt.getToken(),
  });
  const tokens = [...parseTokens(getEnv('ASC_API_READ_TOKENS'), false), ...parseTokens(getEnv('ASC_API_WRITE_TOKENS'), true)];
  return createApi(buildTools(asc), tokens);
}
