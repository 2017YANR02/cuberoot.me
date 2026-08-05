---
name: ops-runbook
description: "Use when adding / editing 运维命令 or AI 提示词模板 to /code/ops page (db/build/deploy/backup/prompt 5 类). DB-backed:走 X-Admin-Key 端点 (`api.cuberoot.me/v1/ops/commands`),非源码改动。Triggers: \"加运维命令\", \"ops command\", \"runbook 加一条\", \"/code/ops\", \"加到运维页\", \"OpsPage\", \"加提示词\", \"prompt 模板\", \"ops_commands\"."
---

# Ops Runbook (DB-backed)

`/code/ops` 命令存在 PG `ops_commands` 表,**不是源码硬编码**。改一条 = 调 admin API,不需要 commit + deploy。

## 加一条

```bash
KEY=$(grep -oP 'ADMIN_API_KEY\*\* \| `\K[^`]+' D:/cube/cuberoot.me/.password.md)
curl -X POST -H "X-Admin-Key: $KEY" -H 'Content-Type: application/json' \
  https://api.cuberoot.me/v1/ops/commands \
  -d '{
    "id": "unique-kebab",
    "category": "db",
    "cwd": "core/",
    "chips": [{"zh":"~25 min","en":"~25 min"}],
    "title_zh": "...",  "title_en": "...",
    "desc_zh": "...",   "desc_en": "...",
    "cmd": "pnpm --filter @cuberoot/foo exec tsx src/bin/x.ts",
    "variants": [{
      "zh": {"label":"...","note":"..."},
      "en": {"label":"...","note":"..."},
      "cmd": "..."
    }]
  }'
```

category 决定 rail/标签/过滤色;`prompt` 类 cmd 渲染会去掉 `$` shell prefix + 改 sans 字体。

## 其它端点

| 操作 | 方法 | 路径 |
|---|---|---|
| 列全部 | GET | `/v1/ops/commands` (public, 5min cache) |
| 改 | PUT | `/v1/ops/commands/:id` (不能改 category, 要换分类先 DELETE 再 POST) |
| 删 | DELETE | `/v1/ops/commands/:id` |
| 重排 | PUT | `/v1/ops/commands/reorder` body `{category, ids: string[]}` (该 category 全部 id 的新顺序) |

prod base `https://api.cuberoot.me`;本地 dev 需 vite proxy 改指 `127.0.0.1:3001` (默认指 prod)。

## prompt 分类专门用法

提示词模板 (用户常对 AI 重复说的指令) 放 category='prompt':
- `cmd` 字段直接放完整中文提示词,多行用 `\n` 分隔,可含 `[填]` 类占位
- 渲染会去掉 `$` shell prefix + 用 sans 字体 + 紫色 rail (跟 shell 命令视觉区分)
- desc 写"什么时候掏这条出来"而不是"它干啥",cmd 本身就是说明
- chips 用场景标签 (短任务 / AFK / 长任务 / 多 agent / 收尾 / 性能优化 等)

## 禁

- 别加新 category —— 5 类已固定;真要加先改 server route `CATEGORIES` 数组 + migration CHECK 约束 + client `CATEGORIES` + 加色 + 加 lucide 图标
- 别去改 OpsPage.tsx 数据 —— DB 是 source of truth,改源码会被覆盖
- 别复制现有 .mjs 命令进来 —— 工作流上"应该出现在运维手册"的才进
- 跑 `pnpm dev` / `npm run` 这种通用命令不进 ops,放各包 README

## 直查 PG (调试 / 批量改)

```bash
ssh root@cuberoot 'PGPASSWORD=314159 psql -U cuberoot cuberoot_db -c "SELECT id, category, title_zh FROM ops_commands ORDER BY category, position"'
```

本地 dev (5433 pwd dev):
```pwsh
$env:PGPASSWORD='dev'; docker exec -i pg13 psql -U postgres cuberoot_db -c "..."
```

## Schema

`migrations/0010_ops_commands.sql` + `0011_seed_ops_commands.sql`,见 `src/db/schema.pg.sql` 第 21 节。
