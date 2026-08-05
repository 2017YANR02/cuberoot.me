---
name: wca-record-badge
description: "渲染 WCA 纪录标志(WR/CR/NR/AsR/ER/NAR/SAR/OcR/AfR/PR/cancelled 等)时用。单一入口 `<RecordBadge>`。Triggers: WR, CR, NR, AsR, ER, NAR, SAR, OcR, AfR, record badge, 纪录标志, RecordBadge, formatRecord."
---

`<RecordBadge record={s} />`,`components/RecordBadge`。裸 CR 传 `iso2` 自动展开洲际;`variant="inline"` 上标贴成绩后。

表格里数字+badge 同格:外面套 `.record-num-cell`(同包 CSS 已定义,数字右对齐 + badge 左锚)。

禁:自写 span+CSS;复制 RECORD_COLORS;hand-map 配色;为对齐另造 wrapper class。

改配色 / 类映射 / 洲际展开:`utils/recon_utils.ts` 的 `formatRecord` + `expandContinentRecord` + `getRecordClass`。
