---
name: wca-event-icon
description: "Use whenever rendering WCA event names anywhere in UI (cards, tables, chips, bar/list rows, popups, badges). All WCA event display must be prefixed with `<EventIcon>` (cubing-icons font glyph) — text-only labels are a bug. Single source: components/EventIcon. Triggers: \"项目名\", \"event name\", \"event display\", \"eventDisplayName\", \"EventIcon\", \"cubing-icon\", 渲染 WCA 项目, 项目图标."
---

# WCA 项目图标

## 铁则

任何"渲染 WCA 项目（3×3 / 单手 / FMC / SQ1...）"的地方,**前面必须有 `<EventIcon>` 图标**——纯文字 = bug。

## 单一入口

```tsx
import { EventIcon } from '../../components/EventIcon';
import { eventDisplayName, toWcaEventId } from '../../utils/wca_events';

<span className="row-label">
  <EventIcon event={ev} />
  <span>{eventDisplayName(ev, isZh)}</span>
</span>
```

`EventIcon` 接受任何短名 / 标准 id：`'3x3'` / `'3'` / `'333'` / `'oh'` / `'333oh'` 都行（内部 `toWcaEventId` 归一化）。CSS 类来自全局加载的 `cubing-icons` 字体（见 `index.html`）。

## 不要做的事

- 用 emoji / lucide / 自定义 SVG 替代 cubing-icon
- 重写一份 short→标准 id 的映射（已经有 `toWcaEventId`）
- 在外联 popup 里 hand-write `<span class="cubing-icon event-333">` —— 这种 React 不渲染的场景看 `flagHtml` 同源思路：用 string 拼也复用 `toWcaEventId(ev)` 算 class 名

## 已经按规矩做的参考

- `EventSelect` 的 trigger 和下拉项
- `recon-event-cell`
- `CalendarStatsPage` 的项目场次条形

新页面 / 新组件渲染项目时，对照这些抄。
