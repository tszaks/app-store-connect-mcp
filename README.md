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
- `ASC_PRIVATE_KEY` (the `.p8` contents; supports `\\n`-escaped newlines) or `ASC_PRIVATE_KEY_FILE`

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
- `asc_request` — any endpoint; path starts with `/v1/`, `/v2/`, or `/v3/`
- `asc_download_finance_report`
- `asc_create_analytics_report_request` (gated)
- `asc_list_analytics_report_requests`
- `asc_list_analytics_reports`
- `asc_list_analytics_report_instances`
- `asc_download_analytics_report_instance`
- `asc_analytics_overview_summary`
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
- `asc_list_subscriptions`
- `asc_get_subscription`
- `asc_list_introductory_offers`
- `asc_list_devices`
- `asc_register_device` (gated)
- `asc_list_profiles`
- `asc_upload_build` (gated) — upload an `.ipa`/`.pkg` to App Store Connect via `altool` using the server's configured key
- `asc_prepare_expedite` — Apple has **no API** for expedited review (it is a web form behind an Apple ID login). This checks the version is `WAITING_FOR_REVIEW`, copies paste-ready text to the clipboard, and opens Apple's form. A signed-in person pastes and clicks Submit. Makes no changes in App Store Connect.

### Feature tools (one tool per feature, `action` = list / get / create / update / delete)

Create calls that Apple lets you send with new linked items (offer code prices, win-back prices, Custom Product Page versions) take an `included` array. Each tool offers only the actions Apple's API has for that feature, and fills in relationship types for you (`relationships: {"app": "123"}`). Writes need `confirm: true` and `reason`. Actions and fields come from `src/spec/asc-spec.ts`, a snapshot of Apple's OpenAPI spec.

- Ratings and Reviews: `asc_customer_reviews`, `asc_customer_review_responses`
- Custom Product Pages: `asc_custom_product_pages`, `asc_custom_product_page_versions`, `asc_custom_product_page_localizations`
- Product Page Optimization: `asc_product_page_experiments` (v2), `asc_product_page_experiment_treatments`, `asc_product_page_experiment_treatment_localizations`
- Asset Library: `asc_asset_library`, `asc_asset_library_images`, `asc_asset_library_videos`, `asc_asset_library_placements`, `asc_asset_library_placement_ordering`, `asc_asset_library_ref_data`
- In-App Events: `asc_app_events`, `asc_app_event_localizations`, `asc_app_event_screenshots`, `asc_app_event_video_clips`
- Featuring and accessibility: `asc_nominations`, `asc_accessibility_declarations`, `asc_promoted_purchases`
- Offers: `asc_win_back_offers`, `asc_subscription_offer_codes`, `asc_subscription_offer_code_one_time_codes`, `asc_subscription_offer_code_custom_codes`, `asc_iap_offer_codes`, `asc_iap_offer_code_one_time_codes`, `asc_iap_offer_code_custom_codes`
- Screenshots and previews: `asc_screenshot_sets`, `asc_screenshots`, `asc_preview_sets`, `asc_previews`
- `asc_upload_asset` (gated) — upload a screenshot, preview, event image/video, Asset Library image/video, or IAP/subscription review screenshot (reserve, send parts, confirm with checksum)

### Everything else (generated)

Every other resource type in Apple's spec gets a generated tool named `asc_<type>` (for example `asc_webhooks`, `asc_users`, `asc_sandbox_testers`, `asc_beta_feedback_crash_submissions`, `asc_app_store_version_phased_releases`, `asc_game_center_leaderboards`, `asc_ci_products`). Same `action` interface, same spec checks. They are built at startup from `src/spec/asc-spec.ts`, so regenerating the snapshot picks up new Apple features with no code change.

Endpoints that return files or Apple-specific JSON have dedicated tools:
- `asc_download_sales_report` — sales, subscription, subscriber, offer code redemption, installs reports
- `asc_download_offer_code_values` — the actual one-time-use codes (CSV)
- `asc_get_performance_data` — power/performance metrics, performance overview, diagnostic logs

Not possible through Apple's API: expedited review (see `asc_prepare_expedite`) and app promo codes (use offer codes).

### Updating the spec snapshot

When Apple ships a new API version:

```bash
curl -sSLO https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip
unzip -o app-store-connect-openapi-specification.zip
node scripts/gen-spec.mjs openapi.oas.json
npm test
```

More can be added via `asc_request` or by adding a row to `FAMILIES` in `src/tools/resources.ts`.
## Web API (for agents that can only call HTTP)

The same tools, served as a plain web API (`src/http/app.ts`):

| Route | Token | What |
|---|---|---|
| `GET /` | no | service info |
| `GET /openapi.json` | no | OpenAPI 3.1 description; `?tools=a,b` limits it to some tools |
| `GET /tools` | yes | tool names and descriptions |
| `POST /tools/{name}` | yes | call a tool; JSON body = the tool's arguments |

Auth is `Authorization: Bearer <token>`. Tokens come from env vars, as comma-separated `label:secret` pairs (secret at least 24 characters):

- `ASC_API_READ_TOKENS`: can read; any call with `"confirm": true` is refused (403)
- `ASC_API_WRITE_TOKENS`: can also write (writes still need `confirm` + `reason`)

Every write is logged as one JSON line (token label, tool, action, id, reason, result). Secrets are never logged. `asc_upload_build`, `asc_upload_asset`, and `asc_prepare_expedite` need this Mac, so they are not served.

Run locally: `ASC_API_READ_TOKENS=me:<secret> npm run serve` (port 8787). Deploy: the repo is a Vercel project (`api/index.js` + `vercel.json`). Set `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY` (the .p8 contents), and the token vars in Vercel.

## Quickstart TL;DR

```bash
npm install
npm run build
ASC_ISSUER_ID='...' ASC_KEY_ID='...' ASC_PRIVATE_KEY='...' node dist/index.js
```

## How It Works (TL;DR)

- MCP tools map to App Store Connect REST endpoints
- Server signs JWT with your `.p8` key and calls ASC APIs
- Write operations are safety-gated (`confirm: true`, non-empty `reason`)

## LLM Quick Copy

Use the copy button on this code block in GitHub.

```txt
Repo: app-store-connect-mcp
Goal: App Store Connect MCP server with broad API coverage.
Setup:
1) npm install
2) npm run build
3) Set ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY
4) Run node dist/index.js and add to MCP client config
Use:
- Read: asc_list_apps, asc_list_builds, asc_list_beta_groups, asc_list_review_submissions
- Write (gated): asc_create_*, asc_update_*, asc_submit_review_submission
How it works:
- Node MCP server -> JWT auth -> App Store Connect API
Safety:
- POST/PATCH/DELETE require confirm=true and reason
```

## Finance Reports

`asc_download_finance_report` downloads the Apple finance report file from `/v1/financeReports`, automatically expands gzip-compressed responses, and returns either:

- a preview (default, first 40 lines)
- or the full report text with `full_report: true`

Example:

```json
{
  "vendor_number": "93635270",
  "report_date": "2026-03",
  "report_type": "FINANCIAL",
  "region_code": "ZZ"
}
```

Notes:
- `region_code` defaults to `ZZ` for all countries or regions
- `report_type` is passed through as-is so you can use the exact Apple value you need, such as `FINANCIAL` or `FINANCE_DETAIL`
- Apple requires the App Store Connect API key user to have `Account Holder`, `Admin`, or `Finance` access for finance reports
