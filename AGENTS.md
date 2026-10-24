# App Store Connect MCP

An MCP server (stdio) and a web API with a remote MCP endpoint, both exposing Apple's App Store Connect API as tools. TypeScript, ES modules, Node 20+. Dependencies: `@modelcontextprotocol/sdk` and `jose`.

This file is for AI agents that work **on** this code. If you are an agent that **uses** the server, read the [README](README.md).

## Build, test
- Install and build: `npm install && npm run build` (output in `dist/`, git-ignored).
- Typecheck: `npm run typecheck`.
- Test: `npm test` (builds, then runs `node --test test/**/*.test.mjs`). The tests use fakes and need no Apple credentials. Run the whole suite before you say something works.
- Run the stdio server: `ASC_ISSUER_ID=... ASC_KEY_ID=... ASC_PRIVATE_KEY_FILE=... node dist/index.js`.
- Run the web API locally: `ASC_API_READ_TOKENS='me:<24+ chars>' npm run serve` (127.0.0.1, port 8787).
- Do not call the real Apple API, deploy to Vercel, or upload anything unless asked.

## Code map
- `src/index.ts`: stdio MCP server entry point.
- `src/asc/`: `env.ts` (env vars, private key loading), `jwt.ts` (signs short-lived ES256 tokens), `http.ts` (Apple HTTP client, retries, gzip, debug redaction).
- `src/safety.ts`: `requireWriteConfirm`. Only JSON `true` confirms; a non-empty `reason` is required.
- `src/tools/tools.ts`: `buildTools`, which assembles every tool, and the hand-written core tools. Other files: `analytics.ts`, `files.ts` (sales, offer code, performance downloads), `assets.ts` (`asc_upload_asset`), `upload.ts` (`asc_upload_build` via `altool`), `expedite.ts`, `resources.ts` (feature tools and generated tools from the spec), `helpers.ts`, `registry.ts` (the `ToolDef` type).
- `src/spec/asc-spec.ts`: snapshot of Apple's OpenAPI spec. Regenerate with `scripts/gen-spec.mjs`; do not edit by hand.
- `src/http/`: `app.ts` (web API: routes, token checks, `isReadCall` allowlist, write log, OpenAPI, remote MCP at `/mcp`), `serve.ts` (local server). `api/index.js` and `vercel.json` are the Vercel entry.
- `test/`: Node test runner files (`*.test.mjs`) that import from `dist/`.
- `docs/tools.md`: the generated-tool list. Keep it in sync with the spec snapshot.

## Conventions
- Match the surrounding code: naming, comment density, idiom. Comments say **why**, not what.
- **Writes are gated.** Every POST, PATCH or DELETE path calls `requireWriteConfirm` first. Never retry a write after a 5xx or a dropped connection (only 429 is safe to retry).
- **Read tokens use an allowlist** (`isReadCall` in `src/http/app.ts`), not each tool's own check. New tools are not readable by a read token unless they match it. Extend the test that pins the read-token tool set when you add tools.
- Never log or return the private key, a bearer token or a signed JWT. Keep `ASC_DEBUG` redaction intact.
- `asc_upload_build`, `asc_upload_asset` and `asc_prepare_expedite` need the local machine. They are listed in `LOCAL_ONLY` and are not served by the web API.
- Do not add dependencies without discussion.
- Never commit credentials, `.p8` files, tokens, vendor numbers or real account data. Use placeholders in docs and tests.
- Update the README, `docs/tools.md` and `CHANGELOG.md` when you change tools, environment variables or routes.
