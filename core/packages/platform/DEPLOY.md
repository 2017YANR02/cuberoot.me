# 部署

平台是 `core/` pnpm workspace 的独立 Next.js 应用。源码、锁文件、CI 和 systemd unit 都以主仓库为单一来源。

## 本地运行

```powershell
Set-Location core
pnpm install
pnpm --filter @cuberoot/platform db:migrate
pnpm --filter @cuberoot/platform db:seed
pnpm --filter @cuberoot/platform dev
```

本地默认监听 `127.0.0.1:3100`;SQLite 默认写入 `packages/platform/data.db`。`build` 会先幂等执行 migration,所以全新 checkout 也能构建。

## 生产环境变量

| 变量 | 生产要求 | 用途 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 必填 | `/admin` 登录密码 |
| `SESSION_SECRET` | 必填 | 用户与管理员 cookie HMAC 签名 |
| `NEXT_PUBLIC_SITE_URL` | 必填 | sitemap、OG 和邀请链接绝对地址 |
| `DB_PATH` | 必填 | 持久 SQLite 文件路径 |

其他支付、短信、对象存储和二维码变量见 `.env.example`。生产缺少 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 会直接报错,不会退回开发默认值。真实值不得写进 Git。

## GitHub Actions + systemd

- workflow:`/.github/workflows/deploy_platform.yml`
- unit:`/ops/systemd/platform-next.service`
- GitHub secrets:`PLATFORM_DEPLOY_HOST`、`PLATFORM_DEPLOY_USER`、`PLATFORM_DEPLOY_SSH_KEY`
- 服务器运行时环境文件:`/etc/cube-platform.env`
- 持久状态:`/var/lib/cube-platform/data.db` 与 `/var/lib/cube-platform/uploads`

CI 使用 pnpm 11 和 Node 24,先测试、migrate、seed、build,再按实际 monorepo standalone 入口组包。按当前权限模型,`PLATFORM_DEPLOY_USER` 必须是 root,且 `/root/.nvm/versions/node/v24.*` 中必须有 Node 24;workflow 固定选择该 major,保证 `better-sqlite3` ABI 一致。未来若改普通账号,需同时重写目录权限、systemd 管理方式与 Node 路径。远端在替换运行目录前检查权限、Node 和环境文件;失败时自动回滚代码包。SQLite migrations 在单个 transaction 内执行,不会留下半迁移,但成功提交的 schema 不随代码回滚,首次切换前必须准备并验证数据库备份。

首次切换前必须备份数据库和 uploads,配置新的仓库 secrets 与服务器环境文件,再手动触发 workflow。完整门槛见根目录 `docs/platform-migration.md`。

## Docker

Docker 是本地或备用运行方式。Compose 从 `core/` 构建上下文读取根 lockfile,并把 `/data` 放进 named volume;入口会在首次运行时复制 seed DB,以后仅执行增量 migration。

```powershell
Set-Location core/packages/platform
Copy-Item .env.example .env
# 编辑 .env,至少设置强随机 ADMIN_PASSWORD 与 SESSION_SECRET
docker compose up -d --build
```

## 数据库演进

现有 33 个 SQLite migration 与 journal 是既有生产历史,保持原字节和顺序。不要把它们并入 `packages/server` 的 PostgreSQL migration。未来若转 PostgreSQL,应另做数据模型、迁移与回滚方案,不能直接改 dialect 后覆盖现有历史。
