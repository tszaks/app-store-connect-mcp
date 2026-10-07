import type { AscHttpClient } from '../asc/http.js';
import type { ToolDef } from './registry.js';
import { optionalString, requireString } from './helpers.js';

// Endpoints that return files or Apple-specific JSON instead of JSON:API.
// The generated feature tools skip these, so they get small dedicated tools.

const SALES_REPORT_TYPES = [
  'SALES',
  'PRE_ORDER',
  'NEWSSTAND',
  'SUBSCRIPTION',
  'SUBSCRIPTION_EVENT',
  'SUBSCRIBER',
  'SUBSCRIPTION_OFFER_CODE_REDEMPTION',
  'INSTALLS',
  'FIRST_ANNUAL',
  'WIN_BACK_ELIGIBILITY',
];

function lines(text: string): string[] {
  const t = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
  return t ? t.split('\n') : [];
}

function previewResult(text: string, full: boolean, lineLimit: number, extra: Record<string, unknown>): string {
  const all = lines(text);
  return JSON.stringify(
    {
      ...extra,
      line_count: all.length,
      preview_text: all.slice(0, lineLimit).join('\n'),
      report_text: full ? capped(text).text : undefined,
      report_text_included: full,
      truncated: full && text.length > MAX_CHARS ? `report cut at ${MAX_CHARS} of ${text.length} chars` : undefined,
    },
    null,
    2,
  );
}

// Keeps one call from flooding an agent's context.
const MAX_CHARS = 100_000;

function capped(text: string): { text: string; truncated: boolean; total_chars: number } {
  return { text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS, total_chars: text.length };
}

function safeId(value: unknown, field: string): string {
  const id = requireString(value, field);
  if (/^\.+$/.test(id)) throw new Error(`Invalid ${field} '${id}'`);
  return encodeURIComponent(id);
}

function lineLimitOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(500, Math.max(1, value)) : 40;
}

export function buildFileTools(asc: AscHttpClient): ToolDef[] {
  return [
    {
      name: 'asc_download_sales_report',
      description:
        'Download an App Store Connect sales or subscription report (tab-separated text). Types include SALES, SUBSCRIPTION, SUBSCRIPTION_EVENT, SUBSCRIBER, SUBSCRIPTION_OFFER_CODE_REDEMPTION, INSTALLS. Needs Sales or Admin access.',
      inputSchema: {
        type: 'object',
        properties: {
          vendor_number: { type: 'string' },
          report_type: { type: 'string', enum: SALES_REPORT_TYPES },
          report_sub_type: { type: 'string', enum: ['SUMMARY', 'DETAILED', 'SUMMARY_INSTALL_TYPE', 'SUMMARY_TERRITORY', 'SUMMARY_CHANNEL'] },
          frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] },
          report_date: { type: 'string', description: 'YYYY-MM-DD (daily/weekly), YYYY-MM (monthly), YYYY (yearly). Omit for the latest.' },
          version: { type: 'string', description: "Report format version, e.g. '1_0' or '1_3' (subscription reports need a newer version)." },
          full_report: { type: 'boolean' },
          line_limit: { type: 'number', description: 'Preview lines when full_report is false (default 40).' },
        },
        required: ['vendor_number', 'report_type', 'report_sub_type', 'frequency'],
      },
      handler: async (args) => {
        const query: Record<string, unknown> = {
          'filter[vendorNumber]': requireString(args.vendor_number, 'vendor_number'),
          'filter[reportType]': requireString(args.report_type, 'report_type'),
          'filter[reportSubType]': requireString(args.report_sub_type, 'report_sub_type'),
          'filter[frequency]': requireString(args.frequency, 'frequency'),
          'filter[reportDate]': optionalString(args.report_date),
          'filter[version]': optionalString(args.version),
        };
        const res = await asc.requestText({ method: 'GET', path: '/salesReports', accept: 'application/a-gzip', query });
        return previewResult(res.text, Boolean(args.full_report), lineLimitOf(args.line_limit), {
          report_type: query['filter[reportType]'],
          frequency: query['filter[frequency]'],
          report_date: query['filter[reportDate]'] ?? null,
        });
      },
    },
    {
      name: 'asc_download_offer_code_values',
      description:
        'Download the actual one-time-use offer codes (CSV) for a batch made with asc_subscription_offer_code_one_time_codes or asc_iap_offer_code_one_time_codes.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['subscription', 'in_app_purchase'] },
          one_time_codes_id: { type: 'string', description: 'Id of the one-time-use code batch' },
          full_report: { type: 'boolean', description: 'Return every code (default true)' },
          line_limit: { type: 'number', description: 'Preview lines when full_report is false (default 40).' },
        },
        required: ['kind', 'one_time_codes_id'],
      },
      handler: async (args) => {
        const kind = requireString(args.kind, 'kind');
        const base =
          kind === 'subscription'
            ? '/v1/subscriptionOfferCodeOneTimeUseCodes'
            : kind === 'in_app_purchase'
              ? '/v1/inAppPurchaseOfferCodeOneTimeUseCodes'
              : null;
        if (!base) throw new Error("kind must be 'subscription' or 'in_app_purchase'");
        const id = safeId(args.one_time_codes_id, 'one_time_codes_id');
        const res = await asc.requestText({ method: 'GET', path: `${base}/${id}/values`, accept: 'text/csv' });
        return previewResult(res.text, args.full_report !== false, lineLimitOf(args.line_limit), { kind, one_time_codes_id: id });
      },
    },
    {
      name: 'asc_get_performance_data',
      description:
        "Read Apple's performance and diagnostics data: power_metrics (hangs, launch, memory, battery, disk, terminations) for an app or build, overview for an app, or diagnostic_logs for a diagnostic signature (find signatures with asc_diagnostic_signatures, parent=build).",
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['power_metrics', 'overview', 'diagnostic_logs'] },
          app_id: { type: 'string', description: 'power_metrics or overview' },
          build_id: { type: 'string', description: 'power_metrics for one build (instead of app_id)' },
          signature_id: { type: 'string', description: 'diagnostic_logs' },
          query: {
            type: 'object',
            additionalProperties: true,
            description: 'e.g. {"filter[metricType]":"HANG,LAUNCH","filter[platform]":"IOS"} or {"limit":5}',
          },
        },
        required: ['kind'],
      },
      handler: async (args) => {
        const kind = requireString(args.kind, 'kind');
        const query = args.query && typeof args.query === 'object' ? (args.query as Record<string, unknown>) : undefined;
        let path: string;
        let accept: string;
        if (kind === 'power_metrics') {
          const build = optionalString(args.build_id);
          path = build
            ? `/v1/builds/${safeId(build, 'build_id')}/perfPowerMetrics`
            : `/v1/apps/${safeId(args.app_id, 'app_id')}/perfPowerMetrics`;
          accept = 'application/vnd.apple.xcode-metrics+json';
        } else if (kind === 'overview') {
          path = `/v1/apps/${safeId(args.app_id, 'app_id')}/performanceOverviews`;
          accept = 'application/vnd.apple.xcode-overview+json';
        } else if (kind === 'diagnostic_logs') {
          path = `/v1/diagnosticSignatures/${safeId(args.signature_id, 'signature_id')}/logs`;
          accept = 'application/vnd.apple.diagnostic-logs+json';
        } else {
          throw new Error("kind must be 'power_metrics', 'overview', or 'diagnostic_logs'");
        }
        const res = await asc.requestText({ method: 'GET', path, accept, query });
        const out = capped(res.text);
        return out.truncated ? `${out.text}\n\n[truncated: showing ${MAX_CHARS} of ${out.total_chars} chars; narrow with query filters]` : out.text;
      },
    },
  ];
}
