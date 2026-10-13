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

## 多方法复盘的公共动作重建

回放时间轴和动作列表跟随当前方法：Roux 使用 FB / SB / CMLL / LSE，ZZ 使用 EOLine / 左块 / 右块 / 顶层。阶段标识与配色分离，沿用阶段顺序配色；收尾动作归入末阶段，点击跳转和高亮使用重建后的原始动作区间。组件回归见 `timer-full-reconstruct-shared.test.ts`。

CFOP、Roux、ZZ 的分步文字统一经过 `buildReconText`，共享中层、双层、转体、废步分组与原始动作区间。方法只提供阶段边界；边界落在同一物理手势内部时顺延到手势末尾，废步跨行时分别闭合括号，纯转体保留时间但不占编码器动作索引。复制文本与点击回放使用同一重建结果。

Roux、ZZ 仍沿用现有阶段粒度，不新增 CMLL/ZBLL case 或参考解法分析；CFOP 的早期 Z 转体抑制和 Cross AUF 边界规则不应用于它们。不同方法、语言的异步分析缓存隔离，CFOP 手工文字覆盖不套用到其他方法。验证包括 `recon-method-gestures`、`recon-wide-timing`、`recon-waste-coll`、`reconstruct-worker` 测试及复盘 ground-truth 门禁。

## Turbopack 开发缓存恢复

若 `next dev` 显示 Ready，但访问页面后持续出现 `conflicting effects for the same key`，先保存 panic 日志并停止该项目的开发服务。将 `core/packages/client/.next/dev/cache/turbopack` 改名备份，再从 `core/` 运行 `pnpm --filter @cuberoot/client dev`，让 Turbopack 重建开发缓存；使用自定义 `NEXT_DEV_DIST_DIR` 时，对应调整缓存路径。

恢复后实际请求出错页面，并重启一次确认新缓存可复用，不能只看 Ready 或 HTTP 200，还要检查终端是否继续报告 panic。若新缓存下仍复现，继续排查编译器或源码触发条件，不要反复清缓存。无需删除依赖、生产构建缓存或修改业务逻辑。

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

## 智能魔方复盘验证

实时步骤与停表后的复盘通过本次尝试 ID 显式交接，立即沿用最近已识别的步骤；末段尚未识别时在后台补齐。交接只接受相同打乱、视角及动作/时间戳前缀，成绩内容后续变更不复用旧快照。完全相同的文字分析输入独立缓存，不因最终参考解法评分开启而重算。参考解法在 Worker 中异步计算，默认收起，其加载或错误状态只在展开后显示，不阻挡已识别步骤。对应回归为 `tests/reconstruct-worker.test.ts` 和 `tests/timer-full-reconstruct-shared.test.ts`。

CFOP 步骤文本保留冗余动作并用括号标记：`U' U' U'` 显示为 `(U' U' U')`，`U U'` 显示为 `(U U')`，普通半转 `U U` 仍合并为 `U2`。括号与回放动作索引分离，复制文本保留括号；净效果非零的冗余段只增加展示标记，不把整段时间计入原有净零废步评分。末层执行前 EO 已完成、执行后只剩 EPLL 时标注 `COLL`，执行前 EO 未完成则标注 `OLL(CP)`。对应回归为 `tests/recon-waste-coll.test.ts`。

智能魔方设置的「打乱剩最后一步时自动重置朝向」默认开启：Solo 在实际打乱进度完成倒数第二步时，每次打乱校准一次实况朝向与下一次复盘参照，最后一步完成不会覆盖已采集的参照。应在该时刻按当前训练朝向握好魔方；专项默认朝向也计入起手握持。没有可用姿态样本或未触发自动校准时，在打乱匹配完成时采集参照。手动重置陀螺仪也会更新未开始的复盘参照，已开始录制的基准不变。此功能不改变双人或联网对战流程。

第一手起表时记录实际握持。观察阶段展示参照与起手净朝向对应的最短 `x/y/z` 组合；后续面转按当前握持命名，转体持续更新坐标。

姿态仍存于 `Solve.gyro` 字符串。v2 沿用原有二进制布局，保存打乱参照下、已折算品牌基的魔方姿态；v1 历史录像保留原有读取逻辑，不能补回未记录的打乱结束参照。没有可用参照的录制仍走 v1。离散播放包括中层带动的核心运动，连续播放直接使用 v2 姿态，避免二次换基。

v2 双层转动按陀螺仪落格与编码器面转相差不超过 120ms 匹配，允许两种上报顺序。例如 `L + x → r`、`D + y → u`、`B + z → f`，六个面均覆盖正转、逆转与有向半转。方向和转量必须匹配，中间不能夹着其他面转；一手编码器动作只匹配一次，已确认中层优先。合并只影响复盘显示，原始动作与姿态保留。对应回归为 `tests/recon-wide-timing.test.ts`。

v2 转体与观察转体调试按角度立即换格，不要求保持时间。新朝向须进入 35° 容差：单轴前进约 55° 时换格，回摆至约 35° 才退回，边界之间保留已确认朝向。调试仍为 20ms 轮询；未采到的姿态无法补回。连续同向四分之一转在没有面转穿插时合并显示为半转；双层半转同时匹配编码器与核心的两次四分之一转，原始姿态保留供回放。稀疏采样跨过复合朝向时以最短转体组合保持终态，不推断未采到的实际路径。旧 v1 录像沿用 120ms 保持与仅在无常规事件时启用的 45° / 500ms 宽松补识别。双层动作的 120ms 配对窗口独立于朝向判定。

相关改动从 `core/` 执行 `pnpm --filter @cuberoot/shared build`、`pnpm --filter @cuberoot/client exec vitest run tests/recon-inspection-frame.test.ts tests/gyro_track.test.ts tests/smart-cube-attempt-producer.test.ts`，并执行强制门禁 `pnpm --filter @cuberoot/client test:recon-ground-truth`。真机复验覆盖普通计时、`z2` 专项、观察中往返转体、起手后连续不同轴转体，以及连续/离散播放切换。

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
