import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTools } from '../dist/tools/tools.js';

function getTool(fakeAsc, name) {
  const tool = buildTools(fakeAsc).find((candidate) => candidate.name === name);
  assert.ok(tool, `missing tool ${name}`);
  return tool;
}

test('asc_create_analytics_report_request creates an ongoing analytics request body', async () => {
  const calls = [];
  const fakeAsc = {
    request: async (args) => {
      calls.push(args);
      return {
        json: {
          data: {
            id: 'request-1',
            type: 'analyticsReportRequests',
            attributes: { accessType: 'ONGOING' },
          },
        },
      };
    },
  };

  const tool = getTool(fakeAsc, 'asc_create_analytics_report_request');
  const output = JSON.parse(await tool.handler({
    app_id: '6756828266',
    access_type: 'ONGOING',
    confirm: true,
    reason: 'Create Ask Vero analytics reports.',
  }));

  assert.equal(output.data.id, 'request-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/analyticsReportRequests');
  assert.deepEqual(calls[0].body, {
    data: {
      type: 'analyticsReportRequests',
      attributes: { accessType: 'ONGOING' },
      relationships: {
        app: { data: { type: 'apps', id: '6756828266' } },
      },
    },
  });
});

test('asc_download_analytics_report_instance downloads segment urls and parses TSV previews', async () => {
  const calls = [];
  const downloaded = [];
  const fakeAsc = {
    request: async (args) => {
      calls.push(args);
      assert.equal(args.path, '/analyticsReportInstances/instance-1/segments');
      return {
        json: {
          data: [
            {
              id: 'segment-1',
              type: 'analyticsReportSegments',
              attributes: {
                url: 'https://example.test/segment-1.txt.gz',
                checksum: 'abc',
                sizeInBytes: 42,
              },
            },
          ],
        },
      };
    },
    downloadUrlText: async (url) => {
      downloaded.push(url);
      return {
        status: 200,
        headers: { 'content-type': 'application/a-gzip' },
        text: 'Date\tDownload Type\tCounts\n2026-05-30\tFirst-time Download\t8\n',
        isCompressed: true,
      };
    },
  };

  const tool = getTool(fakeAsc, 'asc_download_analytics_report_instance');
  const output = JSON.parse(await tool.handler({
    instance_id: 'instance-1',
    line_limit: 2,
  }));

  assert.deepEqual(downloaded, ['https://example.test/segment-1.txt.gz']);
  assert.equal(output.instance_id, 'instance-1');
  assert.equal(output.segment_count, 1);
  assert.equal(output.line_count, 2);
  assert.equal(output.preview_text, 'Date\tDownload Type\tCounts\n2026-05-30\tFirst-time Download\t8');
  assert.equal(output.segments[0].is_compressed, true);
});

test('asc_analytics_overview_summary aggregates dashboard metrics from generated reports', async () => {
  const reportTextByUrl = {
    'https://example.test/downloads.txt.gz': [
      'Date\tDownload Type\tCounts',
      '2026-05-30\tFirst-time Download\t8',
      '2026-05-30\tRedownload\t3',
      '2026-05-30\tUpdate\t76',
    ].join('\n'),
    'https://example.test/engagement.txt.gz': [
      'Date\tImpressions\tProduct Page Views\tUnique Device Impressions\tTotal Downloads',
      '2026-05-30\t978\t58\t815\t11',
    ].join('\n'),
    'https://example.test/purchases.txt.gz': [
      'Date\tProceeds\tIn-App Purchases\tPaying Users',
      '2026-05-30\t100\t7\t2',
    ].join('\n'),
    'https://example.test/subscription-state.txt.gz': [
      'Date\tActive Plans\tPaid Plans\tMonthly Recurring Revenue',
      '2026-05-30\t2\t2\t17',
    ].join('\n'),
    'https://example.test/subscription-event.txt.gz': [
      'Date\tPaid Subscription Starts\tPaid Subscriptions from Offers\tChurned\tOffers from Paid',
      '2026-05-30\t0\t2\t1\t0',
    ].join('\n'),
  };

  const fakeAsc = {
    request: async ({ path }) => {
      if (path === '/apps/6756828266/analyticsReportRequests') {
        return {
          json: {
            data: [
              {
                id: 'request-1',
                type: 'analyticsReportRequests',
                attributes: { accessType: 'ONGOING', stoppedDueToInactivity: false },
              },
            ],
          },
        };
      }

      if (path === '/analyticsReportRequests/request-1/reports') {
        return {
          json: {
            data: [
              { id: 'r-downloads', attributes: { name: 'App Downloads Standard' } },
              { id: 'r-engagement', attributes: { name: 'App Store Discovery and Engagement Standard' } },
              { id: 'r-purchases', attributes: { name: 'App Store Purchases Standard' } },
              { id: 'r-subscription-state', attributes: { name: 'App Store Subscription State Standard' } },
              { id: 'r-subscription-event', attributes: { name: 'App Store Subscription Event Standard' } },
            ],
          },
        };
      }

      const reportId = path.match(/^\/analyticsReports\/([^/]+)\/instances$/)?.[1];
      if (reportId) {
        return {
          json: {
            data: [
              {
                id: `i-${reportId}`,
                type: 'analyticsReportInstances',
                attributes: { processingDate: '2026-05-31', granularity: 'DAILY' },
              },
            ],
          },
        };
      }

      const instanceId = path.match(/^\/analyticsReportInstances\/([^/]+)\/segments$/)?.[1];
      if (instanceId) {
        const reportKey = instanceId.replace(/^i-r-/, '');
        const urlsByReportKey = {
          downloads: 'https://example.test/downloads.txt.gz',
          engagement: 'https://example.test/engagement.txt.gz',
          purchases: 'https://example.test/purchases.txt.gz',
          'subscription-state': 'https://example.test/subscription-state.txt.gz',
          'subscription-event': 'https://example.test/subscription-event.txt.gz',
        };
        return {
          json: {
            data: [
              {
                id: `s-${reportKey}`,
                type: 'analyticsReportSegments',
                attributes: { url: urlsByReportKey[reportKey] },
              },
            ],
          },
        };
      }

      throw new Error(`unexpected path ${path}`);
    },
    downloadUrlText: async (url) => ({
      status: 200,
      headers: {},
      text: reportTextByUrl[url],
      isCompressed: true,
    }),
  };

  const tool = getTool(fakeAsc, 'asc_analytics_overview_summary');
  const output = JSON.parse(await tool.handler({
    app_id: '6756828266',
    processing_date: '2026-05-31',
  }));

  assert.deepEqual(output.metrics.acquisition, {
    first_time_downloads: 8,
    redownloads: 3,
    updates: 76,
    impressions: 978,
    product_page_views: 58,
    conversion_rate: 1.35,
  });
  assert.deepEqual(output.metrics.sales, {
    proceeds: 100,
    paying_users: 2,
    in_app_purchases: 7,
  });
  assert.deepEqual(output.metrics.subscriptions, {
    active_plans: 2,
    paid_plans: 2,
    monthly_recurring_revenue: 17,
    net_paid_plans: 1,
    plan_starts: 0,
    conversion_to_paid: 2,
    churned: 1,
    paid_to_offer: 0,
  });
  assert.equal(output.missing.length, 0);
});
