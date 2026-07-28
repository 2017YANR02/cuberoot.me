<div align="center">

# CubeRoot

### Solve · Train · Analyze

Solvers, trainers, analytics, and statistics for the Rubik's Cube — all in the browser.

[cuberoot.me](https://cuberoot.me/)

</div>

---

## Architecture

```
cuberoot.me/
├── core/                  pnpm + Turbo monorepo — all application code
│   └── packages/
│       ├── client/        React 19 + Next.js 16 (App Router) — the site itself
│       ├── server/        Hono + PostgreSQL 13 — WCA OAuth, reconstructions, algorithm library
│       ├── shared/        Types shared between client and server
│       ├── visualcube/    In-house NxN cube SVG renderer
│       ├── stats-build/   WCA statistics pipeline, refreshed daily by CI
│       └── ...            alg-build, scramble-stats-build, wb-build, stack-kernel
├── solver/                Rust solving engines — native analyzers and WebAssembly builds
├── reconer/               Automated reconstruction from speedsolving video
├── tools/                 Upstream forks, served from static.cuberoot.me
├── stats/                 Generated statistics JSON (committed)
├── ops/                   nginx vhosts, systemd units, deployment scripts
└── docs/                  Design notes and runbooks
```

**Frontend** React 19, Next.js 16 with Turbopack, TypeScript.
**Backend** Hono on PostgreSQL 13, behind nginx.
**Pipelines** TypeScript jobs over the WCA MySQL export, run by GitHub Actions.
**Solving** Rust engines, compiled natively for the statistics pipelines and to WebAssembly for the browser.
**Hosting** A self-hosted server and Vercel, split by DNS.

---

## Local development

Requires pnpm 11 and Node 20 or newer.

```bash
pnpm install

pnpm --filter @cuberoot/client dev         # http://127.0.0.1:3000/
pnpm --filter @cuberoot/client typecheck   # tsgo, the fast daily check
pnpm --filter @cuberoot/client test
pnpm --filter @cuberoot/client build
```

API calls are proxied to production through Next.js rewrites, so the full site
runs without a local backend.

---

## Credits

This project builds on a great deal of open-source work. The full list is at
[cuberoot.me/support](https://cuberoot.me/support).

## License

See [LICENSE](./LICENSE). Vendored upstream modules keep their original licenses.
