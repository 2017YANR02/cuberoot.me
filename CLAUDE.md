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
pnpm --filter @cuberoot/client typecheck      # 日常快速（tsc --noEmit，~0.4s）
pnpm --filter @cuberoot/client typecheck:ci   # push 前必须（tsc -b，~8s，对齐 CI）
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/client lint
```

> **重要 — Claude 易犯的错误：**
> 1. **不要用 `cd core &&`**：session CWD 已经是 `core/`，再 cd 会 "No such file or directory"。
> 2. **路径前缀也不能加 `core/`**：CWD 已是 `core/`，所以写 `packages/client/...` 而不是 `core/packages/client/...`；写 `ls packages/stats-build/database.yml` 不是 `ls core/packages/stats-build/database.yml`。**因路径错而看不到文件 ≠ 文件不存在,先核对 CWD 再下结论**。
> 3. **类型检查两档**：日常用 `typecheck`（快）；完成阶段性功能、准备 push 时用 `typecheck:ci`（对齐 CI）。**完成一个完整功能后应主动提示跑 `typecheck:ci` 再 push。**

- Dev server 绑定 `127.0.0.1`（Vite 默认 IPv6 `[::1]` 在 Windows Chrome 下打不开，已在 `vite.config.ts` 固定）
- Recon API 通过 Vite proxy 转发到 `www.cuberoot.me`，**本地开发不需要跑后端**
- `serveRepoRoot` Vite 插件从仓库根 serve `/tools/`、`/stats/`、以及 upstream 静态页

## 代码风格

- 响应简洁，不加多余注释，不做超出需求的抽象
- 不新建文件除非必要，优先编辑已有文件
- 改完跑 `pnpm --filter @cuberoot/client typecheck`（push 前 `typecheck:ci`）
- UI 不用 emoji，用 lucide-react 图标
- 不放页面级"返回"按钮，浏览器自带 back 即可（wizard 步骤间 / 模式切换不算）

## 专题知识 — 查对应 Skill

这些主题每次出现时，**主动调用对应 skill** 读取详细规则，不要凭记忆：

| 主题 | Skill | 什么时候用 |
|---|---|---|
| 选手名渲染（括号中文） | `cuber-name-display` | 任何展示 WCA person 名的地方 |
| 国旗渲染 | `country-flag` | 任何展示国旗的地方（JSX / popup innerHTML）；统一走 `utils/flag.tsx` 的 `<Flag>` 或 `flagHtml`；TW 特判只在这一处 |
| 比赛日期区间展示 | `comp-date-range` | 任何显示 `start_date` / `end_date` 对的地方；紧凑格式 `2026-06-06~07` |
| 中国比赛名中文化 | `cn-comp-names` | 中文模式下比赛名；`comp_names_zh.json` 数据问题 |
| Competition JSON 数据源 | `comp-data-schema` | 改 upcoming/past comps 相关代码 |
| 新增 public 静态资源 | `deploy-public-asset` | 加 geojson / 图片 / 纹理 / wasm 等；双 workflow 白名单 |
| 重跑统计数据 | `stats-build` | 修改 `stats/data/*.json` 生成器；新增 stat |
| 重跑打乱分布 | `scramble-stats-build` | 修改 `stats/data/scramble/*.json`；WCA 配色 / 阶段-朝向 schema / pair CSV 特殊记号 |
