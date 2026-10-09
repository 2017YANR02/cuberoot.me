# 2026-09-22 `/zh/calc` traffic spike

Follow-up: [September 22–25 public incident review](traffic-incident-2026-09-22-25.md), including the subsequent pauses, reopening, corrected prefetch diagnosis, and automatic-guard coverage.

Observed on 2026-09-23 using the project's existing Vercel Analytics and Logs. The incident date and hours below use the dashboard's America/Los_Angeles timezone. No paid logging service was enabled.

## Evidence

- [Vercel Analytics, `/zh/calc`, September 22](https://vercel.com/cube-root/cuberoot-me/analytics?filter=%7B%22path%22%3A%7B%22values%22%3A%5B%22%2Fzh%2Fcalc%22%5D%2C%22operator%22%3A%22eq%22%7D%7D&from=1790060400&to=1790146740&client_type=client_name&page_type=hostname): 9,268 visitors, 9,531 page views, 95% bounce rate. The filtered referrer panel had no data; device breakdown showed 100% desktop. These are Vercel Analytics aggregates, not verified people.
- [Vercel Logs, September 22 20:00–23:59, `/zh/calc`](https://vercel.com/cube-root/cuberoot-me/logs?startDate=1790132400&endDate=1790146740&search=requestPath%3A%2Fzh%2Fcalc): the UI showed approximately 7,000 matching requests in this four-hour window. Consecutive entries were separated by fractions of a second to seconds and repeatedly changed WCA competition, event, round, and competitor query parameters. Query values are omitted here.
- Fifteen consecutive request details sampled in that window all had WCA competition and competitor parameters. One declared `Lightpanda/1.0`; nine claimed Chrome, four claimed Edge, and one claimed Firefox. An earlier separate small sample also contained Lightpanda. [Lightpanda describes itself as a headless browser for AI and automation](https://github.com/lightpanda-io/browser). Browser claims are untrusted and can be forged.
- The site's WCA competition detail page generates links to `/zh/calc` with competition and competitor parameters. This supplies a plausible route for an automated client to discover many distinct calculation URLs; the entry point of this particular client has not been established.

## Assessment

The inspected burst has **strong evidence of automated traversal of WCA calculation links**, including an explicitly headless browser and rapid systematic variation of URL parameters. The existing data cannot determine the share of all 9,268 Analytics visitors that were automated, identify the operator, or prove that every browser-looking request was a real person. The referrer panel being empty is not proof of direct human traffic.

The hourly nginx monitor covers the separate server line and cannot classify the Vercel-observed requests on its own. Analytics events may also originate from self-hosted pages, so the Analytics spike must not be assumed to be exclusively Vercel-served page traffic. Use the filtered Vercel views above while logs are retained. Monitoring coverage is documented in [traffic-monitor.md](traffic-monitor.md); the subsequent 2026-09-24 mitigation and production pause are recorded in [traffic-defense.md](traffic-defense.md).
