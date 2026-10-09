# 本地开发环境

## WCA 统计用 MySQL

统计 job 使用 `wca_developer_database`。连接信息由 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASS`、`MYSQL_DB` 环境变量或本机 `core/jobs/stats-build/database.yml` 提供；必需表清单以 [`database.ts`](../core/jobs/stats-build/src/core/database.ts) 的 `REQUIRED_TABLES` 为准。MySQL 服务名和 dump 所在目录随开发电脑而异，不使用旧 Windows 绝对路径。

### 导入数据库

从 `core/` 运行：

```sh
pnpm --filter @cuberoot/stats-build exec tsx src/bin/update_database.ts
```

此入口会重建配置指定的数据库；运行前核对目标是专用的本地开发实例。MySQL 服务启停按本机安装方式操作，不把旧 Windows 的 `MySQL80` 服务名当作跨平台命令。

### 维护者 Mac 的按需服务

本机使用 Homebrew `mysql@8.4`，仅监听 `127.0.0.1:3306`：

```sh
brew services run mysql@8.4
brew services stop mysql@8.4
```

`run` 不注册登录自启动。客户端目录 `/opt/homebrew/opt/mysql@8.4/bin` 已加入本机登录 shell PATH；连接配置在上述 gitignored `database.yml`，CLI 配置在本机 `~/.my.cnf`，两者权限均为 `0600`。换电脑须重新核对这些本机配置。

导入完成后，在 `core/` 运行 `pnpm --filter @cuberoot/stats-build run validate-queries` 检查 SQL。只生成某项用 `pnpm --filter @cuberoot/stats-build compute <stat_id>`，不必重算全部统计。

## 登录配置

WCA OAuth 与其他登录流程以 `core/packages/client/app/[lang]/dev/auth/page.tsx`、现役 API 路由和环境配置为准；退役 Vite 开发端口 `5173` 与旧 Implicit Grant 说明不再作为配置依据。

## 前端开发服务器

从仓库的 `core/` 目录运行：

```sh
pnpm --filter @cuberoot/client dev
# → http://127.0.0.1:3000/
```

本地 Web 的 `/v1/*` 通过 Next rewrites 代理线上 API；`/tools/`、`/stats/` 使用现役 Next route handler，静态资源的发布边界见 `.github/workflows/sync_toolkit.yml`。

## 上游同步脚本

### Solver（or18/RubiksSolverDemo）

在 `core/` 运行：

```sh
pnpm upstream:sync --only solver
```

同步 `src/` 运行时、根目录依赖、13 个 HTML 页面。模板文件在 `.sync/` 目录。

### Alg-Trainers（mihlefeld/Alg-Trainers）

```sh
pnpm upstream:sync --only algtrainers
```

同步 30 个训练器目录 + `src/` + `style/`，为每个训练器注入 `i18n.js`。

> 训练器的 `main.js` 用 `body.outerHTML` 替换 body，MutationObserver 失效。解决方案：注入 `setInterval` 轮询。
