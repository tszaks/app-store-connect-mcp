import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExpediteTools, EXPEDITE_FORM_URL } from '../dist/tools/expedite.js';
import { buildTools } from '../dist/tools/tools.js';

function fakeAsc(state, calls = []) {
  return {
    request: async (args) => {
      calls.push(args);
      return {
        json: {
          data: {
            id: 'ver-1',
            type: 'appStoreVersions',
            attributes: { appVersionState: state, versionString: '3.1.9', platform: 'IOS' },
          },
          included: [{ type: 'apps', id: '6756828266', attributes: { name: 'Vero', bundleId: 'app.askvero' } }],
        },
      };
    },
  };
}

function fakeEffects() {
  const log = { copied: [], opened: [] };
  return {
    log,
    effects: {
      copyToClipboard: async (t) => (log.copied.push(t), true),
      openUrl: async (u) => (log.opened.push(u), true),
    },
  };
}

test('asc_prepare_expedite is registered in buildTools', () => {
  assert.ok(buildTools(fakeAsc('WAITING_FOR_REVIEW')).some((t) => t.name === 'asc_prepare_expedite'));
});

test('asc_prepare_expedite copies text and opens the form for a WAITING_FOR_REVIEW version', async () => {
  const calls = [];
  const { log, effects } = fakeEffects();
  const [tool] = buildExpediteTools(fakeAsc('WAITING_FOR_REVIEW', calls), effects);
  const out = JSON.parse(await tool.handler({ version_id: 'ver-1', justification: 'Fixes onboarding crash.' }));

  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].path, '/appStoreVersions/ver-1');
  assert.equal(out.ok, true);
  assert.equal(out.version, '3.1.9');
  assert.deepEqual(log.opened, [EXPEDITE_FORM_URL]);
  assert.equal(log.copied.length, 1);
  assert.match(log.copied[0], /Vero \(Apple ID 6756828266, app\.askvero\)/);
  assert.match(log.copied[0], /Fixes onboarding crash\./);
});

test('asc_prepare_expedite refuses and has no side effects when the version is not in the queue', async () => {
  const { log, effects } = fakeEffects();
  const [tool] = buildExpediteTools(fakeAsc('PREPARE_FOR_SUBMISSION'), effects);
  const out = JSON.parse(await tool.handler({ version_id: 'ver-1', justification: 'x' }));

  assert.equal(out.ok, false);
  assert.match(out.message, /PREPARE_FOR_SUBMISSION/);
  assert.equal(log.copied.length, 0);
  assert.equal(log.opened.length, 0);
});

test('asc_prepare_expedite skips the browser when open_form is false', async () => {
  const { log, effects } = fakeEffects();
  const [tool] = buildExpediteTools(fakeAsc('WAITING_FOR_REVIEW'), effects);
  const out = JSON.parse(await tool.handler({ version_id: 'ver-1', justification: 'x', open_form: false }));

  assert.equal(out.opened_form, false);
  assert.equal(log.opened.length, 0);
  assert.equal(log.copied.length, 1);
});
