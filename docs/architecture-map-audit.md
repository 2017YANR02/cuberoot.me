# 可视化架构地图核对

核对日期：2026-11-05。基线：`e70f974fec` 加当前本地工作树。仓库存在其他任务的未提交改动，本记录仅核对架构概览中的系统地图，不代表这些改动已发布，也不是全仓架构重新验收。

## 事实源与发现

| 项目 | 核对结论 | 源码 / 配置证据 |
| --- | --- | --- |
| 单元覆盖 | 当前活跃 pnpm app、package、job 和独立 FMC Cargo app 均有地图节点覆盖；退役 platform 仍排除。没有新增未映射目录或已失效的源码路径。 | `core/pnpm-workspace.yaml`、`core/scripts/check-architecture-boundaries.mjs` 的 `activePackages()`、各单元 `package.json`、`core/apps/fmc-solver/Cargo.toml`、`tests/architecture-map.test.ts` |
| Web 交付 | Next 的 Vercel / standalone 双交付结构仍在配置中；`next.cuberoot.me` 指向同一自有 Next 服务，不是独立预发布实例，已纠正地图措辞。 | `core/packages/client/next.config.ts`、`.github/workflows/deploy_next.yml`、`ops/nginx/next.cuberoot.me.conf`、`ops/nginx/www.cuberoot.me.conf` |
| 开发预览 | 原地图只说明维护者的 frp 入口；已补充按设备登记、独立密钥的 SSH 反向隧道。 | `ops/dev-preview/machines.json`、`core/scripts/dev-preview/client.ts` 的 `sshArgs` / `-R`、`ops/nginx/dev-machines.conf`、`docs/dev-preview-onboarding.md` |
| 博客 | 应描述为独立仓库的静态归档。Next 的 `/blog` 跳转和自有 nginx 的 `/blog/` 静态目录并存；原“只保留跳转”和“独立运行时”措辞过度概括，已修正。 | `core/packages/client/next.config.ts` 的 blog redirects、`ops/nginx/www.cuberoot.me.conf` 的 `/blog/` alias 与 `blog.cuberoot.me` 静态 root |
| 业务 API / FMC | Hono 是主要业务后端，FMC 为独立在线求解服务；已消除“唯一在线后端”的歧义，补充 `/v1/fmc/*` 的入口说明。 | `core/apps/api`、`core/apps/fmc-solver/Cargo.toml`、`.github/workflows/deploy_fmc.yml`、`ops/nginx/www.cuberoot.me.conf` 的 FMC locations |
| 共享依赖 | 离线 jobs 使用 shared，部分统计 job 还使用 puzzle-solvers；已补齐“共享能力 → 离线任务”的连线。数据库节点补充 schema 和 migration 路径。 | `core/jobs/*/package.json`、`core/apps/api/src/db/schema.pg.sql`、`core/apps/api/migrations` |

## 维护与验收边界

公开页面已移除“怎么防止地图失效”说明，维护细则集中在本文，由现有架构跟踪文档链接；根 `AGENTS.md` 沿用既有架构文档入口，不新增专题细则。图结构仍只有 `core/packages/client/app/[lang]/dev/architecture/_lib/architecture-map.ts` 一份，页面通过 `ArchitectureAtlas` 消费。

新增、移动或删除 app/package/job，或修改运行时边界、依赖关系、交付入口时，同批核对地图。活跃单元复用现有 workspace resolver，独立 Cargo app 核对自身 manifest，部署关系以 workflow 和 `ops/` 为准。地图只写稳定结构，不复制易变版本、耗时、文件大小或页面总数。

在 `core/` 运行 `pnpm --filter @cuberoot/client exec vitest run tests/architecture-map.test.ts`，检查目录覆盖、源码路径和连线合法性。

目录覆盖测试验证的是结构完整性，不验证线上 DNS、实际部署版本、设备连接、所有边的业务含义或文字正确性。本轮核对仓库源码与配置，未探测生产环境、重跑统计或执行部署。语言历史是独立的日期快照，审计系统地图不会自动刷新其数据。

本地验证：`architecture-map.test.ts` 的 5 项检查通过，client typecheck 通过；浏览器刷新后确认维护说明块已移除，开发预览与博客节点使用更新后的术语。
