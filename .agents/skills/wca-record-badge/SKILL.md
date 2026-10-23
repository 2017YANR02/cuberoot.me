---
name: wca-record-badge
description: "渲染 WCA 纪录标志(WR/CR/NR/AsR/ER/NAR/SAR/OcR/AfR/PR/cancelled 等)时用。统一使用 RecordBadge，被取消的纪录由组件画水平删除线。Triggers: WR, CR, NR, AsR, ER, NAR, SAR, OcR, AfR, record badge, 纪录标志, RecordBadge, formatRecord."
---

`<RecordBadge record={s} />`,`components/RecordBadge`。裸 CR 传 `iso2` 自动展开洲际;`variant="inline"` 上标贴成绩后。

被取消、撤销或替换的旧纪录也必须用 `RecordBadge`：传入已有取消格式，例如 `<RecordBadge record="AsR cancelled" />`；裸 CR 用 `record="CR cancelled"` 并传 `iso2`。取消标记由共享 `.record-cancelled::after` 在徽章中部画一条贯穿宽度的水平线，不画斜线，也不在页面外包删除线或另写徽章 CSS。新纪录正常显示，无纪录显示 `—`；不要只因成绩发生修正就将未撤销的纪录标成取消。

成绩变更按“原状态 → 变更后状态”展示：旧纪录被取消且没有新纪录时，显示正常旧 `RecordBadge` → 同一纪录带水平删除线的 `RecordBadge`，例如 AsR → 划线 AsR；不要显示划线 AsR → `—`，也不要省掉原状态。替换为另一项纪录时展示正常旧徽章 → 新徽章。普通成绩表中的无纪录占位仍用 `—`。

取消后缀只用于渲染，不回写原始纪录值。Web 包装入口在 `core/packages/client/components/RecordBadge/`，共享组件和横线样式在 `core/packages/timer-ui/src/RecordBadge.tsx`、`record-badge.css`。

表格里数字+badge 同格:外面套 `.record-num-cell`(同包 CSS 已定义,数字右对齐 + badge 左锚)。

禁:自写 span+CSS;复制 RECORD_COLORS;hand-map 配色;为对齐另造 wrapper class。

类映射与取消格式解析复用 `core/packages/shared/src/timer/record-badge.ts`；Web 洲际展开复用 `core/packages/client/lib/recon-utils.ts` 的 `expandContinentRecord`，徽章配色与线条统一在共享 `record-badge.css` 修改。
