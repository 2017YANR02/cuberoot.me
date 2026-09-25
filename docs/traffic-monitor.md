# CubeRoot traffic monitor

Public incident review: [2026-09-22–25 journal](traffic-incident-2026-09-22-25.md), with dashboard evidence and diagrams at `/dev/traffic-incident-2026-09` (`/zh/dev/traffic-incident-2026-09` in Chinese).

Status: main-domain nginx request monitor deployed on 2026-09-23. On 2026-09-25 the same hourly workflow was extended to the independent `api.cuberoot.me` and public `next.cuberoot.me` nginx logs. No additional paid service was enabled.

## Automatic emergency guard

The server-local `cuberoot-traffic-guard.timer` checks the three nginx access logs once per minute, 15 seconds after the minute boundary. It evaluates the last two complete minutes. A very large one-minute spike or two sustained high minutes in successful page requests, all web requests, API requests, API 429s, or 5xx responses trips the root-owned `/etc/nginx/cuberoot-maintenance-state.conf` switch and reloads nginx. The main site shows the existing maintenance notice; `next.cuberoot.me` and `api.cuberoot.me` return 503. ACME validation stays reachable. The guard sends a Bark alert using the existing key stored root-only on the server. It never auto-reopens; inspect the incident and explicitly set `default 0;` in the state file, then run `nginx -t && nginx -s reload`.

Initial thresholds: two complete minutes with at least 350 successful document candidates, 1,500 web requests, 1,200 API requests, 40 non-Analytics web/API 5xx, or 100 API 429 per minute. An extreme single minute at 1,000 document candidates, 4,000 web/API requests, 100 5xx, or 300 API 429 also trips. These are emergency thresholds above the 2026-09-25 observed short-window peaks; they are not bot classification and can still affect real visitors. The runtime switch survives later nginx deployments. The hourly report below remains useful for context and baseline analysis.

This local guard **does not see Vercel-only traffic**. Vercel's existing DDoS mitigation, WAF rules, Attack Mode while enabled, and spend pause operate independently. The Firewall Actions API reports actions by rule/IP, not all allowed requests, so it cannot make a reliable minute-by-minute all-traffic stop decision. Do not describe this as an automatic global shutdown. No Log Drain or Web Analytics collection has been enabled for it.

Current incident controls and recovery: [Traffic defense and cost protection](traffic-defense.md). On 2026-09-24 Web Analytics collection was disabled and the Vercel production project was paused; do not assume either is currently collecting or serving without checking the dashboard.

## Live coverage

`Traffic Monitor` runs hourly from GitHub Actions, reads the existing `www.cuberoot.me`, `next.cuberoot.me`, and `api.cuberoot.me` nginx access logs over SSH, and writes an hourly UTC report to the Action summary. It uses the existing Bark secret for alerts. The repository is public, so the hosted Actions workflow does not add a private-repository minutes charge. The three nginx sources are reported separately; `vercel:not_connected` remains a separate coverage gap. The `next` source uses the same page-candidate rules as the main nginx source but does not publish source-address attribution.

The report includes request count, likely document requests, 5xx count, same-hour seven-day median, leading route groups, referrer hostnames, and declared automation User-Agent count. For the current nginx hour it also ranks temporary source labels by document requests and shows their request volume, leading route/referrer groups, browser claims, and peak requests per minute. A source is `declared_automation` when its User-Agent explicitly identifies a crawler or headless browser; `suspected_automation` means at least 60 document requests and either 20 route groups or 20 document requests in one minute. Everything else is `unverified`, **not** verified human. A fourfold increase of at least 100 likely document requests or a 5xx rate of at least 5% over 100 requests raises an alert. The Bark alert includes the leading route and source signal; the Action summary has the evidence. `pageCandidates` is a URL heuristic and can include prefetches; it is **not** unique visitors or Web Analytics page views. User-Agent strings can be forged, and the nginx logged address can be a proxy.

The independent API report counts requests, 429 and 5xx responses, and bounded route groups such as `/v1/cubing-live/:id`. At least 10 API 429 responses in the hour raise an alert; a fourfold request spike of at least 500 above the same-hour baseline also raises an alert. The API report does not treat endpoints as page views or list source addresses.

The script strips URL query strings, source IPs, complete User-Agents, and referrer paths from its report. It uses raw logged addresses only in memory while aggregating the main-domain current hour, then publishes rank-based labels such as `source-1`. Those labels are reset every hour and cannot identify a person or link a source across reports. Unknown and high-cardinality routes are grouped. It does not persist a second copy of raw nginx requests.

## Vercel line without an additional paid service

When enabled, Vercel Web Analytics reports collected browser events, visitors and page/referrer breakdowns; it is not proof that the corresponding pages were served through Vercel. The client mounts Analytics and the nginx source configuration forwards `/_vercel/insights/` to Vercel, so self-hosted pages may also contribute events. Verify the deployed script and nginx configuration before attributing traffic to a delivery line. Its [public Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api) can query the same aggregate dataset using an access token and project/team IDs. No token has been configured for the monitor, so its `vercel` source displays `not_connected`. Do not add nginx request counts to Analytics visitors or page views. Collection was disabled on 2026-09-24 for cost control; use existing Firewall and Logs for current request investigation, and do not re-enable paid collection merely to inspect this incident.

Vercel Log Drains are billed separately and are **not enabled**. The previously prepared Drain receiver was removed when the owner chose zero additional paid services. Do not add a Log Drain or Web Analytics Plus subscription for this monitor.

For a Vercel Analytics spike, open the page filter and time range in Analytics, then use the existing Vercel Logs view for the same route and window while logs are retained. Inspect several consecutive requests for User-Agent declarations, query patterns, referrers, and timing. A browser-looking User-Agent or absent referrer does not establish a human visitor. The hourly nginx attribution above applies only to requests in that server's logs; `vercel:not_connected` means the automated report cannot classify Vercel-only traffic. Do not extrapolate a small log sample into a precise bot percentage.

`/admin/users` measures registrations and memberships, not site traffic. The former `pageviews` and `traffic_daily` tables were intentionally removed in migration 0125, so this monitor does not recreate or write to them.

## Run and verify

The [Traffic Monitor workflow](../.github/workflows/traffic_monitor.yml) can be started manually. The report is in the run's Summary. The first manual run reported the UTC hour beginning 2026-09-24 00:00:00: 2,901 main-domain nginx requests, with `vercel:not_connected` displayed explicitly. The [first run with API coverage](https://github.com/2017YANR02/cuberoot.me/actions/runs/36110433177) succeeded for 2026-09-25 06:00–07:00 UTC. The [first run with all three nginx sources](https://github.com/2017YANR02/cuberoot.me/actions/runs/36111796838) succeeded for 07:00–08:00 UTC and reported `nginx:observed:1428`, `next:observed:238`, `api:observed:2837`, and `vercel:not_connected:0`. A successful report means the SSH and parser path worked; Bark sends a message only when an alert rule fires.

Node 24 can also read existing logs directly:

```bash
node --experimental-strip-types core/scripts/traffic-monitor.ts \
  --nginx /path/to/www.cuberoot.me.log \
  --next /path/to/next.cuberoot.me.log \
  --api /path/to/api.cuberoot.me.log \
  --nginx /path/to/www.cuberoot.me.log-20260923.gz
```

Repeat `--nginx`, `--next`, or `--api` for each source file. `--now 2026-09-23T19:07:00Z` fixes the report clock for an incident replay. The narrow parser and alert checks run with `node --experimental-strip-types --test core/scripts/traffic-monitor.test.mjs`. The report is JSON on stdout; parse errors and missing input files fail the process.

Reference: [Vercel Web Analytics](https://vercel.com/docs/analytics), [Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api).
