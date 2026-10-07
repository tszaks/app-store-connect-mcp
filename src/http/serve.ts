#!/usr/bin/env node
// Runs the web API on this Mac: `npm run serve` (PORT defaults to 8787).
import { createServer } from 'node:http';

import { createApiFromEnv } from './app.js';

const handle = createApiFromEnv();
const port = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const response = await handle(
    new Request(`http://localhost:${port}${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`app-store-connect-api on http://127.0.0.1:${port}`));
