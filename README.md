<h1 align="center">App Store Connect MCP</h1>

<p align="center">
  An MCP server and web API that lets an AI agent read and manage your App Store Connect account.
</p>

<p align="center">
  <a href="https://github.com/tszaks/app-store-connect-mcp/actions/workflows/ci.yml"><img src="https://github.com/tszaks/app-store-connect-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/tszaks/app-store-connect-mcp" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/node-20%2B-blue" alt="Node 20 or later">
</p>

An example session (illustrative):

```text
You:    Which of my apps has a build waiting for review, and what do the last
        five 1-star reviews say?
Agent:  asc_list_apps               -> 3 apps
        asc_list_review_submissions -> "Notes" 2.4.0 is WAITING_FOR_REVIEW
        asc_customer_reviews        -> list, filter[rating]=1, sort=-createdDate
        ...
```

This server turns Apple's App Store Connect API into tools an agent can call: apps, versions, builds, TestFlight, review submissions, in-app purchases, subscriptions, offer codes, analytics, sales and finance reports, and more. It signs its own short-lived tokens with your App Store Connect API key, so the key never goes to the model.

It is for developers who want an agent to do release and App Store chores: check review status, update "What's New" text, add testers, pull a sales report. Anything that changes data is gated: the call must carry `confirm: true` and a written `reason`.

## Features

- **Broad coverage.** 247 tools. Hand-written tools for the common jobs, one generated tool for every other resource type in Apple's OpenAPI spec, and `asc_request` for any endpoint that is not wrapped.
- **Writes are gated.** Every create, update and delete needs `confirm: true` (the JSON value `true` only) and a non-empty `reason`. Writes are never retried after a server error, because they may already have happened.
- **Spec-checked.** Generated tools only offer the actions Apple's API has for that resource, so an agent cannot call an endpoint that does not exist.
- **Two ways to connect.** A local stdio MCP server, or a web API with a remote MCP endpoint (`/mcp`) for agents that can only speak HTTP. The web API has read and write tokens, an OpenAPI description and a write log.
- **Uploads.** Send builds (`.ipa`, `.pkg`) with `asc_upload_build` and screenshots, previews and event media with `asc_upload_asset`. Both run only on your machine.
- **No secrets in the repo.** Credentials come from environment variables. Debug logs redact them.

## Install

You need Node 20 or later and an App Store Connect API key (Users and Access > Integrations > App Store Connect API). The key gives you an Issuer ID, a Key ID and a `.p8` file.

```bash
git clone https://github.com/tszaks/app-store-connect-mcp.git
cd app-store-connect-mcp
npm install
npm run build
```

The server is not published to npm. The entry point is `dist/index.js`.

Quick check that it starts and answers (it waits on stdin, so press Ctrl-C to stop):

```bash
ASC_ISSUER_ID='<issuer id>' \
ASC_KEY_ID='<key id>' \
ASC_PRIVATE_KEY_FILE=~/keys/AuthKey_XXXX.p8 \
node dist/index.js
```

## Configuration

| Variable | Required | Default | What it does |
|---|---|---|---|
| `ASC_ISSUER_ID` | yes | | Issuer ID of your API key |
| `ASC_KEY_ID` | yes | | Key ID of your API key |
| `ASC_PRIVATE_KEY` | one of these two | | The `.p8` contents. `\n`-escaped newlines are accepted |
| `ASC_PRIVATE_KEY_FILE` | one of these two | | Path to the `.p8` file. Used when `ASC_PRIVATE_KEY` is not set |
| `ASC_BASE_URL` | no | `https://api.appstoreconnect.apple.com/v1` | Apple API base URL |
| `ASC_TOKEN_TTL_SECONDS` | no | `600` | Lifetime of each signed token |
| `ASC_DEBUG` | no | off | `true` logs requests to stderr. Secrets are always redacted |
| `ASC_API_READ_TOKENS` | web API only | | Read-only bearer tokens, `label:secret` pairs, comma separated |
| `ASC_API_WRITE_TOKENS` | web API only | | Bearer tokens that may also write |
| `PORT` | no | `8787` | Port for `npm run serve` (listens on 127.0.0.1) |

## Connect a client

All three configs start the same stdio server. Replace `/path/to/app-store-connect-mcp` with where you cloned the repo, and use your own key values.

**Claude Code**

```bash
claude mcp add app-store-connect \
  -e ASC_ISSUER_ID='<issuer id>' \
  -e ASC_KEY_ID='<key id>' \
  -e ASC_PRIVATE_KEY_FILE="$HOME/keys/AuthKey_XXXX.p8" \
  -- node /path/to/app-store-connect-mcp/dist/index.js
```

**Codex** (`~/.codex/config.toml`)

```toml
[mcp_servers.app-store-connect]
command = "node"
args = ["/path/to/app-store-connect-mcp/dist/index.js"]

[mcp_servers.app-store-connect.env]
ASC_ISSUER_ID = "<issuer id>"
ASC_KEY_ID = "<key id>"
ASC_PRIVATE_KEY_FILE = "/Users/you/keys/AuthKey_XXXX.p8"
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "node",
      "args": ["/path/to/app-store-connect-mcp/dist/index.js"],
      "env": {
        "ASC_ISSUER_ID": "<issuer id>",
        "ASC_KEY_ID": "<key id>",
        "ASC_PRIVATE_KEY_FILE": "/Users/you/keys/AuthKey_XXXX.p8"
      }
    }
  }
}
```

For a hosted copy of the web API, see [Web API](#web-api-for-agents-that-can-only-call-http) for the remote MCP setup.

## Tools

The server registers 247 tools: 82 hand-written and 165 generated. Tools marked "write" need `confirm: true` and `reason`.

### Core tools

| Tool | What it does |
|---|---|
| `asc_ping` | Health check. Returns the configured base URL |
| `asc_request` | Call any endpoint. Path starts with `/v1/`, `/v2/` or `/v3/`. Non-GET is a write |
| `asc_list_apps`, `asc_get_app` | List your apps, get one |
| `asc_list_app_store_versions`, `asc_get_app_store_version` | Read App Store versions |
| `asc_create_app_store_version`, `asc_update_app_store_version` | Create or edit a version (write) |
| `asc_list_version_localizations`, `asc_get_version_localization` | Read per-language version text |
| `asc_create_version_localization`, `asc_update_version_localization` | Create or edit per-language text (write) |
| `asc_list_builds`, `asc_get_build` | Read builds |
| `asc_list_build_beta_details`, `asc_update_build_beta_details` | Read or edit TestFlight build details (update is a write) |
| `asc_list_review_submissions`, `asc_get_review_submission` | Read review submissions |
| `asc_create_review_submission`, `asc_submit_review_submission` | Start and submit a review (write) |
| `asc_list_beta_groups`, `asc_get_beta_group`, `asc_list_beta_testers` | Read TestFlight groups and testers |
| `asc_create_beta_tester`, `asc_add_tester_to_group`, `asc_remove_tester_from_group` | Manage testers (write) |
| `asc_add_build_to_beta_group`, `asc_remove_build_from_beta_group` | Manage builds in a group (write) |
| `asc_list_in_app_purchases`, `asc_get_in_app_purchase` | Read in-app purchases |
| `asc_list_subscription_groups`, `asc_list_subscriptions`, `asc_get_subscription`, `asc_list_introductory_offers` | Read subscriptions and intro offers |
| `asc_list_devices`, `asc_list_profiles` | Read devices and provisioning profiles |
| `asc_register_device` | Register a device (write) |
| `asc_create_analytics_report_request` | Ask Apple to generate analytics reports (write) |
| `asc_list_analytics_report_requests`, `asc_list_analytics_reports`, `asc_list_analytics_report_instances` | Read analytics report requests, reports and instances |
| `asc_download_analytics_report_instance` | Download and preview an analytics report instance |
| `asc_analytics_overview_summary` | Dashboard-style summary built from analytics reports |
| `asc_download_finance_report` | Download a finance report (see [Finance reports](#finance-reports)) |
| `asc_download_sales_report` | Download sales, subscription, subscriber, offer code redemption or installs reports |
| `asc_download_offer_code_values` | Download the one-time-use offer codes of a batch (CSV) |
| `asc_get_performance_data` | Power and performance metrics, overview, diagnostic logs |
| `asc_upload_build` | Upload an `.ipa` or `.pkg` with `altool` (write, local only) |
| `asc_upload_asset` | Upload a screenshot, preview or other media: reserve, send parts, confirm with checksum (write, local only) |
| `asc_prepare_expedite` | Prepare an expedited review request. Apple has no API for it, so this copies text and opens the form. Changes nothing in App Store Connect (local only) |

### Feature tools

One tool per feature. Each takes an `action` (`list`, `get`, `create`, `update`, `delete`), and offers only the actions Apple's API has for it. Relationship types are filled in for you (`relationships: {"app": "123"}`). Create calls that Apple lets you send with new linked items take an `included` array.

| Area | Tools |
|---|---|
| Ratings and reviews | `asc_customer_reviews`, `asc_customer_review_responses` |
| Custom Product Pages | `asc_custom_product_pages`, `asc_custom_product_page_versions`, `asc_custom_product_page_localizations` |
| Product Page Optimization | `asc_product_page_experiments`, `asc_product_page_experiment_treatments`, `asc_product_page_experiment_treatment_localizations` |
| Asset Library | `asc_asset_library`, `asc_asset_library_images`, `asc_asset_library_videos`, `asc_asset_library_placements`, `asc_asset_library_placement_ordering`, `asc_asset_library_ref_data` |
| In-App Events | `asc_app_events`, `asc_app_event_localizations`, `asc_app_event_screenshots`, `asc_app_event_video_clips` |
| Featuring and accessibility | `asc_nominations`, `asc_accessibility_declarations`, `asc_promoted_purchases` |
| Offers | `asc_win_back_offers`, `asc_subscription_offer_codes`, `asc_subscription_offer_code_one_time_codes`, `asc_subscription_offer_code_custom_codes`, `asc_iap_offer_codes`, `asc_iap_offer_code_one_time_codes`, `asc_iap_offer_code_custom_codes` |
| Screenshots and previews | `asc_screenshot_sets`, `asc_screenshots`, `asc_preview_sets`, `asc_previews` |

### Generated tools

Every other resource type in Apple's spec gets a generated tool named `asc_<type>`, for example `asc_webhooks`, `asc_users`, `asc_sandbox_testers`, `asc_beta_feedback_crash_submissions`, `asc_app_store_version_phased_releases`, `asc_game_center_leaderboards` and `asc_ci_products`. They use the same `action` interface and spec checks. The full list, with actions, is in [docs/tools.md](docs/tools.md).

Not possible through Apple's API: expedited review (see `asc_prepare_expedite`) and app promo codes (use offer codes).

### Updating the spec snapshot

Generated tools are built at startup from `src/spec/asc-spec.ts`, a snapshot of Apple's OpenAPI spec. When Apple ships a new API version:

```bash
curl -sSLO https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip
unzip -o app-store-connect-openapi-specification.zip
node scripts/gen-spec.mjs openapi.oas.json
npm test
```

More tools can be added with `asc_request`, or by adding a row to `FAMILIES` in `src/tools/resources.ts`.

## Web API (for agents that can only call HTTP)

The same tools, served as a plain web API (`src/http/app.ts`). `asc_upload_build`, `asc_upload_asset` and `asc_prepare_expedite` need your Mac, so the web API serves the other 244.

| Route | Token | What |
|---|---|---|
| `GET /` | no | Service info |
| `GET /openapi.json` | no | OpenAPI 3.1 description. `?tools=a,b` limits it to some tools |
| `GET /tools` | yes | Tool names and descriptions |
| `POST /tools/{name}` | yes | Call a tool. The JSON body is the tool's arguments |
| `/mcp` | yes | Remote MCP endpoint (Streamable HTTP, stateless) |

Auth is `Authorization: Bearer <token>`. Tokens come from environment variables, as comma-separated `label:secret` pairs. Each secret must be at least 24 characters. Only a hash of the secret is kept in memory.

- `ASC_API_READ_TOKENS`: can read. Any call that could write is refused (403 on REST, an error result on MCP).
- `ASC_API_WRITE_TOKENS`: can also write. Writes still need `confirm: true` and `reason`.

A read token is checked against an allowlist, not against each tool's own `confirm` check: `list` and `get` actions, `GET` with `asc_request`, `asc_ping`, `asc_analytics_overview_summary`, and tools named `asc_list_*`, `asc_get_*` or `asc_download_*`. A bug in one tool cannot turn a read token into a writer. A test pins the exact set of tools a read token can reach.

Every write attempt is logged as one JSON line to stdout: time, token label, tool, action, id, reason and result. Secrets are never logged. Request bodies are capped at 1 MB.

Run locally (127.0.0.1, port 8787):

```bash
ASC_API_READ_TOKENS='me:<a secret of 24+ characters>' npm run serve
```

To connect a remote MCP client, point it at `https://<host>/mcp` and send the header `Authorization: Bearer <token>`. With Claude Code:

```bash
claude mcp add --transport http app-store-connect https://<host>/mcp \
  --header "Authorization: Bearer <token>"
```

Deploy: the repo is a Vercel project (`api/index.js` and `vercel.json`). Set `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY` (the `.p8` contents) and the token variables in the Vercel project settings. If the key variables are missing, the function answers `500 Server not configured` instead of crashing. Treat a deployed copy like a password: anyone with a write token can change your App Store Connect account.

## Finance reports

`asc_download_finance_report` downloads the finance report file from `/v1/financeReports`, expands gzip-compressed responses, and returns either:

- a preview (default, first 40 lines)
- or the full report text with `full_report: true`

Example arguments:

```json
{
  "vendor_number": "<your vendor number>",
  "report_date": "2026-03",
  "report_type": "FINANCIAL",
  "region_code": "ZZ"
}
```

- `region_code` defaults to `ZZ` for all countries or regions.
- `report_type` is passed through as is, so you can use the exact Apple value you need, such as `FINANCIAL` or `FINANCE_DETAIL`.
- Apple requires the API key user to have `Account Holder`, `Admin` or `Finance` access for finance reports.

## Using with agents

- Start with a read: `asc_list_apps`, `asc_list_builds`, `asc_list_beta_groups`, `asc_list_review_submissions`.
- Writes (`asc_create_*`, `asc_update_*`, `asc_submit_review_submission`, and the `create`, `update` and `delete` actions) need `confirm: true` and a `reason`. Write the reason for a human who reads the log.
- Prefer a feature or generated tool over `asc_request`. It checks your arguments against Apple's spec.
- If a call fails, read the `ASC HTTP <status>` message. It carries Apple's own error detail.

## Permissions and privacy

**What the server can do.** It acts with the API key you give it, so it can do whatever that key's role allows in your App Store Connect account: read apps, reviews, TestFlight testers (names and emails), sales and finance reports, and analytics; and, through gated writes, change versions, metadata, testers, offers and review submissions. Use the lowest-privilege key that does the job, and prefer a read-only role if you only need reports.

**What leaves your machine.**
- Requests go to Apple (`api.appstoreconnect.apple.com`, or `ASC_BASE_URL`), signed with a short-lived token made from your key. The key itself is never sent.
- Tool results go to the MCP client and model you connect. That includes whatever the call returned, such as tester emails or revenue figures.
- `asc_upload_asset` sends files you point at to the upload URLs Apple returns. `asc_upload_build` runs `xcrun altool` on your Mac. For that run it writes your key to a private temporary folder and removes it afterwards.
- The server has no analytics and makes no other network requests.

**Local effects.** `asc_prepare_expedite` copies text to the clipboard and opens Apple's form in your browser (macOS only). It does not submit anything. The upload tools read files from paths the agent gives them.

**Web API.** A hosted copy is reachable by anyone with a token. Keep tokens long, give read tokens to agents that only need to read, and check the write log.

## FAQ

**Does the model see my private key?**
No. The key stays in the server's environment. The model sees tool results only.

**Why does a write fail with "Write requires 'confirm: true'"?**
The gate accepts only the JSON value `true`. The strings `"true"` and `"yes"`, and the number `1`, are refused. A non-empty `reason` is required too.

**Does it work on Windows or Linux?**
The server runs anywhere Node 20 runs. `asc_upload_build` needs Xcode's `altool`, and `asc_prepare_expedite` uses the macOS clipboard and `open`, so those two are macOS only.

## Contributing

Bug reports and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. Security problems go through [SECURITY.md](SECURITY.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

Docs: [generated tool list](docs/tools.md) · [changelog](CHANGELOG.md) · [agent notes](AGENTS.md)

## License

[MIT](LICENSE) © 2026 Szakacs Media Company
