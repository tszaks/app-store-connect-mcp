# App Store Connect MCP

High-coverage App Store Connect (ASC) MCP server.

Design goals:
- Many convenient `asc_*` tools for common operations
- A generic `asc_request` tool to reach endpoints not yet wrapped
- Safety: any `POST`/`PATCH`/`DELETE` requires `confirm: true` and a non-empty `reason`
- No secrets committed (env vars only)

## Setup

```bash
cd ~/Projects/MCP-Servers/app-store-connect-mcp
npm install
npm run build
```

## Env vars

Required:
- `ASC_ISSUER_ID`
- `ASC_KEY_ID`
- `ASC_PRIVATE_KEY` (the `.p8` contents; supports `\\n`-escaped newlines)

Optional:
- `ASC_BASE_URL` (default `https://api.appstoreconnect.apple.com/v1`)
- `ASC_TOKEN_TTL_SECONDS` (default `600`)
- `ASC_DEBUG` (`true` for verbose logging; secrets are always redacted)

## Run

```bash
ASC_ISSUER_ID='...' \
ASC_KEY_ID='...' \
ASC_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n' \
node dist/index.js
```

## Tools

- `asc_ping`
- `asc_request`
- `asc_list_apps`
- `asc_get_app`
- `asc_list_app_store_versions`
- `asc_get_app_store_version`
- `asc_create_app_store_version` (gated)
- `asc_update_app_store_version` (gated)
- `asc_list_builds`
- `asc_get_build`
- `asc_list_review_submissions`
- `asc_get_review_submission`
- `asc_create_review_submission` (gated)
- `asc_submit_review_submission` (gated)
- `asc_list_beta_groups`
- `asc_get_beta_group`
- `asc_list_beta_testers`
- `asc_create_beta_tester` (gated)
- `asc_add_tester_to_group` (gated)
- `asc_remove_tester_from_group` (gated)
- `asc_add_build_to_beta_group` (gated)
- `asc_remove_build_from_beta_group` (gated)
- `asc_list_version_localizations`
- `asc_get_version_localization`
- `asc_create_version_localization` (gated)
- `asc_update_version_localization` (gated)
- `asc_list_build_beta_details`
- `asc_update_build_beta_details` (gated)
- `asc_list_in_app_purchases`
- `asc_get_in_app_purchase`
- `asc_list_subscription_groups`
- `asc_list_devices`
- `asc_register_device` (gated)
- `asc_list_profiles`

More can be added quickly via `asc_request` or by extending `src/tools/`.
