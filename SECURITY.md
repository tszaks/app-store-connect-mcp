# Security policy

## Supported versions

Only the latest release gets security fixes.

| Version | Supported |
|---|---|
| 0.7.x (latest) | Yes |
| Older | No |

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. If that is not available to you, email tyler@szakacsmedia.com.

Please include:

- What you found and what an attacker could do with it.
- Steps to reproduce.
- The version (`package.json`) and how you run the server (stdio, local web API, Vercel).

You can expect a first reply within a few days. This project is maintained by a small team, so a fix may take longer, but you will get updates. Once a fix is released we will credit you in the changelog unless you prefer to stay anonymous.

## Sensitive surface

This server holds an App Store Connect API key and can act on your account. It can read tester emails, sales and finance figures, and, through gated writes, change app versions, metadata, offers and review submissions. These areas matter most:

- Anything that lets a call write without `confirm: true` and a `reason`, or lets a read-only token reach a write.
- Anything that leaks the private key, a bearer token or a signed JWT, in logs, errors or tool output.
- Bearer token checks on the web API and the remote MCP endpoint (`/mcp`).
- The file and process tools: `asc_upload_build` (runs `altool`, writes the key to a temporary folder) and `asc_upload_asset` (reads files from agent-supplied paths).
- Request size limits and path handling in `asc_request` and the generated tools.

Never put a real key, token or vendor number in an issue or pull request. If you leaked one, revoke it in App Store Connect (Users and Access > Integrations) first.
