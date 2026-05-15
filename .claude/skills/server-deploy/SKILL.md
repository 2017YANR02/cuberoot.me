---
name: server-deploy
description: "Use when 改 Hono server routes (`core/packages/server/**`) 或 PG schema (ALTER/新表/新列)。GH Actions 部署,pm2 进程。Triggers: \"cuberoot_db\", \"core-api\", \"deploy server\", \"ALTER TABLE\", \"pm2 restart\", \"server 部署\", \"加列\", 改 server 路由."
---

# Recon server / DB 部署

## SSH 到云服务器

用户机器已配好 SSH 公钥 + `~/.ssh/config` 别名,在 pwsh 直接 `ssh root@cuberoot` 即可登入,**无需密码**。给命令时直接写 `ssh root@cuberoot '...'` 而不是 IP / 密码 / `-p` 端口。

服务器 OS 时区是 **UTC**,看本地时间用 `TZ='America/Los_Angeles' date`。

## DB 凭据(PostgreSQL 13)

**`.password.md`**(gitignored,不在 repo 里)。生产 DB 是 PG 13 跑在 cuberoot,`cuberoot_db / recon_user / 314159`。**不是** MariaDB —— 2026-05-06 已迁完,MariaDB 服务 + 数据已完整卸载(blog 已切静态,见 memory `reference_post_baota.md`)。

云服务器上跑 SQL 示例(密码用 `PGPASSWORD` env,避免 quoting 嵌套):
```bash
ssh root@cuberoot "PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db -c 'ALTER TABLE comments ADD COLUMN pinned SMALLINT NOT NULL DEFAULT 0;'"
```

**SSH quoting trap**: 多层引号嵌套(ssh + bash + psql)经常把单引号 / 内部空格搞坏,密码会被存成 ` 314159 `(前后多空格)。**SQL 多行 / 含字面引号时**,改成 `scp` 一个 SQL 文件上去再 `psql -f`:
```bash
scp /tmp/migration.sql root@cuberoot:/tmp/
ssh root@cuberoot 'PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db -f /tmp/migration.sql && rm /tmp/migration.sql'
```

## Schema 变更:走 migration 文件,不要手动 ALTER

**新流程**(2026-05-10 起):

1. 写 `core/packages/server/migrations/NNNN_short_desc.sql`(纯 ALTER/CREATE,不要包 BEGIN/COMMIT — runner 自己包)
2. 同步改 `src/db/schema.pg.sql`(人读快照 — 必须自觉同步,不然两份脱节)
3. 改业务代码(server 路由 / 类型)
4. `git push`

`deploy_core.yml` 在 pm2 restart **之前** ssh 跑 `apply_migrations.sh`,扫 `migrations/*.sql` 跑没跑过的;每个 migration 一个事务 + `ON_ERROR_STOP=1`,失败 abort + 后续不跑。详细规则见 `core/packages/server/migrations/README.md`。

**已应用的 migration 不可改** — runner 校验 sha256,改了已 push 过的 migration 文件 = abort + 报错。要回滚或修正请写新 migration 反向操作。

**老流程(已废弃)**:之前是 "先 ssh ALTER → 再 push 代码",顺序反过来会让新版 server 在 SELECT 新列时直接 500。现在 push 即可,Actions 自动按"先 migrate 后 pm2 restart"顺序跑。

## PG 方言关键(写 SQL / 改 server 路由前必看)

驱动是 `postgres@^3`(porsager),`db/connection.ts` 里 `query()` helper 接 `?` 占位符,内部自动 `?→$N` 改写,业务路由 SQL 字符串保持 `?` 即可,跟旧 MariaDB 写法一致。

但**SQL 方言**完全是 PG:
- 列名引用用双引号 `"round"`,**不是反引号**(`buildInsert`/`buildUpdate` 已用双引号)
- `INSERT ... ON CONFLICT (cols) DO UPDATE SET col = EXCLUDED.col`(原 `ON DUPLICATE KEY UPDATE col = VALUES(col)`)
- `INTERVAL 'N days'` / `make_interval(secs => ?)`(原 `INTERVAL N DAY` / `DATE_ADD(NOW(), INTERVAL ? SECOND)`)
- `to_timestamp(? / 1000.0)`(原 `FROM_UNIXTIME(? / 1000)`)
- `INSERT ... RETURNING id` 拿自增 id,**不是** `result.insertId`
- **JSONB 列**(`alg_cases.{sticker,algs,ori_names}` / `edits.fields`):写时**直接传 JS 对象**(driver 会自己 `JSON.stringify` 一次,手动再来 = 双重编码 → 落地 jsonb-string → 前端 `.map()` 在字符串上炸 = React 卸树黑屏);读时 driver 也自动反序列化,**不要** `JSON.parse`;合并用 `||` 操作符
- **TEXT 列存 JSON**(`alternatives` / `attempts` / `payload` / `solves` / `before_snapshot` / `after_fields`):写**必须** `JSON.stringify`,读 driver 返字符串**必须** `JSON.parse`
- 两套规则反着来,**先 grep `schema.pg.sql` 看目标列是 JSONB 还是 TEXT 再下手**,别照抄相邻代码(同一文件里两种列都有)
- `tinyint(1)` 在 PG 是 `SMALLINT`,代码传 0/1 不是 boolean(`jsonToRow` 已处理 `official`)
- DATE 列驱动配了 `types.date` override 直接返字符串 `'YYYY-MM-DD'`(不是 ISO 时刻),前端用 `slice(0,10)` 兼容

`schema.pg.sql` 是 source of truth,改任何 schema 同步改这个文件 + 跑 ALTER 上线。

## 部署走 GitHub Actions 不在服务器 git pull

云服务器**能**访问 github.com(2026-05-06 验证: HTTPS 200 < 1s、SSH 通、git ls-remote 0.8s),但**代码部署仍走 Actions**,服务器不要 `git pull`,理由:

- repo 4 GB,服务器 SSD 不必要
- build 要 pnpm + Vite + tsc 全套,服务器无开发环境
- Actions 已配好 build → rsync → pm2 restart 流水

服务器**主动出站到 github 的合法用法**:`git push`/`gh` 推备份产物到外部 repo(参考 `pg-dump-recon` 同款 systemd timer)。

代码部署:
- push `main` 且 `core/**` 有变更 → `deploy_core.yml` 自动跑
- 文件 >300(path filter trap)或想强制重跑 → `gh workflow run deploy_core.yml`

`deploy_core.yml` 已经包含 server:build → rsync `core/packages/server/dist/` → SSH `pm2 restart core-api`。

## 云服务器关键路径

| 项 | 值 |
|---|---|
| Server 部署目录 | `/root/core-api/` |
| pm2 进程 | `core-api` |
| 端口 | 3001(Nginx 反代 `/api/`) |
| `.env` | `/root/core-api/.env`(DB_HOST=127.0.0.1, DB_PORT=5432, DB_USER=recon_user, DB_PASS=314159, DB_NAME=cuberoot_db, JWT_SECRET, PORT) |
| PG 数据目录 | `/var/lib/pgsql/data/` |
| PG 服务 | `systemctl {start,stop,reload,restart} postgresql` |
| Schema 文件 | `core/packages/server/src/db/schema.pg.sql`(repo,11 张表) |

部完看日志:`pm2 logs core-api --lines 30`。

## 验证

1. 改 schema 时先 ALTER + `\d <table>` 确认列加上了
2. push 后 Actions tab 看 `Deploy Core` 跑通
3. 线上 `https://api.cuberoot.me/v1/health` → `{"status":"ok","db":"connected"}` 即活

## ⚠️ Server 新引入 workspace 包:必须 esbuild bundle

tsc 输出 `import './foo'` 无 `.js` 后缀 → Node ESM 拒收 → pm2 挂 → **全 `/api/*` 502**(参考 `@cuberoot/visualcube`)。

新包 package.json:
- `"build": "tsc -b && esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js"`
- `"main": "./dist/index.js"`,exports 用 `{ node: dist, default: src }` conditional(client Vite 仍走 src)
- devDep 加 `esbuild`

`deploy_core.yml` 加 `pnpm --filter <pkg> build` 在 server build 之前 —— `tsc -b` 不跑 npm script。

验证:`node -e "import('<pkg>').then(m=>console.log(Object.keys(m)))"`。
