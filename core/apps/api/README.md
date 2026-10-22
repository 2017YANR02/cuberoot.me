# @cuberoot/server

现役 Hono API 和 PostgreSQL 数据层，拥有独立运行进程和部署产物；API→Web 源码依赖、Web public 运行时读取及宽泛部署触发已完成收口，验收记录见[当前架构跟踪](../../../docs/architecture-modernization-tracker.md)。`package.json`、`src/`、`migrations/` 和 `.github/workflows/deploy_core.yml` 是局部事实源。

## 边界

- API 不得新增对 `packages/client` 源码或 `packages/client/public` 的依赖；CubeOpt 运行资产使用 [API 自有 artifact store](./CUBEOPT_ARTIFACT.md)，依赖以[现行边界基线](../../architecture-boundaries.json)和扫描结果为准，部署输入以[当前 workflow](../../../.github/workflows/deploy_core.yml)为准，不从历史审计推断仍有 Web 耦合。
- 稳定 DTO、schema 和纯规则放在 `@cuberoot/shared` 显式 subpath，Node-only 实现留在本 package。
- PostgreSQL schema 变更新增顺序 migration，先在本地 PG 13 验证，push 后由部署 workflow 自动应用。

## 下载入口统计

`POST /v1/downloads/events` 接收匿名入口点击，复用结构化运行日志；按日期、渠道和语言汇总方式见 [下载页与安装包分发](../../../docs/app-downloads.md)。不新增数据库表，不将点击数解释为完成下载或安装数。

## 命令

从 `core/` 执行：

```sh
pnpm --filter @cuberoot/server dev
pnpm --filter @cuberoot/server typecheck
pnpm --filter @cuberoot/server test
pnpm --filter @cuberoot/server build:bundle
```

默认 Web dev 会把 `/v1/*` 代理到线上 API；只在需要验证本地数据域时，按 [`scripts/README.md`](./scripts/README.md) 使用 `seed:local`、`dev:local` 和 `LOCAL_DOMAINS`。
