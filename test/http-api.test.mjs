import test from 'node:test';
import assert from 'node:assert/strict';

import { createApi, parseTokens, LOCAL_ONLY } from '../dist/http/app.js';

const READ = 'r'.repeat(32);
const WRITE = 'w'.repeat(32);

function setup() {
  const calls = [];
  const logs = [];
  const tools = [
    { name: 'asc_customer_reviews', description: 'Reviews. More text.', inputSchema: { type: 'object' }, handler: async (a) => (calls.push(a), JSON.stringify({ data: [1, 2] })) },
    { name: 'asc_get_performance_data', description: 'Perf.', inputSchema: { type: 'object' }, handler: async () => 'plain text' },
    { name: 'asc_fails', description: 'Fails.', inputSchema: { type: 'object' }, handler: async () => { throw new Error('ASC HTTP 404: no such thing'); } },
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
  const only = await (await call('/openapi.json?tools=asc_fails', { method: 'GET' })).json();
  assert.deepEqual(Object.keys(only.paths), ['/tools/asc_fails']);
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
  assert.equal((await call('/api/tools/asc_customer_reviews', { token: READ, body: {} })).status, 200);
  assert.deepEqual(await (await call('/tools/asc_get_performance_data', { token: READ, body: {} })).json(), { ok: true, result: 'plain text' });
  assert.equal(calls.length, 2);
});

test('read-only token is refused for writes before the tool runs; write token is logged', async () => {
  const { call, calls, logs } = setup();
  const body = { action: 'delete', id: 'r1', confirm: true, reason: 'cleanup' };
  const denied = await call('/tools/asc_customer_reviews', { token: READ, body });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 0);
  const ok = await call('/tools/asc_customer_reviews', { token: WRITE, body });
  assert.equal(ok.status, 200);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].token, 'admin');
  assert.equal(logs[0].reason, 'cleanup');
  assert.ok(!JSON.stringify(logs).includes(WRITE), 'secret must never be logged');
});

test('local-only tools, unknown tools, bad JSON, and Apple errors map to clear statuses', async () => {
  const { call } = setup();
  const local = await call('/tools/asc_upload_build', { token: WRITE, body: {} });
  assert.equal(local.status, 404);
  assert.match((await local.json()).error, /only works in the MCP server/);
  assert.equal((await call('/tools/nope', { token: READ, body: {} })).status, 404);
  const bad = await setup().call('/tools/asc_customer_reviews', { token: READ, body: undefined });
  assert.equal(bad.status, 200); // empty body = no arguments
  const arr = await call('/tools/asc_customer_reviews', { token: READ, body: [1] });
  assert.equal(arr.status, 400);
  assert.equal((await call('/tools/asc_fails', { token: READ, body: {} })).status, 404);
  assert.equal((await call('/tools/asc_customer_reviews', { token: READ, method: 'GET' })).status, 404);
});

test('tokens must be long, and the server refuses to start with none', () => {
  assert.throws(() => parseTokens('instinct:short', false), /at least 24/);
  assert.throws(() => createApi([], []), /No API tokens/);
  assert.ok(LOCAL_ONLY.has('asc_upload_asset') && LOCAL_ONLY.has('asc_prepare_expedite'));
});
