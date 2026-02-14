#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { requireEnv, getEnv, getIntEnv } from './asc/env.js';
import { AscJwtProvider } from './asc/jwt.js';
import { AscHttpClient } from './asc/http.js';
import { buildTools } from './tools/tools.js';

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid '${field}'`);
  }
  return value.trim();
}

const issuerId = requireEnv('ASC_ISSUER_ID');
const keyId = requireEnv('ASC_KEY_ID');
const privateKey = requireEnv('ASC_PRIVATE_KEY');

const baseUrl = (getEnv('ASC_BASE_URL') ?? 'https://api.appstoreconnect.apple.com/v1')
  .replace(/\/+$/, '');
const ttlSeconds = getIntEnv('ASC_TOKEN_TTL_SECONDS', 600);

const jwt = new AscJwtProvider({
  issuerId,
  keyId,
  privateKey,
  ttlSeconds,
});

const asc = new AscHttpClient({
  baseUrl,
  getToken: () => jwt.getToken(),
});

const toolDefs = buildTools(asc);

const server = new Server(
  { name: 'app-store-connect-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefs.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  try {
    const def = toolDefs.find((t) => t.name === req.params.name);
    if (!def) return textResult(`Unknown tool: ${req.params.name}`);
    const out = await def.handler(args);
    return textResult(out);
  } catch (err: any) {
    return textResult(`Error: ${err?.message ?? String(err)}`);
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

