import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FAMILIES, familyActions, buildFamilyTool } from '../dist/tools/resources.js';
import { buildAssetTools } from '../dist/tools/assets.js';
import { buildTools } from '../dist/tools/tools.js';
import { PATHS } from '../dist/spec/asc-spec.js';
import { AscHttpClient } from '../dist/asc/http.js';

function recorder(reply = () => ({ json: { data: { id: 'new-1' } } })) {
  const calls = [];
  return { calls, asc: { request: async (args) => (calls.push(args), { status: 200, ...reply(args) }) } };
}
const family = (tool) => FAMILIES.find((f) => f.tool === tool);

test('every feature tool maps to endpoints that exist in Apple spec', () => {
  for (const f of FAMILIES) {
    assert.ok(PATHS[f.base] || PATHS[`${f.base}/{id}`], `${f.tool}: ${f.base} not in spec`);
    for (const [name, path] of Object.entries(f.parents ?? {})) {
      assert.ok((PATHS[path] ?? []).includes('GET'), `${f.tool}: parent ${name} ${path} has no GET`);
    }
    assert.ok(familyActions(f).length > 0, `${f.tool} has no actions`);
  }
});

test('tool names are unique across the whole server', () => {
  const names = buildTools(recorder().asc).map((t) => t.name);
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});

test('create fills relationship types from the spec', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_custom_product_pages'));
  await tool.handler({ action: 'create', attributes: { name: 'Ad A' }, relationships: { app: '123' }, confirm: true, reason: 't' });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/v1/appCustomProductPages');
  assert.deepEqual(calls[0].body, {
    data: { type: 'appCustomProductPages', attributes: { name: 'Ad A' }, relationships: { app: { data: { type: 'apps', id: '123' } } } },
  });
});

test('product page experiments use the v2 endpoint', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_product_page_experiments'));
  await tool.handler({
    action: 'create',
    attributes: { name: 'Icon test', platform: 'IOS', trafficProportion: 50 },
    relationships: { app: '123' },
    confirm: true,
    reason: 't',
  });
  assert.equal(calls[0].path, '/v2/appStoreVersionExperiments');
});

test('list under a parent and get by id build the right paths', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_customer_reviews'));
  await tool.handler({ action: 'list', parent: 'app', parent_id: '6756828266', query: { sort: '-createdDate' } });
  await tool.handler({ action: 'get', id: 'r1' });
  assert.equal(calls[0].path, '/v1/apps/6756828266/customerReviews');
  assert.deepEqual(calls[0].query, { sort: '-createdDate' });
  assert.equal(calls[1].path, '/v1/customerReviews/r1');
});

test('writes without confirm are refused before any request', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_customer_review_responses'));
  await assert.rejects(
    tool.handler({ action: 'create', attributes: { responseBody: 'Thanks' }, relationships: { review: 'r1' } }),
    /confirm/,
  );
  await assert.rejects(tool.handler({ action: 'delete', id: 'x', confirm: true }), /reason/);
  assert.equal(calls.length, 0);
});

test('missing required fields and unknown relationships are refused before any request', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_customer_review_responses'));
  await assert.rejects(
    tool.handler({ action: 'create', attributes: {}, relationships: { review: 'r1' }, confirm: true, reason: 't' }),
    /Missing required attributes: responseBody/,
  );
  await assert.rejects(
    tool.handler({ action: 'create', attributes: { responseBody: 'x' }, confirm: true, reason: 't' }),
    /Missing required relationships: review/,
  );
  await assert.rejects(
    tool.handler({ action: 'create', attributes: { responseBody: 'x' }, relationships: { app: '1' }, confirm: true, reason: 't' }),
    /Unknown relationship 'app'/,
  );
  assert.equal(calls.length, 0);
});

test('actions Apple does not offer are refused, and upload-only creates point to asc_upload_asset', async () => {
  const { calls, asc } = recorder();
  await assert.rejects(buildFamilyTool(asc, family('asc_customer_reviews')).handler({ action: 'delete', id: 'r1' }), /not available/);
  await assert.rejects(
    buildFamilyTool(asc, family('asc_screenshots')).handler({ action: 'create', confirm: true, reason: 't' }),
    /asc_upload_asset with kind=app_screenshot/,
  );
  assert.equal(calls.length, 0);
});

test('http client sends /v2 paths to the API root and plain paths under /v1', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => (urls.push(String(url)), new Response('{}', { status: 200 }));
  try {
    const client = new AscHttpClient({ baseUrl: 'https://api.appstoreconnect.apple.com/v1', getToken: async () => 't' });
    await client.request({ method: 'GET', path: '/v2/appStoreVersionExperiments/x' });
    await client.request({ method: 'GET', path: '/apps' });
    assert.deepEqual(urls, [
      'https://api.appstoreconnect.apple.com/v2/appStoreVersionExperiments/x',
      'https://api.appstoreconnect.apple.com/v1/apps',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('asc_request accepts /v2 paths and rejects unversioned ones', async () => {
  const { calls, asc } = recorder();
  const tool = buildTools(asc).find((t) => t.name === 'asc_request');
  await tool.handler({ method: 'GET', path: '/v2/inAppPurchases/1' });
  assert.equal(calls[0].path, '/v2/inAppPurchases/1');
  await assert.rejects(tool.handler({ method: 'GET', path: '/apps' }), /must start with/);
});

function tempFile(bytes) {
  const p = join(mkdtempSync(join(tmpdir(), 'asc-test-')), 'shot.png');
  writeFileSync(p, bytes);
  return p;
}

test('asc_upload_asset reserves, uploads each part, then confirms with md5', async () => {
  const bytes = Buffer.from('0123456789');
  const file = tempFile(bytes);
  const { calls, asc } = recorder((args) =>
    args.method === 'POST'
      ? {
          json: {
            data: {
              id: 'shot-1',
              attributes: {
                uploadOperations: [
                  { method: 'PUT', url: 'https://up/1', offset: 0, length: 6, requestHeaders: [{ name: 'Content-Type', value: 'image/png' }] },
                  { method: 'PUT', url: 'https://up/2', offset: 6, length: 4, requestHeaders: [] },
                ],
              },
            },
          },
        }
      : { json: { data: { attributes: { assetDeliveryState: { state: 'UPLOAD_COMPLETE' } } } } },
  );
  const puts = [];
  const fakeFetch = async (url, init) => (puts.push({ url, body: Buffer.from(init.body).toString(), headers: init.headers }), new Response(null, { status: 200 }));
  const [tool] = buildAssetTools(asc, fakeFetch);

  const out = JSON.parse(await tool.handler({ kind: 'app_screenshot', file_path: file, parent_id: 'set-1', confirm: true, reason: 't' }));

  assert.equal(calls[0].path, '/v1/appScreenshots');
  assert.deepEqual(calls[0].body.data.relationships, { appScreenshotSet: { data: { type: 'appScreenshotSets', id: 'set-1' } } });
  assert.equal(calls[0].body.data.attributes.fileSize, 10);
  assert.deepEqual(puts.map((p) => [p.url, p.body]), [['https://up/1', '012345'], ['https://up/2', '6789']]);
  assert.equal(puts[0].headers['Content-Type'], 'image/png');
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(calls[1].path, '/v1/appScreenshots/shot-1');
  assert.deepEqual(calls[1].body.data.attributes, { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') });
  assert.equal(out.parts_uploaded, 2);
});

test('asc_upload_asset refuses an Asset Library image without a category, before any request', async () => {
  const { calls, asc } = recorder();
  const [tool] = buildAssetTools(asc, async () => new Response(null, { status: 200 }));
  await assert.rejects(
    tool.handler({ kind: 'asset_library_image', file_path: tempFile(Buffer.from('x')), parent_id: 'lib', confirm: true, reason: 't' }),
    /Missing required attributes: category/,
  );
  assert.equal(calls.length, 0);
});

test('asc_upload_asset stops and does not confirm when a part fails', async () => {
  const { calls, asc } = recorder(() => ({
    json: { data: { id: 'img-1', attributes: { uploadOperations: [{ url: 'https://up/1', offset: 0, length: 1 }] } } },
  }));
  const [tool] = buildAssetTools(asc, async () => new Response(null, { status: 500 }));
  await assert.rejects(
    tool.handler({ kind: 'asset_library_image', file_path: tempFile(Buffer.from('x')), parent_id: 'lib', attributes: { category: 'C' }, confirm: true, reason: 't' }),
    /failed: HTTP 500/,
  );
  assert.equal(calls.filter((c) => c.method === 'PATCH').length, 0);
});

test('null clears a link: [] for to-many, null for to-one', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_asset_library_images'));
  await tool.handler({ action: 'update', id: 'img-1', relationships: {}, attributes: { archived: true }, confirm: true, reason: 't' });
  const { buildRelationships } = await import('../dist/tools/resources.js');
  const shape = { type: 'x', attributes: [], requiredAttributes: [], relationships: { many: { type: 'a', many: true, required: false }, one: { type: 'b', many: false, required: false } } };
  assert.deepEqual(buildRelationships(shape, { many: null, one: null }), { many: { data: [] }, one: { data: null } });
  assert.equal(calls[0].path, '/v1/appAssetLibraryImages/img-1');
});

test('dot-only ids are refused before any request', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_customer_reviews'));
  await assert.rejects(tool.handler({ action: 'get', id: '..' }), /Invalid id/);
  await assert.rejects(tool.handler({ action: 'list', parent: 'app', parent_id: '.' }), /Invalid id/);
  assert.equal(calls.length, 0);
});

test('offer code create sends included prices alongside data', async () => {
  const { calls, asc } = recorder();
  const tool = buildFamilyTool(asc, family('asc_subscription_offer_codes'));
  const included = [{ type: 'subscriptionOfferCodePrices', id: '${p1}', relationships: { territory: { data: { type: 'territories', id: 'USA' } } } }];
  await tool.handler({
    action: 'create',
    attributes: { name: 'Free month', offerMode: 'FREE_TRIAL', duration: 'ONE_MONTH', numberOfPeriods: 1, offerEligibility: 'STACK_WITH_INTRO_OFFERS', customerEligibilities: ['NEW'] },
    relationships: { subscription: '6757818125', prices: ['${p1}'] },
    included,
    confirm: true,
    reason: 't',
  });
  assert.equal(calls[0].path, '/v1/subscriptionOfferCodes');
  assert.deepEqual(calls[0].body.included, included);
  assert.deepEqual(calls[0].body.data.relationships.prices, { data: [{ type: 'subscriptionOfferCodePrices', id: '${p1}' }] });
  assert.deepEqual(calls[0].body.data.relationships.subscription, { data: { type: 'subscriptions', id: '6757818125' } });
});

test('included is refused where Apple does not accept it, and must be an array', async () => {
  const { calls, asc } = recorder();
  const events = buildFamilyTool(asc, family('asc_app_events'));
  await assert.rejects(
    events.handler({ action: 'create', attributes: { referenceName: 'x' }, relationships: { app: '1' }, included: [], confirm: true, reason: 't' }),
    /does not take 'included'/,
  );
  const codes = buildFamilyTool(asc, family('asc_subscription_offer_codes'));
  await assert.rejects(
    codes.handler({
      action: 'create',
      attributes: { name: 'x', offerMode: 'FREE_TRIAL', duration: 'ONE_MONTH', numberOfPeriods: 1, offerEligibility: 'STACK_WITH_INTRO_OFFERS', customerEligibilities: ['NEW'] },
      relationships: { subscription: '1', prices: ['${p1}'] },
      included: { type: 'x' },
      confirm: true,
      reason: 't',
    }),
    /must be an array/,
  );
  assert.equal(calls.length, 0);
  assert.ok('included' in codes.inputSchema.properties);
  assert.ok(!('included' in events.inputSchema.properties));
});

test('generated tools cover every remaining resource type with real endpoints', async () => {
  const { autoFamilies } = await import('../dist/tools/resources.js');
  const auto = autoFamilies();
  const curatedTypes = new Set(FAMILIES.map((f) => f.base.split('/')[2]));
  for (const f of auto) {
    assert.ok(!curatedTypes.has(f.base.split('/')[2]), `${f.tool} duplicates a curated family`);
    assert.ok(familyActions(f).length > 0, `${f.tool} has no actions`);
    for (const path of Object.values(f.parents ?? {})) assert.ok((PATHS[path] ?? []).includes('GET'), `${f.tool}: ${path}`);
    assert.match(f.tool, /^asc_[a-z0-9_]{1,60}$/);
  }
  const names = new Set(auto.map((f) => f.tool));
  for (const n of ['asc_webhooks', 'asc_sandbox_testers', 'asc_beta_feedback_crash_submissions', 'asc_game_center_leaderboards', 'asc_ci_products', 'asc_app_store_version_phased_releases', 'asc_users']) {
    assert.ok(names.has(n), `missing ${n}`);
  }
  assert.ok(!names.has('asc_sales_reports') && !names.has('asc_finance_reports'), 'file endpoints must not get JSON tools');
});

test('generated tool lists under a parent and creates with spec relationship types', async () => {
  const { calls, asc } = recorder();
  const tool = buildTools(asc).find((t) => t.name === 'asc_webhooks');
  await tool.handler({ action: 'list', parent: 'app', parent_id: '6756828266' });
  assert.equal(calls[0].path, '/v1/apps/6756828266/webhooks');
  const phased = buildTools(asc).find((t) => t.name === 'asc_app_store_version_phased_releases');
  await phased.handler({ action: 'update', id: 'pr1', attributes: { phasedReleaseState: 'PAUSED' }, confirm: true, reason: 't' });
  assert.deepEqual(calls[1].body, { data: { type: 'appStoreVersionPhasedReleases', id: 'pr1', attributes: { phasedReleaseState: 'PAUSED' } } });
});

function textRecorder() {
  const calls = [];
  return { calls, asc: { requestText: async (args) => (calls.push(args), { status: 200, headers: {}, text: 'a\tb\n1\t2\n', isCompressed: true }) } };
}

test('file tools call the right endpoints with the right formats', async () => {
  const { buildFileTools } = await import('../dist/tools/files.js');
  const { calls, asc } = textRecorder();
  const T = Object.fromEntries(buildFileTools(asc).map((t) => [t.name, t]));
  const sales = JSON.parse(await T.asc_download_sales_report.handler({ vendor_number: '9', report_type: 'SUBSCRIPTION_OFFER_CODE_REDEMPTION', report_sub_type: 'SUMMARY', frequency: 'DAILY' }));
  assert.equal(calls[0].path, '/salesReports');
  assert.equal(calls[0].accept, 'application/a-gzip');
  assert.equal(calls[0].query['filter[reportType]'], 'SUBSCRIPTION_OFFER_CODE_REDEMPTION');
  assert.equal(sales.line_count, 2);
  await T.asc_download_offer_code_values.handler({ kind: 'subscription', one_time_codes_id: 'b1' });
  assert.equal(calls[1].path, '/v1/subscriptionOfferCodeOneTimeUseCodes/b1/values');
  assert.equal(calls[1].accept, 'text/csv');
  await T.asc_get_performance_data.handler({ kind: 'power_metrics', build_id: 'bd1' });
  assert.equal(calls[2].path, '/v1/builds/bd1/perfPowerMetrics');
  assert.equal(calls[2].accept, 'application/vnd.apple.xcode-metrics+json');
  await assert.rejects(T.asc_download_offer_code_values.handler({ kind: 'x', one_time_codes_id: 'b1' }), /kind must be/);
  assert.equal(calls.length, 3);
});

test('generated parent keys name the link and prefer the newest list', async () => {
  const { autoFamilies } = await import('../dist/tools/resources.js');
  const a = Object.fromEntries(autoFamilies().map((f) => [f.tool, f]));
  assert.equal(a.asc_in_app_purchases.parents.app, '/v1/apps/{id}/inAppPurchasesV2');
  assert.equal(a.asc_app_categories.parents.app_info_primary_category, '/v1/appInfos/{id}/primaryCategory');
  assert.equal(a.asc_app_categories.parents.app_info, undefined);
  assert.equal(a.asc_webhooks.parents.app, '/v1/apps/{id}/webhooks');
});

test('file tools cap huge output and refuse dot-only ids', async () => {
  const { buildFileTools } = await import('../dist/tools/files.js');
  const calls = [];
  const asc = { requestText: async (args) => (calls.push(args), { status: 200, headers: {}, text: 'x'.repeat(150_000), isCompressed: false }) };
  const T = Object.fromEntries(buildFileTools(asc).map((t) => [t.name, t]));
  const out = await T.asc_get_performance_data.handler({ kind: 'overview', app_id: '1' });
  assert.ok(out.length < 101_000);
  assert.match(out, /truncated: showing 100000 of 150000/);
  await assert.rejects(T.asc_download_offer_code_values.handler({ kind: 'subscription', one_time_codes_id: '..' }), /Invalid/);
  assert.equal(calls.length, 1);
});
