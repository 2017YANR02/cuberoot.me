---
name: perf-test
description: "Use when measuring, diagnosing, or optimizing page-load performance, including regional slowness, Web Vitals, TTFB, bundles, rendering, and lazy loading in the Next.js client."
---

# Performance diagnosis

Diagnose in this order: field impact, regional network, runtime waterfall, bundle composition. Do not infer a cause from one synthetic score.

## 1. Fix the comparison surface

Record the exact URL, country or city, device, browser, approximate time, and whether the report is a cold or repeat visit. Compare the same URL and time window against at least one unaffected region. For route-specific reports, test that route rather than only the home page.

Separate these origins when the page uses them:

- `cuberoot.me`: HTML and `/_next/*`
- `static.cuberoot.me`: stats and shared static data
- `api.cuberoot.me`: API calls

## 2. Check real-user data first

Query PageSpeed Insights from PowerShell:

```powershell
$target = [uri]::EscapeDataString('https://cuberoot.me/')
$psiUrl = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$target&strategy=mobile&category=performance"
if ($env:GOOGLE_PSI_API_KEY) { $psiUrl += "&key=$([uri]::EscapeDataString($env:GOOGLE_PSI_API_KEY))" }
$psi = Invoke-RestMethod $psiUrl
$psi.loadingExperience | Select-Object id, overall_category
$psi.originLoadingExperience | Select-Object id, overall_category
$psi.loadingExperience.metrics | Select-Object LARGEST_CONTENTFUL_PAINT_MS, INTERACTION_TO_NEXT_PAINT, CUMULATIVE_LAYOUT_SHIFT_SCORE, EXPERIENCE_TTFB_MS
$psi.lighthouseResult.categories.performance, $psi.lighthouseResult.audits.'largest-contentful-paint', $psi.lighthouseResult.audits.'server-response-time'
```

Use URL-level `loadingExperience` when present; otherwise label the `originLoadingExperience` fallback. Treat Lighthouse as lab data and CrUX as a rolling 28-day aggregate. PSI and the CrUX API have no country dimension, so neither can confirm or refute a Southeast Asia-only regression. If PSI is rate-limited or returns no field data, state that explicitly; do not turn missing data into a green result.

For country-level historical evidence, use CrUX BigQuery only when credentials and enough traffic are available. Its country data is monthly and origin-level, not a live URL test. Official references: [CrUX tools](https://developer.chrome.com/docs/crux/methodology/tools) and [PSI API](https://developers.google.com/speed/docs/insights/v5/get-started).

## 3. Measure the affected region

Start with [SpeedVitals TTFB Test](https://speedvitals.com/ttfb-test) for a one-click 40-location overview. It measures one resource, so use it to find regional TTFB outliers, not to judge rendering or LCP. Repeat the run to distinguish a cold edge miss from a stable route problem.

Then use the [Globalping web tool](https://globalping.io/) for targeted HTTP probes. Select at least three affected Southeast Asian cities and two controls. Prefer eyeball probes when available. Inspect the actual selected city and network instead of trusting a magic location string, then reuse the measurement ID so every compared URL uses the same probes.

Repeat for the slow route and the exact `/_next/*`, `static`, or `api` resource on its critical path; do not probe a subdomain root that the page never requests. Compare DNS, TCP, TLS, TTFB, total time, status, redirect target, cache headers, and body size. Use GET when HEAD behavior differs or body transfer is part of the question. A probe is one observation, so repeat suspicious measurements at least three times. Treat share links as public and do not paste resolved infrastructure details into reports.

Use [WebPageTest](https://www.webpagetest.org/) from an affected location when a full browser filmstrip, LCP element, or request waterfall is needed. Keep its device, connection profile, and repeat-view setting identical across locations.

Do not run DNS or route reverse-lookups unless the user asks. Do not expose infrastructure identity in the report.

## 4. Inspect the browser waterfall

Use the project Playwright surface with a fresh context. Capture one cold load with cache disabled and one warm reload. For mobile complaints, set the relevant viewport. When reproducible network and CPU throttling is required, use Chromium CDP with recorded parameters or WebPageTest; do not claim throttling when the active Playwright surface cannot apply it. Wait through the page's meaningful settled state, not an arbitrary screenshot moment.

Install buffered `PerformanceObserver`s for `largest-contentful-paint` and `longtask` with a pre-navigation init script. Post-load resource timing alone cannot recover complete LCP attribution or every long task.

Collect navigation and resource timing:

```js
const nav = performance.getEntriesByType('navigation')[0];
const resources = performance.getEntriesByType('resource').map((r) => ({
  name: r.name,
  type: r.initiatorType,
  start: Math.round(r.startTime),
  duration: Math.round(r.duration),
  transfer: r.transferSize,
  decoded: r.decodedBodySize,
  ttfb: Math.round(r.responseStart - r.requestStart),
}));
({
  navigation: nav && {
    ttfb: Math.round(nav.responseStart - nav.requestStart),
    download: Math.round(nav.responseEnd - nav.responseStart),
    dcl: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
  },
  slowest: [...resources].sort((a, b) => b.duration - a.duration).slice(0, 25),
  largest: [...resources].sort((a, b) => b.decoded - a.decoded).slice(0, 25),
});
```

Also capture failed requests, redirects, response headers, LCP element, long tasks, and console errors. `transferSize === 0` may mean cache reuse or unavailable cross-origin timing; it is not proof of zero wire bytes. Resources initiated after LCP or by link prefetch are not automatically LCP blockers.

## 5. Inspect Next.js 16 bundles

This repo uses Next.js 16 and Turbopack. Do not use the retired Vite `bundle-stats.json`, `visualizer`, `_assets/index-*`, or `App.tsx` workflow. Next 16 also removed JS size rows from `next build`.

First check whether the persistent dev server is using port 3000. Do not run the analyzer concurrently against the same `.next` tree; skip it or stop dev only with the user's consent.

From `core/`, run:

```powershell
pnpm --filter @cuberoot/client exec next experimental-analyze --output
```

The report is written to `packages/client/.next/diagnostics/analyze/` without producing a deployable build. For interactive inspection, omit `--output` and use port 4000 only when opening a browser is appropriate.

Filter by the reported route and `client`, then inspect the largest JavaScript, CSS, and JSON modules. Follow the analyzer's full import chain across Server/Client Component boundaries and dynamic imports. Save before/after analyzer outputs under the repo's ignored `.tmp/` when comparing a fix.

Use `@next/bundle-analyzer` only for an explicitly webpack-based build. Do not install it for the default Turbopack path.

## 6. Classify before changing code

- High HTML TTFB only in affected regions: investigate CDN routing, edge misses, redirects, or origin reachability.
- Fast HTML but slow `static` or `api` origin: fix that origin's delivery, cache policy, or critical-path dependency.
- Network completes early but LCP or INP stays poor: profile rendering, hydration, long tasks, fonts, and image decode.
- Cold load slow but warm load fast: inspect payload size and cache policy.
- Warm load also slow: inspect revalidation, repeated fetches, main-thread work, and runtime rendering.

For bundle regressions, first check whether a `'use client'` boundary pulled a heavy import into the client graph, a barrel import defeated tree-shaking, a layout made route-only code global, or a dynamic import is invoked eagerly. Apply the smallest boundary fix, then repeat the same cold/warm, regional, and analyzer measurements.

Report measured evidence, the strongest supported cause, remaining uncertainty, and the exact verification surface. Do not say a regional issue is fixed without a fresh measurement from that region.
