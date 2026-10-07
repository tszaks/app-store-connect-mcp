import test from 'node:test';
import assert from 'node:assert/strict';

import { createApi, parseTokens, LOCAL_ONLY } from '../dist/http/app.js';

const READ = 'r'.repeat(32);
const WRITE = 'w'.repeat(32);

function setup() {
  const calls = [];
  const logs = [];
  const tools = [
    { name: 'asc_customer_reviews', description: 'Reviews. More text.', inputSchema: { type: 'object', properties: { action: { enum: ['list', 'get', 'delete'] } } }, handler: async (a) => (calls.push(a), JSON.stringify({ data: [1, 2] })) },
    { name: 'asc_get_performance_data', description: 'Perf.', inputSchema: { type: 'object' }, handler: async () => 'plain text' },
    { name: 'asc_request', description: 'Any.', inputSchema: { type: 'object' }, handler: async (a) => (calls.push(a), '{}') },
    { name: 'asc_get_fails', description: 'Fails.', inputSchema: { type: 'object' }, handler: async () => { throw new Error('ASC HTTP 404: no such thing'); } },
    { name: 'asc_upload_build', description: 'Local.', inputSchema: { type: 'object' }, handler: async () => 'should never run' },
  ];
  const tokens = [...parseTokens(`instinct:${READ}`, false), ...parseTokens(`admin:${WRITE}`, true)];
  const api = createApi(tools, tokens, (l) => logs.push(l));
  const call = (path, { token, body, method = 'POST' } = {}) =>
    api(new Request(`https://x.test${path}`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: method === 'GET' ? undefined : body === undefined ? undefined : JSON.stringify(body),
    }));
  return { call, calls, logs };
}

test('service info and OpenAPI need no token; OpenAPI lists served tools only', async () => {
  const { call } = setup();
  assert.equal((await call('/', { method: 'GET' })).status, 200);
  const spec = await (await call('/openapi.json', { method: 'GET' })).json();
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.paths['/tools/asc_customer_reviews'].post);
  assert.equal(spec.paths['/tools/asc_upload_build'], undefined);
  assert.equal(spec.servers[0].url, 'https://x.test');
  const only = await (await call('/openapi.json?tools=asc_get_fails', { method: 'GET' })).json();
  assert.deepEqual(Object.keys(only.paths), ['/tools/asc_get_fails']);
});

test('tool calls need a valid token', async () => {
  const { call, calls } = setup();
  assert.equal((await call('/tools/asc_customer_reviews', { body: {} })).status, 401);
  assert.equal((await call('/tools/asc_customer_reviews', { token: 'x'.repeat(32), body: {} })).status, 401);
  assert.equal((await call('/tools', { method: 'GET' })).status, 401);
  assert.equal(calls.length, 0);
});

test('read token can read; result JSON is parsed; /api prefix works', async () => {
  const { call, calls } = setup();
  const res = await call('/tools/asc_customer_reviews', { token: READ, body: { action: 'list' } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: { data: [1, 2] } });
  assert.equal((await call('/api/tools/asc_customer_reviews', { token: READ, body: { action: 'get', id: 'r1' } })).status, 200);
  assert.deepEqual(await (await call('/tools/asc_get_performance_data', { token: READ, body: {} })).json(), { ok: true, result: 'plain text' });
  assert.equal(calls.length, 2);
});

test('read-only token is refused for writes before the tool runs; write token is logged', async () => {
  const { call, calls, logs } = setup();
  const body = { action: 'delete', id: 'r1', confirm: true, reason: 'cleanup' };
  const denied = await call('/tools/asc_customer_reviews', { token: READ, body });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].ok, false);
  const ok = await call('/tools/asc_customer_reviews', { token: WRITE, body });
  assert.equal(ok.status, 200);
  assert.equal(logs.length, 2);
  assert.equal(logs[1].token, 'admin');
  assert.equal(logs[1].reason, 'cleanup');
  assert.equal(logs[1].ok, true);
  assert.ok(!JSON.stringify(logs).includes(WRITE), 'secret must never be logged');
});

test('local-only tools, unknown tools, bad JSON, and Apple errors map to clear statuses', async () => {
  const { call } = setup();
  const local = await call('/tools/asc_upload_build', { token: WRITE, body: {} });
  assert.equal(local.status, 404);
  assert.match((await local.json()).error, /only works in the MCP server/);
  assert.equal((await call('/tools/nope', { token: READ, body: {} })).status, 404);
  const arr = await call('/tools/asc_customer_reviews', { token: READ, body: [1] });
  assert.equal(arr.status, 400);
  assert.equal((await call('/tools/asc_get_fails', { token: READ, body: {} })).status, 404);
  assert.equal((await call('/tools/asc_customer_reviews', { token: READ, method: 'GET' })).status, 404);
});

test('tokens must be long, and the server refuses to start with none', () => {
  assert.throws(() => parseTokens('instinct:short', false), /at least 24/);
  assert.throws(() => createApi([], []), /No API tokens/);
  assert.ok(LOCAL_ONLY.has('asc_upload_asset') && LOCAL_ONLY.has('asc_prepare_expedite'));
});

test('read token cannot write with a truthy-but-not-true confirm, or without confirm at all', async () => {
  const { call, calls, logs } = setup();
  for (const confirm of ['yes', 1, 'true', {}, []]) {
    const r = await call('/tools/asc_request', { token: READ, body: { method: 'DELETE', path: '/v1/betaGroups/x', confirm, reason: 'x' } });
    assert.equal(r.status, 403, `confirm=${JSON.stringify(confirm)}`);
  }
  assert.equal((await call('/tools/asc_request', { token: READ, body: { method: 'delete', path: '/v1/x' } })).status, 403);
  assert.equal((await call('/tools/asc_customer_reviews', { token: READ, body: { action: 'delete', id: 'r1' } })).status, 403);
  assert.equal((await call('/tools/asc_customer_reviews', { token: READ, body: {} })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal(logs.filter((l) => l.ok === false).length, 8);
  assert.equal((await call('/tools/asc_request', { token: READ, body: { method: 'get', path: '/v1/apps' } })).status, 200);
});

test('tools themselves accept only confirm === true', async () => {
  const { buildTools } = await import('../dist/tools/tools.js');
  const calls = [];
  const asc = { request: async (a) => (calls.push(a), { status: 200, json: {} }) };
  const T = Object.fromEntries(buildTools(asc).map((t) => [t.name, t]));
  for (const confirm of ['yes', 1, 'true']) {
    await assert.rejects(T.asc_request.handler({ method: 'DELETE', path: '/v1/betaGroups/x', confirm, reason: 'x' }), /confirm/);
    await assert.rejects(T.asc_custom_product_pages.handler({ action: 'delete', id: 'x', confirm, reason: 'x' }), /confirm/);
  }
  assert.equal(calls.length, 0);
});

test('http client retries a GET on 5xx but never retries a write', async () => {
  const { AscHttpClient } = await import('../dist/asc/http.js');
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (_u, init) => (seen.push(init.method), new Response('{"errors":[{"detail":"boom"}]}', { status: seen.length === 1 ? 500 : 200 }));
  try {
    const client = new AscHttpClient({ baseUrl: 'https://api.test/v1', getToken: async () => 't' });
    await assert.rejects(client.request({ method: 'POST', path: '/x', body: {} }), /ASC HTTP 500/);
    assert.deepEqual(seen, ['POST']);
    seen.length = 0;
    await client.request({ method: 'GET', path: '/x' });
    assert.deepEqual(seen, ['GET', 'GET']);
  } finally {
    globalThis.fetch = original;
  }
});
