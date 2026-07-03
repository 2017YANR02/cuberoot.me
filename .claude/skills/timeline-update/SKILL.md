---
name: timeline-update
description: "Use when user wants to fill in /code/architecture 第 11 节的日历 + 列表 — 从 JSON 最后一条日期之后开始, 把每个有 commit 的日子补上中英 1 行总结 (日历); 每个新页面/路由上线都加进 TIMELINE 数组 (列表)。Triggers: \"/timeline-update\", \"更新 timeline\", \"补日历\", \"补 timeline\", \"update commit calendar\"."
---

# /timeline-update — 补 /code/architecture 日历 + 列表

两个视图:
- 日历 → `core/packages/client/app/[lang]/code/architecture/timeline_commits.json` (升序, 每天 1 行 `{date, zh, en}`)
- 列表 → `app/[lang]/code/architecture/_lib/arch-data.tsx` 里 `TIMELINE` (降序 newest-first, 产品级 changelog)

## 三条铁律

1. **标准书面语 + 客观陈述**(日历 / TIMELINE 的 title·body·expand 全适用,写成产品更新公告,不是朋友圈 / 开发日志)。四类禁区:
   - **主观 / 夸张词**:史诗 / Epic / 大日 / 大改造 / 全量上线 / 喷涌 / 跃变 / 冲刺 / 密集 / 正式 / multi-event / `!`
   - **口语俏皮话**:玩出花 / 上新花样 / 一口气 / 安排上了 这类
   - **件数当卖点**:`一天六件大事` / `同天五件` / `单日七项` / `X 页两天上线` —— 标题只写做了什么,绝不写"几件";body 要列就平铺 ` + ` 串,不加"同天 N 件:"前缀
   - **开发日志口吻**:`一天打了 116 个提交` / `第二天就…` / 比提交数 —— 只讲用户能感知的产品变化
2. **有非 merge 提交的日子一律写, 不留空白日** (用户硬要求: 只要当天有提交, 日历就不能空)。纯 cron 日 (当天只有 `chore: update upcoming/wca` 之类) 也要写, 用据实一句「刷新近期比赛数据 / 中文赛名 / WCA 统计」, 这是事实不是填充废话。真有开发的日子禁泛词 (小修 / 持续迭代 / 收尾 / 微调) — 钻 diff 写具体组件
3. **每个新页面/路由上线都进 TIMELINE 列表** (LandingPage 卡片 + App.tsx 重要 sub-route 全覆盖)

> 反例 → 正例(必照此口径):
> `名次和玩出花:可以分解项目组合` → `名次和可拆分到各项目;计时器接入真实 WCA 打乱`
> `一天六件大事:英文网址去前缀、繁体全覆盖…` → `英文网址去前缀、繁体中文移除、桥式训练器上线`
> `速拧计时器正式上线,第二天一天打了 116 个提交` → `速拧计时器重写上线,随后补齐盲拧 / 蓝牙 / 3D / 观察时间`

## 工作流

1. 读 `timeline_commits.json` 最后日期 → `git log --format='%ad' --date=short --since=<LAST+1d> | sort | uniq -c` 列每个待调研日
2. 每日 `git log --format='%ai|%H|%s' --since=DAY --until=DAY --no-merges`
3. **只 SKIP 整天纯 `^Merge`** (零非 merge 提交) 的日子。cron / 构建噪音 (`chore: update upcoming/wca`, `ci: rebuild SPA`, `^backup:`, `^Update .*\.(md|html|json)$`) 不再是 SKIP 理由: 同日有真实改动→只写改动、忽略噪音; 整天只有这些→写一句据实数据/构建刷新, 仍不留空
4. **placeholder commit 必解码**: subject 是 `update` / `1` / `i18n` / 单字 → `git show --stat HASH` + `git show HASH -- <key-file>` 看实际改动。大日 (>20 commits) 里常藏整页新增, 漏掉 = entry 写错
5. 写日历 entry: 中文 1 行 + 英文 1 行, ` + ` 串多主题, 写组件名 (`/recon`, `GlobePage` 等), 中文标点, 无 emoji, 无句号收尾, 厂商身份 → "自有云服务器"。**禁子编号** (`(1)..(8)`) 和嵌套括号细节 (行数 / commit hash / 子组件清单) — 那些进 TIMELINE expand。日历一句话只列**主题词**, 哪怕一天 8 件也保持"+串"扁平。看到 entry 长得像段落 = 改
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

新条目插数组**最前**, 改完跑 `pnpm --filter @cuberoot/client typecheck`

## Calibration

日历当前 135 条 (每个有非 merge 提交的日子全覆盖, 含纯 cron 日), TIMELINE 当前 44 条 (产品事件, 约 1 周一件)。新 batch 大概率 1-3 件值得进 TIMELINE。**宁多勿少**, 用户翻列表想看每个新页的上线日。

## 验收

`/code/architecture` 第 11 节:
- 日历: 新日期有日期数 + 文字
- 列表: 新条目 tag 颜色对, expand 内容对, 头部 "List · N 件重大" 数字反映新长度
