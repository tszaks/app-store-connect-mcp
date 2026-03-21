import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

import { AscHttpClient } from '../dist/asc/http.js';

test('requestText decompresses gzip finance report responses', async () => {
  const originalFetch = globalThis.fetch;
  const reportText = 'Start Date\tEnd Date\tUnits\n2026-03-01\t2026-03-31\t1\n';

  globalThis.fetch = async () =>
    new Response(gzipSync(Buffer.from(reportText, 'utf8')), {
      status: 200,
      headers: {
        'content-type': 'application/a-gzip',
        'content-disposition': 'attachment; filename=Financial_Report.txt.gz',
      },
    });

  try {
    const client = new AscHttpClient({
      baseUrl: 'https://api.appstoreconnect.apple.com/v1',
      getToken: async () => 'token',
    });

    const response = await client.requestText({
      method: 'GET',
      path: '/financeReports',
      query: {
        'filter[vendorNumber]': '93635270',
        'filter[reportDate]': '2026-03',
        'filter[reportType]': 'FINANCIAL',
      },
    });

    assert.equal(response.text, reportText);
    assert.equal(response.isCompressed, true);
    assert.match(response.headers['content-disposition'], /Financial_Report\.txt\.gz/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
