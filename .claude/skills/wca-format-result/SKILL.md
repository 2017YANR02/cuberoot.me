---
name: wca-format-result
description: "Use when raw WCA result value (centiseconds/FMC/MBLD encoding) → display string. Single entry: utils/wca_format_result.ts. Triggers: \"WCA 成绩\", \"成绩格式化\", \"formatWcaResult\", \"centiseconds\", \"FMC\", \"MBLD\", \"333mbf\", \"333fm\", \"DNF\", \"DNS\", \"0.28\", \"33.00\", \"slice(1,3)\", \"padStart(10\", 渲染 WCA 成绩 / 纪录值 / PR / 比赛纪录."
---

# WCA 成绩值格式化

唯一入口：`core/packages/client-next/lib/wca-format-result.ts`。任何把 raw WCA 数值变字符串的地方都走它,**不要再手写 `(v/100).toFixed(2)` 或对 MBLD 数字做 slice**。

```ts
formatWcaResult(value, eventId, 'single' | 'average', opts?)
formatWcaResultK(value, eventId, 0 | 1, opts?)   // kind 是 0/1 的 caller (rank tables / H2H)
```

`opts`:`fmcAverage: 'decimal'|'rounded'`、`zero: 'dash'|'empty'`、`failure: 'dnf'|'dash'`。

## WCA 编码雷区(选错一个就全错)

- DNF=`-1` / DNS=`-2` / no result=`0`(不是 `null`)
- 时间项:**centiseconds**,8653 = 1:26.53
- **FMC single = 整数 moves(不是 cs!)**,FMC average = `moves × 100`
- MBLD 新格式 `333mbf` = `0DDTTTTTMM`(10 位带前导 0),padStart(10) 后 **`slice(1,3)` 取 DD**(不是 slice(0,2)!),`solved - missed = 99 - DD`
- MBLD 旧格式 `333mbo` = `1SSAATTTTT`,solved=99-SS

## Top10 图表轴刻度走另一个

`lib/top10-axis.ts` 的 `tickLabel` / `axisFor` —— 简洁版(整秒、FMC avg 不带小数),专供 Top10 历史图。其他场景一律 `formatWcaResult`。

## 不要做的事

- 手写 `if (eventId === '333fm') (v/100).toFixed(2)` —— 漏 single/average 区分(就是 H2H 之前的 bug:0.28 应该是 28)
- 自己 padStart + slice MBLD —— slice(0,2) 错位 bug(format_result.ts 历史教训)
- 假定 WCA results API attempts 是 cs —— FMC attempts 是 raw moves(`fetchAttempts` 现有 `/100` 对 FMC 错,记一笔不是这 skill 的范围)

## 已经按规矩做的参考

`PersonDetailPage` PR 表 / `UpcomingCompsPage` 纪录列表 / `Top10HistoryPage` bar list / `H2HMode` 表格。
