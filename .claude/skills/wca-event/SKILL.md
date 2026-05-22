---
name: wca-event
description: "渲染 WCA 项目名/图标/选择器时用。(1) 图标走 `<EventIcon>` 或 `<CubingIcon>` (内联 SVG,components/EventIcon),禁 `<span className=\"cubing-icon ...\">` (空 span)。(2) /wca 子页选项目用 `<WcaEventSelector>` 21 图标行,不用 `<EventSelect>` 下拉。Triggers: 项目名, EventIcon, CubingIcon, cubing-icon, WcaEventSelector, 项目选择器, event picker, eventDisplayName."
---

# 项目图标 + 选择器

## 图标渲染（内联 SVG，源 `components/EventIcon/svg/`）

```tsx
import { EventIcon, CubingIcon } from '../../components/EventIcon/EventIcon';
import { eventDisplayName } from '../../utils/wca_events';

<EventIcon event="3x3" /> {eventDisplayName(ev, isZh)}   // event id (短名都行)
<CubingIcon icon="event-333" />                          // 已知 class key
<CubingIcon icon="unofficial-fto" />                     // 非 WCA / penalty 同理
```

CSS 用 `font-size`(SVG=1em) + `color`(SVG fill=currentColor) — 现存规则零改动。

禁:`<span className="cubing-icon ...">`(font 已撤,会渲空)/ emoji / lucide / 手写 SVG。

## /wca 单项目选择器

```tsx
<WcaEventSelector availableEvents={SET} selectedEvent={ev} onSelect={...} isZh={isZh} />
```

放 filters **上方独立一行**。`allowAll` 加"全部"。多选传 `selectedEvents`+`onToggle`。

## 加新 unofficial 图标

1. 拷 `D:\cube\icons\src\svg\unofficial\<name>.svg` 到 `components/EventIcon/svg/unofficial/`
2. `utils/cubingScramble.ts` 的 `TWIZZLE_NONWCA_APPEND` 加 `{ id, iconClass: 'unofficial-<name>' }`
