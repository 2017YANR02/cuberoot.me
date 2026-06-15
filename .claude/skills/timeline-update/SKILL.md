---
name: timeline-update
description: "Use when user wants to fill in /code/architecture 第 11 节的日历 + 列表 — 从 JSON 最后一条日期之后开始, 把每个有 commit 的日子补上中英 1 行总结 (日历); 每个新页面/路由上线都加进 TIMELINE 数组 (列表)。Triggers: \"/timeline-update\", \"更新 timeline\", \"补日历\", \"补 timeline\", \"update commit calendar\"."
---

# /timeline-update — 补 /code/architecture 日历 + 列表

两个视图:
- 日历 → `core/packages/client-next/app/[lang]/code/architecture/timeline_commits.json` (升序, 每天 1 行 `{date, zh, en}`)
- 列表 → `app/[lang]/code/architecture/_lib/arch-data.tsx` 里 `TIMELINE` (降序 newest-first, 产品级 changelog)

## 三条铁律

1. **客观陈述**, 禁主观词 (史诗 / Epic / 大日 / multi-event / 大改造 / 全量上线 / 喷涌 / `!`)
2. **每个有 commit 的日子都要写**, 除非全是 CI/chore 噪音。禁泛词 (小修 / 持续迭代 / 收尾 / 微调) — 钻 diff 写具体组件
3. **每个新页面/路由上线都进 TIMELINE 列表** (LandingPage 卡片 + App.tsx 重要 sub-route 全覆盖)

## 工作流

1. 读 `timeline_commits.json` 最后日期 → `git log --format='%ad' --date=short --since=<LAST+1d> | sort | uniq -c` 列每个待调研日
2. 每日 `git log --format='%ai|%H|%s' --since=DAY --until=DAY --no-merges`
3. SKIP 整天: 当天全部 commit 匹配 `^chore: update (wca|upcoming)` / `^Merge` / `ci: rebuild SPA` / `^backup:` / `^Update .*\.(md|html|json)$`
4. **placeholder commit 必解码**: subject 是 `update` / `1` / `i18n` / 单字 → `git show --stat HASH` + `git show HASH -- <key-file>` 看实际改动。大日 (>20 commits) 里常藏整页新增, 漏掉 = entry 写错
5. 写日历 entry: 中文 1 行 + 英文 1 行, ` + ` 串多主题, 写组件名 (`/recon`, `GlobePage` 等), 中文标点, 无 emoji, 无句号收尾, 厂商身份 (阿里云 etc) → "自有云服务器"。**禁子编号** (`(1)..(8)`) 和嵌套括号细节 (行数 / commit hash / 子组件清单) — 那些进 TIMELINE expand。日历一句话只列**主题词**, 哪怕一天 8 件也保持"+串"扁平。看到 entry 长得像段落 = 改
6. 审 TIMELINE: 凡新 LandingPage 卡片 / 新顶层路由 / 新重要 sub-route / 框架换栈 / 整片基础设施变更 → 都加一条。新加前先 `grep -nE "id:|href:" LandingPage.tsx` + `grep -nE "path=" App.tsx` 防漏
7. 已有 entry 太单薄 (placeholder 揭出隐藏改动) → **改写**而非追加
8. 给用户**预览** (日历 entry 三列表格 + TIMELINE 候选条目单独一段), 同意再写
9. 不主动 commit / push, 等用户

## TIMELINE schema

```ts
interface TLEntry {
  date: string;  // 'YYYY-MM-DD' / 'YYYY-MM' / 'YYYY-MM-DD ~ DD'
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
}
```

tag: `migration` 换栈/迁数据 · `dx` 开发流程 · `feature` 新页/新模块 · `infra` 部署/CI/SSL

新条目插数组**最前**, 改完跑 `pnpm --filter @cuberoot/client-next typecheck`

## Calibration

日历当前 75+ 条 (每个有 commit 的日子都覆盖), TIMELINE 当前 24 条 (产品事件, 约 1 周一件)。新 batch 大概率 1-3 件值得进 TIMELINE。**宁多勿少**, 用户翻列表想看每个新页的上线日。

## 验收

`/code/architecture` 第 11 节:
- 日历: 新日期有日期数 + 文字
- 列表: 新条目 tag 颜色对, expand 内容对, 头部 "List · N 件重大" 数字反映新长度
