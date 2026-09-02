# CubeRoot 文档索引

状态：`ACTIVE`。最后更新：2026-09-02。

本页是文档状态和权威入口的索引，不替代代码、schema、workflow 或各专题跟踪表。

## 状态约定

| 状态 | 含义 |
| --- | --- |
| `ACTIVE` | 当前执行计划或仍在验收/观察的跟踪表；允许更新状态和下一步 |
| `REFERENCE` | 当前契约、操作说明或事实登记；实现变化时必须同步 |
| `COMPLETED` | 已完成工作的验收证据；不再作为新任务清单 |
| `HISTORICAL` | 特定时点的审计或迁移快照；其中旧命令和未完成项不代表当前待办 |
| `RETIRED` | 退役 runtime 或目录；禁止继续开发、构建、测试、部署，恢复须单独授权 |

同一主题冲突时，优先级为：运行源码/schema/workflow → 本页列出的 `ACTIVE` 跟踪表 → `REFERENCE` 文档 → `COMPLETED`/`HISTORICAL` 记录。本索引的分类是权威状态；活跃跟踪表还必须在文件内写当前状态，历史快照不得覆盖当前 tracker。

## 当前入口

| 领域 | 权威入口 | 状态 | 用途 |
| --- | --- | --- | --- |
| 架构现代化 | [architecture-modernization-tracker.md](./architecture-modernization-tracker.md) | `ACTIVE` | 决策、批次、验收和审核记录 |
| 音乐播放器 | [music-player-tracker.md](./music-player-tracker.md) | `ACTIVE` | `/music`、DeskPet 悬浮音频中心、曲库转码与静态媒体发布 |
| 后台与增长监控 | [admin-observability-tracker.md](./admin-observability-tracker.md) | `ACTIVE` | `/admin` 首页、用户注册与会员增长的口径、实施和验收 |
| 架构现状锐评 | [architecture-audit-2026-08.md](./architecture-audit-2026-08.md) | `HISTORICAL` | 2026-08 审计快照；当前状态以 tracker 为准 |
| Platform 产品迁移 | [platform-product-migration-tracker.md](./platform-product-migration-tracker.md) | `ACTIVE` | 发布、角色态复验和旧资产观察 |
| Platform 数据处置 | [platform-data-disposition-ledger.md](./platform-data-disposition-ledger.md) | `ACTIVE` | 旧数据逐项保管、迁移和处置 |
| Platform surface | [platform-product-surface-ledger.md](./platform-product-surface-ledger.md) | `COMPLETED` | 已验收的页面/Handler/Action 守恒证据 |
| Platform 源码迁入 | [platform-migration.md](./platform-migration.md) | `HISTORICAL` | 独立前端迁入与退役记录，不是当前开发手册 |
| Platform 统一方案 | [platform-unification-plan.md](./platform-unification-plan.md) | `COMPLETED` | 已完成阶段的设计和验收依据 |
| 生成物 | [generated-artifacts.md](./generated-artifacts.md) | `REFERENCE` | source、output、重建入口、owner 和漂移策略 |
| 开发环境 | [development.md](./development.md) | `REFERENCE` | 本地开发与常用验证 |
| 部署与运维 | [workflows](../.github/workflows/) / [nginx](../ops/nginx/README.md) / [故障排除](./troubleshooting.md) | `REFERENCE` | workflow 和 ops 是部署、配置、回滚的事实源 |
| WCA 统计管道 | [stats-pipeline.md](./stats-pipeline.md) | `REFERENCE` | 统计生成、加载和发布边界 |
| Recon API | [recon-api.md](./recon-api.md) | `REFERENCE` | Recon 接口契约 |
| SEO/GEO | [seo-geo-plan.md](./seo-geo-plan.md) | `REFERENCE` | metadata、索引和内容策略 |
| 五端 App 单一来源 | [cross-platform-app-contract.md](./cross-platform-app-contract.md) | `ACTIVE` | Android/iOS/HarmonyOS NEXT/Windows/macOS 宿主、共享层与总体完成口径 |
| 五端 App 路线图 | [mobile-app-roadmap.md](./mobile-app-roadmap.md) | `ACTIVE` | 五端实现、设备、发布和长期维护进度 |
| 五端三栏合同 | [mobile-three-tab-contract.md](./mobile-three-tab-contract.md) | `ACTIVE` | 计时/工具/我的结构、网站复用策略和五端协作边界 |
| App `/timer` 一致性 | [mobile-timer-parity-tracker.md](./mobile-timer-parity-tracker.md) | `ACTIVE` | 网站与已安装客户端的计时器完整 UI/UX、复用边界与逐项验收 |
| 小程序 | [../core/docs/MINIPROGRAM.md](../core/docs/MINIPROGRAM.md) | `REFERENCE` | 小程序实现、构建和发布契约 |

未列出的专题文档仍可作为局部证据；涉及继续实施前，先核对其日期、状态和对应现役代码。
