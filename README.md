<div align="center">

# 🧩 CubeRoot

### Solve · Train · Analyze

**Solvers, trainers, analytics, and stats for the Rubik's Cube — all in your browser.**

[**🌐 Open the site →**](https://cuberoot.me/)


</div>

---

## ✨ What's inside

A growing suite of speedcubing tools, organized as a single SPA on top of a pnpm + Turbo monorepo.

### 🎯 Train & Analyze

| Tool | Path | What it does |
|---|---|---|
| **Trainer** | [`/trainer`](https://cuberoot.me/trainer) | PLL / OLL / ZBLL / ZBLS recognition trainers |
| **Frame Count** | [`/frame-count`](https://cuberoot.me/frame-count) | Frame-accurate timing from solve videos (WebCodecs + mp4box) |
| **Recon** | [`/recon`](https://cuberoot.me/recon) | Solve reconstruction with step-by-step playback |
| **Calculator** | [`/calc`](https://cuberoot.me/calc) | Head-to-Head Ao5 projection & visualization |
| **Distribution** | [`/wca/viz`](https://cuberoot.me/wca/viz) | Watch result distributions evolve over time |
| **Battle** | [`/battle`](https://cuberoot.me/battle) | 1v1 head-to-head timer with penalties & best-of-N |

### 🏆 Competition data

| Tool | Path | What it does |
|---|---|---|
| **WCA Stats** | [`/wca`](https://cuberoot.me/wca) | 80+ auto-generated rankings from the WCA database, updated weekly |
| **Upcoming Comps** | [`/upcoming-comps`](https://cuberoot.me/upcoming-comps) | Worldwide competition calendar with event filters |
| **Globe** | [`/wca/globe`](https://cuberoot.me/wca/globe) | 3D globe view of past & upcoming competitions |
| **Scramble** | [`/scramble-stats`](https://cuberoot.me/scramble-stats) | Difficulty distribution of WCA scrambles by event & stage |

### 🛠️ Classics

| Tool | Path | Source |
|---|---|---|
| **Solver** | [`/solver`](https://cuberoot.me/solver/) | Cross / XCross / F2L pair / EOCross / LL — fork of [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) |
| **Alg Trainer** | [`/alg-trainers`](https://cuberoot.me/alg-trainers) | Cross / XCross / Pseudo / EOCross — fork of [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) |
| **csTimer** | [`/cstimer`](https://cuberoot.me/cstimer/) | Integrated [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) |
| **Mosaic** | [`/mosaic`](https://cuberoot.me/mosaic) | Rubik's Cube mosaic generator — ported from [Roman-/mosaic](https://github.com/Roman-/mosaic) |
| **Web Directory** | [`/site`](https://cuberoot.me/site) | Curated links to the wider cubing web |

---

## 🏗️ Architecture

```
cuberoot.me/
├── core/                          # pnpm + Turbo monorepo (all new work lives here)
│   └── packages/
│       ├── client/                # React 19 + Vite 8 SPA
│       ├── server/                # Hono + PostgreSQL 13 (WCA OAuth + user data)
│       ├── shared/                # Shared types + algorithm datasets
│       ├── stats-build/           # WCA statistics pipeline (weekly CI)
│       └── stats-ui/              # Stats page UI
├── stats/data/                    # Generated stats JSON
├── cstimer/                       # Integrated csTimer (upstream)
└── *.html                         # Legacy static pages (upstream forks)
```

- **Frontend**: React 19, Vite 8, TypeScript, react-i18next (EN/ZH), react-router
- **Backend**: Hono on a cloud VPS, PostgreSQL 13
- **Pipeline**: TypeScript + MySQL (WCA dump) via GitHub Actions, weekly refresh
- **Hosting**: GitHub Pages for static assets + SPA

---

## 🚀 Local development

Requires **pnpm 10** and **Node 20+**.

```bash
pnpm install

# Dev server at http://127.0.0.1:5173/
pnpm --filter @cuberoot/client dev

# Type check (fast, daily)
pnpm --filter @cuberoot/client typecheck

# Type check (CI-equivalent, before push)
pnpm --filter @cuberoot/client typecheck:ci

# Production build
pnpm --filter @cuberoot/client build
```

The Recon API is proxied to production via Vite, so you can develop the full SPA without running the backend locally.

---

## 🌏 Internationalization

Every user-facing tool ships in **English** and **简体中文**, switchable from the footer on every page. Cubing notation (R, U, F2, y'…) stays in English by convention.

---

## 🙏 Credits

This project stands on the shoulders of excellent open-source work.

> **单一数据源**:`core/packages/client/src/pages/credits_data.json`(同步 `/about` 页)。
> 改 credits → 改 JSON → 跑 `pnpm --filter @cuberoot/client gen-credits` → commit。

<!-- credits:start -->
- [**or18/RubiksSolverDemo**](https://github.com/or18/RubiksSolverDemo) — 3×3 solver & trainer pages, PWA scaffolding
- [**jonatanklosko/wca_statistics**](https://github.com/jonatanklosko/wca_statistics) — statistics engine, SQL queries, plugin framework (TS rewrite)
- [**mihlefeld/Alg-Trainers**](https://github.com/mihlefeld/Alg-Trainers) — Algorithm trainer pages
- [**carykh/hthgrapher**](https://github.com/carykh/hthgrapher) — Head-to-Head Ao5 calculator (React port)
- [**MatteoColombo/cube_challenge_timer**](https://github.com/MatteoColombo/cube_challenge_timer) — 1v1 battle timer logic (React port)
- [**cs0x7f/cstimer**](https://github.com/cs0x7f/cstimer) — professional speedcubing timer & WCA random-state scramble engine
- [**Roman-/mosaic**](https://github.com/Roman-/mosaic) — Cube mosaic generator (React port)
- [**huazhechen/cuber**](https://github.com/huazhechen/cuber) — virtual cube engine (Three.js cube/cubelet/group/twister/controller core) ported to React for `/stack`; original UI was Vue + Vuetify
- [**MeigenChou/DCTimer-Android**](https://github.com/MeigenChou/DCTimer-Android) — design inspiration for the battle timer
- [**huizhiLLL/WCA-Nemesizer-API**](https://github.com/huizhiLLL/WCA-Nemesizer-API) — nemesis-relation algorithm reference (client-side TS reimplementation; UI inspired by [nemesizer.com](https://nemesizer.com))
- [**roudai/VisualCubeEditor2**](https://github.com/roudai/VisualCubeEditor2) — Vue + sr-visualizer GUI cube image editor; UI replicated in React for the `/visualcube` page (renderer swapped to our `@cuberoot/visualcube` package)
- [**tdecker91/puzzle-gen**](https://github.com/tdecker91/puzzle-gen) — non-cube WCA puzzle SVG renderer (`sr-puzzlegen` on npm; Square-1, Megaminx, Pyraminx, Skewb — iso / net / top variants) used by `/visualcube`
- [**cube.rider.biz/visualcube.php**](https://cube.rider.biz/visualcube.php) — PHP VisualCube (Cride5 / Yan / Kira lineage); source of the URL query API (`pzl`/`alg`/`arw`/`ac`/`view=trans`/`stage` etc), extended mask shapes, and PHP `fcs_format_alg` notation extensions ported into our `@cuberoot/visualcube`
- [**speedcubedb.com**](https://speedcubedb.com/) — algorithm database powering `/algdb` (2x2/3x3/4x4/5x5 alg sets — F2L, OLL, PLL, COLL, ZBLL, 1LLL, OLLCP, VLS, parity, L2E, L2C, …; scraped via `scramble-stats-build/bin/scrape_speedcubedb.ts`)
- [**nbwzx/commutator**](https://github.com/nbwzx/commutator) — commutator decomposition / expansion engine (Zixing Wang) re-wrapped as ES module for the `/alg/commutator` tool; algorithm code unchanged from upstream, UI rebuilt in React
- [**speedsolving.com/wiki: Pretty Pattern**](https://www.speedsolving.com/wiki/index.php/Pretty_pattern) — Pattern algorithms for /patterns
- [**ruwix.com Rubik's Cube Patterns**](https://ruwix.com/the-rubiks-cube/rubiks-cube-patterns-algorithms/) — Pattern algorithms for /patterns
- [**cubing.pro**](https://cubing.pro/) — UI/概念参考来源:`/wca` 子页(历史排名 / 大满贯 / 全部成绩排行 / 当年成绩排行 / 参赛届别排行 / 项目成功率 / 全项目达成 / 全项目排行)+ `/wca/persons/:wcaId` 选手详情页(成绩 / 赛事 / 项目统计 / 里程碑 / 点亮城市)
<!-- credits:end -->

---

## 📄 License

See [LICENSE](./LICENSE). Individual upstream modules retain their original licenses.
