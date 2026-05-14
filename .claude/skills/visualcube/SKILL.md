---
name: visualcube
description: "Use when rendering NxN cube state image. Single entry: `<VisualCube>` / `cubeSVG()` from `@cuberoot/visualcube`. 手写 `<rect>` SVG = bug. Triggers: \"魔方图片\", \"cube image\", \"VisualCube\", \"MiniCube\", \"JcubeThumb\", \"F2L 图\", \"OLL 图\", \"PLL 图\", \"ZBLL 图\", \"立方体预览\", \"facelets\", \"NxN cube\", \"2x2 / 4x4 / 5x5 thumbnail\"."
---

## 入口

- React: `<VisualCube algorithm view size puzzleSize />`，`puzzleSize` 默认 3，支持 2..7
- DOM: `cubeSVG(el, opts)` / 字符串: `renderCubeSVG(opts)` / query API: `renderFromSimpleQuery({alg, view, mask, size, cubeSize, ...})`（server + Vite middleware 共用）

## view

- `f2l` → isometric, LL 灰
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
- server / client 各写一份 view→mask 映射 —— 走 `renderFromSimpleQuery`

## 改包

改 `packages/visualcube/src/` 后必须 `pnpm --filter @cuberoot/visualcube build`。Node 端消费者（vite.config.ts middleware、Hono server）走 `dist/index.js` 的 esbuild bundle；只跑 typecheck 出的 per-file `.js` 是 extensionless import，Node ESM 解析不了，会出"prod 还是 3x3"这种诡异 bug。

新加 `.ts` 文件 / 新 import 必须带 `.js` 扩展名（`from './foo.js'`），Node ESM 严格要求；漏写会导致 CI 上 vite.config.ts 加载 visualcube 时 `ERR_MODULE_NOT_FOUND`。

还得 `pnpm --filter @cuberoot/client build-sw` + 浏览器硬刷。`<VisualCube>` 走 `public/sw.js` 拦截本地渲染，SW 把包内联了；不 rebuild 静默用旧代码（图不更新、无报错）。`/visualcube` 编辑器自己内联渲染，不走 SW。
