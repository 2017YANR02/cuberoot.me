---
name: wca-event
description: "渲染 WCA 项目名、图标或选择器时用。图标复用 EventIcon/CubingIcon；WCA 筛选复用菜单式 WcaEventSelector/WcaEventMultiSelector，底层统一 PuzzlePicker。Triggers: 项目名, EventIcon, CubingIcon, WcaEventSelector, 项目选择器, event picker, eventDisplayName."
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

默认折叠为 `PuzzlePicker` 菜单，与筛选控件紧凑排列；`allowAll` 加「全部」，多选传 `selectedEvents`+`onToggle`，分类快选用 `WcaEventMultiSelector`。

菜单只列可用项目，废止项和非 WCA 项目分别分组；多选菜单保留清空、全选、分类和废止项开关。
师生编辑与双人计时浮层显式传 `presentation="inline"` 保留展开图标行；比赛列表保留项目表头，筛选使用菜单；`EventSelect` 仅作旧调用的菜单适配入口。

## 加新 unofficial 图标

1. 拷 `D:\cube\icons\src\svg\unofficial\<name>.svg` 到 `components/EventIcon/svg/unofficial/`
2. `utils/cubingScramble.ts` 的 `TWIZZLE_NONWCA_APPEND` 加 `{ id, iconClass: 'unofficial-<name>' }`
