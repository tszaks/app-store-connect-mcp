# Contributing to App Store Connect MCP

Thanks for helping. This server can change a real App Store Connect account, so the bar for changes is: does it stay simple, and does it keep writes safe?

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- For bugs, open an issue with the template. Include the tool name, the arguments (with ids and secrets removed) and the error text.
- For features, open an issue first and describe the job you want an agent to do.
- Small fixes (typos, clear bugs) can go straight to a pull request.
- Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Setup

You need Node 20 or later.

```sh
git clone https://github.com/tszaks/app-store-connect-mcp.git
cd app-store-connect-mcp
npm install
npm run build
```

You do not need real Apple credentials to develop or run the tests. Never commit a `.p8` key, a token or a vendor number.

## Run the tests

```sh
npm run typecheck
npm test
```

`npm test` builds the project and runs the Node test runner over `test/**/*.test.mjs`. The tests use fakes and make no calls to Apple. Run both before you open a pull request.

## Code style

- **Match the surrounding code.** Same naming, same comment density, same idiom as the file you are editing. There is no formatter to run, so read the neighbors.
- TypeScript, ES modules, strict mode (see `tsconfig.json`). Dependencies stay minimal: the MCP SDK and `jose`.
- Comments explain why, not what.

## Write safety

Anything that can POST, PATCH or DELETE must call `requireWriteConfirm` (`src/safety.ts`) before it sends the request. Only the JSON value `true` counts as confirmation, and a non-empty `reason` is required.

The web API adds a second check: a read token may only call tools on the allowlist in `src/http/app.ts` (`isReadCall`). If you add a tool or action, decide whether it is a read, and extend the test that pins the read-token tool set (`test/http-api.test.mjs`). Do not weaken a safety test to make a change pass. If a test is wrong, say why in the pull request.

Do not make writes retry after a server error. They may already have happened at Apple.

## Updating the generated tools

Generated tools come from `src/spec/asc-spec.ts`. Regenerate it with `scripts/gen-spec.mjs` (see the README), then refresh [docs/tools.md](docs/tools.md) so the tool list stays true.

## Pull request checklist

- [ ] `npm run typecheck` and `npm test` pass locally.
- [ ] New behavior has a test; safety changes have a test that fails without the change.
- [ ] Every new write path calls `requireWriteConfirm`, and read-token reachability is checked.
- [ ] The change is small and focused. Unrelated cleanups go in their own pull request.
- [ ] No secrets, tokens, vendor numbers, private paths or real customer data anywhere in the diff.
- [ ] Docs updated if tools, environment variables or routes changed (README, `docs/tools.md`).
- [ ] A line added under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for anything a user would notice.

## Using AI agents to contribute

Fine, as long as you read and understand what you submit and the checklist above is true. [AGENTS.md](AGENTS.md) tells coding agents how this repository works.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
