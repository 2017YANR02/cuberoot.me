---
name: wca-event
description: "渲染 WCA 项目名 / 加 /wca 单项目选择器时用. (1) 项目名前必须 `<EventIcon>`(纯文字=bug),`components/EventIcon`. (2) /wca 子页选项目用 `<WcaEventSelector>` 21 图标行,不用 `<EventSelect>` 下拉. Triggers: 项目名, EventIcon, cubing-icon, WcaEventSelector, 项目选择器, event picker, eventDisplayName."
---

# 项目图标 + 选择器

## 项目标签

```tsx
import { EventIcon } from '../../components/EventIcon';
import { eventDisplayName } from '../../utils/wca_events';
<EventIcon event={ev} /> {eventDisplayName(ev, isZh)}
```

`EventIcon` 接 `'333'`/`'3'`/`'oh'` 等任意短名。

禁:emoji / lucide / 自写 SVG;重写 short→id 映射;popup `innerHTML` 手拼 — 仿 `flagHtml` 用 `toWcaEventId`.

## /wca 单项目选择器

```tsx
import WcaEventSelector from './WcaEventSelector';
<WcaEventSelector availableEvents={EVENTS_SET} selectedEvent={event} onSelect={...} isZh={isZh} />
```

放 filters **上方独立一行**,不塞进 filter 单元格。CSS 走 `WcaEventSelector.css`(组件自带 import)。

要"全部"选项加 `allowAll` prop(`selectedEvent === ''` 时高亮"全部"按钮)。多选(如 `SumOfRanksPage`)用自定义复选 grid,不是这个组件。
