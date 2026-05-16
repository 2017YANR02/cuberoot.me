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
│       ├── client/                # React 19 + Vite 8 SPA
│       ├── server/                # Hono + PostgreSQL 13 (WCA OAuth + user data + alg DB)
│       ├── shared/                # Shared types
│       ├── stats-build/           # WCA statistics pipeline (weekly CI)
│       ├── stats-ui/              # Stats page UI
│       ├── visualcube/            # In-house NxN cube SVG renderer
│       └── ...                    # alg-build, scramble-stats-build, wb-build, vendor-sr-puzzlegen
├── stats/                         # Generated stats JSON (committed)
├── cstimer/                       # Integrated csTimer (upstream)
└── *.html                         # Legacy static pages (upstream forks)
```

- **Frontend**: React 19, Vite 8, TypeScript, react-i18next (EN/ZH), react-router
- **Backend**: Hono + PostgreSQL 13, fronted by nginx
- **Pipeline**: TypeScript + MySQL (WCA dump) via GitHub Actions, weekly refresh
- **Hosting**: self-hosted nginx (primary) + GitHub Pages mirror

---

## 🚀 Local development

Requires **pnpm 11** and **Node 20+**.

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

This project stands on the shoulders of excellent open-source work. See the full list at [**cuberoot.me/about**](https://cuberoot.me/about).

---

## 📄 License

See [LICENSE](./LICENSE). Individual upstream modules retain their original licenses.
