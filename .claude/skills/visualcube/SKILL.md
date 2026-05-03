---
name: visualcube
description: "Use whenever rendering a 3x3 cube state image anywhere in UI — F2L / OLL / PLL case previews, custom case thumbnails, scramble-state visualizations, recon step images, alg library cards. Single source: `<VisualCube>` (React) or `cubeSVG()` (imperative) from `@cuberoot/visualcube`. Hand-written `<rect>` SVG cubes are a bug (legacy `MiniCube.tsx` was removed). Triggers: \"魔方图片\", \"cube image\", \"VisualCube\", \"MiniCube\", \"F2L 图\", \"OLL 图\", \"PLL 图\", \"isometric cube\", \"立方体预览\", \"渲染 cube state\", \"sr-visualizer\", \"facelets\"."
---

# 渲染魔方图片

## 唯一入口

- React：`<VisualCube algorithm={alg} view={'f2l'|'oll'|'pll'} size={88} />`，在 `core/packages/client/src/components/VisualCube.tsx`
- 命令式 / 复杂选项：`import { cubeSVG, Masking, Face, Axis, ICubeOptions } from '@cuberoot/visualcube'`，调 `cubeSVG(htmlEl, opts)`

## 选 view / mask

- F2L case 预览 → `view='f2l'`（isometric 3D，3 面可见）
- OLL case 预览 → `view='oll'`（plan view，顶视）
- PLL case 预览 → `view='pll'`（plan view + 完整 LL 侧边贴纸）
- 不在以上三类（自定义 mask） → 直接 `cubeSVG()` + `Masking.X`（`Masking.F2L` / `Masking.OLL` / `Masking.LL` / ...）
- 已有 facelet 字符串（solver / recon 出来的原始贴纸）→ `cubeSVG()` 传 `facelets` 选项

## 输入 algorithm

- `case`：传"待解的 case"，库内部反转再应用
- `algorithm`：传"从 solved 正向应用"
- 空串 = 还原态

## 配色

默认黄朝上、黄十字（speedcubedb 风格）。**不要覆盖 `colorScheme`** 除非有具体理由。

## 禁忌

- 手写 `<rect>` 拼贴纸（之前的 `MiniCube.tsx` 140 行 = 反面教材，已删）
- 静态缩略图用 cubing.js `TwistyPlayer`（重，是给动画的）
- 自己再写一份 short-name → face 映射，已经在包里

## 包

- `@cuberoot/visualcube` 是 workspace 包，从 npm `sr-visualizer` 移植（再上游是 Cride5 PHP visualcube），LGPL-3 vendored
- bundle ≈ visualcube + svg.js@2 共 ~100KB；algdb 这种 lazy route 影响小
- 新功能先看 `core/packages/visualcube/README.md` 的 PHP→TS roadmap，可能还没移植
