import type { AscHttpClient } from '../asc/http.js';
import type { ToolDef } from './registry.js';
import { requireWriteConfirm } from '../safety.js';
import { optionalString, requireString } from './helpers.js';
import { PATHS, READS, WRITES, type WriteShape } from '../spec/asc-spec.js';

// One tool per App Store Connect feature. Each tool takes an `action`; the
// actions it offers come from Apple's spec (src/spec/asc-spec.ts), so a tool can
// never call an endpoint Apple does not have.

export type Family = {
  tool: string;
  summary: string;
  // Collection path, e.g. '/v1/appCustomProductPages'. Create is POST here,
  // get/update/delete use `${base}/{id}`. Missing methods are left out.
  base: string;
  // Ways to list: parent name -> path template with {id}.
  parents?: Record<string, string>;
  // Set when the bytes must go through asc_upload_asset; hides 'create'.
  uploadKind?: string;
};

export const FAMILIES: Family[] = [
  // Ratings and Reviews
  {
    tool: 'asc_customer_reviews',
    summary: 'App Store customer reviews (read-only). Filter with query, e.g. {"sort":"-createdDate","filter[rating]":"1"}.',
    base: '/v1/customerReviews',
    parents: { app: '/v1/apps/{id}/customerReviews', app_store_version: '/v1/appStoreVersions/{id}/customerReviews' },
  },
  {
    tool: 'asc_customer_review_responses',
    summary: 'Developer replies to customer reviews. Create needs attributes.responseBody and relationships.review.',
    base: '/v1/customerReviewResponses',
    parents: { customer_review: '/v1/customerReviews/{id}/response' },
  },

  // Custom Product Pages
  {
    tool: 'asc_custom_product_pages',
    summary: 'Custom Product Pages (extra App Store pages for ads and links).',
    base: '/v1/appCustomProductPages',
    parents: { app: '/v1/apps/{id}/appCustomProductPages' },
  },
  {
    tool: 'asc_custom_product_page_versions',
    summary: 'Versions of a Custom Product Page.',
    base: '/v1/appCustomProductPageVersions',
    parents: { custom_product_page: '/v1/appCustomProductPages/{id}/appCustomProductPageVersions' },
  },
  {
    tool: 'asc_custom_product_page_localizations',
    summary: 'Per-language text (promotional text) of a Custom Product Page version.',
    base: '/v1/appCustomProductPageLocalizations',
    parents: {
      custom_product_page_version: '/v1/appCustomProductPageVersions/{id}/appCustomProductPageLocalizations',
    },
  },

  // Product Page Optimization (A/B tests). v2 is Apple's current API.
  {
    tool: 'asc_product_page_experiments',
    summary: 'Product Page Optimization tests (A/B tests of icon, screenshots, previews).',
    base: '/v2/appStoreVersionExperiments',
    parents: {
      app: '/v1/apps/{id}/appStoreVersionExperimentsV2',
      app_store_version: '/v1/appStoreVersions/{id}/appStoreVersionExperimentsV2',
    },
  },
  {
    tool: 'asc_product_page_experiment_treatments',
    summary: 'Treatments (variants) of a Product Page Optimization test.',
    base: '/v1/appStoreVersionExperimentTreatments',
    parents: { experiment: '/v2/appStoreVersionExperiments/{id}/appStoreVersionExperimentTreatments' },
  },
  {
    tool: 'asc_product_page_experiment_treatment_localizations',
    summary: 'Per-language content of a test treatment.',
    base: '/v1/appStoreVersionExperimentTreatmentLocalizations',
    parents: {
      treatment: '/v1/appStoreVersionExperimentTreatments/{id}/appStoreVersionExperimentTreatmentLocalizations',
    },
  },

  // Asset Library (new in API 4.5.1)
  {
    tool: 'asc_asset_library',
    summary: "An app's Asset Library (shared store of images and videos). List with parent=app to get the library id.",
    base: '/v1/appAssetLibraries',
    parents: { app: '/v1/apps/{id}/assetLibrary' },
  },
  {
    tool: 'asc_asset_library_images',
    summary: 'Images in the Asset Library. Upload new ones with asc_upload_asset kind=asset_library_image.',
    base: '/v1/appAssetLibraryImages',
    parents: { asset_library: '/v1/appAssetLibraries/{id}/images' },
    uploadKind: 'asset_library_image',
  },
  {
    tool: 'asc_asset_library_videos',
    summary: 'Videos in the Asset Library. Upload new ones with asc_upload_asset kind=asset_library_video.',
    base: '/v1/appAssetLibraryVideos',
    parents: { asset_library: '/v1/appAssetLibraries/{id}/videos' },
    uploadKind: 'asset_library_video',
  },
  {
    tool: 'asc_asset_library_placements',
    summary: 'Placements: where an Asset Library image or video is used (product page, custom page, event, test).',
    base: '/v1/appAssetLibraryPlacements',
    parents: {
      image: '/v1/appAssetLibraryImages/{id}/placements',
      video: '/v1/appAssetLibraryVideos/{id}/placements',
      app_store_version_localization: '/v1/appStoreVersionLocalizations/{id}/placements',
      custom_product_page_localization: '/v1/appCustomProductPageLocalizations/{id}/placements',
      app_event_localization: '/v1/appEventLocalizations/{id}/placements',
      treatment_localization: '/v1/appStoreVersionExperimentTreatmentLocalizations/{id}/placements',
    },
  },
  {
    tool: 'asc_asset_library_placement_ordering',
    summary: 'Set the order of placements in a placement group (create only).',
    base: '/v1/appAssetLibraryPlacementOrderingRequests',
  },
  {
    tool: 'asc_asset_library_ref_data',
    summary: 'Reference data for the Asset Library (allowed categories, placement types). list needs no parent and takes no limit.',
    base: '/v1/appAssetLibraryRefData',
  },

  // In-App Events
  {
    tool: 'asc_app_events',
    summary: 'In-App Events shown on the App Store.',
    base: '/v1/appEvents',
    parents: { app: '/v1/apps/{id}/appEvents' },
  },
  {
    tool: 'asc_app_event_localizations',
    summary: 'Per-language name and descriptions of an In-App Event.',
    base: '/v1/appEventLocalizations',
    parents: { app_event: '/v1/appEvents/{id}/localizations' },
  },
  {
    tool: 'asc_app_event_screenshots',
    summary: 'In-App Event images. Upload new ones with asc_upload_asset kind=app_event_screenshot.',
    base: '/v1/appEventScreenshots',
    parents: { app_event_localization: '/v1/appEventLocalizations/{id}/appEventScreenshots' },
    uploadKind: 'app_event_screenshot',
  },
  {
    tool: 'asc_app_event_video_clips',
    summary: 'In-App Event videos. Upload new ones with asc_upload_asset kind=app_event_video_clip.',
    base: '/v1/appEventVideoClips',
    parents: { app_event_localization: '/v1/appEventLocalizations/{id}/appEventVideoClips' },
    uploadKind: 'app_event_video_clip',
  },

  // Featuring, accessibility, promotion
  {
    tool: 'asc_nominations',
    summary: 'Featuring nominations sent to Apple. list needs query {"filter[state]":"DRAFT"} (one of DRAFT, SUBMITTED, ARCHIVED).',
    base: '/v1/nominations',
  },
  {
    tool: 'asc_accessibility_declarations',
    summary: 'App Accessibility declarations (VoiceOver, larger text, dark interface, and so on) per device family.',
    base: '/v1/accessibilityDeclarations',
    parents: { app: '/v1/apps/{id}/accessibilityDeclarations' },
  },
  {
    tool: 'asc_promoted_purchases',
    summary: 'In-app purchases and subscriptions promoted on the App Store page.',
    base: '/v1/promotedPurchases',
    parents: { app: '/v1/apps/{id}/promotedPurchases' },
  },

  // Offers
  {
    tool: 'asc_win_back_offers',
    summary: 'Win-back offers for lapsed subscribers.',
    base: '/v1/winBackOffers',
    parents: { subscription: '/v1/subscriptions/{id}/winBackOffers' },
  },
  {
    tool: 'asc_subscription_offer_codes',
    summary:
      'Subscription offer codes (redeemable codes; these replace promo codes). Free month example: attributes {"name":"Free month","offerMode":"FREE_TRIAL","duration":"ONE_MONTH","numberOfPeriods":1,"offerEligibility":"STACK_WITH_INTRO_OFFERS","customerEligibilities":["NEW"]}, relationships {"subscription":"<id>","prices":["${p1}"]}, included [{"type":"subscriptionOfferCodePrices","id":"${p1}","relationships":{"territory":{"data":{"type":"territories","id":"USA"}}}}]. Then make codes with asc_subscription_offer_code_one_time_codes or asc_subscription_offer_code_custom_codes.',
    base: '/v1/subscriptionOfferCodes',
    parents: { subscription: '/v1/subscriptions/{id}/offerCodes' },
  },
  {
    tool: 'asc_subscription_offer_code_one_time_codes',
    summary: 'Batches of one-time-use codes for a subscription offer code.',
    base: '/v1/subscriptionOfferCodeOneTimeUseCodes',
    parents: { offer_code: '/v1/subscriptionOfferCodes/{id}/oneTimeUseCodes' },
  },
  {
    tool: 'asc_subscription_offer_code_custom_codes',
    summary: 'Custom (vanity) codes for a subscription offer code.',
    base: '/v1/subscriptionOfferCodeCustomCodes',
    parents: { offer_code: '/v1/subscriptionOfferCodes/{id}/customCodes' },
  },
  {
    tool: 'asc_iap_offer_codes',
    summary: 'In-app purchase offer codes.',
    base: '/v1/inAppPurchaseOfferCodes',
    parents: { in_app_purchase: '/v2/inAppPurchases/{id}/offerCodes' },
  },
  {
    tool: 'asc_iap_offer_code_one_time_codes',
    summary: 'Batches of one-time-use codes for an in-app purchase offer code.',
    base: '/v1/inAppPurchaseOfferCodeOneTimeUseCodes',
    parents: { offer_code: '/v1/inAppPurchaseOfferCodes/{id}/oneTimeUseCodes' },
  },
  {
    tool: 'asc_iap_offer_code_custom_codes',
    summary: 'Custom (vanity) codes for an in-app purchase offer code.',
    base: '/v1/inAppPurchaseOfferCodeCustomCodes',
    parents: { offer_code: '/v1/inAppPurchaseOfferCodes/{id}/customCodes' },
  },

  // Screenshots and previews (product page, custom pages, tests)
  {
    tool: 'asc_screenshot_sets',
    summary: 'Screenshot sets (one per display type) on a product page, custom page, or test treatment.',
    base: '/v1/appScreenshotSets',
    parents: {
      app_store_version_localization: '/v1/appStoreVersionLocalizations/{id}/appScreenshotSets',
      custom_product_page_localization: '/v1/appCustomProductPageLocalizations/{id}/appScreenshotSets',
      treatment_localization: '/v1/appStoreVersionExperimentTreatmentLocalizations/{id}/appScreenshotSets',
    },
  },
  {
    tool: 'asc_screenshots',
    summary: 'Screenshots in a set. Upload new ones with asc_upload_asset kind=app_screenshot.',
    base: '/v1/appScreenshots',
    parents: { screenshot_set: '/v1/appScreenshotSets/{id}/appScreenshots' },
    uploadKind: 'app_screenshot',
  },
  {
    tool: 'asc_preview_sets',
    summary: 'App preview (video) sets on a product page, custom page, or test treatment.',
    base: '/v1/appPreviewSets',
    parents: {
      app_store_version_localization: '/v1/appStoreVersionLocalizations/{id}/appPreviewSets',
      custom_product_page_localization: '/v1/appCustomProductPageLocalizations/{id}/appPreviewSets',
      treatment_localization: '/v1/appStoreVersionExperimentTreatmentLocalizations/{id}/appPreviewSets',
    },
  },
  {
    tool: 'asc_previews',
    summary: 'App preview videos in a set. Upload new ones with asc_upload_asset kind=app_preview.',
    base: '/v1/appPreviews',
    parents: { preview_set: '/v1/appPreviewSets/{id}/appPreviews' },
    uploadKind: 'app_preview',
  },
];

type Action = 'list' | 'get' | 'create' | 'update' | 'delete';
const WRITE_ACTIONS = new Set<Action>(['create', 'update', 'delete']);

const has = (path: string, method: string) => (PATHS[path] ?? []).includes(method);

export function familyActions(f: Family): Action[] {
  const item = `${f.base}/{id}`;
  const actions: Action[] = [];
  if (has(f.base, 'GET') || Object.keys(f.parents ?? {}).length) actions.push('list');
  if (has(item, 'GET')) actions.push('get');
  if (has(f.base, 'POST') && !f.uploadKind) actions.push('create');
  if (has(item, 'PATCH')) actions.push('update');
  if (has(item, 'DELETE')) actions.push('delete');
  return actions;
}

function fill(template: string, id: string): string {
  // '.' and '..' survive encodeURIComponent and would change the path.
  if (/^\.+$/.test(id)) throw new Error(`Invalid id '${id}'`);
  return template.replace('{id}', encodeURIComponent(id));
}

// Turns {"app":"123","items":["a","b"]} into JSON:API relationship objects,
// using the types Apple's spec declares for this exact endpoint.
export function buildRelationships(
  shape: WriteShape,
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input)) {
    const rel = shape.relationships[name];
    if (!rel) {
      const valid = Object.keys(shape.relationships).join(', ') || 'none';
      throw new Error(`Unknown relationship '${name}'. Valid: ${valid}`);
    }
    if (value === null) {
      out[name] = { data: rel.many ? [] : null }; // clear the link
    } else if (typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
      out[name] = value; // already JSON:API
    } else if (rel.many) {
      const ids = Array.isArray(value) ? value : [value];
      out[name] = { data: ids.map((id) => ({ type: rel.type, id: String(id) })) };
    } else {
      out[name] = { data: { type: rel.type, id: String(value) } };
    }
  }
  return out;
}

function checkRequired(shape: WriteShape, attributes: Record<string, unknown>, rels: Record<string, unknown>): void {
  const missingAttrs = shape.requiredAttributes.filter((a) => attributes[a] === undefined);
  const missingRels = Object.entries(shape.relationships)
    .filter(([name, r]) => r.required && rels[name] === undefined)
    .map(([name]) => name);
  const parts: string[] = [];
  if (missingAttrs.length) parts.push(`attributes: ${missingAttrs.join(', ')}`);
  if (missingRels.length) parts.push(`relationships: ${missingRels.join(', ')}`);
  if (parts.length) throw new Error(`Missing required ${parts.join('; ')}`);
}

function describeShape(shape: WriteShape | undefined): string {
  if (!shape) return '';
  const rels = Object.entries(shape.relationships)
    .map(([n, r]) => `${n}${r.required ? '*' : ''}${r.many ? '[]' : ''}`)
    .join(', ');
  const attrs = shape.attributes.map((a) => (shape.requiredAttributes.includes(a) ? `${a}*` : a)).join(', ');
  return `attributes: ${attrs || 'none'}; relationships: ${rels || 'none'}`;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function buildFamilyTool(asc: AscHttpClient, f: Family): ToolDef {
  const actions = familyActions(f);
  const parents = Object.keys(f.parents ?? {});
  const createShape = WRITES[`POST ${f.base}`];
  const updateShape = WRITES[`PATCH ${f.base}/{id}`];

  const notes = [f.summary, `Actions: ${actions.join(', ')}.`];
  if (parents.length) notes.push(`list by parent: ${parents.join(', ')} (with parent_id).`);
  if (actions.includes('create')) notes.push(`create ${describeShape(createShape)} (* = required).`);
  if (actions.includes('create') && createShape?.acceptsIncluded) {
    notes.push('create also takes included: new linked items such as prices, referenced by local ids.');
  }
  if (actions.includes('update')) notes.push(`update ${describeShape(updateShape)}.`);
  notes.push('Relationships take ids, e.g. {"app":"123"}. create/update/delete need confirm=true and reason.');

  return {
    name: f.tool,
    description: notes.join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: actions },
        id: { type: 'string', description: 'Resource id (get, update, delete)' },
        ...(parents.length
          ? {
              parent: { type: 'string', enum: parents, description: 'What to list under (list)' },
              parent_id: { type: 'string', description: 'Id of the parent (list)' },
            }
          : {}),
        attributes: { type: 'object', additionalProperties: true, description: 'Fields to set (create, update)' },
        relationships: {
          type: 'object',
          additionalProperties: true,
          description: 'Linked items by id, e.g. {"app":"123"} or {"items":["a","b"]} (create, update)',
        },
        ...(createShape?.acceptsIncluded
          ? {
              included: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
                description:
                  'New linked items created in the same request (create), e.g. prices. Give each a local id like "${p1}" and list those ids in relationships.',
              },
            }
          : {}),
        query: {
          type: 'object',
          additionalProperties: true,
          description: 'ASC query params, e.g. {"limit":50,"include":"...","filter[state]":"..."} (list, get)',
        },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      const action = requireString(args.action, 'action') as Action;
      if (!actions.includes(action)) {
        const hint = action === 'create' && f.uploadKind ? ` Use asc_upload_asset with kind=${f.uploadKind}.` : '';
        throw new Error(`'${action}' is not available for ${f.tool}. Available: ${actions.join(', ')}.${hint}`);
      }
      if (WRITE_ACTIONS.has(action)) {
        requireWriteConfirm({ confirm: args.confirm, reason: optionalString(args.reason) });
      }
      const query = asObject(args.query);
      const attributes = asObject(args.attributes) ?? {};
      const relInput = asObject(args.relationships);

      let res;
      if (action === 'list') {
        const parent = optionalString(args.parent);
        let path = f.base;
        if (parent) {
          const template = f.parents?.[parent];
          if (!template) throw new Error(`Unknown parent '${parent}'. Valid: ${parents.join(', ')}`);
          path = fill(template, requireString(args.parent_id, 'parent_id'));
        } else if (!has(f.base, 'GET')) {
          throw new Error(`list needs parent (${parents.join(', ')}) and parent_id`);
        }
        res = await asc.request({ method: 'GET', path, query });
      } else if (action === 'get') {
        const id = requireString(args.id, 'id');
        res = await asc.request({ method: 'GET', path: fill(`${f.base}/{id}`, id), query });
      } else if (action === 'create') {
        const relationships = createShape ? buildRelationships(createShape, relInput) : relInput;
        if (createShape) checkRequired(createShape, attributes, relationships ?? {});
        const type = createShape?.type ?? f.base.split('/').pop()!;
        const data: Record<string, unknown> = { type, attributes };
        if (relationships) data.relationships = relationships;
        const body: Record<string, unknown> = { data };
        if (args.included !== undefined) {
          if (!createShape?.acceptsIncluded) throw new Error(`create for ${f.tool} does not take 'included'`);
          if (!Array.isArray(args.included)) throw new Error("'included' must be an array");
          body.included = args.included;
        }
        res = await asc.request({ method: 'POST', path: f.base, body });
      } else if (action === 'update') {
        const id = requireString(args.id, 'id');
        const relationships = updateShape ? buildRelationships(updateShape, relInput) : relInput;
        const type = updateShape?.type ?? f.base.split('/').pop()!;
        const data: Record<string, unknown> = { type, id, attributes };
        if (relationships) data.relationships = relationships;
        res = await asc.request({ method: 'PATCH', path: fill(`${f.base}/{id}`, id), body: { data } });
      } else {
        const id = requireString(args.id, 'id');
        res = await asc.request({ method: 'DELETE', path: fill(`${f.base}/{id}`, id) });
        return JSON.stringify({ ok: true, deleted: id, status: res.status }, null, 2);
      }
      return JSON.stringify(res.json, null, 2);
    },
  };
}

const snake = (s: string) =>
  s
    .replace(/V(\d)$/, '_v$1')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
const humanize = (s: string) => {
  const words = snake(s).replace(/_v\d$/, '').split('_');
  return [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
};
const singular = (s: string) => (s.endsWith('ies') ? `${s.slice(0, -3)}y` : s.endsWith('s') ? s.slice(0, -1) : s);

// Every other resource type in Apple's spec gets a generated tool, so the
// whole API has a checked tool, not only the hand-described features above.
export function autoFamilies(curated: Family[] = FAMILIES): Family[] {
  const curatedTypes = new Set(curated.map((f) => f.base.split('/')[2]));
  const ownVersions = new Map<string, number>();
  for (const path of Object.keys(PATHS)) {
    const m = /^\/v(\d+)\/([A-Za-z]+)(\/\{id\})?$/.exec(path);
    if (!m) continue;
    const [, version, type] = m;
    // Endpoints that return files instead of JSON:API have dedicated tools.
    const get = PATHS[path].includes('GET');
    const writable = PATHS[path].some((x) => x !== 'GET');
    if (get && !READS[path] && !writable) continue;
    ownVersions.set(type, Math.max(ownVersions.get(type) ?? 0, Number(version)));
  }

  const families: Family[] = [];
  for (const [type, version] of [...ownVersions].sort(([a], [b]) => a.localeCompare(b))) {
    if (curatedTypes.has(type)) continue;
    const base = `/v${version}/${type}`;
    // Parent key = parent type, plus the link name when the link is not simply
    // "all <type> of this parent" (e.g. app_info_primary_category). When Apple
    // has old and new versions of the same list, the newest wins.
    const parents: Record<string, string> = {};
    const rank: Record<string, number> = {};
    for (const [path, read] of Object.entries(READS)) {
      if (read.type !== type) continue;
      const m = /^\/v(\d+)\/([A-Za-z]+)\/\{id\}\/([A-Za-z]+?)(?:V(\d+))?$/.exec(path);
      if (!m) continue;
      const [, pathVersion, parentType, link, linkVersion] = m;
      const key = link === type ? snake(singular(parentType)) : `${snake(singular(parentType))}_${snake(link)}`;
      const r = Number(pathVersion) * 100 + Number(linkVersion ?? 1);
      if (rank[key] !== undefined && rank[key] >= r) continue;
      rank[key] = r;
      parents[key] = path;
    }
    families.push({
      tool: `asc_${snake(type)}`.slice(0, 64),
      summary: `${humanize(type)} (${type}; generated from Apple's App Store Connect API spec).`,
      base,
      ...(Object.keys(parents).length ? { parents } : {}),
    });
  }
  return families.filter((f) => familyActions(f).length > 0);
}

export function buildResourceTools(asc: AscHttpClient): ToolDef[] {
  return [...FAMILIES, ...autoFamilies()].map((f) => buildFamilyTool(asc, f));
}
