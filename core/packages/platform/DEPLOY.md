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
| `TEACHING_API_BASE_URL` | 必填 | Core 教学 API 的 HTTPS `/v1` 地址 |
| `TEACHING_PLATFORM_SECRET` | 必填且两端相同 | 64 位十六进制随机密钥,签名账号桥接请求 |
| `SMS_PROVIDER` | `aliyun` 或 `tencent` | 生产验证码通道;console 与空值会阻止部署 |

其他支付、短信、对象存储和二维码变量见 `.env.example`。生产缺少 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 会直接报错,不会退回开发默认值。真实值不得写进 Git。

## GitHub Actions + systemd

- workflow:`/.github/workflows/deploy_platform.yml`
- unit:`/ops/systemd/platform-next.service`
- GitHub secrets:`PLATFORM_DEPLOY_HOST`、`PLATFORM_DEPLOY_USER`、`PLATFORM_DEPLOY_SSH_KEY`
- 服务器运行时环境文件:`/etc/cube-platform.env`
- 持久状态:`/var/lib/cube-platform/data.db` 与 `/var/lib/cube-platform/uploads`

CI 使用 pnpm 11 和 Node 24,先构建共享契约,再测试、migrate、seed、build,最后按实际 monorepo standalone 入口组包。`Test Platform` 和平台部署都在 shared 变更时触发并先构建 shared。Core 与平台 workflow 都会在覆盖 live 文件前校验两端教学密钥的格式和相等性,不输出密钥;平台 workflow 还会拒绝缺失、引号空值或空白短信配置。按当前权限模型,`PLATFORM_DEPLOY_USER` 必须是 root,且 `/root/.nvm/versions/node/v24.*` 中必须有 Node 24;workflow 固定选择该 major,保证 `better-sqlite3` ABI 一致。未来若改普通账号,需同时重写目录权限、systemd 管理方式与 Node 路径。远端在替换运行目录前检查权限、Node 和环境文件;失败时自动回滚代码包。SQLite migrations 在单个 transaction 内执行,不会留下半迁移,但成功提交的 schema 不随代码回滚,首次切换前必须准备并验证数据库备份。

首次切换必须分阶段,不能把两套首次上线改动放进同一次 push 后假设 workflow 有顺序。先备份 PostgreSQL、SQLite 和 uploads,在两端环境文件写入同一个新密钥并补齐真实短信配置;然后只发布 Core API、PostgreSQL migration、shared 契约及所需依赖账本,等待 `Deploy Core` 成功并确认 migration/API 就绪。最后再发布平台 `/org` 桥接、SQLite migration 和运行时代码,或手动触发平台部署。两套 workflow 相互独立,当前没有可靠的跨 workflow readiness gate。完整门槛见根目录 `docs/platform-migration.md`。

## Docker

Docker 是本地或备用运行方式。Compose 从 `core/` 构建上下文读取根 lockfile,并把 `/data` 放进 named volume;入口会在复制 seed DB 或执行 migration 前校验教学密钥为 64 位十六进制、教学 API 为 HTTPS,并要求生产短信 provider 的必需变量非空。

```powershell
Set-Location core/packages/platform
Copy-Item .env.example .env
# 编辑 .env,设置管理员 / session、教学桥接和真实短信通道变量
docker compose up -d --build
```

## 数据库演进

现有 34 个 SQLite migration 与 journal 是生产历史,保持原字节和顺序。`0033` 新增持久化验证码限流状态。不要把它们并入 `packages/server` 的 PostgreSQL migration。未来若转 PostgreSQL,应另做数据模型、迁移与回滚方案,不能直接改 dialect 后覆盖现有历史。
