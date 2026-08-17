# 部署

## 本地一键起

```
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev   # 127.0.0.1:3100
```

`pnpm db:seed` 从 `data/*.ts` 灌入示例数据。无后端依赖,SQLite 文件落在仓库根 `./data.db`。

生产构建:

```
pnpm build
pnpm start
```

## 环境变量

| 变量 | 默认 | 用途 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin123` | `/admin` 登录密码 |
| `SESSION_SECRET` | dev fallback | 用户 / 管理员 cookie HMAC 签名,生产必设 |
| `NEXT_PUBLIC_SITE_URL` | `http://127.0.0.1:3100` | sitemap / OG image / 邀请链接绝对地址 |
| `DB_PATH` | `./data.db` | SQLite 文件位置,docker 内 `/data/data.db` |

参考 `.env.example`,生产复制为 `.env` 后改值。

## Docker 部署(推荐)

```
docker compose up -d
```

镜像走 `Dockerfile` 多阶段构建:`pnpm install` -> `pnpm build` -> Next standalone 运行。SQLite 文件挂在 `cube-data` named volume 的 `/data/data.db`,容器内端口 `3000` 映射宿主 `3100`。

首次起容器后,如果是空 DB,需要进容器跑一次 migration + seed:

```
docker compose exec next-app sh -c "node -e \"require('better-sqlite3')('/data/data.db').close()\""
docker compose exec next-app sh -c "node -e \"const { migrate } = require('drizzle-orm/better-sqlite3/migrator'); const Db = require('better-sqlite3'); const { drizzle } = require('drizzle-orm/better-sqlite3'); const s = new Db('/data/data.db'); migrate(drizzle(s), { migrationsFolder: '/app/db/migrations' }); console.log('ok');\""
```

实际项目里可以把上面打包成一个一次性 `init` service 或本地直接 `pnpm db:migrate DB_PATH=...` 后 `docker cp data.db` 进 volume。

## HTTPS / nginx 反代

```
server {
  listen 443 ssl http2;
  server_name your-domain.com;
  ssl_certificate     /etc/ssl/certs/your.crt;
  ssl_certificate_key /etc/ssl/private/your.key;

  client_max_body_size 8m;

  location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
  }
}

server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}
```

## 备份

SQLite 文件就一份。最简备份:

```
cp /var/lib/docker/volumes/cube-platform_cube-data/_data/data.db \
   /backup/cube-data.db.bak.$(date +%F)
```

放 cron 每天跑一次。需要带 WAL 一致性的话用 `sqlite3 data.db ".backup '/backup/cube-data.db.bak'"`。

## 切换到 PostgreSQL

如果以后想换 PG:改 `drizzle.config.ts` `dialect: "postgresql"`,装 `pnpm add pg @types/pg`,改 `db/index.ts` 用 `drizzle-orm/node-postgres` + `pg.Pool`,重跑一次 `pnpm db:generate` 让 drizzle 生成 PG migration。`.boolean / .json` 类型在两边语义一致,业务代码大多不动。
