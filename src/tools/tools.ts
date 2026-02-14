import type { ToolDef } from './registry.js';
import { requireWriteConfirm } from '../safety.js';
import { requireObject, requireString, optionalString } from './helpers.js';
import { AscHttpClient } from '../asc/http.js';

function requirePathUnderV1(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!p.startsWith('/v1/')) {
    throw new Error("path must start with '/v1/'");
  }
  return p.replace(/^\/v1/, ''); // our http client baseUrl includes /v1
}

export function buildTools(asc: AscHttpClient): ToolDef[] {
  const tools: ToolDef[] = [];

  tools.push({
    name: 'asc_ping',
    description: 'Health check. Returns ok=true and the configured ASC base URL.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return JSON.stringify({ ok: true }, null, 2);
    },
  });

  tools.push({
    name: 'asc_request',
    description:
      "Generic App Store Connect request escape hatch. path must start with '/v1/'. Non-GET requires confirm=true and reason.",
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'] },
        path: { type: 'string', description: "Must start with '/v1/'" },
        query: { type: 'object', additionalProperties: true },
        body: { type: 'object', additionalProperties: true },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['method', 'path'],
    },
    handler: async (args) => {
      const method = requireString(args.method, 'method').toUpperCase();
      const path = requirePathUnderV1(requireString(args.path, 'path'));
      if (method !== 'GET') {
        requireWriteConfirm({
          confirm: Boolean(args.confirm),
          reason: optionalString(args.reason),
        });
      }
      const query = args.query && typeof args.query === 'object' ? (args.query as any) : undefined;
      const body = args.body && typeof args.body === 'object' ? (args.body as any) : undefined;
      const res = await asc.request({ method, path, query, body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  // -----------------------
  // Apps
  // -----------------------
  tools.push({
    name: 'asc_list_apps',
    description: 'List apps you have access to.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        'filter[bundleId]': { type: 'string' },
        'filter[name]': { type: 'string' },
      },
    },
    handler: async (args) => {
      const query = args as any;
      const res = await asc.request({ method: 'GET', path: '/apps', query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_app',
    description: 'Get a single app by id.',
    inputSchema: {
      type: 'object',
      properties: { app_id: { type: 'string' } },
      required: ['app_id'],
    },
    handler: async (args) => {
      const appId = requireString(args.app_id, 'app_id');
      const res = await asc.request({ method: 'GET', path: `/apps/${appId}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  // -----------------------
  // App Store Versions
  // -----------------------
  tools.push({
    name: 'asc_list_app_store_versions',
    description: 'List App Store versions for an app.',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string', description: 'ASC include param' },
        sort: { type: 'string' },
      },
      required: ['app_id'],
    },
    handler: async (args) => {
      const appId = requireString(args.app_id, 'app_id');
      const query: any = { ...args };
      delete query.app_id;
      const res = await asc.request({
        method: 'GET',
        path: `/apps/${appId}/appStoreVersions`,
        query,
      });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_app_store_version',
    description: 'Get an App Store version by id.',
    inputSchema: {
      type: 'object',
      properties: { version_id: { type: 'string' } },
      required: ['version_id'],
    },
    handler: async (args) => {
      const versionId = requireString(args.version_id, 'version_id');
      const res = await asc.request({ method: 'GET', path: `/appStoreVersions/${versionId}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_create_app_store_version',
    description: "Create a new App Store version (POST). Requires confirm=true and reason.",
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        platform: { type: 'string', description: 'e.g. IOS' },
        version_string: { type: 'string', description: 'e.g. 1.0.1' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['app_id', 'platform', 'version_string', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const appId = requireString(args.app_id, 'app_id');
      const platform = requireString(args.platform, 'platform');
      const versionString = requireString(args.version_string, 'version_string');
      const body = {
        data: {
          type: 'appStoreVersions',
          attributes: { platform, versionString },
          relationships: { app: { data: { type: 'apps', id: appId } } },
        },
      };
      const res = await asc.request({ method: 'POST', path: '/appStoreVersions', body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_update_app_store_version',
    description: "Patch an App Store version's attributes (PATCH). Requires confirm=true and reason.",
    inputSchema: {
      type: 'object',
      properties: {
        version_id: { type: 'string' },
        attributes: { type: 'object', additionalProperties: true },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['version_id', 'attributes', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const versionId = requireString(args.version_id, 'version_id');
      const attributes = requireObject(args.attributes, 'attributes');
      const body = { data: { type: 'appStoreVersions', id: versionId, attributes } };
      const res = await asc.request({ method: 'PATCH', path: `/appStoreVersions/${versionId}`, body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  // -----------------------
  // Version Localizations
  // -----------------------
  tools.push({
    name: 'asc_list_version_localizations',
    description: 'List localizations for an App Store version.',
    inputSchema: {
      type: 'object',
      properties: {
        version_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
      },
      required: ['version_id'],
    },
    handler: async (args) => {
      const versionId = requireString(args.version_id, 'version_id');
      const query: any = { ...args };
      delete query.version_id;
      const res = await asc.request({
        method: 'GET',
        path: `/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
        query,
      });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_version_localization',
    description: 'Get a version localization by id.',
    inputSchema: {
      type: 'object',
      properties: { localization_id: { type: 'string' } },
      required: ['localization_id'],
    },
    handler: async (args) => {
      const id = requireString(args.localization_id, 'localization_id');
      const res = await asc.request({ method: 'GET', path: `/appStoreVersionLocalizations/${id}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_create_version_localization',
    description:
      'Create a version localization (POST). Requires confirm=true and reason. attributes is passed through as-is.',
    inputSchema: {
      type: 'object',
      properties: {
        version_id: { type: 'string' },
        locale: { type: 'string', description: 'e.g. en-US' },
        attributes: { type: 'object', additionalProperties: true },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['version_id', 'locale', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const versionId = requireString(args.version_id, 'version_id');
      const locale = requireString(args.locale, 'locale');
      const attributes = args.attributes ? requireObject(args.attributes, 'attributes') : {};
      const body = {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale, ...attributes },
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
          },
        },
      };
      const res = await asc.request({ method: 'POST', path: '/appStoreVersionLocalizations', body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_update_version_localization',
    description:
      'Update a version localization attributes (PATCH). Requires confirm=true and reason. attributes is passed through as-is.',
    inputSchema: {
      type: 'object',
      properties: {
        localization_id: { type: 'string' },
        attributes: { type: 'object', additionalProperties: true },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['localization_id', 'attributes', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const id = requireString(args.localization_id, 'localization_id');
      const attributes = requireObject(args.attributes, 'attributes');
      const body = { data: { type: 'appStoreVersionLocalizations', id, attributes } };
      const res = await asc.request({ method: 'PATCH', path: `/appStoreVersionLocalizations/${id}`, body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  // -----------------------
  // Builds / TestFlight
  // -----------------------
  tools.push({
    name: 'asc_list_builds',
    description: 'List builds (optionally filtered by app).',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
        'filter[processingState]': { type: 'string' },
        'filter[version]': { type: 'string' },
      },
    },
    handler: async (args) => {
      const appId = optionalString(args.app_id);
      const query: any = { ...args };
      delete query.app_id;
      const path = appId ? `/apps/${appId}/builds` : '/builds';
      const res = await asc.request({ method: 'GET', path, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_build',
    description: 'Get a build by id.',
    inputSchema: {
      type: 'object',
      properties: { build_id: { type: 'string' } },
      required: ['build_id'],
    },
    handler: async (args) => {
      const buildId = requireString(args.build_id, 'build_id');
      const res = await asc.request({ method: 'GET', path: `/builds/${buildId}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_list_build_beta_details',
    description: 'List beta details for a build.',
    inputSchema: {
      type: 'object',
      properties: {
        build_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['build_id'],
    },
    handler: async (args) => {
      const buildId = requireString(args.build_id, 'build_id');
      const query: any = { ...args };
      delete query.build_id;
      const res = await asc.request({ method: 'GET', path: `/builds/${buildId}/buildBetaDetails`, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_update_build_beta_details',
    description: 'Update build beta details (PATCH). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        build_beta_detail_id: { type: 'string' },
        attributes: { type: 'object', additionalProperties: true },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['build_beta_detail_id', 'attributes', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const id = requireString(args.build_beta_detail_id, 'build_beta_detail_id');
      const attributes = requireObject(args.attributes, 'attributes');
      const body = { data: { type: 'buildBetaDetails', id, attributes } };
      const res = await asc.request({ method: 'PATCH', path: `/buildBetaDetails/${id}`, body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_list_review_submissions',
    description: 'List review submissions (optionally filtered by app).',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
      },
    },
    handler: async (args) => {
      const appId = optionalString(args.app_id);
      const query: any = { ...args };
      delete query.app_id;
      const path = appId ? `/apps/${appId}/reviewSubmissions` : '/reviewSubmissions';
      const res = await asc.request({ method: 'GET', path, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_review_submission',
    description: 'Get a review submission by id.',
    inputSchema: {
      type: 'object',
      properties: { review_submission_id: { type: 'string' } },
      required: ['review_submission_id'],
    },
    handler: async (args) => {
      const id = requireString(args.review_submission_id, 'review_submission_id');
      const res = await asc.request({ method: 'GET', path: `/reviewSubmissions/${id}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_create_review_submission',
    description: 'Create a review submission for an App Store version (POST). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        version_id: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['version_id', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const versionId = requireString(args.version_id, 'version_id');
      const body = {
        data: {
          type: 'reviewSubmissions',
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
          },
        },
      };
      const res = await asc.request({ method: 'POST', path: '/reviewSubmissions', body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_submit_review_submission',
    description: 'Submit a review submission (POST). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        review_submission_id: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['review_submission_id', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const id = requireString(args.review_submission_id, 'review_submission_id');
      const body = { data: { type: 'reviewSubmissions', id } };
      // ASC uses a "submit" relationship endpoint for submission actions.
      const res = await asc.request({ method: 'POST', path: `/reviewSubmissions/${id}/actions/submit`, body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_list_beta_groups',
    description: 'List TestFlight beta groups for an app.',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
      },
      required: ['app_id'],
    },
    handler: async (args) => {
      const appId = requireString(args.app_id, 'app_id');
      const query: any = { ...args };
      delete query.app_id;
      const res = await asc.request({ method: 'GET', path: `/apps/${appId}/betaGroups`, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_beta_group',
    description: 'Get a beta group by id.',
    inputSchema: {
      type: 'object',
      properties: { beta_group_id: { type: 'string' } },
      required: ['beta_group_id'],
    },
    handler: async (args) => {
      const id = requireString(args.beta_group_id, 'beta_group_id');
      const res = await asc.request({ method: 'GET', path: `/betaGroups/${id}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_add_build_to_beta_group',
    description: 'Add a build to a beta group (POST). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        build_id: { type: 'string' },
        beta_group_id: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['build_id', 'beta_group_id', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const buildId = requireString(args.build_id, 'build_id');
      const groupId = requireString(args.beta_group_id, 'beta_group_id');
      const body = { data: [{ type: 'builds', id: buildId }] };
      const res = await asc.request({
        method: 'POST',
        path: `/betaGroups/${groupId}/relationships/builds`,
        body,
      });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_remove_build_from_beta_group',
    description: 'Remove a build from a beta group (DELETE). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        build_id: { type: 'string' },
        beta_group_id: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['build_id', 'beta_group_id', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const buildId = requireString(args.build_id, 'build_id');
      const groupId = requireString(args.beta_group_id, 'beta_group_id');
      const body = { data: [{ type: 'builds', id: buildId }] };
      const res = await asc.request({
        method: 'DELETE',
        path: `/betaGroups/${groupId}/relationships/builds`,
        body,
      });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_list_beta_testers',
    description: 'List TestFlight beta testers (scoped to app or beta group).',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        beta_group_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
      },
    },
    handler: async (args) => {
      const appId = optionalString(args.app_id);
      const betaGroupId = optionalString(args.beta_group_id);
      const query: any = { ...args };
      delete query.app_id;
      delete query.beta_group_id;

      const path = betaGroupId
        ? `/betaGroups/${betaGroupId}/betaTesters`
        : appId
          ? `/apps/${appId}/betaTesters`
          : '/betaTesters';

      const res = await asc.request({ method: 'GET', path, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_create_beta_tester',
    description: 'Create a beta tester (POST). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['email', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const email = requireString(args.email, 'email');
      const firstName = optionalString(args.first_name);
      const lastName = optionalString(args.last_name);

      const attributes: any = { email };
      if (firstName) attributes.firstName = firstName;
      if (lastName) attributes.lastName = lastName;

      const body = { data: { type: 'betaTesters', attributes } };
      const res = await asc.request({ method: 'POST', path: '/betaTesters', body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_add_tester_to_group',
    description: 'Add an existing beta tester to a beta group (POST). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        beta_tester_id: { type: 'string' },
        beta_group_id: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['beta_tester_id', 'beta_group_id', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const testerId = requireString(args.beta_tester_id, 'beta_tester_id');
      const groupId = requireString(args.beta_group_id, 'beta_group_id');
      const body = { data: [{ type: 'betaTesters', id: testerId }] };
      const res = await asc.request({
        method: 'POST',
        path: `/betaGroups/${groupId}/relationships/betaTesters`,
        body,
      });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_remove_tester_from_group',
    description: 'Remove a beta tester from a beta group (DELETE). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        beta_tester_id: { type: 'string' },
        beta_group_id: { type: 'string' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['beta_tester_id', 'beta_group_id', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const testerId = requireString(args.beta_tester_id, 'beta_tester_id');
      const groupId = requireString(args.beta_group_id, 'beta_group_id');
      const body = { data: [{ type: 'betaTesters', id: testerId }] };
      const res = await asc.request({
        method: 'DELETE',
        path: `/betaGroups/${groupId}/relationships/betaTesters`,
        body,
      });
      return JSON.stringify(res.json, null, 2);
    },
  });

  // -----------------------
  // In-App Purchases / Subscriptions (read-first coverage)
  // -----------------------
  tools.push({
    name: 'asc_list_in_app_purchases',
    description: 'List in-app purchases for an app.',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
      },
      required: ['app_id'],
    },
    handler: async (args) => {
      const appId = requireString(args.app_id, 'app_id');
      const query: any = { ...args };
      delete query.app_id;
      const res = await asc.request({ method: 'GET', path: `/apps/${appId}/inAppPurchasesV2`, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_get_in_app_purchase',
    description: 'Get an in-app purchase by id.',
    inputSchema: {
      type: 'object',
      properties: { iap_id: { type: 'string' } },
      required: ['iap_id'],
    },
    handler: async (args) => {
      const id = requireString(args.iap_id, 'iap_id');
      const res = await asc.request({ method: 'GET', path: `/inAppPurchasesV2/${id}` });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_list_subscription_groups',
    description: 'List subscription groups for an app.',
    inputSchema: {
      type: 'object',
      properties: {
        app_id: { type: 'string' },
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
      },
      required: ['app_id'],
    },
    handler: async (args) => {
      const appId = requireString(args.app_id, 'app_id');
      const query: any = { ...args };
      delete query.app_id;
      const res = await asc.request({ method: 'GET', path: `/apps/${appId}/subscriptionGroups`, query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  // -----------------------
  // Devices / Profiles (common provisioning reads + device registration)
  // -----------------------
  tools.push({
    name: 'asc_list_devices',
    description: 'List registered devices (Apple provisioning).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        'filter[platform]': { type: 'string', description: 'e.g. IOS' },
        'filter[status]': { type: 'string' },
      },
    },
    handler: async (args) => {
      const query = args as any;
      const res = await asc.request({ method: 'GET', path: '/devices', query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_register_device',
    description: 'Register a device (POST). Requires confirm=true and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        udid: { type: 'string' },
        platform: { type: 'string', description: 'e.g. IOS' },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['name', 'udid', 'platform', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });
      const name = requireString(args.name, 'name');
      const udid = requireString(args.udid, 'udid');
      const platform = requireString(args.platform, 'platform');
      const body = { data: { type: 'devices', attributes: { name, udid, platform } } };
      const res = await asc.request({ method: 'POST', path: '/devices', body });
      return JSON.stringify(res.json, null, 2);
    },
  });

  tools.push({
    name: 'asc_list_profiles',
    description: 'List provisioning profiles.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        include: { type: 'string' },
        sort: { type: 'string' },
        'filter[profileType]': { type: 'string' },
        'filter[name]': { type: 'string' },
      },
    },
    handler: async (args) => {
      const query = args as any;
      const res = await asc.request({ method: 'GET', path: '/profiles', query });
      return JSON.stringify(res.json, null, 2);
    },
  });

  return tools;
}
