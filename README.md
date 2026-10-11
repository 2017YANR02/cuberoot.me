<div align="center">

# CubeRoot

### Solve · Train · Analyze

Solvers, trainers, analytics, and statistics for the Rubik's Cube — all in the browser.

[cuberoot.me](https://cuberoot.me/)

</div>

**新同事先读：[新人入门 / 提交规范](./CONTRIBUTING.md) · [项目开发约定](./AGENTS.md)**

所有有仓库写入权限的成员均可在自查和必要验证后直接推送 `main`，无需 PR 或他人审批；推送后确认 CI 和部署结果。需要预览或讨论时可按需提 PR。

---

## Architecture

```
cuberoot.me/
├── core/                  pnpm + Turbo monorepo — active apps, shared packages, and offline jobs
│   ├── apps/
│   │   ├── api/           Hono + PostgreSQL 13 — WCA OAuth, reconstructions, algorithm library
│   │   ├── mobile/        React + Capacitor — native mobile application
│   │   ├── miniprogram/   WeChat Mini Program — independent native runtime
│   │   └── fmc-solver/    Rust FMC solver service — independent Cargo workspace and deployment
│   ├── packages/
│   │   ├── client/        React 19 + Next.js 16 (App Router) — current Web application
│   │   ├── platform/      Retired read-only archive; its product surfaces now live under client /platform
│   │   └── ...            Reusable libraries with public package boundaries
│   └── jobs/
│       ├── alg-build/     Offline algorithm data and SQL generators
│       ├── scramble-stats-build/ Offline scramble analysis generators
│       ├── stats-build/   Offline WCA statistics and database-load pipeline
│       └── wb-build/      Offline unofficial world-best dataset generator
├── solver/                Rust solving engines — native analyzers and WebAssembly builds
├── research/              Independent research projects
│   └── reconer/           Automated reconstruction from speedsolving video
├── tools/                 Upstream forks, served from static.cuberoot.me
├── stats/                 Generated statistics JSON (committed)
├── ops/                   nginx vhosts, systemd units, deployment scripts
└── docs/                  Design notes and runbooks
```

**Frontend** React 19, Next.js 16 with Turbopack, TypeScript.
**Backend** Hono on PostgreSQL 13, behind nginx.
**Pipelines** TypeScript jobs over the WCA MySQL export, run by GitHub Actions.
**Solving** Rust engines, compiled natively for services and statistics pipelines or to WebAssembly for the browser.
**Hosting** A self-hosted server and Vercel, split by DNS.

---

## Local development

Contributions follow the [submission and self-review guide](./CONTRIBUTING.md).
All contributors with write access may push directly to `main` after self-review
and necessary validation, then verify CI and deployment results. PRs are optional;
another person's approval is not required. Force pushes and main deletion remain blocked.

Use the Node version in [`.node-version`](./.node-version) and the pnpm version
declared by [`core/package.json`](./core/package.json).

```bash
cd core
pnpm install

pnpm --filter @cuberoot/client dev         # http://127.0.0.1:3000/
pnpm --filter @cuberoot/client typecheck   # tsgo, the fast daily check
pnpm --filter @cuberoot/client test
pnpm --filter @cuberoot/client build
```

API calls are proxied to production through Next.js rewrites, so the full site
runs without a local backend. Platform is part of that same frontend at
`/platform`; the archived `packages/platform` app is excluded from the workspace
and is not built or deployed.

Architecture decisions, document status, and generated-artifact ownership are
indexed in [`docs/README.md`](./docs/README.md).

---

## Credits

This project builds on a great deal of open-source work. The full list is at
[cuberoot.me/support](https://cuberoot.me/support).

## License

See [LICENSE](./LICENSE). Vendored upstream modules keep their original licenses.
