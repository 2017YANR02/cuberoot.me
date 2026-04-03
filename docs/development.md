# 本地开发环境

## MySQL

| 配置 | 值 |
|------|-----|
| MySQL 版本 | 8.0.37 |
| 服务名 | MySQL80 |
| 数据目录 | `E:\mysql_data\` |
| 数据库 | `wca_statistics`（121 张表） |
| Dump 文件 | `D:\cube\wca-developer-database\wca-developer-database-dump.sql` |
| 连接凭据 | `_stats_build/database.yml`（已在 `.gitignore`） |

**统计脚本只用到 12 张表**，完整列定义见 [`_stats_build/SCHEMA.md`](../_stats_build/SCHEMA.md)。

### 导入数据库

```powershell
.\_stats_build\bin\import_wca_database.ps1
# 或指定自定义 dump 文件路径
.\_stats_build\bin\import_wca_database.ps1 -DumpFile "D:\path\to\dump.sql"
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
| Redirect URIs | `ruiminyan.github.io/auth/callback`、`www.cuberoot.me/auth/callback`、`localhost:5173/auth/callback` |

> Implicit Grant 因为 WCA token endpoint 不开放 CORS。

## 前端开发服务器

```powershell
cd D:\cube\ruiminyan.github.io\core
pnpm --filter @cuberoot/client dev
# → http://localhost:5173/
```

> Vite `serveRepoRoot` 插件直接从仓库根目录 serve `/legacy/` 和 `/stats/` 静态文件，无需额外服务器。

## 上游同步脚本

### Solver（or18/RubiksSolverDemo）

```powershell
git -C D:\cube\RubiksSolverDemo pull
cd D:\cube\ruiminyan.github.io
.\_sync_RubiksSolverDemo.ps1
```

同步 `src/` 运行时、根目录依赖、13 个 HTML 页面。模板文件在 `.sync/` 目录。

### Alg-Trainers（mihlefeld/Alg-Trainers）

```powershell
git -C D:\cube\mihlefeld-alg-trainers pull
cd D:\cube\ruiminyan.github.io
.\sync_alg_trainers.ps1
```

同步 30 个训练器目录 + `src/` + `style/`，为每个训练器注入 `i18n.js`。

> 训练器的 `main.js` 用 `body.outerHTML` 替换 body，MutationObserver 失效。解决方案：注入 `setInterval` 轮询。
