# AGENTS.md

- 状态：`RETIRED`。本目录是历史归档，已从 `core/pnpm-workspace.yaml` 排除。
- 禁止在本目录开发、测试、构建、部署或新增产品功能。
- 禁止运行 `pnpm --filter @cuberoot/platform ...`；该 package 已无受支持的 workspace 命令。
- 现役 Platform 产品属于 `packages/client` 的 `/platform/*`、`packages/server` API 和 `packages/shared` 契约。
- 不得从现役 package import 本目录源码，也不得恢复 SQLite、独立登录、独立前端或独立部署。
- 保留源码、migration 与历史证据；观察期和用户单独授权前不得删除或改写归档数据。
- 获准取证或恢复时只在隔离副本中操作，不把归档应用重新暴露为公共服务。
- 当前状态以 `../../../docs/platform-product-migration-tracker.md` 和 `../../../docs/architecture-modernization-tracker.md` 为准。
