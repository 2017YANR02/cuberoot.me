---
name: server-deploy
description: "Use when changing Hono server routes (`core/packages/server/**`) or DB schema (ALTER / new table / new column). Covers DB credentials location, schema-change ordering, 云服务器 deploy via GitHub Actions (云服务器 itself has no GitHub access), pm2 process. Triggers: \"recon_db\", \"core-api\", \"deploy server\", \"ALTER TABLE\", \"pm2 restart\", \"server 部署\", \"加列\", 改 server 路由."
---

# Recon server / DB 部署

## DB 凭据

**`.password.md`**（gitignored，不在 repo 里）。实际 DB 是 `recon_db / recon_user`——**不是** `.env.example` 里的 `trainer_db`。

云服务器 上加列示例（用单引号包 SQL，避免 bash 解析括号）：
```bash
mysql -u recon_user -p'<password>' recon_db -e 'ALTER TABLE comments ADD COLUMN pinned TINYINT(1) NOT NULL DEFAULT 0;'
```

给用户的命令：从 `.password.md` 嵌真密码（别留 `<password>`）；SQL 压**一行**，多张表多条命令（多行 heredoc 粘贴常被截断卡 `>`）。

## ⚠️ Schema 变更顺序

**先在 云服务器 跑 ALTER → 再 push 代码**。反过来会让部署上去的新版 server 在 SELECT 新列时直接 500，整个 `/api/recon/*` 挂掉。

## 云服务器 没有 GitHub 访问

不要 SSH 上去 `git pull`——连不通。所有部署都走 GitHub Actions：

- push `main` 且 `core/**` 有变更 → `deploy_core.yml` 自动跑
- 文件 >300（path filter trap）或想强制重跑 → `gh workflow run deploy_core.yml`

`deploy_core.yml` 已经包含 server：build → rsync `core/packages/server/dist/` → SSH `pm2 restart core-api`。

## 云服务器 关键路径（CUBEROOT_ME.md 详）

| 项 | 值 |
|---|---|
| Server 部署目录 | `/root/core-api/` |
| pm2 进程 | `core-api` |
| 端口 | 3001（Nginx 反代 `/api/`） |
| `.env` | `/root/core-api/.env`（DB_*, JWT_SECRET） |

部完看日志：`pm2 logs core-api --lines 30`。

## 验证

1. 改 schema 时先 ALTER + `DESCRIBE` 确认列加上了
2. push 后 Actions tab 看 `Deploy Core` 跑通
3. 线上 `https://www.cuberoot.me/api/recon/list` 200 即活

## ⚠️ Server 新引入 workspace 包：必须 esbuild bundle

tsc 输出 `import './foo'` 无 `.js` 后缀 → Node ESM 拒收 → pm2 挂 → **全 `/api/*` 502**（参考 `@cuberoot/visualcube`）。

新包 package.json：
- `"build": "tsc -b && esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js"`
- `"main": "./dist/index.js"`，exports 用 `{ node: dist, default: src }` conditional（client Vite 仍走 src）
- devDep 加 `esbuild`

`deploy_core.yml` 加 `pnpm --filter <pkg> build` 在 server build 之前——`tsc -b` 不跑 npm script。

验证：`node -e "import('<pkg>').then(m=>console.log(Object.keys(m)))"`。
