---
name: cuber-name-display
description: "Use when rendering WCA cuber / person names anywhere in UI (tables, cards, chips, popups, badges). WCA API returns names like \"Xuanyi Geng (耿暄一)\" with parenthesized Chinese — we never keep the parens. Triggers: \"选手名\", \"cuber name\", \"displayCuberName\", \"括号中文\", 渲染 person 列、表格国旗对齐、战队 logo 间距."
---

# 选手名显示规范

WCA API 返回的选手名常带括号中文，如`Xuanyi Geng (耿暄一)`。**任何页面展示选手名时都不要保留括号**：

- 中文模式：显示括号里的中文名（`耿暄一`）
- 英文模式：显示去掉括号后的英文名（`Xuanyi Geng`）
- 都不保留括号本身

## 统一工具

### 身份组合与链接（2026-11-04）

- 视觉与组件基准是 `/wca/results?tab=records` 的 `WcaRecordRowsTable`。
- 选手主页链接统一使用 `@/components/PersonLink`：默认提供战队徽标、姓名本地化、非 WCA ID 的纯文本降级和关闭预取。国旗由 `flag` 传入，使用共享 `Flag`；历史国籍必须使用调用方当时的国家，不得改成当前国籍。特殊姓名模式可传 `children`，行内链接可传 `onClick` 保留阻止冒泡行为。
- 不再复制 `WcaPersonTeamBadge + Flag + AppLink` 的选手主页组合。特殊行为（成绩弹窗、复盘作者页、Kinch 明细、整卡链接、按钮内纯文本、个人页标题）保留其导航/交互，使用 `WcaPersonIdentity` 包裹原有链接或纯文本，并通过 `flag` 传国旗；嵌套在链接或按钮内时传 `linked={false}`。它是 `PersonLink` 自身复用的布局，不另写一套。战队目录已有归属数据时用 `team` 传入，不重复请求。
- **表格国旗必须上下对齐**（维护者纠正，2026-11-04）：共享紧凑 logo 列使用一致宽度；logo 靠右紧邻国旗，避免窄 logo 居中留下大间距；没有战队也保留这一列，表头对齐国旗。此前“不要占位”不能解释成各行自然宽度、导致国旗错位。非表格保持自然宽度。列宽、logo 最大尺寸与比例仅由 `components/wca-person-team-badge.css` 维护，不在单页复制。
- 身份组合必须作为一个布局单元，不能让外层 `flex/gap` 分别排列 logo、国旗和姓名；不要手写 `.wca-person-team-slot`，也不要把 `td` 改成 flex。普通选手列表头使用 `wca-person-column`；含完整身份的表头不再加此缩进。
- 修改共享布局时检查表格调用方，包括预排名、比赛成绩/领奖台/合并轮次、纪录/排名/统计、战队、宿敌、复盘和学生名单。至少检查有战队、无战队、宽窄 logo、无 WCA ID 的实际行；浏览器测量同一表同一选手列的国旗横坐标，不以“引用了共享 CSS”代替验证。独立国家/比赛列保留原有结构，不增加 logo 列。
- 图标不加装饰描边或背景；无 WCA ID 不生成假的选手链接。现有独立国籍列、缺失国籍和未参赛成员不得为了补国旗而臆造数据。

`core/packages/client/lib/cuber-name-display.ts` 的 `displayCuberName(rawName, isZh)`。

```ts
import { displayCuberName } from '@/lib/cuber-name-display';
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
