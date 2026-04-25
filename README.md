<div align="center">

# 🧩 CubeRoot

### Solve · Train · Analyze

**A modern Rubik's Cube toolkit — solvers, trainers, analytics, and stats, all in your browser.**

[**🌐 Open the site →**](https://ruiminyan.github.io/)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

---

## ✨ What's inside

A growing suite of speedcubing tools, organized as a single SPA on top of a pnpm + Turbo monorepo.

### 🎯 Train & Analyze

| Tool | Path | What it does |
|---|---|---|
| **Trainer** | [`/trainer`](https://ruiminyan.github.io/trainer) | PLL / OLL / ZBLL / ZBLS recognition trainers |
| **Frame Count** | [`/frame-count`](https://ruiminyan.github.io/frame-count) | Frame-accurate timing from solve videos (WebCodecs + mp4box) |
| **Recon** | [`/recon`](https://ruiminyan.github.io/recon) | Solve reconstruction with step-by-step playback |
| **Calculator** | [`/calc`](https://ruiminyan.github.io/calc) | Head-to-Head Ao5 projection & visualization |
| **Distribution** | [`/viz`](https://ruiminyan.github.io/viz) | Watch result distributions evolve over time |
| **Battle** | [`/battle`](https://ruiminyan.github.io/battle) | 1v1 head-to-head timer with penalties & best-of-N |

### 🏆 Competition data

| Tool | Path | What it does |
|---|---|---|
| **WCA Stats** | [`/wca-stats`](https://ruiminyan.github.io/wca-stats) | 80+ auto-generated rankings from the WCA database, updated weekly |
| **Upcoming Comps** | [`/upcoming-comps`](https://ruiminyan.github.io/upcoming-comps) | Worldwide competition calendar with event filters |
| **Globe** | [`/globe`](https://ruiminyan.github.io/globe) | 3D globe view of past & upcoming competitions |
| **Scramble** | [`/scramble-stats`](https://ruiminyan.github.io/scramble-stats) | Difficulty distribution of WCA scrambles by event & stage |

### 🛠️ Classics

| Tool | Path | Source |
|---|---|---|
| **Solver** | [`/solver`](https://ruiminyan.github.io/solver/) | Cross / XCross / F2L pair / EOCross / LL — fork of [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) |
| **Alg Trainer** | [`/alg-trainers`](https://ruiminyan.github.io/alg-trainers) | Cross / XCross / Pseudo / EOCross — fork of [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) |
| **csTimer** | [`/cstimer`](https://ruiminyan.github.io/cstimer/) | Integrated [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) |
| **Mosaic** | [`/mosaic`](https://ruiminyan.github.io/mosaic) | Rubik's Cube mosaic generator — ported from [Roman-/mosaic](https://github.com/Roman-/mosaic) |
| **Web Directory** | [`/site`](https://ruiminyan.github.io/site) | Curated links to the wider cubing web |

---

## 🏗️ Architecture

```
ruiminyan.github.io/
├── core/                          # pnpm + Turbo monorepo (all new work lives here)
│   └── packages/
│       ├── client/                # React 19 + Vite 8 SPA
│       ├── server/                # Hono + MariaDB (WCA OAuth + user data)
│       ├── shared/                # Shared types + algorithm datasets
│       ├── stats-build/           # WCA statistics pipeline (weekly CI)
│       └── stats-ui/              # Stats page UI
├── stats/data/                    # Generated stats JSON
├── cstimer/                       # Integrated csTimer (upstream)
└── *.html                         # Legacy static pages (upstream forks)
```

- **Frontend**: React 19, Vite 8, TypeScript, react-i18next (EN/ZH), react-router
- **Backend**: Hono on Cloud ECS, MariaDB
- **Pipeline**: TypeScript + MySQL via GitHub Actions, weekly refresh
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

This project stands on the shoulders of excellent open-source work:

- [**or18/RubiksSolverDemo**](https://github.com/or18/RubiksSolverDemo) — 3×3 solver & trainer pages, PWA scaffolding
- [**jonatanklosko/wca_statistics**](https://github.com/jonatanklosko/wca_statistics) — statistics engine, SQL queries, plugin framework (TS rewrite)
- [**mihlefeld/Alg-Trainers**](https://github.com/mihlefeld/Alg-Trainers) — algorithm trainer pages
- [**carykh/hthgrapher**](https://github.com/carykh/hthgrapher) — Head-to-Head Ao5 calculator (React port)
- [**MatteoColombo/cube_challenge_timer**](https://github.com/MatteoColombo/cube_challenge_timer) — 1v1 battle timer logic (React port)
- [**cs0x7f/cstimer**](https://github.com/cs0x7f/cstimer) — professional speedcubing timer & WCA random-state scramble engine
- [**Roman-/mosaic**](https://github.com/Roman-/mosaic) — cube mosaic generator (React port)
- [**MeigenChou/DCTimer-Android**](https://github.com/MeigenChou/DCTimer-Android) — design inspiration for the battle timer
- [**catdad/canvas-confetti**](https://github.com/catdad/canvas-confetti) — celebration effects

---

## 📄 License

See [LICENSE](./LICENSE). Individual upstream modules retain their original licenses.
