# CubeRoot Core

pnpm + Turbo monorepo，承载现役产品 app、共享 package 和离线 builder；仓库外的 `solver/` 与 `reconer/` 有独立生命周期。

本文的所有 pnpm 命令都从 `core/` 执行；活跃应用是 client、server、mobile 和 miniprogram，`packages/platform` 只是 workspace 外归档。`solver/` 和 `reconer/` 另有独立生命周期。

## 包

```
core/packages/
├── client/         # React 19 + Next.js 16 主站训练 / 工具前端
├── platform/       # 已退役的 Platform 源码与 SQLite migration 归档
├── server/         # Hono + PostgreSQL 13(WCA OAuth + recon + alg + 训练数据)
├── mobile/         # React + Capacitor Android app，未来增加 iOS target
├── miniprogram/     # 微信小程序独立运行时
├── shared/         # 共享类型与通用数据
├── visualcube/     # 自有 NxN SVG 渲染器
├── stats-build/    # WCA 统计生成管道
└── *-build/        # 其他有独立 artifact contract 的离线 builder
```

每个源文件头部 TSDoc `@module` 注释说明职责。

## 详细文档

| 主题 | 文档 |
|---|---|
| 本地开发(MySQL / WCA OAuth / dev server / upstream sync) | [../docs/development.md](../docs/development.md) |
| 统计管线用法 | [../docs/stats-pipeline.md](../docs/stats-pipeline.md) |
| Recon API contract | [../docs/recon-api.md](../docs/recon-api.md) |
| 服务器部署运维 | [../CUBEROOT_ME.md](../CUBEROOT_ME.md) |
| nginx vhost 部署 | [../ops/nginx/README.md](../ops/nginx/README.md) |
| AI 行为指引 | [../AGENTS.md](../AGENTS.md) |
| 文档状态与事实源 | [../docs/README.md](../docs/README.md) |
| 生成物所有权 | [../docs/generated-artifacts.md](../docs/generated-artifacts.md) |

## 快速命令

```bash
pnpm install
pnpm --filter @cuberoot/client dev          # 前端 dev,127.0.0.1:3000
pnpm --filter @cuberoot/client typecheck     # tsgo
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/server typecheck
```

> Recon API 通过 Next rewrites 转到 `api.cuberoot.me`,**本地不需要起 Hono 后端**。
