# cuberoot.me 服务器环境

> 2026-05-06 完成 post-宝塔 改造:卸 PHP/MariaDB/WordPress/宝塔 panel,blog 切静态,
> nginx vhost 入 git,SSL 走 systemd timer。详见 memory `reference_post_baota.md`。

## 服务器信息

| 项目 | 值 |
|------|-----|
| **域名** | `cuberoot.me` → 301 到 `www.cuberoot.me` |
| **托管** | 云服务器 |
| **OS** | Linux 3.2104 U10(基于 CentOS/RHEL,包管理用 `dnf`) |
| **Web 服务器** | Nginx 1.26.2(原宝塔装的二进制 `/www/server/nginx/`,vhost 走 git) |
| **HTTPS** | certbot Let's Encrypt(`certbot-renew.timer` systemd 自动续期,expires 2026-06-30) |
| **磁盘** | 40GB 总量,约 19GB 可用 |
| **Node.js** | v24.14.0(nvm,`~/.nvm/versions/node/v24.14.0/`) |
| **npm** | v11.9.0 |
| **pm2** | v6.0.14(`pm2 startup` 已配置开机自启) |
| **pnpm** | v10.32.1 |

### URL 架构

```
https://www.cuberoot.me/             → React SPA(/www/wwwroot/cuberoot-spa/)
https://www.cuberoot.me/blog/        → 静态镜像(/www/wwwroot/blog-static/,WordPress 已下架)
https://www.cuberoot.me/tools/       → 静态文件镜像(/www/wwwroot/toolkit/tools/)
https://api.cuberoot.me/v1/          → Hono API(Nginx 反代到 127.0.0.1:3001)
https://www.cuberoot.me/stats/       → WCA 统计页面
```

### 概述

云服务器上部署了 `ruiminyan.github.io` 的镜像 + Hono API。

| 项目 | 值 |
|------|-----|
| **地址** | [www.cuberoot.me](https://www.cuberoot.me) |
| **SPA 根目录** | `/www/wwwroot/cuberoot-spa/`(入口 `index.html` + `_assets/`) |
| **镜像根目录** | `/www/wwwroot/toolkit/`(deploy_mirror rsync 同步产物) |
| **Blog 静态根** | `/www/wwwroot/blog-static/`(2026-05-06 wget 镜像,内容冻结) |
| **Nginx 站点配置** | `/etc/nginx/vhost.d/www.cuberoot.me.conf`(source 在 `ops/nginx/`,Phase F 从 panel 迁出) |
| **SSL 证书** | `/etc/letsencrypt/live/cuberoot.me/`(certbot 标准位置) |
| **CI 部署** | `.github/workflows/deploy_mirror.yml`(SPA/static)、`deploy_core.yml`(Hono)、`deploy_nginx.yml`(vhost) |

### 同步机制

```
push 到 main 分支
      │
      ├── 改 SPA / 静态(client) → deploy_mirror.yml → rsync /www/wwwroot/toolkit/
      ├── 改 Hono server         → deploy_core.yml   → rsync /root/core-api/ + pm2 restart
      └── 改 ops/nginx/*.conf    → deploy_nginx.yml  → scp + nginx -t + reload
```

**自动触发条件**:

| Workflow | 触发 |
|------|------|
| `deploy_mirror.yml` | push main(任何前端/static 改动)、Update Stats CI 完成、Update Upcoming Comps CI 完成 |
| `deploy_core.yml` | push main 且 `core/**` 有变更(>300 文件 path filter 失效需手动 `gh workflow run`) |
| `deploy_nginx.yml` | push main 且 `ops/nginx/**` 有变更 |

### GitHub Secrets(部署凭据)

存储在 [仓库 Settings → Secrets](https://github.com/RuiminYan/ruiminyan.github.io/settings/secrets/actions):

| Secret | 用途 |
|--------|------|
| `DEPLOY_SSH_KEY` | SSH 私钥(服务器 `/root/.ssh/github_deploy`) |
| `DEPLOY_HOST` | 服务器 IP |
| `DEPLOY_USER` | SSH 用户名(`root`) |
| `DEPLOY_PATH` | 部署目录(`/www/wwwroot/toolkit`) |

> 对应的公钥已加入服务器 `/root/.ssh/authorized_keys`。

### Nginx 关键配置

**Source of truth 在 git**:`ops/nginx/www.cuberoot.me.conf`,push → `deploy_nginx.yml` 自动 scp + 校验 + reload + 失败回滚。**不要在服务器上手改**;改了下次 deploy 会被覆盖。

主要 location 块:

```nginx
# React SPA — 根路径 fallback
root /www/wwwroot/toolkit;
location / {
    try_files $uri $uri/ /index.html;
}

# certbot ACME challenge(走 cuberoot-spa webroot)
location ^~ /.well-known/acme-challenge/ {
    root /www/wwwroot/cuberoot-spa;
    try_files $uri =404;
}

# Blog 静态镜像(2026-05-06 切静态)
location ^~ /blog/ {
    alias /www/wwwroot/blog-static/;
    try_files $uri $uri/ $uri/index.html =404;
}

# Hono API 反代
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
    proxy_cache off;
}

# 工具/统计静态
location ^~ /tools/ { root /www/wwwroot/toolkit; ... }
location ^~ /stats/ { root /www/wwwroot/toolkit; ... }
```

完整 conf 见 `ops/nginx/www.cuberoot.me.conf`。

### rsync 参数说明(`deploy_mirror.yml`)

```bash
rsync -rltz --delete --exclude='.user.ini' --chmod=D755,F644 ...
```

| 参数 | 说明 |
|------|------|
| `-rltz` | 递归(r) + 保留软链接(l) + 保留时间戳(t) + 压缩传输(z) |
| `--delete` | 删除远程有但本地 `_deploy/` 中没有的文件 |
| `--exclude='.user.ini'` | 历史遗留(宝塔时代有 chattr +i),保留无害 |
| `--chmod=D755,F644` | 目录 755、文件 644 |

> 不用 `-a`(archive)是因为 `-a` 会同步 owner/group/perms,在 CI 环境下会 code 23 错误。

## 故障排除

### 镜像未更新?
1. 检查 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions) 对应 workflow 是否全绿
2. 红叉看日志(SSH 连接 / rsync / nginx -t 失败)

### nginx 配置回滚?
线上 `/etc/nginx/vhost.d/www.cuberoot.me.conf.bak-<unix-ts>` 是历次部署前的备份。
```bash
ssh root@cuberoot 'cd /etc/nginx/vhost.d/ && ls -t www.cuberoot.me.conf.bak-* | head'
ssh root@cuberoot 'cp /etc/nginx/vhost.d/www.cuberoot.me.conf.bak-<ts> /etc/nginx/vhost.d/www.cuberoot.me.conf && nginx -t && nginx -s reload'
```
Phase F 之前(panel 路径下)的历史 `.bak` 已归档至 `/root/archive/nginx-vhost-backups/`。
或本地 `git revert` 改动 commit,push 后 workflow 重新部上去。

### SSL 证书过期?
- `certbot-renew.timer` 每 12h 跑一次,< 30 天才真续。
- 手动 dry-run:`ssh root@cuberoot 'certbot renew --dry-run --no-random-sleep-on-renew'`
- 续后 deploy hook(`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`)自动 reload nginx。

### SSH 连接失败?
- 安全组放行 22
- 确认 `/root/.ssh/authorized_keys` 包含部署公钥
- 密钥丢失:服务器重新生成并更新 GitHub Secret `DEPLOY_SSH_KEY`

## Hono 后端(Recon API + WCA OAuth + alg)

| 项目 | 值 |
|------|-----|
| **框架** | Hono 4.x + @hono/node-server |
| **部署目录** | `/root/core-api/` |
| **端口** | 3001 |
| **进程管理** | pm2(`core-api`,`pm2 startup` 已配置开机自启) |
| **凭据文件** | `/root/core-api/.env`(DB_*, JWT_SECRET, WCA_OAUTH_*) |
| **API 入口** | `https://api.cuberoot.me/v1/health` 等 |
| **CORS** | 允许 `cuberoot.me`、`www.cuberoot.me`、`ruiminyan.github.io`、`localhost:5173` |
| **CI 部署** | `deploy_core.yml`(rsync `dist/` + `pm2 restart core-api`) |

> 健康检查:`curl https://api.cuberoot.me/v1/health` → `{"status":"ok","db":"connected"}`

## PostgreSQL 13(recon_db)

2026-05-06 从 MariaDB 迁过来,MariaDB 服务 + 数据已完整卸载。

| 项目 | 值 |
|------|-----|
| **DB** | PostgreSQL 13 |
| **库名** | `recon_db` |
| **用户** | `recon_user`(仅限 localhost) |
| **数据目录** | `/var/lib/pgsql/data/` |
| **服务** | `systemctl {start,stop,restart} postgresql` |
| **Schema** | `core/packages/server/src/db/schema.pg.sql`(repo,11 张表) |

**ALTER 顺序**:先在云服务器跑 ALTER → 再 push 代码。反过来部署上去 SELECT 新列直接 500。

详细 PG 方言 / 部署细节见 `.claude/skills/server-deploy/SKILL.md`。

### 备份策略

| 备份层 | 方式 | 频率 | 位置 |
|--------|------|------|------|
| API 备份(recon 表) | `backup_recon.yml` CI | 每天 | GitHub 仓库 |
| PG 全库 dump | `pg-dump-recon.timer` (systemd) | 每天 03:00 UTC + 10min random | `/root/archive/pg-recon-YYYY-MM-DD.sql.gz`(留 30 天) |

**全库 dump 实现**(2026-05-06 加):
- 脚本 `/usr/local/bin/pg-dump-recon.sh`(pg_dump → gzip,< 1KB 失败 abort,过期 mtime+30 自动删)
- service `/etc/systemd/system/pg-dump-recon.service`(After=postgresql.service)
- timer `/etc/systemd/system/pg-dump-recon.timer`(OnCalendar=*-*-* 03:00 UTC)
- 防的: 人为 SQL 错误 / PG 升级失败 / OOM corruption / 误删数据库目录
- 不防: 整盘损坏(备份和原数据同盘)。要异地备份再加 daily push 到 GitHub repo / OSS。

**手动恢复 recon_db:**
```bash
ssh root@cuberoot 'gunzip -c /root/archive/pg-recon-<DATE>.sql.gz | PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d recon_db'
```

## SSH 登录方式

```bash
# 已配 ~/.ssh/config 别名(本机)
ssh root@cuberoot
```

服务器 IP / 密码见云控制台,不放 repo。

