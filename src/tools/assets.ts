import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { AscHttpClient } from '../asc/http.js';
import type { ToolDef } from './registry.js';
import { requireWriteConfirm } from '../safety.js';
import { optionalString, requireString } from './helpers.js';
import { WRITES } from '../spec/asc-spec.js';
import { buildRelationships } from './resources.js';

// Every App Store Connect file upload has three steps:
//   1. POST the resource with fileName + fileSize (Apple replies with uploadOperations)
//   2. PUT each byte range to the URL Apple gave (no ASC auth header)
//   3. PATCH uploaded=true (+ sourceFileChecksum where the endpoint accepts it)
export const UPLOAD_KINDS: Record<string, { base: string; parent: string; note?: string }> = {
  app_screenshot: { base: '/v1/appScreenshots', parent: 'appScreenshotSet' },
  app_preview: { base: '/v1/appPreviews', parent: 'appPreviewSet' },
  app_event_screenshot: {
    base: '/v1/appEventScreenshots',
    parent: 'appEventLocalization',
    note: 'needs attributes.appEventAssetType (EVENT_CARD or EVENT_DETAILS_PAGE)',
  },
  app_event_video_clip: {
    base: '/v1/appEventVideoClips',
    parent: 'appEventLocalization',
    note: 'needs attributes.appEventAssetType',
  },
  asset_library_image: {
    base: '/v1/appAssetLibraryImages',
    parent: 'assetLibrary',
    note: 'needs attributes.category (see asc_asset_library_ref_data)',
  },
  asset_library_video: {
    base: '/v1/appAssetLibraryVideos',
    parent: 'assetLibrary',
    note: 'needs attributes.category (see asc_asset_library_ref_data)',
  },
  iap_review_screenshot: { base: '/v1/inAppPurchaseAppStoreReviewScreenshots', parent: 'inAppPurchaseV2' },
  subscription_review_screenshot: { base: '/v1/subscriptionAppStoreReviewScreenshots', parent: 'subscription' },
};

type UploadOperation = {
  method?: string;
  url: string;
  offset?: number;
  length?: number;
  requestHeaders?: Array<{ name: string; value: string }>;
};

export function buildAssetTools(asc: AscHttpClient, fetchImpl: typeof fetch = (...a) => fetch(...a)): ToolDef[] {
  const kindList = Object.entries(UPLOAD_KINDS)
    .map(([k, v]) => `${k} (parent: ${v.parent}${v.note ? `; ${v.note}` : ''})`)
    .join('; ');

  return [
    {
      name: 'asc_upload_asset',
      description: `Upload an image or video file to App Store Connect: reserve, send the bytes, then confirm. Kinds: ${kindList}. Requires confirm=true and reason.`,
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: Object.keys(UPLOAD_KINDS) },
          file_path: { type: 'string', description: 'Absolute path to the file' },
          parent_id: { type: 'string', description: 'Id of the parent (screenshot set, event localization, asset library, ...)' },
          attributes: { type: 'object', additionalProperties: true, description: 'Extra fields, e.g. {"category":"..."}' },
          confirm: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['kind', 'file_path', 'parent_id', 'confirm', 'reason'],
      },
      handler: async (args) => {
        requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
        const kindName = requireString(args.kind, 'kind');
        const kind = UPLOAD_KINDS[kindName];
        if (!kind) throw new Error(`Unknown kind '${kindName}'. Valid: ${Object.keys(UPLOAD_KINDS).join(', ')}`);
        const filePath = requireString(args.file_path, 'file_path');
        const parentId = requireString(args.parent_id, 'parent_id');
        const extra = (args.attributes && typeof args.attributes === 'object' ? args.attributes : {}) as Record<string, unknown>;

        const createShape = WRITES[`POST ${kind.base}`];
        const updateShape = WRITES[`PATCH ${kind.base}/{id}`];
        if (!createShape || !updateShape) throw new Error(`Spec has no upload endpoints for ${kind.base}`);

        const bytes = readFileSync(filePath);
        const attributes = { ...extra, fileName: basename(filePath), fileSize: bytes.length };
        const missing = createShape.requiredAttributes.filter((a) => attributes[a as keyof typeof attributes] === undefined);
        if (missing.length) throw new Error(`Missing required attributes: ${missing.join(', ')}`);

        // 1. Reserve
        const created = await asc.request({
          method: 'POST',
          path: kind.base,
          body: {
            data: {
              type: createShape.type,
              attributes,
              relationships: buildRelationships(createShape, { [kind.parent]: parentId }),
            },
          },
        });
        const id: string = created.json?.data?.id;
        const ops: UploadOperation[] = created.json?.data?.attributes?.uploadOperations ?? [];
        if (!id || !ops.length) throw new Error('Apple did not return an id and upload operations');

        // 2. Send each part
        for (const op of ops) {
          const start = op.offset ?? 0;
          const end = op.length === undefined ? bytes.length : start + op.length;
          const headers: Record<string, string> = {};
          for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
          const res = await fetchImpl(op.url, { method: op.method ?? 'PUT', headers, body: bytes.subarray(start, end) });
          if (!res.ok) throw new Error(`Upload part at offset ${start} failed: HTTP ${res.status}. Reserved id ${id} was not confirmed.`);
        }

        // 3. Confirm
        const commit: Record<string, unknown> = { uploaded: true };
        if (updateShape.attributes.includes('sourceFileChecksum')) {
          commit.sourceFileChecksum = createHash('md5').update(bytes).digest('hex');
        }
        const done = await asc.request({
          method: 'PATCH',
          path: `${kind.base}/${encodeURIComponent(id)}`,
          body: { data: { type: updateShape.type, id, attributes: commit } },
        });
        return JSON.stringify(
          {
            ok: true,
            kind: kindName,
            id,
            parts_uploaded: ops.length,
            bytes: bytes.length,
            asset_delivery_state: done.json?.data?.attributes?.assetDeliveryState ?? null,
            note: 'Apple processes the file after upload. Check it later with the get action of the matching tool.',
          },
          null,
          2,
        );
      },
    },
  ];
}
