<div align="center">

# 🧩 CubeRoot

### Solve · Train · Analyze

**Solvers, trainers, analytics, and stats for the Rubik's Cube — all in your browser.**

[**🌐 Open the site →**](https://cuberoot.me/)


</div>

---

## 🏗️ Architecture

```
cuberoot.me/
├── core/                          # pnpm + Turbo monorepo (all new work lives here)
│   └── packages/
│       ├── client/           # React 19 + Next.js 16 (App Router) ← primary workspace
│       ├── client/                # React 19 + Vite 8 SPA (retired, local fallback only)
│       ├── server/                # Hono + PostgreSQL 13 (WCA OAuth + user data + alg DB)
│       ├── shared/                # Shared types
│       ├── stats-build/           # WCA statistics pipeline (weekly CI)
│       ├── visualcube/            # In-house NxN cube SVG renderer
│       └── ...                    # alg-build, scramble-stats-build, wb-build, vendor-sr-puzzlegen
├── stats/                         # Generated stats JSON (committed)
├── cstimer/                       # Integrated csTimer (upstream)
└── *.html                         # Legacy static pages (upstream forks)
```

- **Frontend**: React 19 + Next.js 16 (App Router, Turbopack), TypeScript, react-i18next (EN/ZH). Legacy Vite 8 SPA kept only as a local fallback.
- **Backend**: Hono + PostgreSQL 13, fronted by nginx
- **Pipeline**: TypeScript + MySQL (WCA dump) via GitHub Actions, weekly refresh
- **Hosting**: self-hosted nginx + Vercel edge (DNS split-routing)

---

## 🚀 Local development

Requires **pnpm 11** and **Node 20+**.

```bash
pnpm install

# Dev server at http://127.0.0.1:3000/
pnpm --filter @cuberoot/client dev

# Type check (fast, daily — tsgo native)
pnpm --filter @cuberoot/client typecheck

# Type check (tsc -b incremental, when in doubt)
pnpm --filter @cuberoot/client typecheck:tsc

# Production build
pnpm --filter @cuberoot/client build
```

The backend API is proxied to production via Next.js rewrites, so you can develop the full app without running the backend locally.

---

## 🌏 Internationalization

Every user-facing tool ships in **English** and **简体中文**, switchable from the toggle in the top-right corner of every page. Cubing notation (R, U, F2, y'…) stays in English by convention.

---

## 🙏 Credits

This project stands on the shoulders of excellent open-source work. See the full list at [**cuberoot.me/about**](https://cuberoot.me/about).

---

## 📄 License

See [LICENSE](./LICENSE). Individual upstream modules retain their original licenses.
