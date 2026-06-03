---
name: math-content
description: "Use when adding content under /math/* — 给数学板块补内容。两种模式:(A) 给已有长篇\"书\"页(如 /math/group 魔方与群论,62 节;/math/god)加新一节;(B) 加一个全新 /math 顶层主题页。全在 client-next (Next 16 App Router, app/[lang]/math/*)。覆盖自包含 section 文件 + dynamic 懒加载 + slug 路由 + 双语 + 手写交互 SVG。Triggers: \"/math\", \"math/group\", \"math/god\", \"群论\", \"加群论章节\", \"加一节\", \"math subpage\", \"加数学页\", \"数学长文\", \"扩充 /math\", \"add math section\", \"new math page\", \"math hub\", \"对称群\", \"群论可视化\"."
---

# /math/* 加内容

**全在 client-next**(`core/packages/client-next/app/[lang]/math/`,Next 16 App Router,文件即路由)。退役的 Vite client 不碰。Hub 在 `math/page.tsx`(`CARDS` 数组 → /math 上的卡)。已有子页:`group`(魔方与群论,62 节 slug 路由长文)、`god`、`demigod`、`unit-distance`,各自 `<topic>/page.tsx`('use client') + co-located `<topic>.css` + `_components/`。

两种加法,先判断走哪条:

## Mode A — 给已有的长篇"书"页加一节(默认走这条:/math/group 加 §N)

`/math/group` 是 slug 路由的多节长文:`[slug]/page.tsx` 只 re-export `../page` 的 default;`page.tsx` 用 `SlugContext` + `<GTSec>`(按 slug 门控,只渲染当前节)。**单节出错不波及全站**。加一节:

1. **新建** `_components/sections/<Name>.tsx`:
   - 第 1 行 `'use client';`
   - `export default function <Name>()` 返回 **一个** `<GTSec id="<slug>" className="gt-sec">`,内含 `<div className="gt-sec-num">§N</div>` + `<h2 className="gt-sec-title">` + `<p className="gt-lede">` + 正文 + **≥2 个交互面板**。
   - **只 import**:`{ GTSec, L, TeX, TeXBlock, useLang } from '../primitives'`;需要魔方状态才 `{ identity, applyAlg, orderOf, invariants, cycleStructure, permSign, ... type CubieState } from '../cube_state'`;链接别页才 `next/link`;图标用 `lucide-react`。**禁** import page.tsx;**禁** 顶层 import `cubing/*` 或 `three`(要 cube 动画用 page.tsx 本地的 `TwistyMini` —— 别把它放进 primitives export,否则它的 `onPlayerReady` 函数 prop 触发 Next RSC 检查 TS71007)。
   - 自包含:所有 helper 本地定义,别伸手进 page.tsx。
2. **接线 page.tsx**(4 处):
   - `EXT_COMPONENTS` 加 `'<slug>': dynamic(() => import('./_components/sections/<Name>'), { ssr: false }),`(懒加载,初始 bundle 不膨胀)。
   - `TOC` 数组在 `refs` 那条**之前**加 `{ id:'<slug>', num:'N', zh:'…', en:'…' }`。
   - `TOC_THEMES` 把 slug 加进对应主题的 `secs`(或新建一组 theme,带 zh/en/descZh/descEn/range)。
   - render 处 `<NewSectionMount slug={slug}>` 已按 slug 自动挑,**不用动**。
   - 顺手更新 hero byline 与 TOC head 的节数,以及 `math/page.tsx` 卡片描述的节数/面板数。
3. slug 走 `[slug]` 动态路由,**无需** `generateStaticParams`。

## Mode B — 加一个全新 /math 顶层主题页(像 /math/god)

1. **新建** `app/[lang]/math/<topic>/page.tsx`('use client' + `useDocumentTitle` + `useTranslation` 取 lang)+ co-located `<topic>.css`(+ 可选 `_components/`)。
2. **改** `math/page.tsx` 的 `CARDS` 加一张卡(`to` / `Icon`(lucide) / `zh{title,desc}` / `en{title,desc}`)。
3. 颜色走全局 theme tokens(调 theme-tokens skill),别硬码灰阶。

## 硬约束(每节/每页必守)

- **真实可靠**:定义 / 定理陈述 / 数值 / 公式精确无误。优先**在代码里现算**(自校验),少硬编码。大数超 2^53(如 |G| = 43,252,003,274,489,856,000)**用精确字符串显示**,别拿 number 字面量(double 精度丢失,末几位变错)。不确定就 WebFetch 原始文档,禁凭记忆造数。
- **交互**:每节 ≥2 个真交互控件(数字/文本 input、`<input type=range>` 滑块、可点 SVG 元素、按钮、chip),输出随 state 现算,静态图不算。
- **可视化**:每节 ≥1 个**手写响应式 SVG**(viewBox + `width="100%"`)。**禁图表库**(recharts/d3/echarts 都不用),手写 SVG 跟全页风格统一。
- **SVG maxWidth 坑(最常踩,务必)**:凡 `width="100%"` 的 SVG **必须**同时 `style={{ maxWidth: <viewBox 自然宽度> }}`,否则宽屏上被拉满容器(~710px)等比撑大(近正方形 viewBox → 710×710)。窄屏靠 width=100% 缩,宽图外层包 `overflowX:auto`。
- **双语**:每个 user-facing 串 zh + en(`<L zh en>` 或 `useLang()` 三元),中文自然、不机翻。
- **移动端**:<480px 可用(SVG 靠 viewBox 缩,控件行 `flexWrap`,无 >360px 固定宽)。
- 复用 `.gt-*` class(`gt-panel/gt-panel-title/gt-panel-sub` `gt-def/gt-thm/gt-aside/gt-proof/gt-pullquote` `gt-input/gt-btn/gt-btn-ghost/gt-chip(+gt-chip-active)` `gt-result-row/gt-result-label/gt-result-val` `gt-compare` `gt-lede/gt-mono`),其余用 inline style + theme var(`--ink/--ink-dim/--accent/--accent-2/--green/--gold/--rule/--bg-elev/--mono/--serif`)。**不改任何 .css 文件**。分类调色板 `['#8B2E3C','#2A4D69','#3F7050','#B8860B','#6B4E9C','#C2410C','#5C7CA0','#9C4E6B']`。
- 公式用 `<TeX src={String.raw`…`} />`(行内)/ `<TeXBlock>`(独占)。**始终 String.raw** 让反斜杠存活。
- 不写 emoji(图标用 lucide);中文禁 `·` 间隔号;初始 render 禁 `Math.random()/Date.now()`(hydration);公开文案禁身份/拓扑词。

## 大批量扩充(派 agent 并行)

一次加很多节时:page.tsx 是单个大文件(>15k 行),**禁让多 agent 同改 page.tsx**(必撞)。让每个 agent **只写自己那一个** `_components/sections/<Name>.tsx`(文件名唯一 → 零冲突,不碰 CSS / page.tsx),最后由你**一次性人工接线**(import/TOC/themes)。给 agent 的合同 = 上面全部硬约束 + 精确文件绝对路径 + export 名 + 事实核查过的 spec。推荐流水线:**研究核查 → 撰写(可用 sonnet) → 对抗式复核(数学+编译+交互+双语,opus)**,别信子 agent 自报"通过",收尾自己跑权威检查。详见 memory `project_math_group_expansion`。

## 写完检查(必做,green typecheck ≠ 做好)

- `pnpm --filter @cuberoot/client-next typecheck`(tsgo,EXIT 0)。注意 ESLint **不扫 .tsx**、tsconfig **没开 noUnusedLocals** —— 想抓死代码得 `pnpm exec tsgo --noEmit --noUnusedLocals --noUnusedParameters`。
- **playwright 实开**每个新 slug(zh + en):0 console error、有 `.gt-sec-title`、有 SVG、≥2 控件;量 SVG `getBoundingClientRect` 高度别超 ~440px(超了八成是漏 maxWidth);390px 无横向溢出;EN 模式无中文残留。dev 已在 `http://127.0.0.1:3000/`(**别** `pnpm dev`)。
- 关键数值人工核对一遍。
