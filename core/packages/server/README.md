# @cuberoot/server

现役 Hono API 和 PostgreSQL 数据层，拥有独立运行进程和部署产物；源码、资产及 workflow 触发仍有旧 Web 耦合。`package.json`、`src/`、`migrations/` 和 `.github/workflows/deploy_core.yml` 是局部事实源。

## 边界

- API 不得新增对 `packages/client` 源码或 `packages/client/public` 的依赖；现有源码 import、tsconfig alias 和 cubeopt 资产读取按[架构审计](../../../docs/architecture-audit-2026-08.md)与[执行跟踪](../../../docs/architecture-modernization-tracker.md)递减。
- 稳定 DTO、schema 和纯规则放在 `@cuberoot/shared` 显式 subpath，Node-only 实现留在本 package。
- PostgreSQL schema 变更新增顺序 migration，先在本地 PG 13 验证，push 后由部署 workflow 自动应用。

## 命令

从 `core/` 执行：

```powershell
pnpm --filter @cuberoot/server dev
pnpm --filter @cuberoot/server typecheck
pnpm --filter @cuberoot/server test
pnpm --filter @cuberoot/server build:bundle
```

默认 Web dev 会把 `/v1/*` 代理到线上 API；只在需要验证本地数据域时，按 [`scripts/README.md`](./scripts/README.md) 使用 `seed:local`、`dev:local` 和 `LOCAL_DOMAINS`。
