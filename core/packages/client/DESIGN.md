# DESIGN — Claude-style 设计系统(已落地)

8 页 (trainer / battle / memo / alg / wca / calendar / calc / wb) 已用此规范落地。token 在 `src/index.css :root`,实现细节见 `src/pages/THEMING.md`。新页/新色按此文档决策树。

写作格式参考:Anthropic frontend-design plugin 推荐的 9 段 DESIGN.md 标准。

---

## 1. Visual Theme & Atmosphere

**核心调性**:Anthropic Claude 暖橙 + 奶油米色,thoughtful 而非 cold/sterile。区别于:
- ❌ Material Design(冷蓝、平面、机械感)
- ❌ Apple HIG(中性灰 + 蓝绿,科技感)
- ❌ shadcn 默认 zinc(纯灰、中性、SaaS 后台感)
- ✅ **Claude 风**:warm terracotta + cream,书卷气 + 友好

色相基础:
- 中性色色相 = **暖灰**(yellow/orange undertone,不是冷蓝灰)
- Accent = **terracotta orange** `#C15F3C`
- 信号色 = 柔和饱和度,不刺眼

**你的站已经在用**:landing / wb / memo (colpi) / calendar 都是这个调色板,就是命名各自一套。重构 = 统一命名,色值不变。

---

## 2. Color Palette & Roles

### 完整 token 表(light + dark,对齐 shadcn/ui 命名)

色值统一 hex。oklch 工具产物对齐难、IDE 不预览,2026-05 调研 30+ 大厂(GitHub / Anthropic console / OpenAI / Linear / Discord / Atlassian / Adobe Spectrum / MS Fluent 等)零一家把 oklch 当主品牌 token,全 hex;故跟随。

| Token | Light(默认)| Dark(反盖)| 用途 |
|---|---|---|---|
| `--background` | `#FAF9F5` | `#1c1917` | 页面整体背景 |
| `--foreground` | `#181716` | `#f0ebe3` | 主文字 |
| `--card` | `#FFFFFF` | `#232020` | 卡片 / panel 背景 |
| `--card-foreground` | `#181716` | `#f0ebe3` | 卡片内文字 |
| `--popover` | `#FFFFFF` | `#2a2520` | 下拉 / modal 浮层 |
| `--popover-foreground` | `#181716` | `#f0ebe3` | 浮层内文字 |
| `--primary` | `#181716` | `#f0ebe3` | 主按钮背景(反差色)|
| `--primary-foreground` | `#FAF9F5` | `#181716` | 主按钮文字 |
| `--secondary` | `#F5F4EE` | `#2a2520` | 次按钮背景 |
| `--secondary-foreground` | `#181716` | `#f0ebe3` | 次按钮文字 |
| `--muted` | `#F5F4EE` | `#2a2520` | 弱化背景(disabled / hover bg)|
| `--muted-foreground` | `#6F6E6B` | `#9c8c7e` | 弱化文字(副信息)|
| `--faint-foreground` | `#9F9D97` | `#7A736A` | 更弱化(disabled / 占位)|
| `--accent` | `#C15F3C` | `#d97757` | **品牌强调** terracotta(dark 下提亮一档)|
| `--accent-foreground` | `#FFFFFF` | `#181716` | accent 上的文字 |
| `--accent-soft` | `color-mix(in srgb, var(--accent) 8%, transparent)` | `color-mix(in srgb, var(--accent) 16%, transparent)` | accent 弱化背景(tag / badge),衍生 |
| `--destructive` | `#e05c5c` | `#e05c5c` | 危险/删除 |
| `--destructive-foreground` | `#FFFFFF` | `#FFFFFF` | destructive 上文字 |
| `--signal-success` | `#5aac7e` | `#5aac7e` | 成功 |
| `--signal-warning` | `#d4a259` | `#d4a259` | 警告 |
| `--signal-info` | `#4a9eff` | `#4a9eff` | 信息 |
| `--border-default` | `#E5E4DF` | `color-mix(in srgb, var(--foreground) 10%, transparent)` | 默认边框,dark 衍生 |
| `--border-strong` | `#CCCAC2` | `color-mix(in srgb, var(--foreground) 20%, transparent)` | 强调边框,dark 衍生 |
| `--input` | `#E5E4DF` | `color-mix(in srgb, var(--foreground) 10%, transparent)` | 输入框边框 |
| `--ring` | `#C15F3C` | `#d97757` | focus ring(accent 同色)|

> 信号色(`destructive` / `signal-*`)light/dark 同值。一般足够;若 dark 下感觉刺眼再单独调,不要先发明两套。

> **衍生色一律走 `color-mix(in srgb, var(--base) X%, transparent)`**,不要再手算 rgba。理由:改 base 一处自动跟,跟 Anthropic console (cds 系统) 644 处实战用法对齐。`in srgb` 是 Anthropic 默认色彩空间,你也跟随。

### Charts(数据可视化用)

```css
--chart-1: #C15F3C;   /* terracotta(同 --accent)*/
--chart-2: #5aac7e;   /* sage green */
--chart-3: #d4a259;   /* mustard */
--chart-4: #4a9eff;   /* blue */
--chart-5: #b056c9;   /* magenta */
```

dark 模式按需各自微调(目前一套足够,真做时再说)。

### Selection / Code(对齐 shadcn 完整集)

```css
--selection: var(--accent);
--selection-foreground: var(--accent-foreground);
--code: var(--surface-muted);
--code-foreground: var(--foreground);
```

---

## 3. Typography Rules

### Font stack

```css
--font-sans:    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-heading: 'Inter', -apple-system, sans-serif;  /* 同 sans,可换 Geist Sans / Söhne */
--font-mono:    'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

### Type scale(对齐 Tailwind 默认 + Claude 偏好)

| 用途 | size / line-height | weight |
|---|---|---|
| Display(landing hero)| 48-56px / 1.1 | 700 |
| H1 | 30-36px / 1.2 | 700 |
| H2 | 22-26px / 1.3 | 600 |
| H3 | 18-20px / 1.4 | 600 |
| Body | 14-16px / 1.5 | 400 |
| Small / caption | 12-13px / 1.4 | 400 |
| Mono(code/数值)| 13-14px / 1.5 | 400 |

**iOS 规则**:任何 `<input>/<textarea>/<select>` 移动端字号必须 ≥ 16px(否则 focus 时 iOS 强制放大整页)。已在 `index.css` 全局兜底。

---

## 4. Component Stylings

### 基本几何

```css
--radius:     0.75rem;   /* 12px,Claude 风偏圆润但不夸张 */
--radius-sm:  calc(var(--radius) * 0.5);   /* 6px,小元素(badge / chip)*/
--radius-md:  calc(var(--radius) * 0.75);  /* 9px,按钮 / input */
--radius-lg:  var(--radius);               /* 12px,卡片 */
--radius-xl:  calc(var(--radius) * 1.5);   /* 18px,大 modal */
--radius-2xl: calc(var(--radius) * 2);     /* 24px,landing hero */
--radius-full: 9999px;                     /* pill / avatar */
```

### 按钮

- **Primary**:`bg-primary text-primary-foreground`,圆角 `--radius-md`,padding `8px 16px` (sm) / `12px 24px` (lg)
- **Secondary**:`bg-secondary text-secondary-foreground border-border`
- **Ghost**:透明背景,hover `bg-muted`
- **Destructive**:`bg-destructive text-destructive-foreground`
- **Accent CTA**:`bg-accent text-accent-foreground`(品牌橙,landing/wb 用)

### 输入框

- 边框 1px `border-input`,圆角 `--radius-md`
- focus:2px `ring-ring`(accent 色,1px offset)
- placeholder:`muted-foreground`
- 错误态:`border-destructive`,下方红色提示

### 卡片

- `bg-card text-card-foreground border-border`
- 默认 1px border,无 shadow(扁平)
- hover 微提升 `shadow-soft`(见下方 Depth)
- landing 风 hero card:`bg-card border-border-strong rounded-2xl`

### Modal / Popover

- `bg-popover text-popover-foreground`
- shadow `floating`
- 圆角 `--radius-lg`
- backdrop:`bg-foreground/40` (40% 不透明)

---

## 5. Layout Principles

### 间距系统(Tailwind 标准 4px scale)

`--space-1: 4px / --space-2: 8px / --space-3: 12px / --space-4: 16px / --space-6: 24px / --space-8: 32px / --space-12: 48px / --space-16: 64px`

### 容器宽度

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;   /* 主流页(calendar / wca / wb)用这个 */
--container-2xl: 1536px;
```

页面默认 `max-width: 1180-1280px`,左右 padding 16px(mobile)/ 24px (desktop)。

### 网格

- Landing: bento grid,12 列,gap 16-24px
- 列表 / 表格:full-width,row 分隔用 `border-b border-border`
- 卡片栈(calendar 月视图):flexbox + auto-fill grid

### 移动端断点

- xs: < 480px(手机竖屏)
- sm: 480-767px(手机横屏 / 小平板)
- md: 768-1023px(平板)
- lg: 1024-1279px(笔记本)
- xl: ≥ 1280px(桌面)

---

## 6. Depth & Elevation

Claude 风**轻柔阴影**,绝不重(避免 Material 的"卡片浮空"感)。

```css
--shadow-soft:     0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
--shadow-elevated: 0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06);
--shadow-floating: 0 4px 8px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.10);
--shadow-glow:     0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent);  /* accent focus glow */
```

dark 模式 shadow 不变(在 dark bg 上几乎看不见,但保留以防 light overlay)。

层级使用:
- `--shadow-soft`:卡片 hover、subtle elevation
- `--shadow-elevated`:dropdown / popover
- `--shadow-floating`:modal / dialog
- `--shadow-glow`:focus ring 强化(配合 `outline: none + box-shadow`)

---

## 7. Do's and Don'ts

### Do

- ✅ 色值全 hex(`#RRGGBB`),不混 hsl / rgb / oklch
- ✅ 按 token 名读色,**不再 #888 / #aaa 硬码**
- ✅ accent 色保留品牌 terracotta,不要因为 dark mode 改色相
- ✅ `--muted` 和 `--secondary` 在 Claude 风里**值相同**(都是 surface-alt),保留 shadcn 命名是为了组件兼容
- ✅ focus 状态用 `--ring`(accent 色),不用浏览器默认蓝
- ✅ 文字层级用 `--foreground` / `--muted-foreground` / `--faint-foreground` 三档,不要发明 4-5 档

### Don't

- ❌ **不要装 shadcn/ui**(`npx shadcn init`)— 会污染你站现有 Tailwind 配置 + 加十几个不需要的依赖
- ❌ 不要把 22 个 code intros 也强行 token 化 — 它们的品牌色调是设计核心
- ❌ 不要给所有页加 dark mode — 只 8 页(THEMING.md)
- ❌ 不要在 :root 反盖时改色相,只调 lightness / chroma(避免 light/dark 视觉断裂)
- ❌ 不要用 Material Design 的 elevation 阴影(z-depth 8 那种深阴影)
- ❌ 不要 emoji,用 lucide-react 图标(对齐 Claude / Linear / shadcn 默认)

---

## 8. Responsive Behavior

- **Mobile-first**:所有组件先在 < 480px 写好,再加 `@media (min-width: 768px)` 桌面增强
- **Touch target ≥ 44×44px**(Apple HIG / WCAG 2.5.5)
- **关键模式**:
  - 工具栏 / filter 行:桌面 horizontal,mobile 折叠成 dropdown 或纵列
  - 表格:mobile 横滑或转 card stack
  - Modal:mobile 全屏覆盖,桌面居中浮窗
  - Sidebar:mobile drawer,桌面常驻
- 已有 helper:`useIsMobile()` + `<AccordionSection>`(memo `reference_mobile_pattern.md` 已记录)

---

## 9. Agent Prompt Guide(给 AI / 自己未来用)

### 新组件写法模板

```tsx
// 优先 Tailwind utility + token 名,不要 inline style
<button className="
  px-4 py-2 rounded-md
  bg-primary text-primary-foreground
  hover:bg-primary/90
  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
">
  {label}
</button>

// 卡片
<div className="
  rounded-lg border border-border bg-card text-card-foreground
  p-6 shadow-soft
  hover:shadow-elevated transition-shadow
">
  {children}
</div>

// 弱化文字
<span className="text-muted-foreground">{subtitle}</span>

// 信号色 — destructive 警告
<p className="text-destructive">{errorMsg}</p>
```

### 选色决策树

1. **是不是品牌强调**? → `--accent`(terracotta)
2. **是不是状态**(success/warning/danger/info)? → `--success/--warning/--destructive/--info`
3. **是不是层级**(主/次/弱)? → `--foreground/--muted-foreground/--faint-foreground`
4. **是不是面板** ? → `--card`/`--popover`/`--muted`/`--secondary`
5. **是不是边界** ? → `--border`/`--border-strong`/`--input`/`--ring`
6. **都不是**? → 多半你想多了,选 `--muted-foreground` 或 `--border`,不要发明新色

---

## 落地路径(分阶段,真做时按此推)

### Phase 0 — 决策已锁(2026-05-14 完成)
- [x] `THEMING.md` — 锁 8 页范围 + 命名空间 + 反盖机制
- [x] `DESIGN.md` — 本文档,锁色值 + 字体 + 阴影 + 间距
- [x] CLAUDE.md `## 主题 / 颜色` 段 — 约束新写 CSS

### Phase 1 — :root 落地一套统一 token(4-6h,大重构,需谨慎)

按本文档第 2 段表落地 `:root` light token + `.dark`(或 `[data-theme=dark]` + `@media (prefers-color-scheme: dark)`)反盖。

- 先把现有 :root 上冲突的 token rename(`--border` → `--border-dark`、`--success/warning/danger` → 合并到新 `--success/warning/info/destructive`)
- grep 全站 `var(--border)` (138 处) / `var(--success/warning/danger)` (11 处) 逐文件 review,对应替换
- 落地新 light token + dark 反盖
- 全 dark 页(timer / wca / recon / etc)visual 校验

### Phase 2 — 8 页迁移到统一 token(8-10h,分页推)

按 THEMING.md 顺序:alg(0)→ wb → memo → calendar → calc → trainer → wca → battle

每页:硬码替换为 token + 删自有 namespace token + visual 校 light + dark + system 三态。

### Phase 3 — ThemeToggle UI(2-3h)

- 在 LangToggle 旁边或 `/settings` 页加三态选择(Light / System / Dark)
- localStorage 存,挂 `<html data-theme>` attribute
- 对齐 claude.ai 的 Settings → Appearance → Color mode

### Phase 4 — 后续维护

- 加新页前先看本文档 + THEMING.md
- 加新色前用第 9 段决策树自检
- 真要加新组件时,优先用 Tailwind utility + token,不再写 page-scope CSS

---

## 参考资料

- **shadcn/ui clone**:`D:\ui\` — 主参考,看 `apps/v4/app/globals.css` (完整 :root 定义 + @theme inline) 和 `apps/v4/public/r/themes/stone.json` (暖色调最接近 Claude 风)
- **Anthropic Claude theme on shadcn.io**:[https://www.shadcn.io/theme/claude](https://www.shadcn.io/theme/claude)
- **Anthropic Frontend Design plugin**:[https://claude.com/plugins/frontend-design](https://claude.com/plugins/frontend-design) — 官方推荐 9 段 DESIGN.md 格式
- **DESIGN.md 模板库**:[https://github.com/VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design) — 68 个现成模板
- **WebKit dark mode 官方推荐**:[https://webkit.org/blog/8840/dark-mode-support-in-webkit/](https://webkit.org/blog/8840/dark-mode-support-in-webkit/)
- **shadcn/ui theming docs**:[https://ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming)

### 站内已有的 Claude 风参考实现

- `src/pages/landing.css` — `.landing-page` 已用本文档色值,只是命名不规范(用 `--bg/--text/--border` 短名而非 `--background/--foreground/--border`)
- `src/pages/wb/wb.css` — `.wb-page` 同样,用 `--wb-*` namespace
- `src/pages/memo/colpi/colpi.css` — `--c-*` namespace
- `src/pages/calendar_page.css` — `.calendar-page` 是最完整的 page-scope token 化样本

直接看这 4 个文件,色值已对齐本文档。重构 = 把 `--bg / --c-bg / --wb-bg` 都改名为 `--background`,落地到 :root,加 dark 反盖。
