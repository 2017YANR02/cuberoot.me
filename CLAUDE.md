# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库布局

仓库根是 GitHub Pages 站点（`ruiminyan.github.io`），同时托管：

1. **根目录的静态 HTML/JS**（来自多个 fork）—— 只读，不改。
2. **`core/`** — pnpm + Turbo monorepo，所有新开发都在这里：
   - `packages/client` — React 19 + Vite 8 SPA（主要工作区）
   - `packages/server` — Hono + MariaDB（WCA OAuth + 训练数据，部署到 ECS）
   - `packages/shared` — 共享类型 + 公式数据（PLL / ZBLL / ZBLS JSON）
   - `packages/stats-build` — WCA 统计生成管道（独立 CI 周更）
   - `packages/stats-ui` — 统计页 UI

## 12 个模块的归属（重要）

首页（`LandingPage.tsx`）列出 12 个入口。部分是 fork 来的别人的代码，**不能改**：

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态 HTML | fork of [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) | ❌ upstream |
| Alg Trainer | `/alg-trainers` | 根目录静态 HTML | fork of [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) | ❌ upstream |
| csTimer | `/cstimer` | 根目录 `/cstimer/` | integrated from [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) | ❌ upstream |
| WCA Stats（数据管道） | `/wca-stats` | `core/packages/stats-build` | 基于 [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics) 的 TS 重写 | ⚠️ 管道已重写，UI 自有 |
| Score Calculator (HTH) | `/calc` | `core/packages/client/src/pages/calc/` | ported from [carykh/hthgrapher](https://github.com/carykh/hthgrapher) | ✅ 已 port 为 React |
| 1v1 Battle | `/battle` | `core/packages/client/src/pages/battle/` | ported from [MatteoColombo/cube_challenge_timer](https://github.com/MatteoColombo/cube_challenge_timer) | ✅ 已 port 为 React |
| Recon | `/recon` | `core/packages/client/src/pages/recon/` | 自有 | ✅ |
| Trainer（PLL/OLL/ZBLL/ZBLS 识别） | `/trainer` | `core/packages/client/src/pages/` (Zbll*/Zbls*/OllTraining/CaseSelect) | 自有 | ✅ |
| Frame Count | `/frame-count` | `core/packages/client/src/pages/frame-count/` | 自有（WebCodecs + mp4box.js） | ✅ |
| Distribution | `/viz` | `core/packages/client/src/pages/viz/` | 自有 | ✅ |
| Upcoming Comps | `/upcoming-comps` | `core/packages/client/src/pages/UpcomingCompsPage.tsx` | 自有 | ✅ |
| Scramble（打乱难度分布） | `/scramble-stats` | `core/packages/client/src/pages/scramble_stats/` + 数据 `stats/data/scramble/*.json` | 自有（源自 `D:\cube\solver` C++ 分析器产出的 CSV） | ✅ |
| Mosaic（魔方马赛克生成） | `/mosaic` | `core/packages/client/src/pages/mosaic/` | ported from [Roman-/mosaic](https://github.com/Roman-/mosaic) | ✅ 已 port 为 React |
| Blog | `cuberoot.me/blog/` | 不在本仓库 | 外部托管 | — |

改 upstream 模块前先问用户；要改就只改 fork 后新增/包装的部分。

## 开发命令

包管理用 **pnpm 10**（不是 npm）。Windows 下按全局规则用 `pwsh`。

```bash
# 所有命令直接在仓库根或 core/ 下运行，不要加 cd core（CWD 已经是 core/）
pnpm install
pnpm --filter @cuberoot/client dev            # http://127.0.0.1:5173/
pnpm --filter @cuberoot/client typecheck      # tsc -b（incremental，~12s 首次 / 后续略快）
pnpm --filter @cuberoot/client typecheck:ci   # tsc -b --force（清缓存全量，对齐 CI）
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/client lint
```

> **重要 — Claude 易犯的错误：**
> 1. **不要用 `cd core &&`**：session CWD 已经是 `core/`，再 cd 会 "No such file or directory"。
> 2. **路径前缀也不能加 `core/`**：CWD 已是 `core/`，所以写 `packages/client/...` 而不是 `core/packages/client/...`；写 `ls packages/stats-build/database.yml` 不是 `ls core/packages/stats-build/database.yml`。**因路径错而看不到文件 ≠ 文件不存在,先核对 CWD 再下结论**。
> 3. **类型检查只有一档了**（历史教训：以前的 `typecheck` 走根 `tsconfig.json` 即 `files: []` references-only 壳，`tsc --noEmit` 实际什么都没检查，typo 静默过；2026-04 改为 `tsc -b`）。日常和 push 前都跑 `typecheck`；`typecheck:ci` 加 `--force` 是 CI 用的清缓存全量。
> 4. **磁盘不够必须停下来告诉我**（worktree / pnpm install / build 失败时先 `df -h` 再求助，别静默换方案）。
> 5. **Dev server 我已经在跑,不要 `pnpm dev`**：`http://127.0.0.1:5173/` 永远开着,要验证直接 playwright 打开;别后台启 dev,会因端口占用立刻挂。

- Dev server 绑定 `127.0.0.1`（Vite 默认 IPv6 `[::1]` 在 Windows Chrome 下打不开，已在 `vite.config.ts` 固定）
- Recon API 通过 Vite proxy 转发到 `www.cuberoot.me`，**本地开发不需要跑后端**
- `serveRepoRoot` Vite 插件从仓库根 serve `/tools/`、`/stats/`、以及 upstream 静态页

## 代码风格

- 响应简洁，不加多余注释，不做超出需求的抽象
- 不新建文件除非必要，优先编辑已有文件
- 改完跑 `pnpm --filter @cuberoot/client typecheck`（push 前 `typecheck:ci`）
- UI 不用 emoji，用 lucide-react 图标
- 不放页面级"返回"按钮，浏览器自带 back 即可（wizard 步骤间 / 模式切换不算）
- 选择型输入框（CountryInput / CompPicker / EventSelect 等"有选中态保留显示"的搜索框）有非空值时必须显示 `×` 清除按钮（参考 CountryInput / CompPicker 实现）
- WCA 历史时间锚点：第 1 场比赛 1982-06-05（WC1982），第 2 场 2003-08-23~24（WC2003）；任何"时间序列展示"（折线 / 热力图 / 时间轴 / bar chart race）默认视图从 **2003-08-22** 起步（WC2003 前夜：第 0 帧 = 1982 那场的全部成绩快照，再往后才是 WCA 复办之后的逐日演化），但**统计聚合（总数 / 国家排行 / 项目场次等）必须包含 1982 那场**（用户没主动缩放时口径=全时段，不要把"默认视图≠全数据"的不一致带到数字上）

## 专题知识 — 查对应 Skill

这些主题每次出现时，**主动调用对应 skill** 读取详细规则，不要凭记忆：

| 主题 | Skill | 什么时候用 |
|---|---|---|
| 选手名渲染（括号中文） | `cuber-name-display` | 任何展示 WCA person 名的地方 |
| 国旗渲染 | `country-flag` | 任何展示国旗的地方（JSX / popup innerHTML）；统一走 `utils/flag.tsx` 的 `<Flag>` 或 `flagHtml`；TW 特判只在这一处 |
| WCA 项目图标 | `wca-event-icon` | 任何渲染 WCA 项目名的地方（卡片 / 表格 / 条形 / chip）；项目名前必须有 `<EventIcon>`，纯文字是 bug |
| 比赛日期区间展示 | `comp-date-range` | 任何显示 `start_date` / `end_date` 对的地方；紧凑格式 `2026-06-06~07` |
| 中国比赛名中文化 | `cn-comp-names` | 中文模式下比赛名；`comp_names_zh.json` 数据问题 |
| Competition JSON 数据源 | `comp-data-schema` | 改 upcoming/past comps 相关代码 |
| 新增 public 静态资源 | `deploy-public-asset` | 加 geojson / 图片 / 纹理 / wasm 等；双 workflow 白名单 |
| 重跑统计数据 | `stats-build` | 修改 `stats/data/*.json` 生成器；新增 stat |
| 写 WCA SQL（本地 dump） | `wca-stats-db` | 任何写针对 `wca_statistics` MySQL 的 SQL — schema snake_case、persons.sub_id=1、events.rank<900、成绩值编码、records 标记 |
| 重跑打乱分布 | `scramble-stats-build` | 修改 `stats/data/scramble/*.json`；WCA 配色 / 阶段-朝向 schema / pair CSV 特殊记号 |
