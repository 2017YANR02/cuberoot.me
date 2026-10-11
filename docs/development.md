# 本地开发环境

## 新员工：一次配置，以后输入 cuberoot

网页入门说明在 `/zh/account/get-started` 的「交给 AI：配置本地环境」中；普通内容管理员无需安装本地环境。网站管理员权限不等于 GitHub 仓库权限。

Mac / Windows 都先安装 Git、仓库 `.node-version` 指定的 Node 与 `core/package.json` 指定的 pnpm。Windows 建议使用「命令提示符」，不需要 PowerShell 脚本或更改执行策略。在准备存放代码的目录运行（已有代码则直接进入其 `core/`）：

```sh
git clone https://github.com/2017YANR02/cuberoot.me.git
cd cuberoot.me/core
pnpm install --frozen-lockfile
pnpm setup:local
```

每一步成功再继续；最后重新打开终端，输入 `cuberoot`。浏览器在页面就绪后打开 `http://127.0.0.1:3000/zh`，终端保留日志，Ctrl+C 停止本次启动的服务。快捷命令从任何目录都能调用。首次安装需网络和仓库访问权限，尚未在新人 Windows 真机验收。

- `setup:local` 复用 `build:deps` 构建共享模块，随后安装通用 TypeScript `devsite`，通过项目登记创建快捷命令，不定义个人 shell 函数。
- 已有 `cuberoot` 登记时保留原配置，包括维护者的 `https://dev.cuberoot.me`；已有 Mac `devsite` 时调用其 `add` 子命令，不替换它。命令同名但未登记、已有 Windows devsite 等情况停止并提示，不覆盖未知文件。
- 配置沿用 `~/.config/devsite/projects.json`；新启动器位于 `~/.local/share/devsite/devsite.ts`。Mac 命令在 `~/.local/bin`，安装器为默认 zsh 追加相应 PATH；其他 shell 自行把此目录加入 PATH。Windows 命令在 `%APPDATA%\npm`，若未在 PATH，按安装输出通过 Windows「环境变量 → 用户变量 → Path」添加并重开终端。安装器不修改系统 PATH 或执行策略。
- 注册的启动入口为 `node core/scripts/local-dev.ts`（实际绝对路径由安装器记录），复用既有资源生成器和 Next binary，避开会杀端口、清缓存的 `predev-clean`。已有健康 CubeRoot 服务时复用；其他服务或启动中状态不会被停止。
- Node 或仓库移动后需维护登记；新增其他项目继续用 `devsite add 名称 目录 网址 -- 启动命令`，启动命令负责打开就绪网页。当前 TS 版支持 `add/list/run`；已有维护者版命令保持原样。
- 本地前端默认代理线上 API，不是隔离测试库；写入操作按负责人安排执行。无需分发管理员密钥、数据库密码或现有 FRP 令牌。
- 本轮不配置 DNS、HTTPS、隧道或登录自启；跨设备预览按 [开发预览接入](dev-preview-onboarding.md) 单独办理。

已有 Windows devsite 的人工登记范本：在 `core/` 中，把以下目录和 Node 路径换成目标电脑实际路径，使用现有工具登记；不要覆盖原启动器。

```text
devsite add cuberoot "C:/实际项目目录/core" http://127.0.0.1:3000/zh -- "C:/实际Node目录/node.exe" "C:/实际项目目录/core/scripts/local-dev.ts"
```

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

### 新同事电脑：交给 AI 安装

让能操作本机的 AI 检查现有安装，只补缺少的项目：Git、仓库根 `.node-version` 指定的 Node.js、`core/package.json` 的 `packageManager` 指定的 pnpm、OpenSSH 客户端（ssh / ssh-keygen）、项目及其 pnpm 依赖。Git 缺失时先用官方安装渠道安装，再克隆仓库；已有仓库保留本地修改。Windows 可使用 Git for Windows 和系统 OpenSSH，Mac 按需安装命令行工具。版本以仓库事实源为准，不抄手册固定值。

AI App 需具备终端和本地文件操作能力；账号登录、系统管理员确认由本人完成，不向 AI 提供密码。普通网页开发不默认安装 Docker、数据库、Rust、完整 Xcode 或 Android Studio；需要原生端/求解器等具体任务时再补。默认开发 API 连接线上。

配置后在新终端输入 `cuberoot`：启动过程和服务日志留在当前终端，服务就绪后打开网址。尚未批准开发域名时使用本地网址；开发网址申请完成后，enroll.ts 自动将同一 checkout 的登记切换为专属网址及前台隧道 runner。不能把“直接打开旧后台服务并返回命令行”当作首次启动验收。已有后台服务需先核对归属，不强制清理其他进程。
