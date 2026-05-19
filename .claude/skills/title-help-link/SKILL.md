---
name: title-help-link
description: "Use when adding a help/info icon next to a page title that explains the page (intro / flow / engine choices). Pattern: lucide HelpCircle inside react-router Link → standalone /<page>-about route. Triggers: \"标题问号\", \"页面问号\", \"help icon\", \"info icon\", \"about page\", \"说明页\", \"介绍页\", \"intro page\", \"HelpCircle\", \"问号按钮\", \"页面介绍\"."
---

# 标题旁的 ? 帮助链接 + about 页

页面标题右侧放问号入口,点进单独 about 页给「介绍 + 流程」。本站已有 3 处实现这套,新增时直接抄结构,**不要造新 popover / modal / tooltip**。

## 三条不变规则

1. **图标**:lucide `HelpCircle`,`size={18-20}` `strokeWidth={1.75}`。其它图标(InfoCircle / `?` 字符)= bug。
2. **包裹**:`react-router-dom` `<Link>`,**不要** `<a href>`(失去 SPA 路由)。`title=` + `aria-label=` 双写,双语用现成的 `t(zh, en)` helper。
3. **目标路由**:`/<sourceRoute>-about`(或 `/<sourceRoute>/about/<param>` if 按 id),不堆在弹层里。

## 三个现成实例(任挑一个抄)

| 源页 | 入口 | about 路由 | about 页文件 |
|------|------|-----------|-------------|
| `/scramble/gen` | 标题旁 `gen-title-help` | `/scramble/gen-about` | `pages/gen_about/GenAboutPage.tsx` |
| `/scramble/gen` (5x5 picker) | mode toggle 旁 `gen-555-mode-info` | `/scramble/555-about` | `pages/scramble_555_about/Scramble555AboutPage.tsx` |
| `/wca/:statId` | 标题旁 `wca-stats-title-help` | `/wca/about/:statId` | `pages/wca_about/...` |

## JSX 模板(从 GenPage 抄)

```tsx
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

<h1>
  {t('页面标题', 'Page title')}
  <Link
    to="/<route>-about"
    className="<prefix>-title-help"
    title={t('这页是干啥的?', 'What is this page?')}
    aria-label={t('查看说明', 'About this page')}
  >
    <HelpCircle size={18} strokeWidth={1.75} />
  </Link>
</h1>
```

## CSS(每页 ~10 行,放各自 `<page>.css`)

```css
.<prefix>-title h1 { display: inline-flex; align-items: center; gap: 8px; }
.<prefix>-title-help {
    display: inline-flex;
    align-items: center;
    color: var(--<prefix>-text-mute);
    opacity: 0.6;
    text-decoration: none;
    transition: opacity 0.15s, color 0.15s;
}
.<prefix>-title-help:hover { opacity: 1; color: var(--<prefix>-accent); }
```

## about 页骨架

- 新目录 `pages/<source>_about/`(下划线分隔,跟源页同级)。
- 文件名 `<Source>AboutPage.tsx` + 同名 `.css`。
- CSS namespace 自己一套 `--<prefix2>-bg / -surface / -text / -accent` + `[data-theme="dark"]` 覆写。
- header 套路:左 `<ArrowLeft>` + 「返回 X」`<Link to="/<sourceRoute>">`,右 `<LangToggle />`。
- 主体常用区块:`<h1>` 标题 → `.intro` 简介 → `<h2>` 分节 → `Step` 流程组件 + `Arrow` 单字符箭头。看 `GenAboutPage.tsx` / `Scramble555AboutPage.tsx` 任一参考。
- 双语全用 `t(zh, en)`,**所有** user-facing string 都套。
- 末尾「相关页面」段:`<Link>` 内部页 + `<a target="_blank" rel="noopener noreferrer">` 外部资料。

## 注册 + 跳转

- `App.tsx`:`const <Name>AboutPage = lazy(() => import('./pages/<source>_about/<Source>AboutPage'));` + `<Route path="/<route>-about" element={<Suspense ...><<Name>AboutPage /></Suspense>} />`。
- 不需要加到首页 / hub / nav — 入口就是源页标题旁那个问号。

## 禁

- 不要 popover / tooltip 当 about 内容(信息量装不下,移动端难点)。
- 不要复用别的 about 页的 CSS class(`s555-*` 等都是 page-local namespace,跨页 import 会耦合)。
- 不要把 about 内容塞回源页 collapsible — 一展开顶掉主交互,是 bug。
- about 页底部不放 LangToggle / ThemeToggle 之外的全局按钮(避免跟主页的 toggle 抢位置)。
