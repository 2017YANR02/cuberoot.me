# 旧 Platform 部署归档

独立 Platform 前端已退役。`platform.cuberoot.me` 只返回 HTTP 410;仓库不再提供 Platform test/deploy workflow 或 systemd unit。主站 `@cuberoot/client` 的 `/org` 与 `/learn` 是唯一教学入口。

本文件只记录历史运行边界,用于数据取证或离线恢复,不得作为重新上线独立前端的操作手册。

## 历史本地恢复

```powershell
Set-Location core
pnpm install
pnpm --filter @cuberoot/platform db:migrate
pnpm --filter @cuberoot/platform db:seed
pnpm --filter @cuberoot/platform dev
```

以上命令仅用于离线验证归档可读性。SQLite 默认写入 `packages/platform/data.db`;不得据此恢复公开域名或生产服务。

## 历史生产环境变量

| 变量 | 生产要求 | 用途 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 必填 | `/admin` 登录密码 |
| `SESSION_SECRET` | 必填 | 用户与管理员 cookie HMAC 签名 |
| `NEXT_PUBLIC_SITE_URL` | 必填 | sitemap、OG 和邀请链接绝对地址 |
| `DB_PATH` | 必填 | 持久 SQLite 文件路径 |
| `TEACHING_API_BASE_URL` | 必填 | Core 教学 API 的 HTTPS `/v1` 地址 |
| `TEACHING_PLATFORM_SECRET` | 必填且两端相同 | 64 位十六进制随机密钥,签名账号桥接请求 |
| `SMS_PROVIDER` | `aliyun` 或 `tencent` | 生产验证码通道;console 与空值会阻止部署 |

这些变量只用于理解历史数据和代码边界。真实值不得写进 Git;旧凭据应按迁移跟踪中的门槛轮换或撤销。

## 已删除的历史部署链

退役前应用使用 Next.js standalone、SQLite 与独立运行服务。独立 test/deploy workflow 和仓库内 unit 已删除;Web 运维部署负责停用旧服务并确认旧监听不存在。SQLite、uploads、migration 与源码只作离线归档,不再接受线上写入。

## 历史 Docker 恢复

Docker 仅用于离线恢复检查。Compose 从 `core/` 构建上下文读取根 lockfile,并把 `/data` 放进 named volume。

```powershell
Set-Location core/packages/platform
Copy-Item .env.example .env
# 编辑 .env,设置管理员 / session、教学桥接和真实短信通道变量
docker compose up -d --build
```

## 数据库演进

现有 34 个 SQLite migration 与 journal 是生产历史,保持原字节和顺序。`0033` 新增持久化验证码限流状态。不要把它们并入 `packages/server` 的 PostgreSQL migration;新教学数据只写主站 PostgreSQL。

完整迁移证据、归档范围和最终删除门槛见根目录 [`docs/platform-migration.md`](../../../docs/platform-migration.md)。
