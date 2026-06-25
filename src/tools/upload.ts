import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ToolDef } from './registry.js';
import { requireWriteConfirm } from '../safety.js';
import { optionalString, requireString } from './helpers.js';
import { requireEnv, resolvePrivateKey } from '../asc/env.js';
import { normalizePrivateKey } from '../asc/jwt.js';

// altool's -t (platform) accepted values, keyed by friendly input.
const PLATFORM_MAP: Record<string, string> = {
  ios: 'ios',
  macos: 'macos',
  osx: 'macos',
  appletvos: 'appletvos',
  tvos: 'appletvos',
  visionos: 'visionos',
};

const UPLOAD_TIMEOUT_MS = 20 * 60 * 1000; // altool can take several minutes.

type AltoolResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

function runAltool(
  altoolArgs: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<AltoolResult> {
  return new Promise((resolve) => {
    const child = spawn('xcrun', altoolArgs, { env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\nspawn error: ${err.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

export function buildUploadTools(): ToolDef[] {
  const tools: ToolDef[] = [];

  tools.push({
    name: 'asc_upload_build',
    description:
      "Upload an .ipa (or .pkg) to App Store Connect via altool, using the server's configured ASC API key (ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY). No secret is passed by the caller. Requires confirm=true and reason. Runs altool and can take several minutes.",
    inputSchema: {
      type: 'object',
      properties: {
        ipa_path: { type: 'string', description: 'Absolute path to the .ipa (or .pkg) to upload' },
        platform: {
          type: 'string',
          description: 'ios (default), macos, appletvos, or visionos',
        },
        confirm: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['ipa_path', 'confirm', 'reason'],
    },
    handler: async (args) => {
      requireWriteConfirm({ confirm: Boolean(args.confirm), reason: optionalString(args.reason) });

      const ipaPath = requireString(args.ipa_path, 'ipa_path');
      if (!existsSync(ipaPath)) {
        throw new Error(`ipa_path does not exist: ${ipaPath}`);
      }

      const platformInput = (optionalString(args.platform) ?? 'ios').toLowerCase();
      const platform = PLATFORM_MAP[platformInput];
      if (!platform) {
        throw new Error(
          `Unsupported platform '${platformInput}' (use ios, macos, appletvos, or visionos)`,
        );
      }

      // Reuse the server's existing credential resolution + key normalization.
      const keyId = requireEnv('ASC_KEY_ID');
      const issuerId = requireEnv('ASC_ISSUER_ID');
      const privateKey = normalizePrivateKey(resolvePrivateKey());

      // altool finds the key by name in API_PRIVATE_KEYS_DIR: AuthKey_<keyId>.p8
      const dir = mkdtempSync(join(tmpdir(), 'asc-upload-'));
      const keyPath = join(dir, `AuthKey_${keyId}.p8`);
      try {
        writeFileSync(keyPath, privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`, {
          mode: 0o600,
        });

        const altoolArgs = [
          'altool',
          '--upload-app',
          '-f',
          ipaPath,
          '-t',
          platform,
          '--apiKey',
          keyId,
          '--apiIssuer',
          issuerId,
          '--output-format',
          'json',
        ];

        const res = await runAltool(
          altoolArgs,
          { ...process.env, API_PRIVATE_KEYS_DIR: dir },
          UPLOAD_TIMEOUT_MS,
        );

        const ok = res.code === 0 && !res.timedOut;
        return JSON.stringify(
          {
            ok,
            uploaded: ok,
            exitCode: res.code,
            timedOut: res.timedOut,
            platform,
            ipa_path: ipaPath,
            stdout: res.stdout.trim(),
            stderr: res.stderr.trim(),
          },
          null,
          2,
        );
      } finally {
        // Always remove the temp key material.
        rmSync(dir, { recursive: true, force: true });
      }
    },
  });

  return tools;
}
