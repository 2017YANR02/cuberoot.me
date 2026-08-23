# @cuberoot/platform 历史归档

状态：`RETIRED`。

本目录保存退役 Platform 前端、SQLite migration 和相关历史证据，已从 `core/pnpm-workspace.yaml` 排除。它不是可开发、可测试、可构建或可部署的应用，也没有受支持的原地运行命令。

现役产品归属：

- Web 入口和页面：`../client` 的 `/platform/*`，必要深链复用 `/org/*`、`/learn/*` 等主站能力。
- API 和 PostgreSQL 数据：`../server`。
- 跨端稳定契约：`../shared`。

禁止现役 package 导入本目录源码，禁止恢复独立账号、SQLite 写入、独立前端或独立部署。需要历史取证或恢复时，必须先获得明确授权，并在隔离副本中操作。

当前状态见：

- [`../../../docs/platform-product-migration-tracker.md`](../../../docs/platform-product-migration-tracker.md)
- [`../../../docs/architecture-modernization-tracker.md`](../../../docs/architecture-modernization-tracker.md)
- [`../../../docs/platform-data-disposition-ledger.md`](../../../docs/platform-data-disposition-ledger.md)

旧实现细节保存在 Git 历史中，不再把旧命令复制到现役文档。
