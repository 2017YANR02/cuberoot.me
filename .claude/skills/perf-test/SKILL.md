---
name: perf-test
description: "Use when 测/诊断/优化页面加载速度 (LCP / FCP / bundle 大 / 加载慢 / 首屏)。三件套:PageSpeed Insights API (拿 CrUX 真用户 Web Vitals) + playwright resource panel (看运行时加载) + visualizer .tmp/bundle-stats.json (jq 解析 chunk 内部)。Triggers: \"页面慢\", \"加载慢\", \"测速度\", \"测加载\", \"bundle 大\", \"perf\", \"首屏\", \"LCP\", \"FCP\", \"Web Vitals\", \"PageSpeed\", \"WebPageTest\", \"chunk 太大\", \"lazy load\", \"动态 import\", \"瓶颈\"."
---

# Perf test playbook

## 1. 真用户 Web Vitals (最先做)

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<URL>&strategy=mobile" \
  | jq '.loadingExperience.metrics | {LCP: .LARGEST_CONTENTFUL_PAINT_MS, FCP: .FIRST_CONTENTFUL_PAINT_MS, CLS: .CUMULATIVE_LAYOUT_SHIFT_SCORE, INP: .INTERACTION_TO_NEXT_PAINT, TTFB: .EXPERIENCE_TTFB_MS}'
```

CrUX p75 全绿 = 真用户已秒开,优化是 vanity。WPT (webpagetest.org) 给 filmstrip 更直观,但要用户在浏览器跑,AI 别用。

## 2. 运行时加载顺序 (playwright)

```js
playwright navigate → wait 5s → evaluate:
const r = performance.getEntriesByType('resource');
// 看 top N by decodedBodySize + start time
// transferSize=0 = cache hit, 只能看 SHAPE 不能看 wire
```

cache 污染时 wire 不准,但 resource list / start time / decoded size 永远真实。

## 3. Chunk 内部 (visualizer + jq)

每次 prod build 自动出 `packages/client/.tmp/bundle-stats.{html,json}` (gitignored,vite.config.ts 已配)。

主 bundle top 模块按 gzip 排:
```bash
jq -r '
  .tree.children as $chunks | .nodeMetas as $metas | .nodeParts as $parts |
  ($chunks[] | select(.name | startswith("_assets/index-")) | .name) as $chunk |
  ($metas | to_entries | map(.value | select(.moduleParts[$chunk] != null)
    | {id, gz: $parts[.moduleParts[$chunk]].gzipLength}))
  | sort_by(-.gz) | .[0:20] | .[]
  | "\(.gz) gz  \(.id | sub(".*node_modules/(.pnpm/)?";"") | sub(".*core/packages/client/src/";"src/"))"
' packages/client/.tmp/bundle-stats.json
```

任意 chunk:把 `startswith("_assets/index-")` 换成 `startswith("_assets/LandingPage-")` 等。

## 4. 修法

找到意外大块(其它页代码 / 重型 lib 泄漏到主 bundle) →
1. `grep "from ['\"]<path>"` 找 importer
2. importer 通常在 `App.tsx`(static 而非 lazy)或某 hook 顶部 static import heavy lib
3. 改 `React.lazy(() => import(...))` 或 useEffect 内 `await import(...)`
4. 重 build,jq 再核 — 主 bundle 应该缩

## 经验过的坑

- `import.meta.glob({ eager: true })` 会把 N 个文件全打进调用者 chunk(EventIcon SVG)
- `import * as OpenCC` 整库进 import 链,即使只用一处兜底
- 静态 `import { Heavy } from ...` 哪怕只是 hook 用一次也全进 chunk → 改 dynamic import
- vite `modulePreload: false` 已设;若 lazy chunk 仍首屏加载,查 `<link rel="modulepreload">` 或某 always-loaded 模块 static import

## 参考

加新内容时主动想速度:见 memory `feedback_watch_page_load_speed`。
