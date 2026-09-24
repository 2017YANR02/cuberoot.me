# CubeRoot traffic monitor

Status: local implementation, 2026-09-23. No production rollout or Vercel Drain has been enabled.

## What it measures

`core/scripts/traffic-monitor.ts` reads the existing nginx combined access logs and, when available, sanitized Vercel Log Drain NDJSON files. It produces a UTC report for the last complete hour, separately for `nginx` and `vercel`. A GitHub Actions hourly workflow runs both available inputs using the existing deployment SSH secret and sends an existing Bark notification only when an alert rule fires. The workflow is not live until it is pushed to `main`.

The report contains request counts, likely document requests, 5xx counts, a same-hour seven-day median, leading route groups, referrer hostnames, and declared bot User-Agent counts. A fourfold increase of at least 100 likely document requests or a 5xx rate of at least 5% over 100 requests raises an alert. Counts from the two delivery lines are kept separate. `pageCandidates` is a URL heuristic and includes possible prefetches; it is **not** unique visitors, Web Analytics page views, or a bot verdict. The `self-declared bot` class is based on an untrusted User-Agent string.

`/admin/users` measures registrations and memberships, not site traffic. The former `pageviews` and `traffic_daily` database tables were intentionally removed in migration 0125, so this monitor does not recreate or write to them.

## Privacy and coverage

The report drops URL query strings, source IPs, complete User-Agents, and referrer paths. Unknown and high-cardinality routes are grouped before they appear in output. Referrers are hostnames only. It does not persist raw Vercel or nginx requests. The source `coverage` field says `not_connected` when no input file for that delivery line was supplied. `no_matching_requests` can mean either no requests or a gap in the supplied files; do not turn it into a zero-traffic claim.

The scheduled workflow reads `/var/lib/cuberoot/traffic/vercel.ndjson*` only after Vercel Log Drain has been connected. The receiver at `https://api.cuberoot.me/v1/ops/traffic/drain` checks the official HMAC signature and writes a restricted NDJSON file with query strings, IPs, full User-Agents, and referrer paths removed. The server needs `VERCEL_TRAFFIC_DRAIN_SECRET` set to the Drain signature secret; without it the endpoint returns 503. Vercel Drains are a separately billed Pro feature, so choose production-only logs, JSON array format, HTTPS destination, and a measured sampling/cost policy before activation. The file uses 14 daily rotations. An Analytics Drain, if added later, is a separate stream of page-view events and must not be added to HTTP request totals.

## Run locally

Node 24 can run the TypeScript file directly:

```bash
node --experimental-strip-types core/scripts/traffic-monitor.ts \
  --nginx /path/to/www.cuberoot.me.log \
  --nginx /path/to/www.cuberoot.me.log-20260923.gz \
  --vercel /path/to/sanitized-vercel.ndjson
```

Repeat `--nginx` and `--vercel` for each input file. `--now 2026-09-23T19:07:00Z` fixes the report clock for incident replay. Use `node --experimental-strip-types --test core/scripts/traffic-monitor.test.mjs` for the narrow parser and alert checks. The report is JSON on stdout; parse errors and missing input files fail the process.

## Rollout boundary

Before scheduling production alerts, confirm the workflow's SSH and Bark secrets still resolve, check one full hourly report against the same nginx time window, and verify the first scheduled run. For Vercel, deploy the receiver and retention rule, configure the signature secret on the API host, then connect the Drain and compare the two request lines with Web Analytics in the same UTC hour. No drain, new secret, paid service, firewall rule, or GA4 tag is configured by this change.

References: [Vercel Log Drain schema](https://vercel.com/docs/drains/reference/logs), [Drain signatures](https://vercel.com/docs/drains/security), [Web Analytics measurement](https://vercel.com/docs/analytics).
