# THEMING

dark/light 切换已落地 (2026-05-14)。token 在 `src/index.css :root`,toggle 在 `components/ThemeToggle.tsx`,bootstrap 在 `utils/theme.ts` (main.tsx 启动调)。

---

## 适用范围(8 页)

只对这 8 页计划支持 dark/light 切换。其他页保持现状。

| # | 页 | 路由 | 当前主题 | 当前 token 化 | 命名空间 |
|---|---|---|---|---|---|
| 1 | trainer | `/trainer` | dark | ⚠️ 半 token + 伪 token (`var(--text-color, #ECEAE3)`)+ rgba 硬码 | 无,需新建 |
| 2 | battle | `/battle` | dark(纯黑 AMOLED)| ❌ 全硬码 `#000 #ededed` | 无,需新建 |
| 3 | memo (colpi) | `/memo/colpi` | light | ✅ 严格 token | `--c-*` |
| 4 | alg | `/alg` | **跟随系统**(已完成)| ✅ token + `prefers-color-scheme` | `--alg-*` |
| 5 | wca-stats | `/wca` 家族 | dark | ❌ 硬码(2026-05-14 刚清掉伪 token)| 无,需新建 |
| 6 | calendar | `/wca/calendar` | light | ✅ 严格 token | 短名 `--bg/--text` |
| 7 | calc | `/calc` | light | ❌ 部分硬码,body bg `#E7DFD5` | 无,需新建 |
| 8 | wb | `/wb` | light | ✅ 严格 token | `--wb-*` |

**不参与的页**:
- 22 个 code intros(各自独立品牌暗色,**就是 dark by design**,不切)
- globe(已完成自有双主题方案,不动)
- landing / scramble_stats / mosaic / 其他 light 页(暂不在 8 页内,以后想加再扩)
- 其他 dark 页(timer / recon / submit / frame-count 等)

---

## 架构方向 — 大厂式分层

**学 Apple / Anthropic / shadcn:全局中性色 + per-page accent**。不是每页独立 namespace 全套色(过去版本一度想这么做,撤了)。

### 全局中性色(:root,~12 个 token)

放 `core/packages/client/src/index.css` :root,**所有 8 页共用**。改一处全部跟随。

```css
/* index.css :root,light 默认 */
:root {
  color-scheme: light dark;

  /* 中性 light */
  --background:        #fafafa;
  --surface:           #FFFFFF;          /* card / popup / modal 默认 */
  --surface-elevated:  #FFFFFF;
  --surface-muted:     #f5f5f5;          /* alt bg / hover */
  --foreground:        #171717;          /* 主文字 */
  --muted-foreground:  #737373;          /* 副信息 */
  --faint-foreground:  #a3a3a3;          /* 弱化 / disabled */
  --border-default:    #e5e5e5;
  --border-strong:     #d4d4d4;

  /* 信号(light/dark 同色相,饱和度可按需要在反盖时调) */
  --signal-success: #5aac7e;
  --signal-warning: #d4a259;
  --signal-danger:  #e05c5c;
  --signal-info:    #4a9eff;
}

/* 跟系统 dark + 显式 dark 都生效;[data-theme=light] 显式 override 时不进 */
@media (prefers-color-scheme: dark) {
  html:not([data-theme=light]) {
    --background:        #171717;
    --surface:           #1f1f1f;
    --surface-elevated:  #262626;
    --surface-muted:     #1f1f1f;
    --foreground:        #ededed;
    --muted-foreground:  #a3a3a3;   /* 中性灰 */
    --faint-foreground:  #737373;
    --border-default:    rgba(255, 255, 255, 0.1);
    --border-strong:     rgba(255, 255, 255, 0.2);
    /* signal 通常 light/dark 同值就够,实在刺眼再单独调 */
  }
}
html[data-theme=dark] {
  /* 同上(从 @media block 复制),允许在 light 系统下也强切 dark */
}
```

### Per-page accent(各页 page-scope,保留)

页面独有的品牌色 / 装饰色留在自己 namespace,**不进 :root**。

```css
.colpi-page { --c-active: #C15F3C; }      /* memo terracotta */
.wb-page    { --wb-gold: #C9A24E; }       /* wb 金牌色 */
.calendar-page {
  --accent: #C15F3C;                      /* calendar 自己的 accent */
  --wr-current: #DC2626;                  /* WR 标识,信号但页面专有 */
}
```

### 反盖现有冲突

`:root` 当前已有这些名字,会跟新 light 中性 token 冲突,落地前需要处理:

| 现有 :root token | 当前值(dark)| 处理 |
|---|---|---|
| `--bg-primary --bg-secondary --bg-card --bg-card-hover` | dark 棕 | **保留**,用旧名字的页(timer / training / home / etc)继续用 |
| `--text-primary --text-secondary` | dark 米色 | **保留** |
| `--accent --accent-glow` | terracotta dark | **保留**,但要意识到这跟某些 page-scope 的 `--accent`(light)同名,page-scope 会赢 |
| `--border` | `rgba(255, 255, 255, 0.1)` 深色透明 | **改名 `--border-dark`**,落地新 light token 时不能用 `--border` 这个名字 → 用 `--border-default` |
| `--success --warning --danger` | dark | **改名为 `--signal-*`** 对齐新 token,grep 替换 |

落地代码时**先做 rename**(--border → --border-dark, --success → --signal-success 等),再加新 light 中性 token。

---

## 反盖机制 — 双轨

**`prefers-color-scheme` + `[data-theme]` 双轨**:

> ⚠️ **坑**: 不要把 `html:not([data-theme=light])` 包在 `:where()` 里 —— `:where()` 特异性是 0,会被 `:root { --background: #fafafa }` (特异性 0,1,0) 压过去,@media 反盖**完全不生效**。直接用 `html:not([data-theme=light])` (特异性 0,1,1) 才赢得过。


- 跟系统:`@media (prefers-color-scheme: dark) { html:not([data-theme=light]) { ... } }`
- 显式 dark override:`html[data-theme=dark] { ... }`
- 显式 light override:`html[data-theme=light]`(覆盖系统 dark 偏好)

ThemeToggle 三态(对齐 claude.ai):
- **Match System**(默认)→ 不设 data-theme,走 @media
- **Light** → `html[data-theme=light]`
- **Dark** → `html[data-theme=dark]`

存 `localStorage.theme = 'system' | 'light' | 'dark'`,挂载时读、change 时写。

---

## Toggle UI 形态

**对齐 claude.ai:Settings 菜单三选**,**不是** header toggle。

理由:
- 主题切换是低频操作(每用户一次设置)
- 每页 header 加 toggle 占地方
- 三态(Light/System/Dark)用下拉/单选比 icon 切换清晰

放在哪:可以放 LangToggle 旁边的 "..." 菜单,或者专门 `/settings` 页。**留到真做时具体决定**。

---

## 8 页落地清单(真做时按此顺序)

每页工作量评估:

| # | 页 | base | 工作 | 预计 |
|---|---|---|---|---|
| 1 | alg | 跟随系统 | **0**(已完成) | 0 |
| 2 | calendar | light | 47 处硬码 → `:root` 中性 token,信号色 (`--signal-danger` 等)替换硬码;`--accent` `--wr-*` 留 page-scope | 1h |
| 3 | wb | light | 把 `--wb-bg/text/text-sub/border` 等中性的部分**改用** `:root` 中性 token,`--wb-gold` 留;`--wb-accent` 留 | 30min |
| 4 | memo (colpi) | light | 同上,`--c-bg/text/border/muted` 改用 :root,`--c-active` 留;`--c-filled --c-empty` 留(语义化卡片色)| 30min |
| 5 | calc | light | body bg 提到 .calc-page 内,中性色用 :root,~50 处硬码替换 | 1.5h |
| 6 | trainer | dark | 先清伪 token (`var(--text-color, #ECEAE3)` → `--foreground`),rgba 硬码替换为 `:root` 中性 | 1h |
| 7 | battle | dark | `#000 #ededed` 替换为 `--background --foreground`(注意 battle 是纯黑 AMOLED,base bg 跟一般 dark 不同 → 可能需要 `.battle-container` 内单独反盖 `--background: #000`)| 1.5h |
| 8 | wca-stats | dark | 把刚清掉伪 token 的硬码 (`#ededed #1a1a1a #aaa #888`) 替换为 :root 中性;7 个家族文件统一 | 2-3h |

**总计:8-10 小时**(分散在多个 PR 推,每页独立验证)

每页做完跑 `pnpm --filter @cuberoot/client typecheck` + 浏览器 light + dark + system 三态 visual 校。

### 迁移策略:统一 (不是兼容)

发现某页硬码值跟 DESIGN.md canonical token 不一致时,**默认让页面跟 token 走,而不是改 token 去保现状**。例:某页 `background: #FAFAFA` 但 `--background: #fafafa`,直接换成 `var(--background)`,不为这页发明 `#FAFAFA` 变体。

例外:battle 的 AMOLED 纯黑 `#000` —— 这是设计意图,需要在 `.battle-container` 内 page-scope 反盖 `--background: #000`,不要"统一"成 `#171717`。

ThemeToggle 默认值 = `system`(对齐 macOS / Win11 / iOS 现代 UX 主流)。这意味着 OS 设深色的用户进站,目前的 4 个 light 页 (memo/calc/wb/calendar) 上线即自动 dark。是预期行为。

---

## 代码模板(以后照抄)

### 在某个 page-scope 反盖中性色(rare,通常用 :root 一处就够)

```css
.battle-container {
  /* battle 是 AMOLED 纯黑,跟一般 dark 主题(--background: #1a1a1a)不一样,需要单独压 */
  --background: #000;
  --surface: #0a0a0a;
}
```

### Per-page accent 反盖(dark 模式下 accent 调一档)

```css
.colpi-page { --c-active: #C15F3C; }

@media (prefers-color-scheme: dark) {
  html:not([data-theme=light]) .colpi-page {
    --c-active: #D97757;  /* 暗底下提亮 */
  }
}
html[data-theme=dark] .colpi-page {
  --c-active: #D97757;
}
```

---

## 不在范围内的页面

如果未来想给 landing / scramble_stats / mosaic / 其他 dark 页加 dark/light,**扩展这份文档加进 8 页表**,然后照同样模板做。不要复制方案搞第二套。

22 个 code intros(`bash_intro / python_intro / ...`)**永久不进**这套体系 — 它们的 dark + 品牌色就是设计核心。
