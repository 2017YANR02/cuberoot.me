---
name: theme-tokens
description: "Use when writing/editing CSS color values, backgrounds, borders, text colors, or dark/light theme behavior. shadcn-style token system + color-mix derivations + dark-locked page list. Triggers: \"颜色\", \"color\", \"background\", \"background-color\", \"border\", \"text color\", \"--background\", \"--foreground\", \"--muted\", \"--accent\", \"dark mode\", \"light mode\", \"theme\", \"主题\", \"暗色\", \"深色\", \"dark/light\", \"shadcn\", \"hex\", \"rgba\", \"color-mix\", \"#888\", \"#aaa\", \"#fff\", \"prefers-color-scheme\", \"data-theme\"."
---

# Theme tokens — Claude 风 hex + color-mix

token 定义在 `core/packages/client/app/globals.css :root`。完整色值表 + 决策树见下方表格 + 决策树小节(原 `client-vite/DESIGN.md` / `client-vite/src/pages/THEMING.md` 未随 Vite 退役迁过来)。

## 写新 CSS 必查 token 表

| 用途 | Token |
|---|---|
| 页面主背景 | `var(--background)` |
| 卡片 / panel 背景 | `var(--card)` 或 `var(--popover)` (浮层) 或 `var(--muted)` (弱化) |
| 主文字 | `var(--foreground)` |
| 副信息文字 | `var(--muted-foreground)` |
| 弱化 / disabled / 占位文字 | `var(--faint-foreground)` |
| 默认边框 | `var(--border-default)` |
| 强边框 | `var(--border-strong)` |
| 输入框边框 | `var(--input)` |
| focus ring | `var(--ring)` |
| 品牌强调 (terracotta) | `var(--accent)` |
| accent 上文字 | `var(--accent-foreground)` |
| accent tag/badge 弱化背景 | `var(--accent-soft)` |
| 主按钮背景 | `var(--primary)` |
| 主按钮文字 | `var(--primary-foreground)` |
| 危险/删除 | `var(--destructive)` / `var(--destructive-foreground)` |
| 成功 | `var(--signal-success)` |
| 警告 | `var(--signal-warning)` |
| 信息 | `var(--signal-info)` |

## 衍生色:一律 color-mix

```css
/* 半透明叠加 */
background: color-mix(in srgb, var(--foreground) 8%, transparent);
border: 1px solid color-mix(in srgb, var(--foreground) 20%, transparent);

/* hover / 提亮 */
background: color-mix(in srgb, var(--accent) 88%, black);    /* 压一档 */
background: color-mix(in srgb, var(--accent) 12%, transparent); /* tag 弱化 */
```

**禁** 手算 `rgba(255, 235, 220, 0.08)` 这种。Anthropic CDS 也是 `color-mix(in srgb, ...)` 644 处实战。

## 决策树

1. **品牌强调?** → `--accent`
2. **状态色?** (success/warning/danger/info) → `--signal-success/-warning/-info` / `--destructive`
3. **文字层级?** → `--foreground` (主) / `--muted-foreground` (副) / `--faint-foreground` (弱)
4. **面板背景?** → `--card` / `--popover` / `--muted` / `--secondary`
5. **边框?** → `--border-default` / `--border-strong` / `--input` / `--ring`
6. **都不是?** → 多半想多了,选 `--muted-foreground` 或 `--border-default`

## 8 页主题策略 (写 CSS 前先确认是哪类)

| 页 | 模式 | 处理 |
|---|---|---|
| `/wca/calendar` `/wb` `/memo/colpi` `/alg` `/trainer` (含 `/trainer/3bld/*`) `/battle` `/recon` `/visualcube` `/mosaic` `/site` | 双主题 | 走 :root token,自动 light/dark 翻 |
| `/wca/*` (含 records/wse/t10h) | **dark-locked + 暗配色放行** | globals.css `html:root:not([data-palette-scheme=dark]):has(.xxx-page)` 压 dark;无配色 / 浅色配色保持经典暗,暗色配色(寒潭/乌金)放行整套上色。**仍不要给它们加 light/dark 反盖**;内容里硬码色一律走 token 否则暗配色不跟 |
| `/calc` | **palette-inert light** | `html:root:has(.calc-page)`(0,2,1 outrank 配色块)钉 light + `--background/--foreground`,所有配色都不渗入(art-directed 奶油纸) |

### 配色主题 × 锁页(2026-06-16)
- 选配色 → `<html data-palette=x data-palette-scheme=light|dark>`(scheme 由 lib/theme.ts + theme-bootstrap.ts 写,源在 lib/palettes.ts 的 `scheme` 字段)。
- 暗锁页用 `:not([data-palette-scheme=dark])` 只放行暗配色(暗页暗配色、低风险);浅配色回退经典暗。新增暗配色自动生效,**无需改 globals.css**。
- 本地 pin token 的组件(如 `.t10h-page`)要 scheme-aware:`html:not([data-palette-scheme=dark]) .xxx { --background:...; }`(别裸 `.xxx{--background}`,否则暗配色被它盖回经典暗)。
- 想让某 art-directed 页对所有配色免疫:用 `html:root:has(.xxx-page)`(0,2,1)钉 token,outrank 配色块 `:root[data-palette]`(0,2,0)。
- canvas 不能吃 `var(--token)`:从容器 `getComputedStyle` 解析 token 值(带 fallback),见 `WrHistoryChart.tsx`。

## Light/dark 反盖 (写新 :root token 才用)

```css
:root { --background: #FAF9F5; --foreground: #181716; }

/* 跟系统 dark + 显式 data-theme=dark */
@media (prefers-color-scheme: dark) {
  html:not([data-theme=light]) {  /* 禁 :where() 包裹,会让 specificity 变 0 */
    --background: #1c1917;
    --foreground: #f0ebe3;
  }
}
html[data-theme=dark] {
  --background: #1c1917;
  --foreground: #f0ebe3;
}
```

## 禁区

- ❌ 硬码 `#888 #aaa #fff #f0ebe3` 等灰阶 → 用 token
- ❌ 手算 `rgba(255,255,255,0.08)` → 用 `color-mix(in srgb, var(--foreground) 8%, transparent)`
- ❌ `:where(html:not([data-theme=light]))` 包反盖块 → 直接 `html:not([data-theme=light])`,否则 specificity=0 被 :root 压死
- ❌ 用 oklch / hsl 写新色 → 全栈 hex
- ❌ 给 dark-locked 页 (wca-stats 家族) 加 light 反盖 → 它们故意锁 dark(暗配色已自动放行,别手加)
- ❌ legacy 老 token (`--bg-primary --text-primary --accent-glow --border-dark`) 用在新代码 → 留给旧页

## 测试矩阵 (改主题相关 CSS 必跑 4 cell)

DevTools → F12 → Ctrl+Shift+P → "Emulate CSS prefers-color-scheme"

| ThemeToggle | OS pref | 期望 |
|---|---|---|
| system | light | light 视觉 |
| system | **dark** | dark 视觉 (**最容易漏的格子**) |
| light | dark | light 视觉 (用户强切 light) |
| dark | light | dark 视觉 (用户强切 dark) |
