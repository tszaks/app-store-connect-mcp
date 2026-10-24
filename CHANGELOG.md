# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/). Version 0.7.0 and the work before 0.3.0 have no git tag; their dates come from git history.

## [Unreleased]

### Added
- Documentation: README rewrite, `docs/tools.md`, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, AGENTS, issue and pull request templates, and a CI workflow (typecheck and tests).

## [0.7.0] - 2026-10-07

### Added
- Remote MCP endpoint at `/mcp` on the web API (Streamable HTTP, stateless), with the same token rules and write log as the REST routes.

## [0.6.0] - 2026-10-06

### Added
- Web API for agents that can only call HTTP: bearer tokens with read and write scopes, a write log, an OpenAPI 3.1 description and a Vercel deployment.

### Security
- Read tokens are checked against an allowlist instead of each tool's own checks. Tools accept only `confirm === true`. Writes are never retried. Denials are logged. Request bodies are capped. A missing-config error no longer reveals details.

## [0.5.0] - 2026-10-06

### Added
- Tools for every resource type in Apple's OpenAPI spec (generated at startup from a spec snapshot), plus sales reports, offer code values and performance data tools.

### Fixed
- Parent keys name their link and prefer the newest list. File tool output is capped. Ids are checked for safety.

## [0.4.1] - 2026-10-06

### Added
- `included` on create calls for offer codes, win-back offers and Custom Product Pages.

## [0.4.0] - 2026-10-06

### Added
- 32 feature tools built from Apple's spec, `asc_upload_asset`, and `/v2` routing.

### Fixed
- `null` clears to-many links, dot-only ids are refused, and upload size comes from the bytes read.

## [0.3.0] - 2026-10-06

### Added
- `asc_prepare_expedite`: prepares an expedited review request (Apple has no API for it).
- `asc_upload_build`: upload an `.ipa` or `.pkg` through `altool`.
- Analytics report tools.

### Fixed
- Review submission create and submit helpers.

## Before 0.3.0

Untagged work from 2026-02 to 2026-09: the first server with `asc_request` and write gating (2026-02-14), subscription and introductory offer tools, finance report download (2026-03-21), and a fix that normalizes `\n` in `ASC_PRIVATE_KEY` (2026-09-23).

[Unreleased]: https://github.com/tszaks/app-store-connect-mcp/compare/v0.6.0...HEAD
[0.7.0]: https://github.com/tszaks/app-store-connect-mcp/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/tszaks/app-store-connect-mcp/releases/tag/v0.6.0
[0.5.0]: https://github.com/tszaks/app-store-connect-mcp/releases/tag/v0.5.0
[0.4.1]: https://github.com/tszaks/app-store-connect-mcp/releases/tag/v0.4.1
[0.4.0]: https://github.com/tszaks/app-store-connect-mcp/releases/tag/v0.4.0
[0.3.0]: https://github.com/tszaks/app-store-connect-mcp/releases/tag/v0.3.0
