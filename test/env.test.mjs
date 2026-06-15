import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePrivateKey } from '../dist/asc/env.js';

test('resolvePrivateKey reads ASC_PRIVATE_KEY_FILE when inline private key is absent', () => {
  const env = {
    ASC_PRIVATE_KEY_FILE: '/secure/AuthKey_TEST.p8',
  };
  const privateKey = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n';
  const reads = [];

  const resolved = resolvePrivateKey(env, (path, encoding) => {
    reads.push({ path, encoding });
    return privateKey;
  });

  assert.equal(resolved, privateKey);
  assert.deepEqual(reads, [{ path: '/secure/AuthKey_TEST.p8', encoding: 'utf8' }]);
});

test('resolvePrivateKey prefers ASC_PRIVATE_KEY over ASC_PRIVATE_KEY_FILE', () => {
  const resolved = resolvePrivateKey(
    {
      ASC_PRIVATE_KEY: 'inline-key',
      ASC_PRIVATE_KEY_FILE: '/secure/AuthKey_TEST.p8',
    },
    () => {
      throw new Error('file should not be read');
    },
  );

  assert.equal(resolved, 'inline-key');
});
