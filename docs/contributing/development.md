# 开发、验证与本机环境

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

## 常用工作流

打乱统计的日常一键入口在 `core/` 运行 `pnpm stats:scramble`：默认增量运行全部作业，成功后自动灌线上 PG、通过同一个 `wca-data-latest` Release 发布最新统计，并增量上传独立在线分片；统计产物不再提交 Git。明确只想本地计算时用 `pnpm stats:scramble:local`；仅跑指定作业用 `--jobs stages|333opt|puzzles`，只读查看路径与计划用 `pnpm stats:scramble:local --plan`。新 checkout 先运行 `pnpm stats:hydrate` 恢复校验后的数据及发布基线。运行日常一键命令即明确授权本轮统计发布；其他代码 push 仍遵守部署章节。

创建或修改 Mac 快捷指令用 [mac-shortcuts skill](../../.agents/skills/mac-shortcuts/SKILL.md)；本机「跑打乱统计」实例见 [docs/mac-stats-shortcut.md](../../docs/mac-stats-shortcut.md)。

改 `core/apps/miniprogram/src/` 后必须在 `core/` 运行 `pnpm --filter @cuberoot/miniprogram build` 刷新开发者工具读取的 `dist/`；该命令不跑测试。
WXML 表达式直接写 `&&` / `||`，禁 HTML 实体；改 WXML 后必须通过小程序 build 并在微信开发者工具关闭项目后重开做干净编译。

## 开发预览域名接入

维护者两台 Mac 的终端命令 `cuberoot` 共用仓库 `core/scripts/local-dev.mts`，登记在各机 `~/.config/devsite/projects.json`，快捷命令经通用 TypeScript `devsite` 调用。Mac mini 带 `--url https://dev.cuberoot.me`，MacBook Pro 带 `--preview ruimin-macbook-pro`。每次执行先停止本 checkout 的旧开发会话，清理 Next 开发缓存，再在当前终端启动资源生成与 Turbo watch；就绪后打开本机登记网址。

Mac mini 复用既有常驻 FRP；MacBook Pro 的 preview runner 管理独立 SSH 隧道。重复运行 `cuberoot` 会结束旧开发会话并重启，日志留在新终端；Ctrl+C 或关闭终端停止该会话创建的服务。未知端口进程或 PID 不匹配时停止并报错，不误杀其他项目。此入口不负责 DNS、证书或设备申请。新增项目使用 `devsite add`，不要再复制一套 shell 启动函数。该工具属于本机配置，换设备或修改前先核对实际脚本、登记项及服务状态。

用户说“帮我配置 dev，名字是…电脑是…”、新增同事开发域名或撤销某台电脑时，读取 `.agents/skills/dev-preview/SKILL.md` 和 `docs/dev-preview-onboarding.md`。以 `ops/dev-preview/machines.json` 为唯一设备清单，使用 `core/scripts/dev-preview/cli.ts` 和 `client.ts` 完成登记、授权、DNS、证书、部署、电脑自启和验收；不能只改 DNS 就报完成。新增同事使用每设备独立 SSH 密钥，不分发现有 FRP 共用令牌。

## 开发命令

- **代码量统计（维护者要求，2026-10-22）**：用户说“统计代码量”“看看代码统计”等时，AI 直接运行 `cloc` 并汇总结果，不只提供命令让用户自行执行。默认在仓库根目录用 `cloc --vcs=git` 统计 Git 跟踪文件的当前本地内容，按需补充语言和主要模块统计；明确区分代码、注释、空行，以及数据、资源、第三方和生成内容，不把总行数称为自研代码量。维护者 Mac 已通过 Homebrew 安装 cloc；换环境先检查可用性。

流量异常排查先读 [`docs/traffic-monitor.md`](../../docs/traffic-monitor.md) 与 [`docs/traffic-defense.md`](../../docs/traffic-defense.md)（当前防护、费用保护、暂停及恢复步骤），2026-09-22 `/zh/calc` 峰值的证据见 [`docs/traffic-incident-2026-09-22.md`](../../docs/traffic-incident-2026-09-22.md)。先核对报表的 `coverage`：自动来源分析目前只覆盖自有服务器 nginx；Vercel 请求在现有 Firewall 和 Logs 中按时间与路径核查。Analytics 是浏览器事件，自有线路也可能上报，不能等同于 Vercel 页面线路；停用时不得为了监控自行重新开启。User-Agent 和浏览器名称不能证明是真人；不要把 nginx 请求数当作全站访客数，也不要为监控启用额外收费项。

使用 pnpm 12.6.0；运行 core 命令前核实 CWD，在仓库根时先进入 `core/`；`ERR_PNPM_NO_PKG_MANIFEST` 时先检查执行目录。
改 `core/packages/shared/src/**` 后完成前必须在 `core/` 运行 `pnpm --filter @cuberoot/shared build` 刷新 `dist`;“不用检查”只跳过测试/校验,不跳过该构建。

- shell 路径相对 `core/` 写(`packages/...`),禁加 `core/` 前缀(会变 `core/core/`)。含 `[lang]` 等方括号的路径一律单引号,必要时 `git add ':(literal)packages/.../[lang]/x.tsx'`。
- **工作树默认策略（维护者要求，2026-10-10）**：默认在当前工作目录直接开发和验证，不主动创建或切换到 Git worktree。存在其他任务的未提交修改本身不构成使用 worktree 的理由，应限定改动范围并保留他人修改。仅在用户明确要求，或确有无法在当前目录安全完成的隔离需求时使用；后者须先说明具体原因。使用时保持一个任务只有一份实际编辑来源，确保验证与提交来自同一份目录，不在主目录和工作树之间手工维护两份相同改动。
- 临时验证目录 / worktree 禁用 Junction / SymbolicLink 复用正式 `node_modules` 或 `packages`;各自运行 `pnpm install --offline --frozen-lockfile`。

```bash
pnpm --filter @cuberoot/client dev            # http://127.0.0.1:3000/
pnpm --filter @cuberoot/client typecheck      # tsgo,日常用这个
pnpm --filter @cuberoot/client typecheck:tsc  # 怀疑 tsgo 漏报时
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/client lint
```

- 禁 `tsc --noEmit` 走根 tsconfig(references-only 壳,typo 静默过)。
- 使用 dev 前先探测 `http://127.0.0.1:3000/`:已有服务则复用,未运行且资源允许时可在 `core/` 启动本任务 client dev(绑 127.0.0.1);不得擅自停止/重启他人服务;浏览器验证遵循全局可见窗口边界。Windows 关窗可能留孤儿 node,改 globals/layout/config 看 chunk hash 是否变。
- **dev 在跑时禁本地 `next build`**(共用 `.next/` 撕裂 manifest → 全站 500;PreToolUse hook 硬拦;坏了删 `.next` 重启)。验证走 `typecheck`。
- 本地 dev 调 `/v1/*` 走 rewrites 反代线上 api,不需要跑后端。
- 磁盘不够先 `df -h` 告诉我,别静默换方案。
- 凭据:给用户服务器/DB 命令时从 `.password.md`(gitignored)读真实密码嵌入,不写 `<password>` 占位;命令不 commit。
- 本地 PG:docker `pg13`(5433,pwd `dev`,db `cuberoot_db`);schema/load.sql 先本地验。
- 本地改某域 DB 数据并预览:`seed:local <表>` 拉那域的表进 pg13 + `dev:local` 跑本地 API + `$env:LOCAL_DOMAINS='<域>'` 起前端(只该域走本地,登录/别的域/WCA 大表仍反代线上);禁默认全局连本地。范本 alg,详 `apps/api/scripts/README.md`。

## 测试

- 求解器性能对比默认每版单轮、不预热，未经用户明确要求不重复测试。

- 智能魔方复盘收录、步骤批注、待办队列与 AI 处理遵循 `docs/recon-intake-workflow.md`。管理员在页面点击确认即为该版本的明确收录授权；AI 通过 `core/` 的 `pnpm recon:intake` 领取、续期、测试和回写。不得修改人工预期来通过检查，不得把待验收样本自行升级为已确认，默认仅本地修改。收录后的正式回归快照由 `pnpm recon:intake export` 生成。

- **智能魔方默认真机（维护者要求，2026-10-15）**：维护者有多款智能魔方，日常开发和真机验证默认使用 **GAN 16 UI**，适用于 iOS、Android、Apple Watch 等客户端；以后不要重复询问默认品牌/型号。只有任务明确针对其他型号时再按该型号验证。Apple Watch 当前需求是直接连接魔方、离开 iPhone 也可使用；连接、协议及自动计时证据按平台独立记录，不把其他端的通过当作手表通过。

- 非必要不新增、不运行测试。简单、可逆的改动优先直接实现并审阅差异，不写只复述实现的测试，不为凑验证数量扩展测试范围。只有涉及明确的回归风险、关键计算或安全边界，且已有证据不足时，才做能验证具体风险的最小检查；用户本次要求不测试时优先遵从。必要构建与发布后的部署状态确认不属于额外测试。
- 提交前完成适用验证;push 后不重复已通过的检查,只观察对应提交的 CI;新增改动、失败或遗漏的必要验收仅跑对应最小检查;本地 commit 不视为触发 CI;用户本次“不用检查”限制仍优先。
- `pnpm --filter @cuberoot/client test` 全集;单文件 `pnpm --filter @cuberoot/client exec vitest run <path>`(**禁** `test -- <path>`,pnpm 透传会被 vitest 吞、跑全集)。
- `tests/analyzer_worker.test.ts` ~225s(占全集 99%),只改别处就单跑其它文件。
- 测试统一 `packages/client/tests/*.test.ts`(不与源码并排),源文件 `@/` alias import。
- 改 worker/kociemba/scramble 生成器或相关 utils 的算法、计算或输出行为时，按具体回归风险补必要 fixture；纯重构、样式、文案及无行为变化的 utils 改动不自动要求新增测试。先看同类怎么写;worker 回归走 `_*_runner.cjs` 模式(见 `tests/analyzer_worker.test.ts`)。
- 回归 baseline 用 `toBe()` 锁数值,改算法主动改 baseline 当 review 信号,禁放宽成 `toBeGreaterThan`。
- CI `.github/workflows/test.yml`(PR + push main:typecheck + test)。

## Skill 路由

Skill 路径按 catalog 的 root alias 展开,禁猜路径。

主题命中 trigger 时主动调对应 skill,不凭记忆(描述已由 harness 加载,不在此列索引)。
