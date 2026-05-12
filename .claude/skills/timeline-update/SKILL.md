---
name: timeline-update
description: "Use when user wants to fill in /code/architecture 第 11 节的日历 + 列表 — 从 JSON 最后一条日期之后开始, 把未覆盖的每一天都补上中英 1 行总结 (日历); 若该批 commits 里有重大事件, 也建议加进 TIMELINE 数组 (列表)。Triggers: \"/timeline-update\", \"更新 timeline\", \"补日历\", \"补 timeline\", \"update commit calendar\"."
---

# /timeline-update — 补 /code/architecture 日历 + 列表

## 用途

`/code/architecture` 第 11 节有两个视图, 数据源不同:
- **日历视图** (默认) → `core/packages/client/src/pages/code/timeline_commits.json` (按日 1 行 zh+en, 含琐碎)
- **列表视图** → `core/packages/client/src/pages/code/CodeArchitecturePage.tsx` 里的 `TIMELINE` 数组 (人工 curate 的 14 件大事件, 每条带 expand 详情)

这个 skill 流程化两件事:
1. **必做**: 把日历 JSON 补到当天 (逐日总结)
2. **酌情**: 若这批 commits 里有 AI 判定的"重大"事件, 也建议加进 TIMELINE 列表 (用户审过再写)

## 输入 / 输出

- **输入**: 无显式参数。Skill 自己从 `timeline_commits.json` 推断起始日期。
- **输出**: 修改后的 `timeline_commits.json` (append-only, 按日期升序末尾追加)。

## 文件 schema

```json
[
  { "date": "YYYY-MM-DD", "zh": "中文一行", "en": "English one-liner" }
]
```

- 整个文件是 array, 按日期**升序** (oldest first, newest last)
- 每条 zh + en 一行总结那一天的主要改动
- **每天只有 1 条 entry** (不像更早的版本支持 3 个 chips)
- 没 commit 的日子 (或当天只有琐碎自动 commits) **不加 entry, 跳过**

## 工作流

### Step 1: 读最后一天

```bash
node -e "const d=require('./core/packages/client/src/pages/code/timeline_commits.json'); console.log(d[d.length-1].date)"
```

记为 `LAST_DATE`。

### Step 2: 拉 git log

```bash
git log --format='%ai|%s' --since=<LAST_DATE+1day>
```

把当天 commits 按日期 group。

### Step 3: 跳过琐碎日

如果某天的全部 commits 都匹配以下 SKIP pattern, **整天 skip 不加 entry**:
- `^chore: update (wca|upcoming)` (case-insensitive — git log 里大小写都会出现)
- `^Merge (branch|pull)`
- `^Update [a-zA-Z_./-]+\.(md|html|json)$` (single-file rename/touch)
- `^Add files via upload`
- `^Delete `, `^Create `
- `ci: rebuild SPA from core/` (CI auto-rebuild noise)
- `^backup:` ([skip ci] backup commits)
- `^update$`, `^1$`, `^i18n$` (单字 placeholder messages — 别的 AI commit 习惯)

判定为"实质性":至少一条 commit 是 `feat` / `refactor` / `perf` / `fix(...具体 scope)` / `i18n:` / 非 trivial 的 unprefixed message。

### Step 4: 逐日总结

**写法风格** (严格遵守):
- **1 行**, zh 一行 + en 一行
- zh 中文叙述, en 英文叙述, 信息对齐
- 多个主题用 ` + ` (前后空格) 串联
- 史诗日 (>50 commits) 在标题里加 ` (NN commits)`
- 千万**禁止**出现:
  - "阿里" / "阿里云" / "Alibaba" — 一律替换 "自有云服务器" / "self-hosted VM"
- 多模块齐进 → 用 ` + ` 串;同模块多 phase → 写 "Phase X-Y" 之类
- 出现已知"大事件"(MariaDB→PG, alg JSON→DB, Hono ↑, etc.) 时, 可以参考 `[[reference_alg_db]]`、`[[reference_post_baota]]` 等 memory 里的因果, 写得更有上下文

**风格示例** (照抄已有, 保持一致):

```json
{"date":"2026-04-27","zh":"/timer 史诗一天 (116 commits)! BLD/分阶段 timing + 智能立方蓝牙 + 3D 预览 + WCA inspection + share URL + 全套移动适配 + CFOP 多阶段 + cstimer 算法引擎 port + 5 个蓝牙协议","en":"/timer epic day (116 commits)! BLD/stage timing + smartcube BT + 3D preview + WCA inspection + share URL + mobile polish + CFOP multi-stage + cstimer gSolver port + 5 BLE protocols"}

{"date":"2026-05-06","zh":"大重构日! MariaDB → PostgreSQL 13 + 41 个 alg JSON → DB + 宝塔/PHP/WP 全卸 + ZBLS docx scrape + nginx vhost 入 git","en":"Great Refactor day! MariaDB → PostgreSQL 13; 41 alg JSONs → DB; baota/PHP/WP wiped; ZBLS docx scrape; nginx vhost in git"}

{"date":"2026-03-06","zh":"记录徽章 / 列宽 / 移动端阻 zoom 等小样式修","en":"Record-badge / column-width / mobile zoom-block small style fixes"}
```

注意:
- zh 用中文标点 (例如 `,` 和 `:`) 但 commit 引用 (`feat(xxx):`) 内保持英文
- en 用英文标点
- 都不用 emoji
- 别用句号收尾 (照已有风格)

### Step 5: 给用户预览

把待加 entry **全部一次性贴出来** (date | zh | en 三列表格), 不要分批。让用户审, 同意了再写盘。如果用户提出修改 (改某天措辞 / 把某天合并 / 拆 / 跳过), 接受并迭代。

### Step 6: 写盘

确认后:
1. 读取现有 `timeline_commits.json`
2. 把新 entries append 到末尾 (因为升序)
3. `Write` 整个文件
4. 跑 `pnpm --filter @cuberoot/client typecheck` 兜底 (改 JSON 一般不影响 typecheck, 但顺手)

### Step 7: 判断有没有"重大"事件值得进列表

读完所有新 commits 后, 思考: **这批里有没有 AI 判定值得进 14 件大事 TIMELINE 列表的**?

**"重大"的判定标准** (满足任一即可):
- **整体迁移** (database / framework / runtime 换栈, 如 MariaDB → PG, Fastify → Hono, jQuery 静态站 → React monorepo)
- **新顶层 page / 主功能模块上线** (如 /timer, /viz, /algdb, /scramble/solver — 单日 50+ commits 全 scope 同一 module 的史诗日基本都算)
- **整片基础设施变更** (如卸宝塔/PHP, 整站静态化, 后端架构换栈, deploy 流程换)
- **重要 dev-flow 修复** (HMR 之类影响每天体验的)

**不算**:
- 单 feature 新增 (除非是整页新模块)
- bug 修复 / 性能调优 (除非颠覆性, 比如把整套 SQL 改派生表 + late join 那种全局影响)
- 文案 / i18n / 小样式 / 重命名
- "工具上线"但只是 fork / iframe 包装 (像 csTimer 集成虽算 own 之外, 但还是只算 feature 不算 migration)
- 数据更新 / 重生成

**已有 14 件大事日期参考** (帮判 calibration):
2026-05-12 (HMR + 这页重写) / 2026-05-08~09 (WCA Stats 扩张) / 2026-05-06 (大重构日) / 2026-05-03 (VisualCube 服务化) / 2026-04-23~28 (二轮工具) / 2026-04 (typecheck) / 2026-03-24 (Hono) / 2026-03-23 (monorepo) / 2026-03-12~15 (一轮工具) / 2026-03-04 (PHP+MariaDB) / 2026-02-27 (Recon Phase 1) / 2026-02-18 (Landing) / 2026-02-17 (Stats 管道) / 2025-12-13 (诞生)

→ 大约平均 **2-4 周一件**。如果新一批里有事件够这个层级, 加 1-2 条;若全是日常迭代, **0 条也很正常**, 别强行凑。

### Step 8: TIMELINE 数组 schema (若 Step 7 有命中)

`TIMELINE: TLEntry[]` 在 `CodeArchitecturePage.tsx`, schema:

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
  - `dx` = 开发流程修 (HMR, typecheck, 这页重写)
  - `feature` = 新模块 / 工具上线 (/timer 史诗日, monorepo, WCA Stats 扩张)
  - `infra` = 部署 / SSL / nginx / panel 拆 (宝塔卸, Stats CI 管道, 项目诞生 entry)
- **title**: 跟日历总结类似但更"标题化", 不写一长串具体技术, 突出**这件事是什么**
- **body**: 1-2 句概述, 别太长
- **expand**: 展开后的因果 / 上下文 / 跟其他大事件的串联 (像"半个月内换了三次后端" 这种)

**风格示例** (照 TIMELINE 已有):

```ts
{
  date: '2026-05-06',
  tag: 'migration',
  zh: {
    title: '"大重构日":三件大事一起做',
    body: '同一天完成:MariaDB → PG 13 整体迁移 / 41 个 alg JSON 进 PG / 宝塔 + PHP + WP 全卸...',
    expand: 'PG 迁移用 jsonb / window function / partial index 让...; pg_dump systemd timer ...; Alg 网页可直接编辑 ...; Blog 从 WordPress 迁 Hugo 静态。',
  },
  en: { /* parallel */ },
}
```

### Step 9: 给用户预览候选列表 entry

如果 Step 7 命中, 把候选条目**单独一段**贴出来, 让用户审。问 3 件事:
1. 加哪几条?
2. 措辞要不要改?
3. tag 选得对吗?

如果命中 0 条, 跳过这步, 在最终汇报里说一句 "本批没有 AI 判定的重大事件, 列表不动"。

### Step 10: 写盘

#### 10a. 日历 JSON
1. 读取 `timeline_commits.json`
2. 把新 entries append 到末尾 (升序)
3. `Write` 整个文件

#### 10b. TIMELINE 数组 (若有)
1. `Edit` `CodeArchitecturePage.tsx`, 在 `const TIMELINE: TLEntry[] = [` 之后**最顶端**插入新条目 (newest first)
2. 留意逗号 / 缩进 / TypeScript 类型对齐
3. 跑 `pnpm --filter @cuberoot/client typecheck` 兜底 (改 TSX 一定要跑)

### Step 11: 报告 + 不主动 commit

写完告诉用户:
- "已补 N 条 entry 到 JSON, 范围 YYYY-MM-DD ~ YYYY-MM-DD"
- "TIMELINE 加了 M 条" (若有) OR "TIMELINE 不动" (若无)
- "你审一下要不要 commit" — **不要主动 `git add / git commit`**, 等用户说。

## 重要细节

- **不要碰 chip / tag / sha / GitHub 链接** — 现在的日历就是纯文字, 之前那些都拆了。日历 entry 只有 `{date, zh, en}` 三字段。
- 时间锚: 当天日期从 `currentDate` 系统提示或 `date +%Y-%m-%d` 都行;**别用记忆里的旧日期**。
- 如果 git log 显示当前 `LAST_DATE` 之后**没有任何 commit**, 告诉用户 "没新提交, 不用更新", 退出。
- 如果中间某天用户有 commits 但你判定**全部琐碎** → 不加 entry, **不需要在预览里说"今天跳过"**, 直接漏掉。但如果跳过的天数有 >3 天, 在最后简短报告一下 "中间 N 天全是 CI/auto 提交, 跳了"。
- **TIMELINE 宁缺勿滥**。14 条已经是 5 个月精挑的, 多了不是好事。新增前问自己:"用户翻列表看半年后, 这条对他理解站点演化有不有用?"

## 验收

写完调用方 `/code/architecture` 切到:
- 日历视图 — 新日期出现日期数字 + 总结文字
- 列表视图 — (若有新增) 最顶端出现新 entry, tag 颜色对, 点开 expand 看详情对
