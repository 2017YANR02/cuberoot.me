---
name: comp-date-range
description: "Use when rendering WCA competition dates anywhere in UI (popups, cards, modal headers, day list, bin-panel). All dates must be ISO yyyy-mm-dd; cross-day ranges use compact form (2026-06-06~07) — never locale month names (May 1–3). Triggers: \"比赛日期\", \"日期区间\", \"date range\", \"start_date end_date\", \"2026-06-06~07\"."
---

# 比赛日期格式

**全项目统一 ISO `yyyy-mm-dd`**，不按 isZh 切英文/中文月名。跨天比赛用紧凑区间（不重复年月）：

| 场景 | 格式 |
|---|---|
| 同天 | `2026-06-06` |
| 同月 | `2026-06-06~07` |
| 同年跨月 | `2026-06-28~07-02` |
| 跨年 | `2025-12-30~2026-01-02` |

## 工具 `utils/date_range.ts`

```ts
formatDateRangeIso(startISO, endISO?) → 紧凑区间字符串
toIsoDate(date) → Date → 'YYYY-MM-DD'（本地时区）
```

## 禁止

- `${start} — ${end}` 直接连两个完整日期 —— 年月重复
- `toLocaleDateString('en-US', { month: 'short', day: 'numeric', ... })` —— 会出现 May/Jun 等月名
- 按 isZh 切 `6 月 6 日` / `Jun 6, 2026` —— 已统一 ISO，不分语言
- popup 里不要丢 `.mlp-date { white-space: nowrap }` —— 连字符 `-` 是可断行点，`2026-06-` 会被换行切断
