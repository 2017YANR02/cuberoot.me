---
name: title-help-link
description: "Use when adding or editing a help icon beside a page title and its standalone explanation page. Covers 标题问号、说明页、介绍页 and HelpCircle links; pair with user-facing-report for concise user-facing content."
---

# 标题帮助入口与说明页

标题旁的问号进入独立说明页。这个 skill 约束入口和组件复用，不规定每个页面都采用相同正文模板。

## 入口

- 复用 `@app-foundation/icons/lucide` 的 `HelpCircle`，通常 18–20px、strokeWidth 1.75。
- 站内链接使用 `@/components/AppLink` 与 `href`；保留双语 `aria-label`。需要悬停提示时复用 `Tooltip`，不另造提示气泡。
- 沿用已有说明页 URL；新增时通常使用 `/<sourceRoute>-about`，按参数的说明沿用所属模块路由。不要为了统一命名搬动既有路由。
- 独立说明内容不塞入源页面的 tooltip、popover 或 modal。源页的问号即入口，无需重复加入全站导航。

```tsx
import Link from '@/components/AppLink';
import { HelpCircle } from '@app-foundation/icons/lucide';

<Link href="/calc-about" aria-label={t('查看说明', 'About this page')}>
  <HelpCircle size={18} strokeWidth={1.75} />
</Link>
```

## 说明页

- 先读 [user-facing-report](../user-facing-report/SKILL.md)，按页面职责组织信息：操作说明用简短流程，指标说明用例子或对照，参考库保留完整资料与检索。不要机械复制「简介 → 步骤卡片 → 技术 → 相关链接」。
- 优先复用 `components/report-page.css` 的阅读宽度、字号与表格样式。共用排版不等于共用内容结构；只有独特交互需要页面专属 CSS。
- 标题和返回使用 `PageHeading`；技术细节使用原生 `details` + `MoreToggle as="summary"`。关键局限保持可见。
- 双语遵循 [i18n](../i18n/SKILL.md)，颜色遵循 [theme-tokens](../theme-tokens/SKILL.md)。不复制页面私有明暗色值；确需语言/主题入口时复用 `HeaderToggles`。
- 先核对当前工具源码，再写操作与能力说明。旧说明不能作为唯一事实源；不要为凑流程补写尚未实现的能力。
- 路由位于 `core/packages/client/app/[lang]/`；新增路由按 [document-title](../document-title/SKILL.md) 配置标题与 metadata，不使用已退役的 Vite `pages/`、`App.tsx` 注册方式。
- 避免在已有 max-width 的容器上叠加基于整个 viewport 计算的水平 padding，以免窄屏正文挤成单字列。

## 参考

| 页面 | 用途 |
| --- | --- |
| `/scramble/gen-about` | 生成模式对照、公开边界、折叠引擎细节 |
| `/frame-count-about` | 简短操作流程、时间分辨率例子、测量局限 |
| `/nemesizer-about` | 用小表格解释关系定义与并列边界 |
| `/scramble/hardest` | 可操作例子、可见口径、完整语料折叠 |

参考信息层级和组件，不要求复制相同章节。完成后按 `user-facing-report` 检查双语、窄屏和主题。
