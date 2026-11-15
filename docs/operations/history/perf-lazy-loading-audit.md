# 重组件懒加载审计（three / cubing.js / maplibre）

**日期**：2026-07-25 ｜ **范围**：`core/packages/client` 全站

## 三条准则

1. **引擎永远 code-split**，不进 initial bundle。
2. **首屏固定尺寸容器 + 轻量占位**，引擎到了再接管 → 无 CLS、无空白焦虑。
3. **「几乎肯定要用」的 chunk 在空闲预热**，别在关键渲染路径上 `await`。

## 体积实测

`node_modules` 里的文件大小会严重误导（cubing 的入口是薄壳，重量在它自己按需拉的
chunk 里）。下表是**真打包出来的数字**，esbuild `--bundle --minify --splitting`，
只算「静态 import 会进首包」的那部分：

```bash
# 在 packages/client 下，复现用
pnpm exec esbuild entry.mjs --bundle --minify --format=esm --splitting --outdir=out
# 入口 + 它静态 import 的 chunk 拼起来 gzip -9
```

| 静态 import 什么 | 进首包 min | gzip | 现状 |
|---|---|---|---|
| `sim/engine/world` + three（真实引擎面） | **660KB** | **177KB** | 6 处消费点全动态 ✅ |
| `three`（仅 WebGLRenderer，tree-shake 后底线） | 488KB | 123KB | — |
| `cubing/scramble` + `cubing/search` | **76KB** | **21KB** | 静态 → 已改动态 |
| `cubing/alg` | 19KB | 5KB | 静态，不改（见下） |
| `cubing/twisty` | ~592KB（目录） | — | 5 处消费点全动态 ✅ |
| `maplibre-gl` | ~550KB | — | `dynamic()` 包住 ✅ |

cubing 的 `twips_wasm`(687KB)、`puzzles-dynamic-*`、`search-dynamic-*` 都是它运行时
自己按需拉的，静态 import 不会把它们塞进首包 —— 所以 cubing 那刀的收益是 21KB gzip
× 7 个引用页，不是一开始估的 185KB。

## 审计结论（改造前）

| 准则 | 状态 | 说明 |
|---|---|---|
| ① code-split | ✅ 基本达标 | three / twisty / maplibre 的消费入口都是动态；`sim/engine/**` 60 个文件静态 `import * as THREE` 但只被动态入口拉，等价路由级 split |
| ② 占位 / 无 CLS | ⚠️ 一半 | 13 个 `next/dynamic` 无 `loading:`；effect 内动态加载的 8 个重组件全部零骨架 |
| ③ idle 预热 | ❌ 几乎没有 | 全站 idle 调用清一色在推迟**数据 fetch**；预热 **chunk** 的只有 `DeskPet:340` 一处 |

额外发现：**全站没有任何一处「等首帧画完再 import」**——都是 mount 即 `await import()`。首页装饰性 3D（`LandingCubeHero`）就这么和首页 LCP 抢主线程。

## 任务清单（全部完成）

- [x] **P0 首页 hero — 177KB gzip 彻底不再加载**
  先做了延后（IntersectionObserver + `onIdle` 双闸 + `:empty` 兜底高度），随后**按用户要求整块删除**：`LandingCubeHero.tsx` 移入回收站，`app/[lang]/page.tsx` 去掉 hero 分支（无图标的卡不再渲染空 `.card-icon`），`landing.css` 清掉 `.cube-hero-slot` / `.cube-hero-fallback` / hero 专属高度，`tier-hero` 回归普通宽卡（`min-height: 152px`，字号与 `hero-side` 齐）。首页现在完全不碰 three。
- [x] **P1 补 `loading:` 占位（按判据只补该补的）**
  补：`alg/roux`（页面主体 70vh）、`paint`（同）、`wca/results` 的 echarts（190px）、`math/probability` ×4（360px）、`mosaic` ×6（60vh）、`LandingSearch` 的 EventIcon（1.2em 方块）。
  **不补**：`code/traffic`（外层 `.tr-chart-wrap` 已 280px）、`ByEventView`（外层 `height:400`）、`math/unit-distance`（13 处 `<Suspense fallback>` 已覆盖）、`CompDetailPage` ×5 / `DeskPet` ×3 / `SheetView` / `ArticleAlgEmbed`（都是交互后才渲染，不在首屏，补了不解决任何 CLS）。
- [x] **P2 播放器容器兜底**
  只有 `TwistySection` 非 fill 模式缺高度 → `TwistySection.css` 加 `.twisty-section:not(--fill) .twisty-container:empty { min-height: 240px }`。
  复查后确认已达标、无需改：`AlgPlayer`（host 固定 `size×size`）、`CubingPreview`（`aspect-ratio`）、`TwistyMini`（`aspect-ratio:1.1`）、`NotationMove`（`aspect-ratio:1/1`）、`LiveCubeGyroView`（固定 size）、`ReconPlayerBase`（父 pane 100%）。
- [x] **P3 cubing 静态链改动态 — 每个引用页省 21KB gzip**
  `lib/cubing-scramble.ts`（`loadCubingScramble()` 缓存 promise，`setSearchDebug` 随行）、`lib/scramble-from-solution.ts`（`loadSolver()`）、`math/demigod/LiveSampler.tsx`（`loadScrambler()`）。
  受益页：`/scramble/gen`（+QuickMode/TNoodleMode）、`PuzzleOptimalSolver`（各 solver 页共用）、`_Sq1Solver`、`/sim` 的 PlayerControls、`/math/demigod`。
- [x] **P4 `/scramble/solver` 立体画板**（上一轮）
  `afterFirstPaint()` + 四个模块一次 `Promise.all`（原本 three → world/interaction → Toucher 三段串行）+ `useIdlePreloadPaintEngine` + 250ms 延迟 spinner。

**明确不做**（代价 > 收益）：

- `cubing/alg` 的静态 import（`lib/cube3.ts` → `lib/puzzle-image/render.ts` 等）。实测只有 19KB min / **5KB gzip**，而 `invertAlg` 是**同步** API，被渲染路径同步调用；改动态要把整条链染成 async，波及十几个渲染器。留着。
- three 的 tree-shaking 深挖（`import * as THREE` → 具名 import）。`next.config` 已有 `optimizePackageImports: [three, maplibre-gl, katex]`；手改 60 个引擎文件风险高、收益不确定。
- poster 静态图占位。client 的 `<VisualCube>` 是打后端的 `<img>`，为占位反而加一个跨域请求；纯 TS 渲染器又会把 `lib/puzzle-image` 拉进首包。固定尺寸 + 延迟 spinner 是零字节方案。

## 复用的零件

- `lib/on-idle.ts` 的 `onIdle(fn, {timeout})` —— 已存在，别再手写 `requestIdleCallback`。
- `afterFirstPaint()`（`_Interactive3DCube.tsx`）—— 嵌套 rAF，等像素真上屏。
- `:empty` CSS 兜底高度 —— 容器空着时撑住布局，DOM 一挂上自动失效，零 JS。

## 验证

- `typecheck` 干净；`test` **2613 passed / 3 skipped**（含 `scramble-from-solution` 9/9 —— 走的正是新的动态 import 路径）。
- 字节数是 esbuild 单独打包实测（方法见上表），可复现。
- **未做**：Next build 产物 + 浏览器实测（LCP / TBT）。dev server 常驻，本地禁 `next build`（共用 `.next/` 会撕裂 manifest）。要端到端数字得停 dev 跑一次 build + Lighthouse/PageSpeed（见 skill `perf-test`）。

## 收益汇总

| 页面 | 从首屏关键路径移走 |
|---|---|
| 首页 `/` | three + 引擎 **177KB gzip** 完全不再加载（hero 3D 已删，只留文字卡） |
| `/scramble/gen`、各 solver 页、`/sim`、`/math/demigod` | cubing scramble+search **21KB gzip**（每页） |
| `/scramble/solver` 立体画板 | 引擎推到首帧之后；四模块并行取，省掉两段串行往返 |
| 6 类首屏/常显 `dynamic` 位 | 补占位，消掉对应的布局跳动 |
