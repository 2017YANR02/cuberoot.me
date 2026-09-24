# CubeRoot traffic monitor

Status: nginx request monitor deployed on 2026-09-23. The first manual GitHub Actions run succeeded. No additional paid service was enabled.

## Live coverage

`Traffic Monitor` runs hourly from GitHub Actions, reads the existing `www.cuberoot.me` nginx access logs over SSH, and writes an hourly UTC report to the Action summary. It uses the existing Bark secret for alerts. The repository is public, so the hosted Actions workflow does not add a private-repository minutes charge.

The report includes request count, likely document requests, 5xx count, same-hour seven-day median, leading route groups, referrer hostnames, and declared automation User-Agent count. For the current nginx hour it also ranks temporary source labels by document requests and shows their request volume, leading route/referrer groups, browser claims, and peak requests per minute. A source is `declared_automation` when its User-Agent explicitly identifies a crawler or headless browser; `suspected_automation` means at least 60 document requests and either 20 route groups or 20 document requests in one minute. Everything else is `unverified`, **not** verified human. A fourfold increase of at least 100 likely document requests or a 5xx rate of at least 5% over 100 requests raises an alert. The Bark alert includes the leading route and source signal; the Action summary has the evidence. `pageCandidates` is a URL heuristic and can include prefetches; it is **not** unique visitors or Web Analytics page views. User-Agent strings can be forged, and the nginx logged address can be a proxy.

The script strips URL query strings, source IPs, complete User-Agents, and referrer paths from its report. It uses raw logged addresses only in memory while aggregating the current hour, then publishes rank-based labels such as `source-1`. Those labels are reset every hour and cannot identify a person or link a source across reports. Unknown and high-cardinality routes are grouped. It does not persist a second copy of raw nginx requests.

## Vercel line without an additional paid service

The existing Vercel Web Analytics dashboard remains the source for visitors, page views, page/referrer breakdown, and overseas-line traffic. Its [public Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api) can query the same aggregate dataset using an access token and project/team IDs; no new event collection or Drain is needed to read existing data. No token has been configured for the monitor, so its `vercel` source displays `not_connected`. Do not add nginx request counts to Analytics visitors or page views: they measure different things and the delivery lines may overlap.

Vercel Log Drains are billed separately and are **not enabled**. The previously prepared Drain receiver was removed when the owner chose zero additional paid services. Do not add a Log Drain or Web Analytics Plus subscription for this monitor.

For a Vercel Analytics spike, open the page filter and time range in Analytics, then use the existing Vercel Logs view for the same route and window while logs are retained. Inspect several consecutive requests for User-Agent declarations, query patterns, referrers, and timing. A browser-looking User-Agent or absent referrer does not establish a human visitor. The hourly nginx attribution above applies only to requests in that server's logs; `vercel:not_connected` means the automated report cannot classify Vercel-only traffic. Do not extrapolate a small log sample into a precise bot percentage.

`/admin/users` measures registrations and memberships, not site traffic. The former `pageviews` and `traffic_daily` tables were intentionally removed in migration 0125, so this monitor does not recreate or write to them.

## Run and verify

The [Traffic Monitor workflow](../.github/workflows/traffic_monitor.yml) can be started manually. The report is in the run's Summary. The first manual run reported the UTC hour beginning 2026-09-24 00:00:00: 2,901 nginx requests, with `vercel:not_connected` displayed explicitly. A successful report means the SSH and parser path worked; Bark sends a message only when an alert rule fires.

Node 24 can also read existing logs directly:

```bash
node --experimental-strip-types core/scripts/traffic-monitor.ts \
  --nginx /path/to/www.cuberoot.me.log \
  --nginx /path/to/www.cuberoot.me.log-20260923.gz
```

Repeat `--nginx` for each file. `--now 2026-09-23T19:07:00Z` fixes the report clock for an incident replay. The narrow parser and alert checks run with `node --experimental-strip-types --test core/scripts/traffic-monitor.test.mjs`. The report is JSON on stdout; parse errors and missing input files fail the process.

Reference: [Vercel Web Analytics](https://vercel.com/docs/analytics), [Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api).
