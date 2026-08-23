# Platform 部署记录

状态：`RETIRED / HISTORICAL`。

独立 Platform runtime、workflow 和 service 已退役。本目录没有受支持的部署、启动、恢复或回滚命令；过去的配置只作为历史证据保存在 Git 历史中，不得用于重新上线旧应用。

现役 `/platform/*` 随 `packages/client` 发布，相关 API 和 PostgreSQL migration 随 `packages/server` 发布。实际发布契约以仓库根 `AGENTS.md`、`.github/workflows/` 和 `ops/` 为准。

如确需法证恢复旧资产，必须先获得用户明确授权，在隔离副本中完成，并遵守 [`../../../docs/platform-data-disposition-ledger.md`](../../../docs/platform-data-disposition-ledger.md)；不得把恢复副本暴露为公共服务。

当前迁移和观察状态见 [`../../../docs/platform-product-migration-tracker.md`](../../../docs/platform-product-migration-tracker.md)。
