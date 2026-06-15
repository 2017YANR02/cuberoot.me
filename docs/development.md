# 本地开发环境

## MySQL

| 配置 | 值 |
|------|-----|
| MySQL 版本 | 8.0.37 |
| 服务名 | MySQL80 |
| 数据目录 | `E:\mysql_data\` |
| 数据库 | `wca_developer_database`（121 张表） |
| Dump 文件 | `E:\mysql_data\wca-developer-database-dump.sql` |
| 连接凭据 | `core/packages/stats-build/database.yml`（已在 `.gitignore`） |

**统计管线只用到 12 张表**，列定义见 [`MIGRATION_PLAN.md`](../core/packages/stats-build/MIGRATION_PLAN.md)。

### 导入数据库

```powershell
# TypeScript 版一键导入（下载 + 解压 + 过滤导入 + 建索引）
npx tsx core/packages/stats-build/src/bin/update_database.ts
```

> **关键优化**：`innodb_flush_log_at_trx_commit = 0` 导入（9 小时 → ~10 分钟），完毕后自动恢复为 1。

**启动/关闭 MySQL**：

```powershell
sudo net start MySQL80
sudo net stop MySQL80   # ⚠️ 绝对不要强杀 mysqld.exe，否则损坏 InnoDB
```

**启用 sudo**（首次，Windows 11 24H2+）：设置 → 系统 → 开发者选项 → 启用 sudo。

## WCA OAuth

| 配置 | 值 |
|------|------|
| 流程 | Implicit Grant（`response_type=token`，绕过 CORS） |
| Client ID | `mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4` |
| Scopes | `public` |
| Redirect URIs | `cuberoot.me/auth/callback`、`www.cuberoot.me/auth/callback`、`localhost:5173/auth/callback` |

> Implicit Grant 因为 WCA token endpoint 不开放 CORS。

## 前端开发服务器

```powershell
cd D:\cube\cuberoot.me\core
pnpm --filter @cuberoot/client-next dev
# → http://127.0.0.1:3000/
```

> `app/{tools,stats}/[...slug]/route.ts` catch-all 直接从仓库根目录 serve `/tools/` 和 `/stats/` 静态文件，无需额外服务器。

## 上游同步脚本

### Solver（or18/RubiksSolverDemo）

```powershell
git -C D:\cube\RubiksSolverDemo pull
cd D:\cube\cuberoot.me
.\_sync_RubiksSolverDemo.ps1
```

同步 `src/` 运行时、根目录依赖、13 个 HTML 页面。模板文件在 `.sync/` 目录。

### Alg-Trainers（mihlefeld/Alg-Trainers）

```powershell
git -C D:\cube\mihlefeld-alg-trainers pull
cd D:\cube\cuberoot.me
.\sync_alg_trainers.ps1
```

同步 30 个训练器目录 + `src/` + `style/`，为每个训练器注入 `i18n.js`。

> 训练器的 `main.js` 用 `body.outerHTML` 替换 body，MutationObserver 失效。解决方案：注入 `setInterval` 轮询。
