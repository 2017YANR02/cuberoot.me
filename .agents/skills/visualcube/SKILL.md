---
name: visualcube
description: "Use when rendering NxN cube state image. Single entry: `<VisualCube>` / `cubeSVG()` from `@cuberoot/visualcube`. 手写 `<rect>` SVG = bug. Triggers: \"魔方图片\", \"cube image\", \"VisualCube\", \"MiniCube\", \"JcubeThumb\", \"F2L 图\", \"OLL 图\", \"PLL 图\", \"ZBLL 图\", \"立方体预览\", \"facelets\", \"NxN cube\", \"2x2 / 4x4 / 5x5 thumbnail\"."
---

## 入口

- React: `<VisualCube algorithm view size puzzleSize />`，`puzzleSize` 默认 3，支持 2..7
- DOM: `cubeSVG(el, opts)` / 字符串: `renderCubeSVG(opts)` / query API: `renderFromSimpleQuery({alg, view, mask, size, cubeSize, ...})`（server + Vite middleware 共用）

## view

- `f2l` → isometric, LL 灰
- `plan` → 平面识别图；侧环中等于遮罩灰的格子默认删除，顶面灰格必须保留
- `oll` → plan 顶视, 黄/灰朝向图（自动切 OLL scheme）
- `pll` → plan 顶视 + 侧边 LL 贴纸（PLL/COLL/ZBLL/CLL/4x4 PLL Parity/5x5 L2E·L2C 都用这个）
- `pll-iso` → isometric LL
- 其他 mask → 直接 `Masking.X`（22 个核心 mask 全 size 工作；30+ 扩展 mask 仅 `cubeSize=3`，见 README）

## algorithm

`<VisualCube algorithm>` 走 `case`（库内反转），传"待解 case"，空串=solved。

## 禁忌

- 手写 `<rect>` 拼贴纸（删过 `MiniCube.tsx` / `JcubeThumb.tsx`）
- 静态图用 cubing.js `TwistyPlayer`（重，是给动画用的）
- 覆盖 `colorScheme`（除非有具体理由）
- `plan` 图手动保留侧面灰格；灰色侧环不是题面，`renderFromSimpleQuery({view:'plan'})` 已默认只删侧灰、保留顶灰
- server / client 各写一份 view→mask 映射 —— 走 `renderFromSimpleQuery`

## 应用内图片性能

- `/alg`、`/recon`、`/timer` 的静态状态图复用本地绘图，避免图片接口往返。少量当前题、上一个和弹窗图使用 `<CaseThumb local>` / `<VisualCube local>`。
- 长列表、旧成绩和选择网格使用 `local` + `loading="lazy"`。`VisualCube` 已复用 `LazyVisible`：提前 160px 挂载，挂载前保留准确宽高，进入后保留，不反复生成；不要自行再写一套可见性监听。
- 不可省略长列表的 `loading="lazy"` 而一次同步生成全库；也不要因数量增加改回网络 SVG。更新打乱、遮罩、配色和朝向时仍传无损参数给同一绘图器。
- `CaseThumb` 的非 NxN 静态资源、视频封面、动画播放器和对外分享用 SVG URL 保持各自用途。回归：`core/packages/client/tests/visualcube-lazy-local.test.ts`。

## 改包与网络图片接口

改 `packages/visualcube/src/` 后必须 `pnpm --filter @cuberoot/visualcube build`。Node 端消费者（Hono server）走 `dist/index.js` 的 esbuild bundle；只跑 typecheck 出的 per-file `.js` 是 extensionless import，Node ESM 解析不了，会出"prod 还是 3x3"这种诡异 bug。

新加 `.ts` 文件 / 新 import 必须带 `.js` 扩展名（`from './foo.js'`），Node ESM 严格要求；漏写会导致 CI 上加载 visualcube 时 `ERR_MODULE_NOT_FOUND`。

`VisualCube` 未指定 `local` 时仍保留 `<img>` → `/v1/visualcube.svg` 的网络能力，供确有需要的消费者使用；上面三个应用区域遵守本地绘图契约。这个网络分支没有 service-worker 拦截或 `build-sw` 步骤。改包后仍必须构建共享包；是否需要后端发布取决于是否修改网络接口实际使用的引擎。
