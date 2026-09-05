---
name: document-title
description: "Use when adding or changing 浏览器标题、页面标题、tab title, document title, or useDocumentTitle behavior. Static route titles use server metadata; only runtime state invisible to the server uses the shared hook."
---

# 浏览器标题

- 静态路由遵循仓库 AGENTS「页面标题 / SEO metadata」:维护 `core/packages/client/lib/page-meta.ts` 与路由 server `layout.tsx`,动态参数按该节的可枚举/哨兵规则处理。
- 同一标题只保留一个事实源;已有 layout metadata 时删除重复的 `useDocumentTitle`,不得为读路径引入 `headers()` 或把静态页转为动态渲染。
- 仅服务端看不见的运行时状态使用 `core/packages/client/hooks/useDocumentTitle.ts`;此时路由 metadata 保留通用标题。
- Hook 导入用 `import { useDocumentTitle } from '@/hooks/useDocumentTitle'`,调用 `useDocumentTitle('中文标题', 'English title')`;已本地化字符串传入两个参数。
- 禁直接赋值 `document.title`、另加标题库或自行拼品牌前后缀;静态品牌格式由 metadata helper 统一处理。
- 修改前核实目标路由现有 layout、metadata 和 hook;不依据旧页面清单批量迁移无关文件。
