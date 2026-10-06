import { spawn } from 'node:child_process';

import type { AscHttpClient } from '../asc/http.js';
import type { ToolDef } from './registry.js';
import { requireString } from './helpers.js';

// Apple has no App Store Connect API endpoint for expedited review (checked
// against OpenAPI spec 4.5: 973 paths, zero mention "expedite"). The only route
// is this web form behind an Apple ID login, so the tool prepares everything and
// a person submits the form.
export const EXPEDITE_FORM_URL = 'https://developer.apple.com/contact/app-store/?topic=expedite';

// Apple only accepts expedite requests for a version that is in the review queue.
const EXPEDITABLE_STATES = new Set(['WAITING_FOR_REVIEW']);

export type LocalEffects = {
  copyToClipboard: (text: string) => Promise<boolean>;
  openUrl: (url: string) => Promise<boolean>;
};

function run(cmd: string, args: string[], stdin?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: [stdin === undefined ? 'ignore' : 'pipe', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
    if (stdin !== undefined) child.stdin?.end(stdin);
  });
}

const macEffects: LocalEffects = {
  copyToClipboard: (text) => (process.platform === 'darwin' ? run('pbcopy', [], text) : Promise.resolve(false)),
  openUrl: (url) => (process.platform === 'darwin' ? run('open', [url]) : Promise.resolve(false)),
};

export function buildExpediteTools(asc: AscHttpClient, effects: LocalEffects = macEffects): ToolDef[] {
  const tools: ToolDef[] = [];

  tools.push({
    name: 'asc_prepare_expedite',
    description:
      "Prepare an expedited App Review request. Apple has NO API for this; it is a web form behind an Apple ID login. This tool checks the version is WAITING_FOR_REVIEW, builds paste-ready text, copies it to the clipboard, and opens Apple's form in the browser. A signed-in person must paste and click Submit. Makes no changes in App Store Connect.",
    inputSchema: {
      type: 'object',
      properties: {
        version_id: { type: 'string', description: 'App Store version id (from asc_list_app_store_versions)' },
        justification: {
          type: 'string',
          description: 'Why Apple should expedite, e.g. the critical bug this build fixes and who it affects',
        },
        open_form: { type: 'boolean', description: 'Open the form in the browser (default true)' },
      },
      required: ['version_id', 'justification'],
    },
    handler: async (args) => {
      const versionId = requireString(args.version_id, 'version_id');
      const justification = requireString(args.justification, 'justification');
      const openForm = args.open_form !== false;

      const res = await asc.request({
        method: 'GET',
        path: `/appStoreVersions/${versionId}`,
        query: { include: 'app' },
      });
      const json = res.json as any;
      const attrs = json?.data?.attributes ?? {};
      const app = (json?.included ?? []).find((r: any) => r?.type === 'apps');
      const state: string = attrs.appVersionState ?? attrs.appStoreState ?? 'UNKNOWN';

      const summary = {
        app_name: app?.attributes?.name ?? null,
        app_apple_id: app?.id ?? null,
        bundle_id: app?.attributes?.bundleId ?? null,
        version: attrs.versionString ?? null,
        platform: attrs.platform ?? null,
        state,
      };

      if (!EXPEDITABLE_STATES.has(state)) {
        return JSON.stringify(
          {
            ok: false,
            ...summary,
            message: `Version is ${state}, not WAITING_FOR_REVIEW. Submit it for review first; Apple only expedites versions in the review queue.`,
          },
          null,
          2,
        );
      }

      const pasteText = [
        `App: ${summary.app_name ?? 'unknown'} (Apple ID ${summary.app_apple_id ?? 'unknown'}, ${summary.bundle_id ?? 'unknown'})`,
        `Version: ${summary.version ?? 'unknown'} (${summary.platform ?? 'unknown'})`,
        '',
        justification,
      ].join('\n');

      const copied = await effects.copyToClipboard(pasteText);
      const opened = openForm ? await effects.openUrl(EXPEDITE_FORM_URL) : false;

      return JSON.stringify(
        {
          ok: true,
          ...summary,
          form_url: EXPEDITE_FORM_URL,
          copied_to_clipboard: copied,
          opened_form: opened,
          paste_text: pasteText,
          next_step:
            'A person signed in to the Apple Developer account must choose the app and platform on the form, paste the text into the description field, and click Submit. This tool did not submit anything.',
        },
        null,
        2,
      );
    },
  });

  return tools;
}
