---
name: cuber-name-display
description: "Use when rendering WCA cuber / person names anywhere in UI (tables, cards, chips, popups, badges). WCA API returns names like \"Xuanyi Geng (耿暄一)\" with parenthesized Chinese — we never keep the parens. Triggers: \"选手名\", \"cuber name\", \"displayCuberName\", \"括号中文\", 渲染 person 列."
---

# 选手名显示规范

WCA API 返回的选手名常带括号中文，如`Xuanyi Geng (耿暄一)`。**任何页面展示选手名时都不要保留括号**：

- 中文模式：显示括号里的中文名（`耿暄一`）
- 英文模式：显示去掉括号后的英文名（`Xuanyi Geng`）
- 都不保留括号本身

## 统一工具

`core/packages/client-next/lib/name-utils.ts` 的 `displayCuberName(rawName, isZh)`。

```ts
import { displayCuberName } from '@/lib/name-utils';
// ...
<span>{displayCuberName(person.name, isZh)}</span>
```

## 禁止

- 不要现场写 `extractChineseName` / `stripChineseParens` 或自己的正则
- 不要把括号中文保留在页面上
- 不要只取英文部分作为"通用显示"

## 参考用法

- `WcaStatsPage` 表格（wr_metric 等）—— person 列渲染
- `GlobePage` cuber chip —— 顶部搜索选手后的展示
