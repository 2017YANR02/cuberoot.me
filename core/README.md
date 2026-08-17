# CubeRoot Core

pnpm + Turbo monorepo,所有新开发都在这里。

## 包

```
core/packages/
├── client/         # React 19 + Next.js 16 主站训练 / 工具前端
├── platform/       # Next.js 16 + SQLite 机构 / 教师 / 课程交易平台
├── server/         # Hono + PostgreSQL 13(WCA OAuth + recon + alg + 训练数据)
├── shared/         # 共享类型与通用数据
├── visualcube/     # 自有 NxN SVG 渲染器
└── stats-build/    # WCA 统计生成管道
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

## 快速命令

```bash
pnpm install
pnpm --filter @cuberoot/client dev          # 前端 dev,127.0.0.1:3000
pnpm --filter @cuberoot/client typecheck     # tsgo
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/platform dev       # 平台 dev,127.0.0.1:3100
pnpm --filter @cuberoot/platform typecheck
pnpm --filter @cuberoot/platform test
pnpm --filter @cuberoot/server typecheck
```

> Recon API 通过 Next rewrites 转到 `api.cuberoot.me`,**本地不需要起 Hono 后端**。
