# Request failure diagnostics

As of 2026-09-13, page delivery no longer queries homepage locks or session roles.
Homepage locks control card visibility only. Competition Practice is also public,
including its client UI; guest practice uses its existing local storage flow.
API authorization and account lifecycle checks are unchanged. The gateway and
older diagnostic helpers remain for compatibility, but proxy no longer calls them.
The page-access incident and correlation steps below describe the retired gate;
API, database and host instrumentation remain active.

## Correlating a failure

1. Open the Vercel request log and find the structured `page_access` event.
   Copy its generated `requestId`, timestamp and `region`. `stepsMs` separates
   `home-locks` from `auth-me`; `homeLocksStatus` is only the locks response status.
2. On `ssh cuberoot`, search that ID in
   `/www/wwwlogs/timing.api.cuberoot.me.log` and
   `/root/.pm2/logs/core-api-out.log` / `core-api-error.log` (including rotations).
   Every permission check is sent fresh with the ID; it is not a credential.
3. nginx records `connectSeconds`, `headerSeconds`, `upstreamSeconds` and
   `requestSeconds`. Its original combined log remains in place. The new log
   includes permission endpoints plus all API 5xx/499 and requests taking >=1s.
4. API `api_request` records route **templates**, status, handler duration and
   `dbCalls`, `dbCallMs`, `dbMaxCallMs`, `dbErrors`. `api_request_pending` is emitted
   after four seconds even if the handler has not completed. Calls through the
   `query()` and transaction query helpers are instrumented; raw tagged `sql`
   usage is not. DB wall time includes pool queuing, execution and result transfer;
   it is not pure SQL execution time. Parallel DB calls can make the sum exceed
   the request wall time. Streaming response completion is measured by nginx,
   not the API middleware's handler-return duration.
5. Inspect nearby `api_runtime`, `database_activity` and `host_disk` events. Every
   30 seconds they record process CPU, RSS, event-loop delay, helper calls in
   flight, database wait categories/blocking counts and filesystem free space.
   Each DB snapshot uses one independent read-only connection with a 1.5s SQL
   limit, 2s connect timeout and a 3s forced transport cutoff. Statistics visibility
   follows the existing DB role; no new privileges are granted. Boot events and
   PIDs distinguish restarts. `DIAGNOSTICS_DISK_PATH` defaults to `/`, where this
   server's DB, WAL and uploads reside; change it if that layout changes.

## Interpretation and thresholds

- Page failure with no matching nginx entry: check a sufficiently wide window,
  since nginx logs at request completion. Absence alone is not proof of a network
  fault. Log retention, incomplete requests and sampling boundaries also matter.
- Fast matching nginx/API response but a five-second Vercel timeout: investigate
  the edge-to-origin transport. These metrics do not split DNS, TCP and TLS at
  Vercel; a regional network probe may still be necessary.
- High nginx header time plus large DB-call wall time, blocked database sessions
  and many calls in flight: evidence for database/pool contention.
- High event-loop lag with multiple unrelated slow routes: inspect CPU work,
  garbage collection and host pressure. CPU percentages can exceed 100% when
  the process uses more than one core.

Warnings: API/DB calls >=1s, pending API calls >=4s, page failures, event-loop
maximum >=250ms, any blocked DB session or active query >=5s, and disk space <3GiB.
These are structured log warnings, not a new external notification service.
Existing Vercel 5xx alerts remain the external incident signal. Thirty-second
snapshots can miss shorter events; a stopped process cannot emit its own metrics.

## Historical Vercel page verification placement

`core/packages/client/vercel.json` pins `/api/page-access` to `iad1`. Production
Node.js middleware runs globally and calls this regional gateway through the
existing Vercel-only `cuberoot-me.vercel.app` production alias. The gateway
performs the original live API request. Using the custom domain here would
reintroduce the origin connection through its split DNS. Preview middleware and
self-hosted/dev Next keep calling the original API directly. Static assets
continue to use the global CDN.

The gateway accepts only fixed `locks` and `session` GET checks. It forwards
Authorization only for session verification, never forwards cookies, refuses
upstream redirects, preserves the request UUID, and marks every response
`private, no-store`. Backend role and lock-state validation remain unchanged.
The gateway consumes the upstream body within the original five-second
deadline. It exposes `X-Page-Access-Region` for deployment verification.

A direct `functions["proxy.ts"]` setting passed the published JSON schema but
was rejected by Vercel CLI 59.11.7 before building. Its Next.js function matcher
accepts app routes but not the renamed proxy entrypoint. Do not use that
configuration or assume the project default region constrains middleware.

On 2026-09-13 UTC, production request
`86fab93b-eb3b-4808-ba4c-5c190905cb2c` failed in `sfo1` after exactly 5000 ms
at `home-locks`, with no upstream HTTP status or matching origin log. Other
failures occurred in `hkg1` and `sin1`. Successful correlated requests spent
only 1–3 ms in nginx/API; the concurrent DB snapshots had no blocked sessions.

A separate preview probe compared Node 24 native HTTPS, fixed-IP HTTPS, fetch,
and fetch with `Connection: close`. In `hkg1`, DNS resolved the correct IPv4
address in 5 ms, but both fresh HTTPS connections reached their five-second
deadline before the TCP `connect` event. Both fetch variants also timed out.
This isolates a connection-path failure before TLS/HTTP, rather than an API
query, stale keep-alive socket, or DNS lookup. It does not identify which
network operator dropped the connection. The `iad1` control completed all four
request variants in six consecutive probe rounds; `sfo1` was intermittent.

The visible regression began with `9fd37b606` on 2026-09-11: page routes began
checking live homepage locks before serving documents and RSC. This made the
regional API connection a prerequisite for otherwise static pages. The regional
gateway first repaired that path. The subsequent product decision removed the
page gate entirely, so locks and session verification no longer block page delivery.

After a placement change, inspect the deployed `/api/page-access` region and
correlate new main-domain requests through the gateway with the origin. A successful preview
alone is insufficient because preview and production middleware placement can
differ. Recheck anonymous access to permanently locked pages as well as public
pages in both languages.

No new diagnostic log contains IPs, raw URLs/query strings, authorization headers,
cookies, request/response bodies, SQL text/parameters, or arbitrary error messages.
Only endpoint categories/templates, validated IDs, static labels and metrics are
recorded. No telemetry is sent to an additional external service.

## Retention and rollout

The nginx timing log is covered by the existing seven-rotation logrotate policy.
The same deployed policy now rotates the two core-api PM2 logs with copytruncate,
compression and seven retained rotations. `maxsize 100M` is checked when the host
logrotate job runs; it is not a continuously enforced quota. copytruncate may lose
a small number of lines during rotation; it avoids restarting the API.

Ship API and Web code through their existing Actions/Vercel workflows; ship nginx
and logrotate through `deploy_nginx.yml`. A local test or syntax check does not
mean collection is active. After deployment, make a harmless public permission
request carrying a fresh UUID and verify the ID appears in both nginx and API;
then verify one runtime/database/disk snapshot. Do not manufacture a production
lock, fill the disk, or force real visitor timeouts to test warnings.
