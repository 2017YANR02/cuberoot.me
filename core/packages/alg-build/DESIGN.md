# /alg — 设计宪法 (DESIGN.md)

> 本文档是整个 `/alg` 模块的视觉与 UX 决策基线。所有后续实施（包
> 括 Phase 1 build pipeline 产物的 HTML 结构、Phase 2 SPA 页面、
> Phase 3 落地页接入）必须依据本文件。未在此明确的细节由实施
> 者自行判断，但**已明确的条款不得破坏**。

研究基础：调研了 speedcubedb / algdb / crystalcuber / skewbdb /
twoobytwoo / pepkin88-zbll-explorer / morganyeh06-zbls-trainer /
cube.rider.biz / duplex / clockdb / zzmethod / lowcubes-fto /
mycube / cubiclealgdbimagegen / huazhechen-cuber /
cubing.js-mark3 / nissy.tronto / fmcworkshop 共 18 个站。

---

## 1. 核心理念

三条，按优先级：

1. **实用（utility first）** — cuber 来 `/alg` 是为了快速找到公式、复制、练习。任何阻碍这个核心路径的装饰必须砍掉。
2. **便捷（frictionless）** — 点击复制、键盘快捷键、URL 可分享、中英切换无障碍。每一次鼠标点击都应有价值。
3. **精美（dignified）** — 克制的浅色 + WCA 6 色点缀，不要花哨，不要 OAuth 浮层、登录 gate、广告位、SEO popup。
4. **Cuber-first** — 页面密度要高于普通博客（cuber 扫 case 网格需要并排看很多），但低于 DB 站（我们是教程+公式双视图）。

## 2. 视觉系统

### 2.1 配色 (CSS 变量，支持未来暗色 toggle)

```css
:root {
  /* 主 (light theme, V1 default) */
  --alg-bg: #ffffff;
  --alg-bg-soft: #f7f8fa;       /* 卡片、chip、table th 背景 */
  --alg-bg-hover: #eef1f6;      /* hover 态 */
  --alg-border: #e3e7ee;
  --alg-border-strong: #c8ced8;
  --alg-text: #1a1a1a;
  --alg-text-muted: #5a6370;
  --alg-text-faint: #8a93a0;
  --alg-link: #0066cc;
  --alg-link-hover: #0052a3;
  --alg-accent: #0066cc;         /* 主 accent，与 LandingPage 一致的蓝 */
  --alg-accent-soft: #e6f0fb;    /* accent 轻底（选中态、active chip）*/
  --alg-success: #0a8c3e;        /* 复制成功 */
  --alg-warn: #b8860b;
  --alg-danger: #c0392b;

  /* WCA 魔方面色 (用于 case state 渲染、category badge) */
  --cube-U: #ffffff;
  --cube-D: #ffd500;
  --cube-F: #ef3b2c;
  --cube-B: #ff5800;
  --cube-L: #009b48;
  --cube-R: #0046ad;
  --cube-X: #6c7380;            /* 未知 / 被掩盖的面 */

  /* Author-attribution 色 (学 pepkin88 ZBLL explorer) */
  --author-juju: #ebb900;
  --author-brooks: #b0281f;
  --author-jabari: #0c8040;
  --author-egdal: #d26a1a;
  /* 其余作者从 hash → 6 色循环 */
}

/* 暗色 (V1 不启用但预留) */
@media (prefers-color-scheme: dark) {
  :root.alg-dark-ready {
    --alg-bg: #181a1f;
    --alg-bg-soft: #22252c;
    --alg-bg-hover: #2c3039;
    --alg-border: #30343d;
    --alg-border-strong: #444952;
    --alg-text: #e8eaf0;
    --alg-text-muted: #a0a6b3;
    --alg-accent: #5a9eff;
    --alg-accent-soft: #1f2f4a;
  }
}
```

### 2.2 字体栈

```css
--font-ui: system-ui, -apple-system, "Segoe UI",
           "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC",
           sans-serif;
--font-mono: "JetBrains Mono", "Cascadia Mono",
             Consolas, "Courier New", monospace;
```

- 正文用 `--font-ui`，公式 / code / chip 全部用 `--font-mono`
- 中文混排优先 `PingFang SC` (Mac) / `Microsoft YaHei` (Win) — 已在 stack 里

### 2.3 字号阶梯 (桌面，移动端整体 -1px)

| 级别 | 桌面 | 移动 |
|---|---|---|
| H1 (页面标题) | 28px | 24px |
| H2 (section) | 22px | 20px |
| H3 (子 section) | 18px | 17px |
| Body | 17px | 16px |
| Small / meta | 14px | 13px |
| Chip / badge | 14px | 13px |

- 行高: body 1.7, heading 1.3, chip 1.4
- Letter-spacing: 公式 chip `0.02em`, 标题 `-0.01em` (细收紧)

### 2.4 间距阶梯

```
--space-0: 2px
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px   (最常用)
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-12: 48px
```

### 2.5 圆角 / 阴影 / 动效

- 圆角：卡片 8px / chip 6px / code inline 4px / button 6px
- 阴影：`--shadow-sm: 0 1px 2px rgba(17,24,39,.05); --shadow-md: 0 4px 12px rgba(17,24,39,.08); --shadow-lg: 0 12px 28px rgba(17,24,39,.12);`
- 动效：全局 transition `150ms cubic-bezier(.4,0,.2,1)`；hover 卡片 translate-y(-1px) + shadow-md
- `prefers-reduced-motion: reduce` → 所有 transition 降到 0

## 3. 组件规范

### 3.1 `<AlgChip>` — 最关键组件

```
┌─────────────────────────────┐
│ R U R' U' R' F R F' [□]    │  ← 未复制，右侧 Copy 图标
└─────────────────────────────┘
           ↓ 点击后 1.2s
┌─────────────────────────────┐
│ R U R' U' R' F R F' [✓]    │  ← 复制成功，success 色闪 1 次
└─────────────────────────────┘
```

- 行内 `inline-flex`，不破坏文字流
- `padding: 2px 8px`，`border-radius: 6px`，`border: 1px solid var(--alg-border)`
- 默认 bg `--alg-bg-soft`，hover `--alg-bg-hover`，active `--alg-accent-soft`
- monospace 字体，`0.95em` (比 body 略小)
- 复制：`navigator.clipboard.writeText()`，成功后：
  - 右侧 Copy icon → Check icon (Lucide)
  - 短暂 background 闪过 `--alg-success` 色（150ms fade），然后回到正常
  - 同时右下角浮现小 toast "已复制"，800ms 自动消失
- `role="button"`, `tabindex="0"`, 键盘 Enter/Space 触发
- 长公式 (>40 字符) 允许在空白处 wrap，不破行

### 3.2 `<CaseCard>` — 列表卡片

```
┌───────────────────────┐
│                       │
│    [case SVG 图]      │  aspect 16:10, padding 12px
│                       │
├───────────────────────┤
│ PLL                   │  meta 行 (category badge)
│ J Perm (a)            │  H3 标题 (2 行截断)
│ 5 algs · zh/en        │  alg 数 / 语言 badge
└───────────────────────┘
```

- 最小 240px 宽，grid `repeat(auto-fill, minmax(240px, 1fr))`
- border 1px + 圆角 8px
- hover: border → accent，translate-y(-1px)，shadow-md
- 语言 badge：双语 `zh/en`；单语只显示 `zh` 或 `en`
- algset 类型卡片左下角加 **`PUBLIC LIB`** corner badge + case 数

### 3.3 `<CategoryBadge>` — 分类徽标

- 圆角 4px，padding `2px 8px`，font-size 12px
- 顶层分类映射 WCA 面色：3x3→蓝 / Roux→绿 / Mehta→橙 / BLD→紫 (新加) / Misc→灰
- 背景取对应 `--cube-*` 的 soft 版本（添 `alpha(.15)`），文字用 darker 原色

### 3.4 `<LangSwitch>` — 中英切换 chip

- 详情页右上角
- 双语可用：两个 chip 并排，current active 为 `--alg-accent-soft` + accent 边框
- 单语：非 active 语言 chip 置灰 + `title="no translation"` tooltip

### 3.5 `<Breadcrumb>` — 面包屑

- `公式教程 / 3x3 / CFOP / PLL` 全部可点
- 分隔符 `/` 用 `--alg-text-faint`
- 当前页项文字色 `--alg-text`，非粗体

### 3.6 `<Toast>` — 轻反馈

- 右下角 `fixed; bottom: 20px; right: 20px`
- 浅色背景 + accent 左 border
- slide-up + fade-in 150ms，800ms 后 fade-out
- 只用于："已复制" "已复制全部公式" "链接已复制" 三类微反馈，不用于 error

## 4. 页面模板

### 4.1 列表页 `/alg`

```
┌────────────────────────────────────────────────────────────┐
│  公式教程 Algorithms                     [zh] [搜索 /]    │
├────────────────────────────────────────────────────────────┤
│  [全部] [3x3] [Roux] [魔方根] [ZBLL] [ZBLS] ... →         │
│                         ↑ 水平 scroll，active 底部 underline
├────────────────────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                 │
│  │  C  │ │  C  │ │  C  │ │  C  │ │  C  │                 │
│  │ PLL │ │ OLL │ │ ZBLL│ │ZBLS │ │CFOP │                 │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                 │
│  ┌─────┐ ┌─────┐ ...                                      │
└────────────────────────────────────────────────────────────┘
```

- 顶部固定 (position: sticky) 的分类 chip 行
- `?show=hidden` 显示 hidden 项（给我 review 用）
- 空态：中央显示 `📭 没有匹配的教程`

### 4.2 详情页 article 视图 `/alg/:slug`

```
┌────────────────────────────────────────────────────────────┐
│  [← 公式教程] / 3x3 / CFOP / PLL                [zh][en]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   # PLL                                                    │
│                                                            │
│   PLL (Permutation of Last Layer) 是 CFOP 的第四步 ...   │
│                                                            │
│   ## J Perm (a)                                            │
│   [case image]                                             │
│   推荐公式：[R U R' F'] [R U R' U'] [R' F R2 U']          │
│   Setup: ↑ inverse 备用                                    │
│                                                            │
│   (long-form HTML from docx, with AlgChip replacements)    │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  相关教程                                                  │
│  [OLL card] [COLL card] [CMLL card]                       │
└────────────────────────────────────────────────────────────┘
```

- 主容器 `max-width: 720px` 居中（完全对齐 pepkin88 的 45rem 实证）
- 面包屑全可点
- 右上三按钮：`[zh][en]` 语言切换 / `[复制全部]` 本页公式全复制 / `[打印]`
- 底部"相关教程"4-6 个同 category + tag overlap 的卡

### 4.3 详情页 algset 视图 `/alg/<algset-slug>`

ZBLL / PLL / OLL / COLL / CMLL / ZBLS 等专用视图：

```
┌────────────────────────────────────────────────────────────┐
│  公式教程 / 3x3 / PLL              [zh][en] [导出csTimer]  │
├────────────────────────────────────────────────────────────┤
│   # PLL (21 cases)                                         │
│   [EPLL 4] [Adj Swap 6] [Opp Swap 2] [Diagonal 2] ...     │
│                         ↑ group filter chips (+ counts)     │
├────────────────────────────────────────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                     │
│  │case│ │case│ │case│ │case│ │case│ │case│                │
│  │ Ua │ │ Ub │ │ H  │ │ Z  │ │ Aa │ │ Ab │                │
│  │[□] │ │[□] │ │[□] │ │[□] │ │[□] │ │[□] │                │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                     │
│    ↑ case tile 100x100 + label + 主公式 chip               │
│  ... 21 tiles total                                        │
└────────────────────────────────────────────────────────────┘

点击 tile → 展开浮层 (CaseModal):
┌────────────────────────────────────────────┐
│  J Perm (a)                          [×]   │
│  ┌──────┐                                  │
│  │  C   │  推荐: [R U R' F' R U R' U' R' F R2 U'] │
│  │      │  变体: [R' U L' U2 R U' R' U2 R L]      │
│  └──────┘  变体: [L U' R' U L' U' ...]            │
│            作者 color tag: Juju / Feliks          │
│  [复制全部公式]  [下一 case →]                    │
└────────────────────────────────────────────┘
```

- case tile: inline-block grid (学 pepkin88)，100×100 + 下方 label + 主公式 chip（首选公式）
- group filter chips 顶部一行，点击切换只显示该 group
- 超长 alg 在 tile 内用 ellipsis，modal 里完整展开
- CaseModal 点击外部或 Esc 关闭，上下箭头切换 case
- 导出按钮：生成 csTimer `.alg` 格式文本到剪贴板

## 5. 公式库视图规范详细

### 5.1 Case 排序

1. 手动 `case.order` 指定（manual_overrides）
2. Group 内按 label 字母/数字排序 (H1 < H2 < ... < U1 < U2)
3. Group 间按 group.order

### 5.2 Group 划分

从 case label 前缀推断：
- PLL: EPLL (H/Ua/Ub/Z) / Adj (T/J/Ra/Rb/F) / Opp (Y/V/Na/Nb) / Diag (E)
- OLL: Edges Oriented / Cross / Square / Small Lightning / ...
- ZBLL: H / Pi / U / T / S / As / L (7 groups)
- ZBLS: 基于 EO+CP state

可以手写在 `algset_groups.json` 中，不做自动推断（太脆弱）。

### 5.3 多 alg 变体

Tile 上只显示 `primary: true` 的那条（或 list 的第一条）。
Modal 内显示全部，每条独立 chip，按 author color tag 区分。

### 5.4 Author attribution 色（学 pepkin88）

从 hash (SHA1(author_name) % 10) 映射到调色板：

```
#ebb900 #b0281f #0c8040 #d26a1a #4a69bd
#8854d0 #05a4c1 #e15f41 #2c3e50 #e84393
```

没作者信息的 alg 不显 tag。

### 5.5 导出格式

- **csTimer .alg**: 每行一个 alg，空行分隔 case，`#` 行为 case label
- **CubeDB JSON**: `{ cases: [{ label, algs: [...] }] }`
- **纯文本**: `J Perm (a)\n  R U R' F' R U R' U' R' F R2 U'\n...`

## 6. 响应式断点

| 断点 | 宽度 | 列表列数 | 字号 | 容器 padding |
|---|---|---|---|---|
| XL | ≥1280 | 5 列 | 17px body | 32px |
| L | 900-1280 | 4 列 | 17px body | 24px |
| M | 600-900 | 3 列 | 16px body | 16px |
| S | 400-600 | 2 列 | 16px body | 12px |
| XS | <400 | 1 列 | 16px body | 12px |

详情页 `max-width: 720px` 在所有断点保持（超出留白），移动端整屏减 padding。

表格 > 容器宽时，外层 `.table-wrap` 加 `overflow-x: auto`。

Sticky 分类 tab 在移动端保留，触摸 scroll。

## 7. 可访问性 (WCAG 2.1 AA)

- 正文对比度 ≥ 4.5:1 (计算过：`#1a1a1a` on `#ffffff` = 16.5:1 ✓)
- 非正文 (meta / faint) ≥ 3:1
- Chip / button 触摸目标 **≥ 44×44px** (用 padding 扩展，不缩字)
- 所有 `<img>` 有 `alt`（case 图用 `alt="J Perm (a) case 图"`）
- 键盘导航：Tab 顺序符合视觉流，focus-visible 明显 outline
- `aria-live="polite"` 在搜索结果 / 复制 toast
- 所有 interactive chip/card 有合适 role + aria-label

## 8. 键盘快捷键

| 键 | 动作 | 页面 |
|---|---|---|
| `/` | focus 搜索框 | 列表页 |
| `Esc` | 清空搜索 / 关闭 modal | 全部 |
| `[` `]` | 上/下一分类 | 列表页 |
| `j` `k` | 上/下一卡（下次迭代做） | 列表页 |
| `c` | 复制本页全部公式 | 详情页 |
| `←` `→` | 上/下一 case | algset modal |
| `?` | 弹出快捷键 help | 全部 |

快捷键在 `<input>` / `<textarea>` focus 时禁用（防止输入冲突）。

## 9. 品牌一致性 (与现有 LandingPage / Recon / Battle 对齐)

- 全局 body 字体、accent 蓝 `#0066cc`、卡片圆角 8px、shadow 级别与 LandingPage `.card` 一致
- 使用 Lucide React 图标库 (`BookOpen` for /alg 入口，`Copy/Check` for chip)
- 不引入新的字体包（除 JetBrains Mono 可选 @font-face）

## 10. 反模式 (明确不做)

- ❌ 登录 gate / OAuth 浮层（除了全局已有的 WCA login，不加任何 alg 专属登录）
- ❌ 广告位 / affiliate link
- ❌ SEO popup / newsletter 订阅弹窗
- ❌ 动态 3D TwistyPlayer 在列表页每张卡（性能灾难；留给详情页）
- ❌ 外部 image generation 服务运行时依赖（The Cubicle Azure 有冷启动；SVG 全 in-tree）
- ❌ 无 copy 按钮（行业基线；不可接受）
- ❌ Pre-rendered filename-encoded PNG (speedcubedb 做法)；我们用 docx 内置 SVG
- ❌ 整站 Three.js full SPA（huazhechen 的 cuber 体量）
- ❌ 所有 cases 挤在一屏不分 group (pepkin88 做到了因为 ZBLL subset 只有 28 个；我们要给所有 algset 加 group filter)
- ❌ 把 alg 藏在 accordion 里默认不展开 (zbls-trainer 做法，扫的时候麻烦)

## 11. V1 明确不做 / 留 Hook

- **动态 3D case 渲染**：cubing.js `TwistyPlayer` 2D mode，V1 不接；详情页预留 `<CasePreview>` 组件位，以后切换
- **暗色 toggle**：CSS 变量和 `:root.alg-dark-ready` 选择器准备好，V1 不暴露 toggle
- **Trainer 模式**（计时/随机/recognition drill）：pepkin88 没做，我们也不做，先做浏览。
- **AUF 预览**：pepkin88 有；我们 V1 不做
- **社区投票 per alg**：speedcubedb 有；需要后端支持，V1 跳过
- **Author attribution tag**：CSS 准备好，数据层 `alg.author` 字段保留；Phase 1 提取 docx 时抽取作者信息，V1 有数据的地方显示

---

**结论**：本宪法确立后，所有视觉/交互决策据此。修正由讨论后写入本文件再变更实现。
