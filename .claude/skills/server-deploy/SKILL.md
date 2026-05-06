---
name: server-deploy
description: "Use when changing Hono server routes (`core/packages/server/**`) or DB schema (ALTER / new table / new column). Covers PG credentials, schema-change ordering, 云服务器 deploy via GitHub Actions (云服务器 itself has no GitHub access), pm2 process. Triggers: \"recon_db\", \"core-api\", \"deploy server\", \"ALTER TABLE\", \"pm2 restart\", \"server 部署\", \"加列\", 改 server 路由."
---

# Recon server / DB 部署

## SSH 到云服务器

用户机器已配好 SSH 公钥 + `~/.ssh/config` 别名,在 pwsh 直接 `ssh root@cuberoot` 即可登入,**无需密码**。给命令时直接写 `ssh root@cuberoot '...'` 而不是 IP / 密码 / `-p` 端口。

服务器 OS 时区是 **UTC**,看本地时间用 `TZ='America/Los_Angeles' date`。

## DB 凭据(PostgreSQL 13)

**`.password.md`**(gitignored,不在 repo 里)。生产 DB 是 PG 13 跑在 cuberoot,`recon_db / recon_user / 314159`。**不是** MariaDB —— 2026-05-06 已迁完,MariaDB 服务 + 数据已完整卸载(blog 已切静态,见 memory `reference_post_baota.md`)。

云服务器上跑 SQL 示例(密码用 `PGPASSWORD` env,避免 quoting 嵌套):
```bash
ssh root@cuberoot "PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d recon_db -c 'ALTER TABLE comments ADD COLUMN pinned SMALLINT NOT NULL DEFAULT 0;'"
```

**SSH quoting trap**: 多层引号嵌套(ssh + bash + psql)经常把单引号 / 内部空格搞坏,密码会被存成 ` 314159 `(前后多空格)。**SQL 多行 / 含字面引号时**,改成 `scp` 一个 SQL 文件上去再 `psql -f`:
```bash
scp /tmp/migration.sql root@cuberoot:/tmp/
ssh root@cuberoot 'PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d recon_db -f /tmp/migration.sql && rm /tmp/migration.sql'
```

## ⚠️ Schema 变更顺序

**先在云服务器跑 ALTER → 再 push 代码**。反过来会让部署上去的新版 server 在 SELECT 新列时直接 500,整个 `/api/recon/*` 挂掉。

## PG 方言关键(写 SQL / 改 server 路由前必看)

驱动是 `postgres@^3`(porsager),`db/connection.ts` 里 `query()` helper 接 `?` 占位符,内部自动 `?→$N` 改写,业务路由 SQL 字符串保持 `?` 即可,跟旧 MariaDB 写法一致。

但**SQL 方言**完全是 PG:
- 列名引用用双引号 `"round"`,**不是反引号**(`buildInsert`/`buildUpdate` 已用双引号)
- `INSERT ... ON CONFLICT (cols) DO UPDATE SET col = EXCLUDED.col`(原 `ON DUPLICATE KEY UPDATE col = VALUES(col)`)
- `INTERVAL 'N days'` / `make_interval(secs => ?)`(原 `INTERVAL N DAY` / `DATE_ADD(NOW(), INTERVAL ? SECOND)`)
- `to_timestamp(? / 1000.0)`(原 `FROM_UNIXTIME(? / 1000)`)
- `INSERT ... RETURNING id` 拿自增 id,**不是** `result.insertId`
- `JSONB` 列 (目前只 `edits.fields`):合并用 `||` 操作符;driver 自动反序列化,**不要** `JSON.parse` 它
- 其它 JSON 数据(`alternatives`, `attempts`, `payload`, `solves`, `before_snapshot`, `after_fields`)留 `TEXT`,driver 返字符串需手动 `JSON.parse`
- `tinyint(1)` 在 PG 是 `SMALLINT`,代码传 0/1 不是 boolean(`jsonToRow` 已处理 `official`)
- DATE 列驱动配了 `types.date` override 直接返字符串 `'YYYY-MM-DD'`(不是 ISO 时刻),前端用 `slice(0,10)` 兼容

`schema.pg.sql` 是 source of truth,改任何 schema 同步改这个文件 + 跑 ALTER 上线。

## 云服务器没有 GitHub 出站访问

SSH 进得去(`ssh root@cuberoot`),但云服务器自己访问不到 `github.com`,所以**别在云服务器上 `git pull`** —— 会卡。所有代码部署都走 GitHub Actions:

- push `main` 且 `core/**` 有变更 → `deploy_core.yml` 自动跑
- 文件 >300(path filter trap)或想强制重跑 → `gh workflow run deploy_core.yml`

`deploy_core.yml` 已经包含 server:build → rsync `core/packages/server/dist/` → SSH `pm2 restart core-api`。

## 云服务器关键路径

| 项 | 值 |
|---|---|
| Server 部署目录 | `/root/core-api/` |
| pm2 进程 | `core-api` |
| 端口 | 3001(Nginx 反代 `/api/`) |
| `.env` | `/root/core-api/.env`(DB_HOST=127.0.0.1, DB_PORT=5432, DB_USER=recon_user, DB_PASS=314159, DB_NAME=recon_db, JWT_SECRET, PORT) |
| PG 数据目录 | `/var/lib/pgsql/data/` |
| PG 服务 | `systemctl {start,stop,reload,restart} postgresql` |
| Schema 文件 | `core/packages/server/src/db/schema.pg.sql`(repo,11 张表) |

部完看日志:`pm2 logs core-api --lines 30`。

## 验证

1. 改 schema 时先 ALTER + `\d <table>` 确认列加上了
2. push 后 Actions tab 看 `Deploy Core` 跑通
3. 线上 `https://www.cuberoot.me/api/health` → `{"status":"ok","db":"connected"}` 即活

## ⚠️ Server 新引入 workspace 包:必须 esbuild bundle

tsc 输出 `import './foo'` 无 `.js` 后缀 → Node ESM 拒收 → pm2 挂 → **全 `/api/*` 502**(参考 `@cuberoot/visualcube`)。

新包 package.json:
- `"build": "tsc -b && esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js"`
- `"main": "./dist/index.js"`,exports 用 `{ node: dist, default: src }` conditional(client Vite 仍走 src)
- devDep 加 `esbuild`

`deploy_core.yml` 加 `pnpm --filter <pkg> build` 在 server build 之前 —— `tsc -b` 不跑 npm script。

验证:`node -e "import('<pkg>').then(m=>console.log(Object.keys(m)))"`。
