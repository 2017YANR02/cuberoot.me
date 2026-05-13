---
name: timeline-update
description: "Use when user wants to fill in /code/architecture 第 11 节的日历 + 列表 — 从 JSON 最后一条日期之后开始, 把每个有 commit 的日子补上中英 1 行总结 (日历); 每个新页面/路由上线都加进 TIMELINE 数组 (列表)。Triggers: \"/timeline-update\", \"更新 timeline\", \"补日历\", \"补 timeline\", \"update commit calendar\"."
---

# /timeline-update — 补 /code/architecture 日历 + 列表

## 用途

`/code/architecture` 第 11 节有两个视图, 数据源不同:
- **日历视图** (默认) → `core/packages/client/src/pages/code/timeline_commits.json` (按日 1 行 zh+en, 每个有实质 commit 的日子都要有)
- **列表视图** → `core/packages/client/src/pages/code/ArchitecturePage.tsx` 里的 `TIMELINE` 数组 (产品级 changelog, **每个新页面/卡片上线都要有**, 每条带 expand 详情)

这个 skill 流程化两件事:
1. **必做**: 把日历 JSON 补到当天 (有 commit 的每一天都要写, 除非纯 CI 噪音)
2. **必做**: 检查这批有没有**新页面/新路由/新卡片上线** — 有就加进 TIMELINE 列表 (产品视角)

## 核心原则 (用户最在乎的 3 条)

1. **客观陈述, 不要修辞**。**禁止** "史诗" / "Epic" / "大日" / "multi-event" / "大改造" / "大重构日" / "全量上线" / "喷涌日" / `!` 等主观词。说"上线了 X / Y / Z 三个页面", 别说"史诗多页日!"。
2. **每天有 commit 就要有 entry**, 除非那天**全部** commits 都是 CI/chore 噪音。"小修小补 / 持续迭代 / 收尾" 这种泛词全禁 — 钻进 diff 看到底改了什么具体功能或 bug 修, 然后客观写出来。
3. **每个新页面/卡片上线都要进 TIMELINE 列表**。产品经理视角: 用户上线了什么内容就要让用户知道。原来 14 条太少, 应该 24+ 条覆盖每个 LandingPage 卡片 + 重要子路由的首次上线日。

## 输入 / 输出

- **输入**: 无显式参数。Skill 自己从 `timeline_commits.json` 推断起始日期。
- **输出**: 修改后的 `timeline_commits.json` (append-only, 按日期升序末尾追加) + (必要时) `ArchitecturePage.tsx` 的 TIMELINE 数组。

## 日历 JSON schema

```json
[
  { "date": "YYYY-MM-DD", "zh": "中文一行", "en": "English one-liner" }
]
```

- 整个文件是 array, 按日期**升序** (oldest first, newest last)
- 每条 zh + en 一行总结那一天的主要改动
- **每天只有 1 条 entry**
- 没 commit 的日子 (或当天**全部** commits 都是 CI 噪音) **不加 entry, 跳过**

## 工作流

### Step 1: 读最后一天 + 列出待调研日期

```bash
node -e "const d=require('./core/packages/client/src/pages/code/timeline_commits.json'); console.log(d[d.length-1].date)"
git log --format='%ad' --date=short --since=<LAST_DATE+1day> | sort | uniq -c | sort -k2
```

把每个有 commit 的日子全列出来 (含 commit 数), 后面**每个都要调研**。

### Step 2: 拉每日 commits

对每个待调研日:
```bash
git log --format='%ai|%H|%s' --since=YYYY-MM-DD --until=YYYY-MM-DD --no-merges
```

### Step 3: 跳过纯噪音日

只有当**当天所有 commits** 都匹配以下 SKIP pattern 时, 才整天跳过:
- `^chore: update (wca|upcoming)` (case-insensitive)
- `^Merge (branch|pull)`
- `^Update [a-zA-Z_./-]+\.(md|html|json)$` (single-file rename/touch)
- `ci: rebuild SPA from core/`
- `^backup:` ([skip ci] backup dumps)
- `^Add files via upload` / `^Delete ` / `^Create `

只要当天有**任何一个**非噪音 commit, 就要给那天产出 entry。

### Step 4: 必须解码 placeholder commits

`update` / `1` / `i18n` / 单字 placeholder 是常见偷懒 commit subject。**绝不能直接跳过**, 必须钻进去看:

```bash
git show --stat <HASH>          # 看改了哪些文件
git show <HASH> -- <key-file>   # 看实际改动
```

把 placeholder 拆成"实际改了什么":
- `update` → `/globe` 3D 地球初版 903 行
- `1` → FrameCountPage / useFrameBuffer 大改 224 行
- `i18n` → trainer LangToggle + 113 行词条

**经验法则**: 大日子 (>20 commits) 里很可能藏着 `update` placeholder 包了几百到几千行的新页/新组件。**漏掉 = 当天 entry 写错**。

### Step 5: 逐日总结 — 写法

**严格遵守**:
- **1 行**, zh 一行 + en 一行
- 多个主题用 ` + ` (前后空格) 串联
- 涉及具体组件/页面写出名字 (`/recon`, `Battle`, `AlgInput`, `GlobePage` 等)
- 中文标点 (`,` `:`), commit 引用 (`feat(xxx):`) 内保持英文
- 不用 emoji
- 不用句号收尾

**禁止**:
- 主观修辞: "史诗" / "Epic" / "大日" / "multi-event" / "大改造" / "大重构日" / "全量上线" / "喷涌日" / `!`
- 泛词: "小修" / "持续迭代" / "收尾" / "微调" / "大改" → 必须具体到组件
- 厂商身份: "阿里" / "阿里云" / "Alibaba" → 一律 "自有云服务器" / "self-hosted VM"

**好示例** (客观陈述):
```json
{"date":"2026-04-27","zh":"/timer 116 commits 一天: BLD/分阶段 timing + 智能立方蓝牙 + 3D 预览 + WCA inspection + share URL + 全套移动适配 + CFOP 多阶段 + cstimer 算法引擎 port + 5 个蓝牙协议 + shared components 第一波 (EventIcon / EventSelect / RecordSelect / RecordBadge 抽出)","en":"/timer 116-commit day: BLD/stage timing + smartcube BT + 3D preview + WCA inspection + share URL + mobile polish + CFOP multi-stage + cstimer gSolver port + 5 BLE protocols + shared-components first wave (EventIcon / EventSelect / RecordSelect / RecordBadge extracted)"}

{"date":"2026-05-06","zh":"三件迁移同日完成: MariaDB → PostgreSQL 13 + 41 个 alg JSON → DB + 宝塔/PHP/WP 全卸 (云服务器只剩 nginx + Node + PG)","en":"Three migrations the same day: MariaDB → PostgreSQL 13; 41 alg JSONs → DB; baota/PHP/WP wiped (VM now runs only nginx + Node + PG)"}

{"date":"2026-04-13","zh":"Frame Count 更新: A 键倒退去重帧 fix + IndexedDB 记住最近 20 个 FileSystemDirectoryHandle MRU 目录 + 缩略图改两阶段 + 300 MB 预算自适应分辨率 + 视频 wrapper 双指 pinch 缩放","en":"Frame Count update: A-key backward-step duplicate-frame fix + IndexedDB MRU memory of last 20 FileSystemDirectoryHandle dirs + two-phase thumbnail strategy + 300 MB-budget adaptive thumbnail resolution + two-finger pinch zoom"}
```

**坏示例** (改写它们):
```
❌ "记录徽章 / 列宽 / 移动端阻 zoom 等小样式修"
✓ "legacy /recon PHP 列表 UI 收尾: colgroup 宽度 + 小 idx 列 + 缩小国旗与纪录角标 + i18n 自动追加 ?lang= 到 URL"

❌ "Frame Count UI 迭代"
✓ "Frame Count 加 timestamp 起表帧反推法 + 每个 Solve 自带 time 字段重构 + Mark 三角条 + Solve bands"

❌ "收尾 / 小修"
→ 钻进 diff 看, 几乎一定有具体新增 / 修复; 如果真的只是琐碎, 那天就跳过别凑
```

### Step 6: 给用户预览

把待加 entry **全部一次性贴出来** (date | zh | en 三列), 不要分批。让用户审, 同意了再写盘。

### Step 7: 审 TIMELINE 列表 (产品视角)

读完所有新 commits 后, **必做**: 扫一遍这批里有没有任何符合以下条件的事件 → 都要加进 TIMELINE 数组:

**必加 (新页面/卡片/路由)**:
- 任何 LandingPage 卡片首次上线 (`/timer`, `/globe`, `/frame-count`, `/algdb`, `/memo`, `/notation`, `/code`, `/alg/commutator` 等都对应一条)
- 任何新顶层路由首次上线 (`/wca-stats/historical`, `/scramble/solver`, `/calendar/stats` 等子页)
- 单日 ≥3 个新页同时上线 → 合并写成"N 个新页同日上线"
- 重要 sub-page 第一次上线 (eg. /memo/colpi 是 /memo 的核心子页)

**必加 (整体迁移 / 架构变更)**:
- database / framework / runtime 换栈 (MariaDB→PG, Fastify→Hono, jQuery→React monorepo)
- 整片基础设施变更 (卸宝塔, 整站静态化, deploy 流程换)
- 重要 dev-flow 修复 (HMR 之类影响每天体验的)

**酌情加**:
- 大模块重构 (eg. /persons 重构成 8 sections + 月级 rank 图)
- 单日 50+ commits 全 scope 同一模块 (eg. /timer 4-27 的 116 commits)

**不加**:
- 单个组件抽出 (除非整片 design system 第一波)
- bug 修复 (除非颠覆性 — eg. 把整套 SQL 改派生表 + late join)
- 文案 / i18n / 小样式 / 重命名 / 数据更新

### Step 8: 审 LandingPage + App.tsx 路由

加 TIMELINE 前**必查一次**:
```bash
grep -nE "id:|href:" core/packages/client/src/pages/LandingPage.tsx | head -100
grep -nE "path=" core/packages/client/src/App.tsx
```

确保新 batch 里上线的页/卡片/子路由**没有遗漏**。如果 LandingPage 有卡片 timeline 里找不到上线日 → 用 `git log --follow --diff-filter=A --format='%ad' --date=short -- <page-file>` 找首次 add 日期, 补到 TIMELINE。

### Step 9: TIMELINE 数组 schema

`TIMELINE: TLEntry[]` 在 `ArchitecturePage.tsx`, schema:

```ts
interface TLEntry {
  date: string;        // YYYY-MM-DD 或 'YYYY-MM' 或 'YYYY-MM-DD ~ DD' 区间
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
}
```

- **顺序**: 数组**降序** (newest first), 新条目插到**最前**
- **tag 选**:
  - `migration` = 换栈 / 数据迁移 (Hono, PG, alg JSON→DB)
  - `dx` = 开发流程修 (HMR, typecheck, /code/architecture 重写)
  - `feature` = 新模块 / 工具上线 / 新页面 (/timer, /frame-count, /globe, /memo, /alg/commutator 等)
  - `infra` = 部署 / SSL / nginx / panel 拆 (宝塔卸, Stats CI 管道, 项目诞生)

**title** 写法 (客观陈述, 不要修辞):
- ✓ "/alg/commutator 换位分解工具上线"
- ✓ "三件迁移同日完成 (PG / alg DB / 卸宝塔)"
- ✓ "/code 编程语言入门站上线 (9 种语言一次上)"
- ✓ "单日 7 个独立功能上线 (/memo / /scramble Hub / 7 张 stat 子页 / /recognize 路由 / +3 lang)"
- ❌ "'大重构日':三件大事一起做"
- ❌ "WCA Stats 大扩张"
- ❌ "/timer 史诗一天 (116 commits)!"

**body** 1-2 句概述, **expand** 展开因果/上下文/串联。

### Step 10: 已有 TIMELINE 条目 (24+ 条 calibration)

新 entry 插入参考已有条目 (newest first):
- 2026-05-12: HMR 三入口 + dev.cuberoot.me 隧道 + /code/architecture 重写 (dx)
- 2026-05-10: /alg/commutator 换位分解工具 (feature)
- 2026-05-08: 单日 7 个独立功能 (/memo / scramble hub / 7 stat 子页 / recognize / +3 lang) (feature)
- 2026-05-07: /code 9 种语言一次上 (feature)
- 2026-05-06: 三件迁移同日 (PG / alg DB / 卸宝塔) (migration)
- 2026-05-03: 6 个新页同日上线 + VisualCube 服务化 (feature)
- 2026-04-30~05-01: /prediction + /algdb + /calendar 列表 (feature)
- 2026-04-26~27: /timer 上线 + 116 commits 增强日 (feature)
- 2026-04-24~25: 5 个新页两天 (/sites /mosaic /nemesizer /persons /wb) (feature)
- 2026-04-23: /alg 教程 SPA (后改名 /tutorial) (feature)
- 2026-04-22: /scramble-stats 打乱难度分布 (feature)
- 2026-04-16~18: /globe 地球页 + Landing 重写 (feature)
- 2026-04-06~16: /frame-count 10 天迭代成型 (feature)
- 2026-04: typecheck 切到 tsc -b (dx)
- 2026-03-24: Fastify → Hono (migration)
- 2026-03-23: React + TS monorepo + cubing.js (migration)
- 2026-03-21: /viz 成绩分布页 (feature)
- 2026-03-12~15: 第一轮工具 (HTH Calc / Alg-Trainers / csTimer / 1v1 Battle) (feature)
- 2026-03-04: Firestore → PHP + MariaDB (migration)
- 2026-02-27: /recon Phase 1 + WCA OAuth (feature)
- 2026-02-26: Upcoming Comps 比赛追踪 (feature)
- 2026-02-18: 第一个 Landing 双卡 (feature)
- 2026-02-17: WCA Statistics 周更管道 (infra)
- 2025-12-13: 项目诞生 (infra)

平均**约 1 周一件**, 不是月级稀疏。新 batch 里大概率有 1-3 件值得加。**宁多勿少** — 用户翻列表想看到每个新页的上线日。

### Step 11: 给用户预览候选 TIMELINE entry

新 entry 单独一段贴出来让用户审。问 3 件事:
1. 加哪几条? (默认全加, 让用户筛掉)
2. 措辞要不要改?
3. tag 选得对吗?

### Step 12: 写盘

#### 12a. 日历 JSON
1. 读现有 `timeline_commits.json`
2. 新 entries append 到末尾 (升序)
3. `Write` 整个文件

#### 12b. TIMELINE 数组
1. `Edit` `ArchitecturePage.tsx`, 在 `const TIMELINE: TLEntry[] = [` 之后**最顶端**插入新条目 (newest first)
2. 留意逗号 / 缩进 / TypeScript 类型对齐
3. 跑 `pnpm --filter @cuberoot/client typecheck` 兜底 (改 TSX 一定要跑)

### Step 13: 报告

- "已补 N 条 entry 到 JSON, 范围 YYYY-MM-DD ~ YYYY-MM-DD"
- "TIMELINE 加了 M 条" (列出各条标题)
- 跳过的纯噪音日数量

## 修旧条目: 当批次跨多日且 placeholder 多时

如果调研发现**之前的** entry 写得太单薄 (eg. 漏写了藏在 placeholder commit 里的整页上线), 应该**改写已有 entry**而不是只追加新 entry。例:
- 原 entry: "/calendar 列表视图 + 范围过滤 + 每项目轮次 chip"
- 调研发现同日还有 /prediction 初版 + ClearButton 抽组件 + CuberSearchInput 新组件 (都藏在 placeholder 里)
- 改写: "/prediction 项目理论极限上线 (PredictionPage 667 行 + EventSection 317 行 + charts.tsx 315 行) + /calendar 列表视图 + 范围过滤 + 每项目轮次 chip + ClearButton 抽组件 + CuberSearchInput 207 行新组件"

## 重要细节

- 时间锚: 当天日期从 `currentDate` 系统提示或 `date +%Y-%m-%d`, 别用记忆里的旧日期
- 如果 `LAST_DATE` 之后没新 commit, 告诉用户 "没新提交, 不用更新", 退出
- 跳过 >3 天纯噪音时, 在最后简短报告一下 "中间 N 天全是 CI/auto 提交, 跳了"
- 用户没明确要求 commit 时**不要主动** `git add / git commit / git push`, 等用户说

## 验收

`/code/architecture` 第 11 节:
- 日历视图: 新日期出现日期数字 + 总结文字, 每个有 commit 的日子都有内容
- 列表视图: 新增条目 tag 颜色对, 点开 expand 看详情对, 头部 "List · N 件重大" 数字反映新长度
