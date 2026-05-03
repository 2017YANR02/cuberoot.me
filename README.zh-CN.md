<div align="center">

# 🧩 CubeRoot

### 解法 · 训练 · 分析

**现代魔方工具集 —— 求解器、训练器、数据分析、WCA 统计，全部在浏览器里运行。**

[**🌐 打开网站 →**](https://cuberoot.me/)

中国大陆用户访问 [cuberoot.me](https://cuberoot.me/)，境外用户访问 [ruiminyan.github.io](https://ruiminyan.github.io/) — 两者是同一站点的镜像，内容完全一致。

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

---

## ✨ 功能一览

基于 pnpm + Turbo monorepo 构建的单页应用，覆盖从训练到数据分析的完整链路。

### 🎯 训练与分析

| 工具 | 路径 | 简介 |
|---|---|---|
| **训练器** | [`/trainer`](https://ruiminyan.github.io/trainer) | PLL / OLL / ZBLL / ZBLS 识别训练 |
| **数帧工具** | [`/frame-count`](https://ruiminyan.github.io/frame-count) | 从录像中逐帧计时（WebCodecs + mp4box） |
| **复盘** | [`/recon`](https://ruiminyan.github.io/recon) | 步骤级解法回放与分析 |
| **成绩计算器** | [`/calc`](https://ruiminyan.github.io/calc) | 1v1 Ao5 走势预测与可视化 |
| **分布演变** | [`/viz`](https://ruiminyan.github.io/viz) | 观察成绩分布随时间的演变 |
| **1v1 对战** | [`/battle`](https://ruiminyan.github.io/battle) | 带罚时与 BoN 赛制的对战计时器 |

### 🏆 比赛数据

| 工具 | 路径 | 简介 |
|---|---|---|
| **WCA 统计** | [`/wca-stats`](https://ruiminyan.github.io/wca-stats) | 基于 WCA 官方数据库的 80+ 项自动排名，每周更新 |
| **比赛日历** | [`/upcoming-comps`](https://ruiminyan.github.io/upcoming-comps) | 全球比赛日程，支持项目筛选 |
| **比赛地球** | [`/globe`](https://ruiminyan.github.io/globe) | 3D 地球视图浏览历届与未来赛事 |
| **打乱分布** | [`/scramble-stats`](https://ruiminyan.github.io/scramble-stats) | WCA 打乱按项目和阶段的难度分布 |

### 🛠️ 经典模块

| 工具 | 路径 | 来源 |
|---|---|---|
| **求解器** | [`/solver`](https://ruiminyan.github.io/solver/) | Cross / XCross / F2L pair / EOCross / LL —— fork 自 [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) |
| **公式训练器** | [`/alg-trainers`](https://ruiminyan.github.io/alg-trainers) | Cross / XCross / 伪 / EOCross —— fork 自 [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) |
| **csTimer** | [`/cstimer`](https://ruiminyan.github.io/cstimer/) | 集成 [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) |
| **魔方马赛克** | [`/mosaic`](https://ruiminyan.github.io/mosaic) | 魔方马赛克生成器 —— 移植自 [Roman-/mosaic](https://github.com/Roman-/mosaic) |
| **魔方导航** | [`/site`](https://ruiminyan.github.io/site) | 精选魔方相关网站索引 |

---

## 🏗️ 架构

```
ruiminyan.github.io/
├── core/                          # pnpm + Turbo monorepo（新开发都在这里）
│   └── packages/
│       ├── client/                # React 19 + Vite 8 SPA
│       ├── server/                # Hono + MariaDB（WCA OAuth + 用户数据）
│       ├── shared/                # 共享类型 + 公式数据集
│       ├── stats-build/           # WCA 统计生成管道（每周 CI）
│       └── stats-ui/              # 统计页 UI
├── stats/data/                    # 生成的统计 JSON
├── cstimer/                       # 集成的 csTimer（上游原版）
└── *.html                         # 根目录静态页（上游 fork）
```

- **前端**: React 19, Vite 8, TypeScript, react-i18next（中英双语），react-router
- **后端**: Hono 部署在云服务器, MariaDB
- **数据管道**: TypeScript + MySQL, GitHub Actions 每周跑
- **托管**: GitHub Pages 托管静态资源 + SPA

---

## 🚀 本地开发

需要 **pnpm 10** 与 **Node 20+**。

```bash
pnpm install

# Dev server：http://127.0.0.1:5173/
pnpm --filter @cuberoot/client dev

# 类型检查（日常，快）
pnpm --filter @cuberoot/client typecheck

# 类型检查（对齐 CI，push 前跑）
pnpm --filter @cuberoot/client typecheck:ci

# 生产构建
pnpm --filter @cuberoot/client build
```

Recon 相关 API 在 Vite dev server 里已代理到生产环境，本地开发无需启动后端。

---

## 🌏 多语言

所有自研模块均支持**中英双语**，页脚可一键切换。魔方公式记号（R, U, F2, y' 等）按惯例保留英文。

---

## 🙏 致谢

本项目构建在以下优秀开源项目之上：

- [**or18/RubiksSolverDemo**](https://github.com/or18/RubiksSolverDemo) —— 3×3 求解器与训练器页面, PWA 基础设施
- [**jonatanklosko/wca_statistics**](https://github.com/jonatanklosko/wca_statistics) —— 统计引擎、SQL 查询、插件框架（已 TS 重写）
- [**mihlefeld/Alg-Trainers**](https://github.com/mihlefeld/Alg-Trainers) —— 公式训练器页面
- [**carykh/hthgrapher**](https://github.com/carykh/hthgrapher) —— 1v1 Ao5 成绩计算器（已 React 化）
- [**MatteoColombo/cube_challenge_timer**](https://github.com/MatteoColombo/cube_challenge_timer) —— 1v1 对战计时器逻辑（已 React 化）
- [**cs0x7f/cstimer**](https://github.com/cs0x7f/cstimer) —— 专业魔方计时器与 WCA 随机状态打乱引擎
- [**Roman-/mosaic**](https://github.com/Roman-/mosaic) —— 魔方马赛克生成器（已 React 化）
- [**MeigenChou/DCTimer-Android**](https://github.com/MeigenChou/DCTimer-Android) —— 对战计时器设计灵感
- [**huizhiLLL/WCA-Nemesizer-API**](https://github.com/huizhiLLL/WCA-Nemesizer-API) —— 宿敌关系算法参考实现（已客户端 TS 重写；UI 借鉴 [nemesizer.com](https://nemesizer.com)）

---

## 📄 License

见 [LICENSE](./LICENSE)。各上游模块保留其原始许可证。
