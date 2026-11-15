# CubeRoot production MCP

The private Streamable HTTP endpoint is `https://api.cuberoot.me/v1/mcp`. Every CubeRoot administrator can consent; each request rechecks the original account's current role. GitHub code access is separate: connect the repository through ChatGPT's GitHub app. This service neither calls a model API nor guarantees any subscription quota savings.

## Connect

1. In ChatGPT, enable developer mode where available, then create an app with the MCP URL above and OAuth authentication. Discovery supports dynamic registration; if a client ID is requested, use `cuberoot-chatgpt`, leaving the secret empty (public client with S256 PKCE).
2. Follow the CubeRoot sign-in and consent page. Review the scope and select **Authorize ChatGPT**. Declining grants nothing.
3. Check the four tools appear, then ask for `membership_summary` or `recent_diagnostics`. Only this real-account round trip proves ChatGPT is connected.
4. Manage or revoke personal connections at `/account/mcp` (Chinese `/zh/account/mcp`). Website sign-out does not revoke a separately authorized app.

Available tools:

| Tool | Evidence | Limits |
| --- | --- | --- |
| `registration_trend` | Daily UTC registrations, including zero days and excluding merged accounts | Default 30 days, maximum 366, no future dates; shares dashboard SQL |
| `membership_summary` | Current active personal/enterprise membership counts | Shares dashboard SQL; not revenue or paying-customer totals |
| `database_activity` | Current connection, active query and blocked connection counts | No SQL text, host, user or record data |
| `recent_diagnostics` | Numeric process, disk, slow-query and selected request samples | 1,000 retained per process, maximum 100 returned; restarts clear history; not complete traffic |

## Authorization and operational boundaries

- OAuth authorization code with mandatory S256 PKCE, exact ChatGPT callback allowlist, explicit resource and scope, and issuer identification. DCR registers only the predefined public ChatGPT client; no arbitrary redirect or remote client-metadata fetching.
- Codes are single-use for five minutes. Access tokens last ten minutes. Refresh tokens rotate, within a fixed 30-day grant; replay of the immediately preceding refresh token revokes the grant. Older token replays fail. Credentials are random opaque values; only SHA-256 hashes are persisted. MCP tokens cannot authorize website sessions.
- Access is denied after revocation, original-account merging, deletion or loss of administrator privileges. Account deletion cascades grants. At most ten active grants per administrator. Completed/expired audit rows are retained; no automatic retention purge is included.
- Fixed aggregate SQL runs through a separate two-connection pool with PostgreSQL `default_transaction_read_only`, two-second statement timeout and 500 ms lock timeout. This pool currently uses the API database role; it is a restricted query surface, not a separately provisioned SQL role. OAuth grant persistence uses the normal write pool.
- Maximum two simultaneous MCP requests and 30 requests per minute per grant. Before authentication, IP limits are 120 MCP and 60 OAuth requests per minute. Request bodies are capped at 64 KiB, OAuth bodies at 8 KiB. Stateless JSON responses avoid retained transport sessions. No arbitrary SQL, shell, files, request bodies, passwords, personal profiles or individual payment details are exposed.
- Tool calls emit `mcp_tool_call` with actor ID, grant ID, static tool name, success and duration. Consent and revocation emit separate events. No tokens or returned datasets enter these audit events. These records use the existing process log retention; this is not a tamper-proof audit store.
- Diagnostics reuse the existing sampler through an allowlist of finite numeric fields. The process buffer never ingests arbitrary log text. Request sampling is incomplete by design; do not derive global traffic/error rates from it.

## Delivery and verification

Migration `0240_mcp_oauth.sql`, the API bundle and Web consent page must be deployed together. No new secret or paid model API is required. The API host must route both root `.well-known` paths to Hono. Backend deployment runs the normal migration runner; do not apply production DDL manually.

Verification must distinguish local protocol/security tests, local PostgreSQL migration/query checks, the exact deployment commit, and a real ChatGPT administrator consent/tool-call flow. Source changes alone do not establish deployment or ChatGPT access.

Suggested planning prompt:

> Read the CubeRoot GitHub repository and use the production MCP tools for evidence. Investigate the issue below. Distinguish facts, sample limitations and hypotheses. Propose the smallest change using existing components, list the files and acceptance checks, and produce a concrete implementation brief for Codex. Do not claim that sampled request logs represent total traffic.

References: [OpenAI authentication](https://developers.openai.com/plugins/build/auth), [connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt/), [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/).
