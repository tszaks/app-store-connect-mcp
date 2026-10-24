## What and why

<!-- What does this change, and why? Link the issue if there is one. -->

## Checklist

- [ ] `npm run typecheck` and `npm test` pass (see CONTRIBUTING.md)
- [ ] New behavior has a test
- [ ] Every new write path calls `requireWriteConfirm`, and read-token reachability is checked (`isReadCall`)
- [ ] The code matches the surrounding code and adds no dependency without discussion
- [ ] No secrets, tokens, vendor numbers or private paths in the diff
- [ ] User-visible change: added a line under `[Unreleased]` in CHANGELOG.md
- [ ] Docs updated if tools, environment variables or routes changed (README, `docs/tools.md`)
