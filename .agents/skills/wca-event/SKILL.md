---
name: wca-event
description: "渲染 WCA 项目名、图标或选择器时用。图标复用 EventIcon/CubingIcon；WCA 筛选复用菜单式 WcaEventSelector/WcaEventMultiSelector，底层统一 PuzzlePicker。Triggers: 项目名, EventIcon, CubingIcon, WcaEventSelector, 项目选择器, event picker, eventDisplayName."
---

# 项目图标 + 选择器

## 图标渲染（内联 SVG，源 `core/packages/event-icon/svg/`）

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

## 项目图标事实源与维护

唯一 SVG 源在 `core/packages/event-icon/svg/`，Web / App 的 `CubingIcon` 都从 `@cuberoot/event-icon` 消费；旧 `components/EventIcon/svg/` 路径已迁出。

- `event/`、`unofficial/`、`penalty/` 保留 cubing/icons 上游原稿；本站设计放 `puzzle/`，不要改上游图来冒充另一个项目。
- `/sim` 的 PG 图标必须对应当前项目的形状、切割和阶数，禁止拿五魔图标代替二十面体、拿 FTO 代替所有八面体，或不同阶数共用一个图标。
- PG 图标从 `sim/pgCatalog.ts` 的同一切割定义生成：在 `core/` 运行 `pnpm --filter @cuberoot/client exec node scripts/generate-puzzle-icons.mts`，加 `--check` 可只读核对。曲面直升机保留曲线原稿，因为平面切割不能表达真实曲线。
- 修改 SVG 后运行 `pnpm --filter @cuberoot/event-icon generate`。`/icon` 自动枚举同一份 SVG；项目名称复用目录数据，菜单显示和下载必须一致。
- 新图标同时检查菜单小尺寸与图标库；可见切缝相同的拼图不编造多余切缝，几何相似不意味着转动机制相同。

## 项目菜单短名

网站所有项目选择菜单（含分组、选中项、提示名称）不得出现「魔方」二字，例如「二重奏」「枫叶」「齿轮」。使用统一 PuzzlePicker 的展示规则，并在项目目录数据中直接写短名；不得改项目 ID、计算或保存值。此规则只约束项目菜单，不禁止文章正文等正常用词。写入守卫 `block-puzzle-menu-label.mts` 与 CI `puzzle-menu-label-guard.test.ts` 共同维护；新增菜单数据源时同步纳入检查。

项目菜单的三维尺寸省略乘号，写作 `233`、`334`、`335`，不写 `2×3×3`、`3x3x4`；中英文名称、左侧文字标签、选中提示保持一致。仅格式化展示，不改项目 ID。
