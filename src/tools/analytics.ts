import type { AscHttpClient } from '../asc/http.js';
import { requireWriteConfirm } from '../safety.js';
import type { ToolDef } from './registry.js';
import { optionalString, requireString } from './helpers.js';

type JsonRecord = Record<string, any>;

const ACCESS_TYPES = new Set(['ONGOING', 'ONE_TIME_SNAPSHOT']);
const GRANULARITIES = new Set(['DAILY', 'WEEKLY', 'MONTHLY']);

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function splitReportLines(text: string): string[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, '\n');
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return trimmed ? trimmed.split('\n') : [];
}

function expandFilterKeys(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k.startsWith('filter_')) {
      out[`filter[${k.slice(7)}]`] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function requiredAccessType(value: unknown): string {
  const accessType = (optionalString(value) ?? 'ONGOING').toUpperCase();
  if (!ACCESS_TYPES.has(accessType)) {
    throw new Error(`access_type must be one of: ${Array.from(ACCESS_TYPES).join(', ')}`);
  }
  return accessType;
}

function optionalGranularity(value: unknown): string {
  const granularity = (optionalString(value) ?? 'DAILY').toUpperCase();
  if (!GRANULARITIES.has(granularity)) {
    throw new Error(`granularity must be one of: ${Array.from(GRANULARITIES).join(', ')}`);
  }
  return granularity;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseTsv(text: string): { headers: string[]; rows: JsonRecord[] } {
  const lines = splitReportLines(text);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split('\t');
  const rows = lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split('\t');
    const row: JsonRecord = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function valueFor(row: JsonRecord, aliases: string[]): string | undefined {
  const normalizedToKey = new Map<string, string>();
  for (const key of Object.keys(row)) {
    normalizedToKey.set(normalizeKey(key), key);
  }
  for (const alias of aliases) {
    const key = normalizedToKey.get(normalizeKey(alias));
    if (key) return row[key];
  }
  return undefined;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[$,%\s,]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumColumn(rows: JsonRecord[], aliases: string[]): number | null {
  let found = false;
  let total = 0;
  for (const row of rows) {
    const value = valueFor(row, aliases);
    if (value !== undefined && value !== '') {
      found = true;
      total += parseNumeric(value);
    }
  }
  return found ? total : null;
}

async function getAllData(
  asc: AscHttpClient,
  path: string,
  query?: Record<string, unknown>,
  maxPages = 10,
): Promise<any[]> {
  const data: any[] = [];
  let currentPath = path;
  let currentQuery = query;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await asc.request({ method: 'GET', path: currentPath, query: currentQuery });
    if (Array.isArray(res.json?.data)) data.push(...res.json.data);

    const next = optionalString(res.json?.links?.next);
    if (!next) break;

    const parsed = new URL(next);
    currentPath = parsed.pathname.replace(/^\/v1/, '') || currentPath;
    currentQuery = Object.fromEntries(parsed.searchParams.entries());
  }

  return data;
}

async function listReports(asc: AscHttpClient, requestId: string): Promise<any[]> {
  return getAllData(asc, `/analyticsReportRequests/${requestId}/reports`, { limit: 200 });
}

async function listInstances(
  asc: AscHttpClient,
  reportId: string,
  granularity: string,
  processingDate?: string,
): Promise<any[]> {
  const query: Record<string, unknown> = {
    limit: 200,
    'filter[granularity]': granularity,
  };
  if (processingDate) query['filter[processingDate]'] = processingDate;
  return getAllData(asc, `/analyticsReports/${reportId}/instances`, query);
}

function pickLatestInstance(instances: any[], processingDate?: string): any | undefined {
  if (processingDate) return instances[0];
  return [...instances].sort((a, b) => {
    const aDate = optionalString(a?.attributes?.processingDate) ?? '';
    const bDate = optionalString(b?.attributes?.processingDate) ?? '';
    return bDate.localeCompare(aDate);
  })[0];
}

async function downloadInstanceText(asc: AscHttpClient, instanceId: string): Promise<{
  segments: JsonRecord[];
  combinedText: string;
}> {
  const res = await asc.request({
    method: 'GET',
    path: `/analyticsReportInstances/${instanceId}/segments`,
    query: { limit: 200 },
  });
  const segments = Array.isArray(res.json?.data) ? res.json.data : [];
  const downloadedSegments: JsonRecord[] = [];
  const texts: string[] = [];

  for (const segment of segments) {
    const url = optionalString(segment?.attributes?.url);
    if (!url) {
      downloadedSegments.push({
        id: segment?.id ?? null,
        status: 'missing_url',
      });
      continue;
    }
    const downloaded = await asc.downloadUrlText(url);
    const lines = splitReportLines(downloaded.text);
    texts.push(downloaded.text);
    downloadedSegments.push({
      id: segment?.id ?? null,
      checksum: segment?.attributes?.checksum ?? null,
      size_in_bytes: segment?.attributes?.sizeInBytes ?? null,
      content_type: downloaded.headers['content-type'] ?? null,
      is_compressed: downloaded.isCompressed,
      line_count: lines.length,
    });
  }

  return {
    segments: downloadedSegments,
    combinedText: texts.join('\n'),
  };
}

function reportName(report: any): string {
  return optionalString(report?.attributes?.name) ?? '';
}

function isStandardReport(report: any, contentLevel: string): boolean {
  const name = reportName(report);
  if (contentLevel === 'ANY') return true;
  return new RegExp(`\\b${contentLevel}\\b`, 'i').test(name);
}

function findReport(reports: any[], key: string, contentLevel: string): any | undefined {
  const matchers: Record<string, RegExp[]> = {
    downloads: [/downloads?/i],
    engagement: [/discovery/i, /engagement/i],
    purchases: [/purchases?/i],
    subscription_state: [/subscription/i, /state/i],
    subscription_event: [/subscription/i, /event/i],
  };
  const required = matchers[key] ?? [];
  return reports.find((report) => {
    const name = reportName(report);
    return isStandardReport(report, contentLevel) && required.every((matcher) => matcher.test(name));
  });
}

function addMissing(missing: JsonRecord[], metric: string, reason: string): void {
  missing.push({ metric, reason });
}

function addIfPresent(target: JsonRecord, key: string, value: number | null, missing: JsonRecord[], reason: string): void {
  if (value === null) {
    addMissing(missing, key, reason);
  } else {
    target[key] = value;
  }
}

function summarizeDownloads(rows: JsonRecord[], missing: JsonRecord[]): JsonRecord {
  const out = { first_time_downloads: 0, redownloads: 0, updates: 0 };
  let sawDownloadType = false;

  for (const row of rows) {
    const type = valueFor(row, ['Download Type']) ?? '';
    const count = parseNumeric(valueFor(row, ['Counts', 'Count']));
    if (!type) continue;
    sawDownloadType = true;
    if (/first[-\s]?time/i.test(type)) out.first_time_downloads += count;
    else if (/redownload/i.test(type)) out.redownloads += count;
    else if (/update/i.test(type)) out.updates += count;
  }

  if (!sawDownloadType) addMissing(missing, 'downloads', 'Downloads report is missing Download Type or Counts columns.');
  return out;
}

function summarizeEngagement(rows: JsonRecord[], acquisition: JsonRecord, missing: JsonRecord[]): void {
  addIfPresent(
    acquisition,
    'impressions',
    sumColumn(rows, ['Impressions']),
    missing,
    'Engagement report is missing Impressions.',
  );
  addIfPresent(
    acquisition,
    'product_page_views',
    sumColumn(rows, ['Product Page Views']),
    missing,
    'Engagement report is missing Product Page Views.',
  );

  const directConversion = sumColumn(rows, ['Conversion Rate']);
  if (directConversion !== null) {
    acquisition.conversion_rate = round2(directConversion);
    return;
  }

  const totalDownloads = sumColumn(rows, ['Total Downloads', 'Downloads']);
  const uniqueImpressions = sumColumn(rows, ['Unique Device Impressions', 'Impressions Unique Devices']);
  if (totalDownloads !== null && uniqueImpressions && uniqueImpressions > 0) {
    acquisition.conversion_rate = round2((totalDownloads / uniqueImpressions) * 100);
  } else {
    addMissing(
      missing,
      'conversion_rate',
      'Engagement report is missing Conversion Rate or Total Downloads plus Unique Device Impressions.',
    );
  }
}

function summarizePurchases(rows: JsonRecord[], missing: JsonRecord[]): JsonRecord {
  const sales: JsonRecord = {};
  addIfPresent(sales, 'proceeds', sumColumn(rows, ['Proceeds']), missing, 'Purchases report is missing Proceeds.');
  addIfPresent(
    sales,
    'paying_users',
    sumColumn(rows, ['Paying Users']),
    missing,
    'Purchases report is missing Paying Users.',
  );
  addIfPresent(
    sales,
    'in_app_purchases',
    sumColumn(rows, ['In-App Purchases', 'In App Purchases', 'Purchases', 'Counts']),
    missing,
    'Purchases report is missing In-App Purchases or Counts.',
  );
  return sales;
}

function summarizeSubscriptionState(rows: JsonRecord[], subscriptions: JsonRecord, missing: JsonRecord[]): void {
  addIfPresent(
    subscriptions,
    'active_plans',
    sumColumn(rows, ['Active Plans', 'Active Plans (All)']),
    missing,
    'Subscription State report is missing Active Plans.',
  );
  addIfPresent(
    subscriptions,
    'paid_plans',
    sumColumn(rows, ['Paid Plans', 'Paid Plans (All)']),
    missing,
    'Subscription State report is missing Paid Plans.',
  );
  addIfPresent(
    subscriptions,
    'monthly_recurring_revenue',
    sumColumn(rows, ['Monthly Recurring Revenue']),
    missing,
    'Subscription State report is missing Monthly Recurring Revenue.',
  );
}

function summarizeSubscriptionEvents(rows: JsonRecord[], subscriptions: JsonRecord, missing: JsonRecord[]): void {
  const planStarts = sumColumn(rows, ['Plan Starts', 'Paid Subscription Starts']);
  const conversionToPaid = sumColumn(rows, ['Conversion to Paid', 'Paid Subscriptions from Offers']);
  const churned = sumColumn(rows, ['Churned', 'Churned (All)', 'Voluntary Churns', 'Involuntary Churns']);
  const paidToOffer = sumColumn(rows, ['Paid to Offer', 'Offers from Paid']);

  addIfPresent(
    subscriptions,
    'plan_starts',
    planStarts,
    missing,
    'Subscription Event report is missing Plan Starts or Paid Subscription Starts.',
  );
  addIfPresent(
    subscriptions,
    'conversion_to_paid',
    conversionToPaid,
    missing,
    'Subscription Event report is missing Conversion to Paid or Paid Subscriptions from Offers.',
  );
  addIfPresent(
    subscriptions,
    'churned',
    churned,
    missing,
    'Subscription Event report is missing Churned.',
  );
  addIfPresent(
    subscriptions,
    'paid_to_offer',
    paidToOffer,
    missing,
    'Subscription Event report is missing Paid to Offer or Offers from Paid.',
  );

  if (planStarts !== null && conversionToPaid !== null && churned !== null) {
    subscriptions.net_paid_plans = planStarts + conversionToPaid - churned;
  } else {
    addMissing(
      missing,
      'net_paid_plans',
      'Net Paid Plans requires plan starts, conversion to paid, and churned values.',
    );
  }
}

async function downloadReportForSummary(
  asc: AscHttpClient,
  report: any,
  granularity: string,
  processingDate?: string,
): Promise<{ status: string; instance?: any; parsed?: ReturnType<typeof parseTsv>; segment_count?: number }> {
  const reportId = requireString(report?.id, 'report.id');
  const instances = await listInstances(asc, reportId, granularity, processingDate);
  const instance = pickLatestInstance(instances, processingDate);
  if (!instance) return { status: 'pending_no_instances' };

  const instanceId = requireString(instance.id, 'instance.id');
  const downloaded = await downloadInstanceText(asc, instanceId);
  return {
    status: 'available',
    instance,
    parsed: parseTsv(downloaded.combinedText),
    segment_count: downloaded.segments.length,
  };
}

export function buildAnalyticsTools(asc: AscHttpClient): ToolDef[] {
  return [
    {
      name: 'asc_create_analytics_report_request',
      description:
        'Create an App Store Connect analytics report request for an app. Requires Admin access, confirm=true, and reason.',
      inputSchema: {
        type: 'object',
        properties: {
          app_id: { type: 'string' },
          access_type: {
            type: 'string',
            enum: ['ONGOING', 'ONE_TIME_SNAPSHOT'],
            description: 'Defaults to ONGOING.',
          },
          confirm: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['app_id', 'confirm', 'reason'],
      },
      handler: async (args) => {
        requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
        const appId = requireString(args.app_id, 'app_id');
        const accessType = requiredAccessType(args.access_type);
        const body = {
          data: {
            type: 'analyticsReportRequests',
            attributes: { accessType },
            relationships: {
              app: { data: { type: 'apps', id: appId } },
            },
          },
        };
        const res = await asc.request({ method: 'POST', path: '/analyticsReportRequests', body });
        return JSON.stringify(res.json, null, 2);
      },
    },
    {
      name: 'asc_list_analytics_report_requests',
      description: 'List analytics report requests for an app.',
      inputSchema: {
        type: 'object',
        properties: {
          app_id: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['app_id'],
      },
      handler: async (args) => {
        const appId = requireString(args.app_id, 'app_id');
        const query: any = { ...args };
        delete query.app_id;
        const res = await asc.request({
          method: 'GET',
          path: `/apps/${appId}/analyticsReportRequests`,
          query,
        });
        return JSON.stringify(res.json, null, 2);
      },
    },
    {
      name: 'asc_list_analytics_reports',
      description: 'List analytics reports generated for a report request.',
      inputSchema: {
        type: 'object',
        properties: {
          request_id: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['request_id'],
      },
      handler: async (args) => {
        const requestId = requireString(args.request_id, 'request_id');
        const query: any = { ...args };
        delete query.request_id;
        const res = await asc.request({
          method: 'GET',
          path: `/analyticsReportRequests/${requestId}/reports`,
          query,
        });
        return JSON.stringify(res.json, null, 2);
      },
    },
    {
      name: 'asc_list_analytics_report_instances',
      description: 'List instances for an analytics report, optionally filtered by granularity and processing date.',
      inputSchema: {
        type: 'object',
        properties: {
          report_id: { type: 'string' },
          granularity: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
          processing_date: { type: 'string', description: 'YYYY-MM-DD processing date.' },
          limit: { type: 'number' },
        },
        required: ['report_id'],
      },
      handler: async (args) => {
        const reportId = requireString(args.report_id, 'report_id');
        const query = expandFilterKeys({
          limit: args.limit,
          filter_granularity: optionalString(args.granularity)?.toUpperCase(),
          filter_processingDate: optionalString(args.processing_date),
        });
        const res = await asc.request({
          method: 'GET',
          path: `/analyticsReports/${reportId}/instances`,
          query,
        });
        return JSON.stringify(res.json, null, 2);
      },
    },
    {
      name: 'asc_download_analytics_report_instance',
      description:
        'Download all segment files for an analytics report instance and return parsed preview text. Segment URLs expire quickly.',
      inputSchema: {
        type: 'object',
        properties: {
          instance_id: { type: 'string' },
          full_report: { type: 'boolean' },
          line_limit: { type: 'number', description: 'Defaults to 40, max 500.' },
        },
        required: ['instance_id'],
      },
      handler: async (args) => {
        const instanceId = requireString(args.instance_id, 'instance_id');
        const fullReport = Boolean(args.full_report);
        const lineLimit = clamp(optionalNumber(args.line_limit) ?? 40, 1, 500);
        const downloaded = await downloadInstanceText(asc, instanceId);
        const lines = splitReportLines(downloaded.combinedText);
        const parsed = parseTsv(downloaded.combinedText);

        return JSON.stringify(
          {
            instance_id: instanceId,
            segment_count: downloaded.segments.length,
            segments: downloaded.segments,
            line_count: lines.length,
            row_count: parsed.rows.length,
            headers: parsed.headers,
            preview_line_count: Math.min(lineLimit, lines.length),
            preview_text: lines.slice(0, lineLimit).join('\n'),
            report_text: fullReport ? downloaded.combinedText : undefined,
            report_text_included: fullReport,
          },
          null,
          2,
        );
      },
    },
    {
      name: 'asc_analytics_overview_summary',
      description:
        'Build dashboard-like overview metrics from generated Analytics Reports. Returns pending or missing-column details instead of guessing.',
      inputSchema: {
        type: 'object',
        properties: {
          app_id: { type: 'string' },
          request_id: { type: 'string' },
          access_type: { type: 'string', enum: ['ONGOING', 'ONE_TIME_SNAPSHOT'] },
          content_level: { type: 'string', enum: ['STANDARD', 'DETAILED', 'ANY'] },
          granularity: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
          processing_date: { type: 'string', description: 'YYYY-MM-DD processing date.' },
        },
        required: ['app_id'],
      },
      handler: async (args) => {
        const appId = requireString(args.app_id, 'app_id');
        const requestedAccessType = requiredAccessType(args.access_type);
        const granularity = optionalGranularity(args.granularity);
        const processingDate = optionalString(args.processing_date);
        const contentLevel = (optionalString(args.content_level) ?? 'STANDARD').toUpperCase();
        if (!['STANDARD', 'DETAILED', 'ANY'].includes(contentLevel)) {
          throw new Error('content_level must be one of: STANDARD, DETAILED, ANY');
        }

        const requestId = optionalString(args.request_id);
        let selectedRequest: any | undefined;
        if (requestId) {
          selectedRequest = { id: requestId, attributes: { accessType: requestedAccessType } };
        } else {
          const requests = await getAllData(asc, `/apps/${appId}/analyticsReportRequests`, { limit: 50 });
          selectedRequest = requests.find((request) => {
            const attrs = request?.attributes ?? {};
            return attrs.accessType === requestedAccessType && attrs.stoppedDueToInactivity !== true;
          }) ?? requests.find((request) => request?.attributes?.stoppedDueToInactivity !== true);
        }

        if (!selectedRequest) {
          return JSON.stringify(
            {
              app_id: appId,
              status: 'pending_no_report_request',
              message:
                'No analytics report request exists yet. Create ONGOING and ONE_TIME_SNAPSHOT requests first, then wait for Apple to generate reports.',
              metrics: {},
              missing: [],
            },
            null,
            2,
          );
        }

        const reports = await listReports(asc, requireString(selectedRequest.id, 'selectedRequest.id'));
        const missing: JsonRecord[] = [];
        const reportStatus: JsonRecord[] = [];
        const metrics: JsonRecord = {
          acquisition: {},
          sales: {},
          subscriptions: {},
        };

        const specs = [
          { key: 'downloads', section: 'acquisition' },
          { key: 'engagement', section: 'acquisition' },
          { key: 'purchases', section: 'sales' },
          { key: 'subscription_state', section: 'subscriptions' },
          { key: 'subscription_event', section: 'subscriptions' },
        ];

        for (const spec of specs) {
          const report = findReport(reports, spec.key, contentLevel);
          if (!report) {
            addMissing(missing, spec.key, `No ${contentLevel.toLowerCase()} report matched ${spec.key}.`);
            reportStatus.push({ key: spec.key, status: 'missing_report' });
            continue;
          }

          const downloaded = await downloadReportForSummary(asc, report, granularity, processingDate);
          reportStatus.push({
            key: spec.key,
            status: downloaded.status,
            report_id: report.id,
            report_name: reportName(report),
            instance_id: downloaded.instance?.id ?? null,
            processing_date: downloaded.instance?.attributes?.processingDate ?? null,
            segment_count: downloaded.segment_count ?? 0,
          });

          if (downloaded.status !== 'available' || !downloaded.parsed) {
            addMissing(missing, spec.key, `${reportName(report)} has no available instances yet.`);
            continue;
          }

          const rows = downloaded.parsed.rows;
          if (spec.key === 'downloads') {
            Object.assign(metrics.acquisition, summarizeDownloads(rows, missing));
          } else if (spec.key === 'engagement') {
            summarizeEngagement(rows, metrics.acquisition, missing);
          } else if (spec.key === 'purchases') {
            Object.assign(metrics.sales, summarizePurchases(rows, missing));
          } else if (spec.key === 'subscription_state') {
            summarizeSubscriptionState(rows, metrics.subscriptions, missing);
          } else if (spec.key === 'subscription_event') {
            summarizeSubscriptionEvents(rows, metrics.subscriptions, missing);
          }
        }

        return JSON.stringify(
          {
            app_id: appId,
            status: missing.length ? 'partial' : 'available',
            request: {
              id: selectedRequest.id,
              access_type: selectedRequest.attributes?.accessType ?? null,
              stopped_due_to_inactivity: selectedRequest.attributes?.stoppedDueToInactivity ?? null,
            },
            granularity,
            processing_date: processingDate ?? null,
            content_level: contentLevel,
            metrics,
            reports: reportStatus,
            missing,
          },
          null,
          2,
        );
      },
    },
  ];
}
