---
name: wca-event
description: "渲染 WCA/非 WCA 项目名、图标或选择器，或为新项目注册图标与短名时用。图标复用 EventIcon/CubingIcon；WCA 筛选复用菜单式 WcaEventSelector/WcaEventMultiSelector，底层统一 PuzzlePicker。Triggers: 项目名, EventIcon, CubingIcon, WcaEventSelector, 项目选择器, event picker, eventDisplayName."
---

# 项目图标 + 选择器

## 图标渲染（共享内联 SVG）

源文件在 `core/packages/event-icon/svg/`，生成映射在该包的 `src/svg-map-*.ts`；Web 的 `components/EventIcon/EventIcon.tsx` 只适配事件名称，跨端使用 `@cuberoot/event-icon` 的公开出口。

```tsx
import { EventIcon, CubingIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';

<EventIcon event="3x3" /> {eventDisplayName(ev, isZh)}   // event id (短名都行)
<CubingIcon icon="event-333" />                          // 已知 class key
<CubingIcon icon="unofficial-fto" />                     // 非 WCA / penalty 同理
```

CSS 用 `font-size`(SVG=1em) + `color`(SVG fill=currentColor) — 现存规则零改动。

禁:`<span className="cubing-icon ...">`(font 已撤,会渲空)/ emoji / lucide / 页面内手写 SVG。需要原创图标时在共享 SVG 源目录制作；缺少图标的项目通过 picker 的 `textLabel` 显示明确短名。

## /wca 单项目选择器

```tsx
<WcaEventSelector availableEvents={SET} selectedEvent={ev} onSelect={...} isZh={isZh} />
```

默认折叠为 `PuzzlePicker` 菜单，与筛选控件紧凑排列；`allowAll` 加「全部」，多选传 `selectedEvents`+`onToggle`，分类快选用 `WcaEventMultiSelector`。

菜单只列可用项目，废止项和非 WCA 项目分别分组；多选菜单保留清空、全选、分类和废止项开关。
师生编辑与双人计时浮层显式传 `presentation="inline"` 保留展开图标行；比赛列表保留项目表头，筛选使用菜单；`EventSelect` 仅作旧调用的菜单适配入口。

## 加新 unofficial 图标

1. 先查 `core/packages/event-icon/svg/unofficial/` 与 `src/svg-map-unofficial.ts` 是否已有图标；新增时核对来源/授权，原创图标也放在同一共享源目录，不依赖某台电脑的绝对路径。
2. 在 `core/` 运行 `pnpm --filter @cuberoot/event-icon generate`，提交 SVG 与受影响的生成映射；不要直接手改生成文件。
3. Web 图标名映射核对 `core/packages/client/components/EventIcon/EventIcon.tsx`；项目菜单按真实来源登记：Twizzle 项目用 `lib/non-wca-events.ts`，原生打乱项目用 `lib/native-scramble.ts`，Timer 用 `core/packages/shared/src/timer/event-catalog.ts`。新增打乱与计时器接线时另读 `sim-add-puzzle` 的 [跨页面清单](../sim-add-puzzle/references/integration-and-verification.md)。
4. 保留稳定事件 id，图标键使用实际存在的 `unofficial-<name>`；picker 可使用真实 `iconClass` 或 `textLabel`，不要为满足“所有非 WCA 都有图标/csTimer key”的旧假设填写假值。
