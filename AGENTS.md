# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 系统地图（先读）

仓库 `2017YANR02/cuberoot.me` 的活跃应用、共享能力和生成任务在同一个仓库管理，不等于同一个运行时或部署单元。

| 路径 | 责任与边界 |
| --- | --- |
| `core/packages/client` | 唯一 Web 前端，包含 `/platform/*` 产品入口及其复用的 `/org/*`、`/learn/*` 深链 |
| `core/apps/api` | Hono API + PostgreSQL，独立运行和部署；源码与运行时资产不依赖 Web 私有目录；既有解耦验收见架构跟踪表，禁止重新引入 |
| `core/packages/app-ui` | Android、iOS、HarmonyOS NEXT、Windows 和 macOS 唯一共享的 React 产品层；不调用原生 API，只通过宿主 capability adapter 使用系统能力 |
| `core/apps/mobile` | Android/iOS 共用的 Capacitor 薄宿主；业务 UI 从 `@cuberoot/app-ui` 消费 |
| `core/apps/desktop` | Windows/macOS 共用的单一 Tauri 薄宿主；构建、安装、BLE、签名与公证证据分平台记账 |
| `core/apps/harmony` | HarmonyOS NEXT 的 ArkTS + ArkWeb 薄宿主；当前实现与 HAP 构建证据见 `docs/mobile-app-roadmap.md` |
| `core/apps/miniprogram` | 微信小程序独立运行时，不复用 React DOM UI |
| `core/apps/fmc-solver` | vendored cubelib Cargo workspace 与独立 HTTP 服务；专用 workflow 构建部署，线上入口保持 `/v1/fmc/*` |
| `core/packages/shared` | 稳定契约、纯规则与跨端数据模型；公式数据以 PG `alg_sets/alg_cases` 为准 |
| `core/packages/visualcube` 等 | 有明确构建或运行时边界的共享 package |
| `core/jobs/*` | 离线 job，输出统计、数据或迁移生成物，不是在线 app |
| `core/packages/platform` | workspace 外的退役历史归档，不测试、不构建、不部署、不引入新功能 |
| `solver/` | workspace 外 Rust 求解引擎，产 native 分析器和 WASM；`target/`、`tables/`、`pkg-*` 仅本机有 |
| `research/reconer/` | workspace 外速拧视频自动复盘研发；进入前读 `research/reconer/AGENTS.md`、`roadmap.md`、`plan.md` 和 `human.md` |
| `tools/` / `stats/` | `static.cuberoot.me` 的 upstream/教学资源与本地生成数据；统计快照由 `wca-data-latest` Release 管理，不再提交 Git |
| `ops/` / `docs/` / `.github/workflows` | 运维、状态/设计记录和 CI/部署契约 |

事实源按优先级核对：`core/pnpm-workspace.yaml` 与各 `package.json` 定义 pnpm workspace/命令，Cargo app 由自身 `Cargo.toml` 定义；源码路由、shared schema 和 migration 定义运行契约；`.github/workflows` 与 `ops/` 定义发布边界；`docs/generated-artifacts.json` 定义生成物，`docs/generated-artifacts.md` 解释维护方式；`docs/architecture-modernization-tracker.md` 是当前架构执行入口，历史验收单独保存在 `docs/architecture-modernization-history.md`。架构建议须注明检查提交与具体源码/配置证据；路径和 package 身份复用现有 workspace resolver，部署路径合同从 manifest 依赖推导，文档不重复维护完整清单。

新代码归属：页面和平台适配留在所属 app；稳定、运行时中性且有真实多端消费者的契约/纯逻辑才进共享 package；只因两份文件相似不拆 package。

新的一般业务代码、统计/生成 job 和仓库自动化优先 TypeScript，求解器与大表生成优先 Rust；现存 Python 的迁移状态和必须保留的 Blender/研究/上游例外见 `docs/python-to-typescript-rust-tracker.md`。新增 Python 入口前先核对该跟踪表，避免把已经迁出的管道接回 Python。

仓库自有 PowerShell 脚本已迁为 TypeScript 或退役，清单和验证边界见 `docs/powershell-to-typescript-tracker.md`。新增自动化入口使用 TypeScript；调用方、CI、hook 配置和文档不得重新引入 `.ps1` 或把 `pwsh` 当作 TS 入口的依赖。

打乱统计的日常一键入口在 `core/` 运行 `pnpm stats:scramble`：默认增量运行全部作业，成功后自动灌线上 PG、通过同一个 `wca-data-latest` Release 发布最新统计，并增量上传独立在线分片；统计产物不再提交 Git。明确只想本地计算时用 `pnpm stats:scramble:local`；仅跑指定作业用 `--jobs stages|333opt|puzzles`，只读查看路径与计划用 `pnpm stats:scramble:local --plan`。新 checkout 先运行 `pnpm stats:hydrate` 恢复校验后的数据及发布基线。运行日常一键命令即明确授权本轮统计发布；其他代码 push 仍遵守部署章节。

创建或修改 Mac 快捷指令用 [mac-shortcuts skill](.agents/skills/mac-shortcuts/SKILL.md)；本机「跑打乱统计」实例见 [docs/mac-stats-shortcut.md](docs/mac-stats-shortcut.md)。

改 `core/apps/miniprogram/src/` 后必须在 `core/` 运行 `pnpm --filter @cuberoot/miniprogram build` 刷新开发者工具读取的 `dist/`；该命令不跑测试。
WXML 表达式直接写 `&&` / `||`，禁 HTML 实体；改 WXML 后必须通过小程序 build 并在微信开发者工具关闭项目后重开做干净编译。

新增生产依赖禁止 `package -> app`、`app A -> app B 源码`、`server -> client/client public`、`miniprogram -> React DOM/Next`、跨包 deep import 和任何现役包对 `packages/platform` 的引用；已有违规在架构跟踪表里递减，不得扩大。

所有 core pnpm 命令先进入 `core/`；Cargo app 进入自身目录运行 `cargo`；验证使用目标单元的 `typecheck`/`test`/`build`；API 部署按真实输入路径触发；push 前以当前 workflow path filter 与产物步骤核对范围，不从历史文档推断。

## 模块归属(fork 不能改)

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态(Vercel 走 `tools/[...slug]` 反代) | fork of or18/RubiksSolverDemo | ❌ |
| Alg Trainer | `/alg-trainers` | 同上 | fork of mihlefeld/Alg-Trainers | ❌ |
| csTimer | `/cstimer` | iframe → `/tools/cstimer/` | cs0x7f/cstimer | ❌ |
| BLDDB | `/blddb` | iframe → `/tools/blddb/`(next build 静态导出,统一入口 `cd core && pnpm upstream:sync --only blddb`) | nbwzx/blddb v2 | ❌ |
| 盲拧公式查询 | `/alg/3bld/lookup` | client,吃 `tools/blddb/data/*Manmade.json`(三阶六套) | 自有 UI + blddb 数据 | ✅ |
| WCA Stats | `/wca` | `jobs/stats-build` | jonatanklosko/wca_statistics TS 重写 | ⚠️ 管道重写,UI 自有 |
| Score Calculator | `/calc` | client `app/[lang]/calc/` | ported from carykh/hthgrapher | ✅ |
| 1v1 Battle | `/timer` 双人模式(旧 `/battle` 已退役,引擎在 `timer/_battle/`) | client | ported from MatteoColombo/cube_challenge_timer | ✅ |
| Recon | `/recon` | client | 自有 | ✅ |
| Trainer | `/alg`(公式库内,`/alg/:p/:s/select` + `/alg/{3bld,roux,skewb-trainer}`) | client | 自有 | ✅ |
| Recognize | `/recognize/pll` | client | 自有 | ✅ |
| Frame Count | `/frame-count` | client | 自有 | ✅ |
| Distribution | `/wca/viz` | client | 自有 | ✅ |
| Comp 比赛中心 | `/wca/comp` | client | 自有 | ✅ |
| Scramble | `/scramble/stats` | client + `stats/scramble/*.json` | 自有 | ✅ |
| Mosaic | `/mosaic` | client | ported from Roman-/mosaic | ✅ |
| Blog | blog.cuberoot.me | 独立 repo `cuberoot-blog` | 外部 | — |

改 upstream 模块先问用户;要改只改 fork 后新增/包装部分。

## 部署

- 提交发布不等待或跟进 CodeQL；其他必要 CI 和部署正常确认。

> **团队提交政策（2026-10-11）**：默认只改本地，不自动提交或推送。用户要求发布时，所有已有仓库写入权限的成员及使用其已授权账号的 AI 均可直接 commit → push main，无需 PR、他人审批或个人豁免。PR 可按需使用。推送前同步最新 main、解决冲突并完成必要验证，推送后确认适用的 CI 和部署结果；GitHub 不再以 PR 或检查通过作为普通推送的前置门槛。保留禁止强推、禁止删除主分支的保护，不夹带他人改动。当次指令优先。

- 小改动不单独提交；同一功能积累较多代码改动后再集中提交，明确要求立即提交时除外。
- 当次明确指令优先：用户说“仅本地/不 push”“只建 PR/先别合并”“不要部署”等时按当次范围执行；仅要求分析或评审的任务不自动变成修改与发布任务。
- 发布授权以本节和当次任务为准；Skill 中的常规 push/上传/workflow 提示不另设重复确认关卡。沿用平台和工具实际提供的权限与交互要求；本授权不授予新账号访问权，也不替代必须由用户完成的安全交接。
- 充分使用用户已经授予且实际可用的仓库写入权限，不擅自扩大账号权限。没有写入权限的贡献者仍通过 PR 交付。需要用户亲自操作或缺少必要信息时，说明具体原因和所需的一步。
- 推送、合并会按当前 workflow 和 Vercel 路径规则触发构建与部署；先核对实际范围，完成后据实报告。纯文档等未触发应用构建的变更不要求手动制造部署。
- 云工作区的终端 `git push` 缺凭据时，先核对已授权 GitHub 连接器的实际写入能力；可用则按团队直推政策或用户指定的 PR 流程继续。流程见 [GitHub 提交通道](docs/troubleshooting.md#github-提交通道)。新会话重新核对能力，分别报告终端认证、远端提交和正式部署状态。
- 主域 DNS 分线路:一路自有服务器 nginx→127.0.0.1:3002(systemd `cuberoot-next`;vhost `ops/nginx/`,改 nginx 走 `deploy_nginx.yml`);一路 Vercel(push 自动 build)。
- `static.cuberoot.me`:服 `{tools,stats}/`,CORS:*。`next.cuberoot.me`:staging 别名,同 :3002。
- Next standalone:`deploy_next.yml`(push client/shared/visualcube 触发)CI build→scp→原子换+健康检查+失败回滚;unit `ops/systemd/cuberoot-next.service`。
- Vercel 用 `VERCEL=1` gate 跳过 standalone;`app/{stats,tools}/[...slug]/route.ts` 在 Vercel fallback 拉 static.cuberoot.me。
- Vercel CLI 本机已登录:`vercel logs https://www.cuberoot.me` 自查 5xx,免截图。
- CORS allowlist:server `src/index.ts`,函数式放行 `*.vercel.app` + 主域。
- 后端 Hono 服 api.cuberoot.me(nginx→127.0.0.1:3001)。
- DB 迁移随 push 自动跑(`deploy_core.yml` reload 前 `apply_migrations.sh`),禁说要手动 ssh。
- 主域 `/blog` redirect → blog.cuberoot.me(独立 repo)。
- 前端调 API 必用 `apiUrl()`(client `lib/api-base.ts`),禁硬编码 origin;`/stats/*.json` 走 `statsUrl()`,禁相对路径。
- API 缓存头:可变数据浏览器 `max-age≤3600`,长缓存只给 nginx `s-maxage`;空/暂态 `no-store`;改响应 shape 必 bump `v=`。CI `tests/server-cache-headers.test.ts`。
- Pattern B:英文裸 URL,中文 `/zh`;内部链接用 `components/AppLink`;非 Link 导航手动 `${lang==='zh'?'/zh':''}`,禁硬编码 `/${lang}`;新路由免登记。
- dev/prod API base 用 `import.meta.env.DEV`,禁 `hostname==='localhost'` 判断(LAN/隧道域名会错走 prod 被 CORS 拦)。
- COOP/COEP 仅 `/scramble/solver` 发;Next `headers()` 与 nginx map 两处同步改。
- client 页面默认 SSG:根 layout 禁动态 API(cookies/headers),全局组件禁 render 调 `useSearchParams`;语言归属在 `[lang]/layout`。
- 省 Vercel 配额:①高基数/响应式 href/离开本页的 `<Link>` 必 `prefetch={false}`;②无 SEO 的动态 `[param]` 页走静态哨兵壳(`dynamicParams=false` + `generateStaticParams` 返 `['_']` + beforeFiles rewrite + client 读 `window.location`);③`public/` 大资产必设 `Cache-Control`;④取证看 `/www/wwwlogs/www.cuberoot.me.log`(全 IP+UA)。

## 开发预览域名接入

维护者 Mac 的终端命令 `cuberoot` 是本机 `~/.local/bin/devsite` 的同名快捷命令，登记在 `~/.config/devsite/projects.json`。它在 `core/` 运行现有 `pnpm --filter @cuberoot/client dev:clean`，开发域名就绪后打开 `https://dev.cuberoot.me`。

此命令复用既有常驻 FRP，不负责 DNS、证书或设备隧道配置。新增项目使用 `devsite add`，不要再复制一套 shell 启动函数。该工具属于本机配置，换设备或修改前先核对实际脚本、登记项及服务状态。

用户说“帮我配置 dev，名字是…电脑是…”、新增同事开发域名或撤销某台电脑时，读取 `.agents/skills/dev-preview/SKILL.md` 和 `docs/dev-preview-onboarding.md`。以 `ops/dev-preview/machines.json` 为唯一设备清单，使用 `core/scripts/dev-preview/cli.ts` 和 `client.ts` 完成登记、授权、DNS、证书、部署、电脑自启和验收；不能只改 DNS 就报完成。新增同事使用每设备独立 SSH 密钥，不分发现有 FRP 共用令牌。

## 开发命令

- **代码量统计（维护者要求，2026-10-22）**：用户说“统计代码量”“看看代码统计”等时，AI 直接运行 `cloc` 并汇总结果，不只提供命令让用户自行执行。默认在仓库根目录用 `cloc --vcs=git` 统计 Git 跟踪文件的当前本地内容，按需补充语言和主要模块统计；明确区分代码、注释、空行，以及数据、资源、第三方和生成内容，不把总行数称为自研代码量。维护者 Mac 已通过 Homebrew 安装 cloc；换环境先检查可用性。

流量异常排查先读 [`docs/traffic-monitor.md`](docs/traffic-monitor.md) 与 [`docs/traffic-defense.md`](docs/traffic-defense.md)（当前防护、费用保护、暂停及恢复步骤），2026-09-22 `/zh/calc` 峰值的证据见 [`docs/traffic-incident-2026-09-22.md`](docs/traffic-incident-2026-09-22.md)。先核对报表的 `coverage`：自动来源分析目前只覆盖自有服务器 nginx；Vercel 请求在现有 Firewall 和 Logs 中按时间与路径核查。Analytics 是浏览器事件，自有线路也可能上报，不能等同于 Vercel 页面线路；停用时不得为了监控自行重新开启。User-Agent 和浏览器名称不能证明是真人；不要把 nginx 请求数当作全站访客数，也不要为监控启用额外收费项。

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

### 本地计算内存与交换保护（维护者更新，2026-10-13）

- **长期求解任务生命周期（维护者要求，2026-10-14）**：所有长期计算必须持续保存可验证的结果和断点；用户中断或异常退出后，从已保存结果续算，不从头重跑。一次完整任务中，求解进程及只读大表必须常驻，逻辑批次只负责调度、验解和保存，不得每批退出进程、重载/重新全表校验，也不得用定时重启代替常驻。仅任务完成、用户停止、程序错误、授权到期或实际资源保护触发时退出。换出、压力、RSS、余量保护及独占锁继续有效；失败不得自动重启或重设保护基线。新 AI 修改此类任务时必须核查这两项，并用跨批次同一 PID 的运行证据确认常驻。

- **H10 求解规则已修改（2026-10-12）**：维护者明确允许启动 H48 h10 求解及其算法优化对照，运行时监控即为此类任务的启动条件，不再要求先具备系统级防换出机制，也不再按单次任务、命令或源码 hash 申请例外。此规则覆盖原版和实验版 H10 求解器，以及对照所需的小型辅助剪枝表；不授权重建 H10/H11 大表。启动前检查已有计算、内存压力和预算，运行中持续记录同一系统启动标识及 Swapouts；新增换出、压力异常、任务 RSS 超限或保守余量低于 2 GiB 时停止并保留结果，不得重设基线自动重启。不得据此宣称操作系统已禁用 swap。下列系统级防换出启动限制不再适用于 H10 求解，其他大内存计算仍按原规则执行。

- **cube48opt Rust 研究授权（2026-10-12）**：维护者明确继续 Opt1–9 原生移植与原版对照，允许该独立研究的建表、查表、求解和基准，但必须由 `solver/experiments/cube48opt-rust/guard.mts` 启动。用 `CUBEOPT_VARIANT=1..9` 选择档位，由入口按模式预估内存、排除并行计算并持续监控整个进程树 RSS、内存压力、同次启动的 Swapouts 和至少 2 GiB 余量；触线停止、保留结果，不得重设基线自动重启。禁止直接运行研究原生求解器的 `solve`、`oracle.mjs generate|query|solve`、`validate.mjs` 或 `benchmark.mjs`；`inspect`、`small`、`verify-small` 和小表坐标校验可直接执行。授权仅限这个研究入口，不解除 H10/H11 大表重建限制，也不改变日常统计仍使用 H10 的约定；监控不代表操作系统禁止换出。

Rust H10 融合研究同样使用该 guard：`CUBEOPT_BACKEND=h10` 显式选择已有 30,336,314,216 字节 H10 表，`solve-h10` / `query-h10` / `h10-benchmark.mjs` 的大表运行必须受监控；C 与 Rust 顺序运行，一次只驻留一份大表。小型 `verify-h10.mjs` 坐标检查仅读取辅助段。此授权来自维护者要求接入 H10 并同内存对照，不授权大表重建；原 Opt1–9 通过默认 `CUBEOPT_BACKEND=opt` 保留。

- **Rust H48 泛化运行边界（2026-10-13）**：独立研究新增 `solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES]` / `query-h48 H TABLE`，本机仅允许 H0–H10，并且必须经上述 `guard.mts`，显式设置 `CUBEOPT_BACKEND=h48` 与匹配 CLI 的 `CUBEOPT_H=0..10`。入口核对实际表文件大小和主表头的档位、布局，再按该档单表大小及预留内存设置预算；沿用研究锁、时限、同次启动的 Swapouts 基线、停止记录和至少 2 GiB 余量，不得并行驻留多份大表或重设基线续跑。此更新只开放已授权研究范围内的现有表查表和求解，不新增 Nissy H48 建表授权，不替换日常 H10 统计，也不自动授权其他批量或长期计算；旧 Opt1–9 与 H10 专用入口的规则保持。

H11 在本机仅允许源码实现、静态检查和不接触 H11 表文件的小数据算术/单元测试；**禁止 H11 建表、表文件加载或映射、查表、求解及基准**。guard 与 CLI 在表文件读取前拒绝明确的 H11 运行请求，不提供环境变量豁免；不得通过改名程序、表路径或其他入口绕过。代码支持 H11 格式不等于准许运行，预算充足或更换硬件也不会自动解除此限制。

- **单项授权更新（2026-10-11）**：维护者了解无法保证零换出后明确授权双底 AUF 样本测试，并要求有效则继续长期计算。本项允许使用现有 H48 引擎加持续运行时监控；仍须在新增换出、压力异常或保守余量不足 2 GiB 时停止，禁止重设基线自动重启。此例外仅限 `docs/double-zbll-trainer.md` 的 AUF 长期任务及其固定脚本，hook 用命令与代码 hash 限定，不解除其他大内存任务的默认拦截；仍不代表操作系统禁用了 swap。

- **适用范围仅为维护者本地电脑（当前为这台 Mac）上运行的项目任务，包括本地子进程、容器和虚拟机；不适用于阿里云等远程服务器或远程 CI。** 远程服务器允许按其现有系统配置使用 swap，不得把本节当作服务器上线必须禁用 swap 或升级到 cgroup v2 的条件。服务器任务仍应设置合理的内存、并发、批次和超时上限；不因此擅自修改服务器的全局 swap 设置。
- 以下交换保护要求均针对本地电脑。除上述已修改的 H10 求解规则及明确授权任务外，本地项目任务禁止使用 swap，不得把“少用”“尽量不用”或“发生后停止”当作满足要求。内存不足时缩小批次、降低任务内存占用或停止，禁止通过交换空间继续运行。
- 必须区分行为规范与操作系统强制保证：MD、启动 hook、定时读取换出计数都不能阻止内核第一次换出。没有核验覆盖任务及其子进程的系统级防换出机制，不得宣称已实现项目完全禁用 swap；除已按上述新规则允许的 H10 求解及明确授权任务外，不得启动或续跑大内存求解、建表、批量计算，先说明执行环境限制。
- 锁定部分表或缓冲区不等于整个进程及其子进程禁止换出；虚拟机内禁用 swap 也不等于宿主不会换出虚拟机内存。不得用这些局部措施冒充项目级保证。
- 求解、建表、批量计算启动前仍须核对当前可回收内存、内存压力、预计峰值与已有计算进程。资源不够就不启动，不擅自关闭其他应用。
- 启动前记录系统启动标识与交换换出计数，运行期间持续监控；macOS 使用 `vm_stat` 的 `Swapouts` 增量。系统重启前后的计数不能直接比较；已有交换占用、普通文件写入量不等于本轮新增交换写入。
- 一旦出现新增 swap-out、内存压力异常、触及任务自身 RSS 上限，或保守可用内存余量低于 **2 GiB**，停止本任务计算，保留完整结果与断点并报告。更严格的已有任务门槛继续有效，不因这条规则降低。
- 交换保护触发后不得通过重设基线自动重启；先查清资源变化并重新核对安全条件。同一系统启动期间，续算应核对上次保护记录，不能把已增长的计数当成没有发生过。
- 已有运行时资源监控继续作为额外停止保护，不能替代系统级防换出机制。
- 启动拦截由 `.codex/hooks/block-unprotected-memory-compute.mts` 接入 `Bash` PreToolUse，覆盖已登记的双底 ZBLL、H48 大表生成、部分大表分析器及打乱统计入口；H10 求解入口按 2026-10-12 的规则变更放行，不再要求源码 hash 白名单。cube48opt Opt1–9、Rust H10 及泛化 H0–H10 研究计算仅允许经其专用 `guard.mts` 启动，每个 shell 命令段分别检查，不能用分号前的 guard 豁免后续直接计算；明确的 H11 请求即使经过 guard 也拒绝。其他未授权计算入口默认拒绝，`NO_SWAP=1` 不能豁免。统计只读 `--plan` 和普通开发命令不受影响。新增大内存入口须同步守卫及回归用例；hook 不解析任意别名或生成脚本，也不控制手动终端、已运行进程或操作系统，不能把安装 hook 当成系统已经禁用 swap。修改 hook 定义后须在新会话信任配置并验证实际拦截。
- 不把项目约束自动扩大为整台电脑的系统设置修改；不擅自关闭 macOS 的交换机制、修改系统服务或禁用系统保护。

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

## 代码风格

- **厂商与培训机构 logo（维护者要求，2026-10-26）**：不加白色或其他装饰性描边、外框、光晕；原素材自带的白色轮廓也应使用无描边版本替换。保留品牌原色与标志形状，优先复用真实 SVG 矢量资源，不把 PNG 嵌入 SVG 冒充矢量。统一复用 `CubingBrandLabel` 和 `public/images/brands/` 资源，新增品牌或机构时同样遵循；logo 内部有意义的白色图形不视为装饰描边。

- **界面与文案精简（维护者要求，2026-10-19）**：不要重复内容、常驻提示和阅读套话。同一信息只展示一次，不重复标题、名称或说明；不添加“点击即可…”等常驻操作提示，以及“请阅读以下内容”“温馨提示”等无实际信息的引导套话。必要说明放到设置、按需帮助或交互时的短暂反馈中，正文只保留用户完成任务所需的信息。

- 页面层级优先用留白、间距和排版区分；分隔线仅在确实帮助辨识内容边界时使用。导航、标题和工具栏已有清晰布局时保持简洁，去掉多余的装饰性横线。
- 布局保持均衡，根据内容量和屏幕宽度合理安排列数、容器宽度与间距，避免大面积无意义留白；通过调整布局保持紧凑与可读性。

- 弹窗必须支持点击/触摸外部遮罩关闭,内部操作和从内部拖到外部不得误关;新改弹窗遮罩复用 `useModalDismiss` 返回的 props(已有生命周期用 `useModalBackdrop`),关闭等同取消且不得隐式保存/提交,仅提交中的临时禁用可阻止关闭;hook + CI 检查漏接关闭事件。
- 新增或复刻任何功能前先全仓搜索现有组件、数据源、工具、交互契约与资源，存在同职责实现时直接复用或先提取单一事实源，禁止复制后改名、各端维护副本或擅自增加源实现没有的内容，跨运行时只保留必要的平台适配层。
- 复用内嵌逻辑时，能抽取就优先抽取：若逻辑仍属于某个页面、组件或业务入口，先将可共用部分移到职责合适的公共模块，再让原调用方和新调用方共同引用，避免新调用方直接依赖原业务入口或复制实现。抽取保持原调用方行为不变；已经独立的公共实现直接复用，不为抽取而新增无必要的层级或 package。
- 优先编辑已有文件；typecheck 范围遵循全局验证规则。
- 改动先定位根因,禁止在症状点打补丁;根因定位后落地用最小实现,不臆造抽象层/翻译层。
- 展示格式化、隐藏步骤和本地化后的值只用于渲染或复制;播放器、计算、校验、保存、API 和派生状态必须使用无损原值,登录/管理员态只能增加操作能力,不得改变公开内容语义。
- SSR 首次 render / useState 初始化禁读随机数、当前时间或浏览器存储;固定首屏后再用 effect 更新,外部存储走 useSyncExternalStore 的 server snapshot。
- 浏览器标题统一使用 metadata 或 `useDocumentTitle`；弹窗/嵌入内容不得抢外层页面标题，复用 `AlgCaseView` 时传 `embedded`。动态标题 hook 由单一监听器协调多个使用者，禁止恢复为每实例各建标题 MutationObserver；关闭时恢复仍挂载的标题拥有者。回归见 `tests/recon-case-dialog-title.test.ts`。
- 新增或修改 MutationObserver/ResizeObserver/effect 同步时，核对回调写入是否会再次触发自身或其他监听器；相同值不重复写，共享 DOM 状态只保留一个写入入口，卸载时清理订阅。涉及页面嵌套/弹窗时用有硬性次数上限的隔离回归验证挂载、关闭与重新挂载，不能只验证单组件或用延时掩盖循环。
- 浏览器端源码禁用正则后行断言,改用捕获边界或显式前字符判断;Hook + CI 守卫。
- UI 可用 lucide-react;不放页面级"返回"按钮(wizard 步骤间不算)。
- **返回导航（维护者要求，2026-10-20）**：全站已有或确需保留的返回导航只显示箭头，不显示“返回”“首页”“Back”等文字；通过 `aria-label` 或 `sr-only` 保留明确的无障碍名称。返回首页复用 `BackHome`，其他返回导航优先复用已有组件，不另造带可见文字的版本。本规则不要求新增返回入口，也不适用于“返回公式”等恢复内容的功能操作。暂不增加 hook。
- `BackHome` 必须放进与正文同宽的 header/topbar/wrap，禁直接挂在 full-bleed page root 下。
- 按钮式交互必须真 `<button>`(剥 UA 样式)或 `AppLink`,禁 `<div/span onClick>`(iOS Safari tap 不可靠);例外 div 加 `role="button"`+`tabIndex`+`onKeyDown`;豁免注释 `allow-static-onclick`。守卫:hook + CI ratchet。
- 选择/搜索输入框非空时显示清除按钮,统一 `components/ClearButton`。
- 所有密码输入统一复用 `components/PasswordInput`,必须带可切换明文的眼睛按钮,禁页面手写 `type="password"`。
- 切换器默认下拉;chip 仅当选项 ≤4 且需左右对比。
- 布尔开关用 `BoolToggle`，全项目统一内容/文字在左、开关在右（共享组件保持此 DOM 顺序，页面不得用 row-reverse/order 反转）；同组纵向设置行须占满共同宽度，开关右侧对齐，不得随标签长短错位；设置行已有独立标签时，开关也放在标签右侧。`block-toggle-side.mts` 与 `toggle-side-guard.test.ts` 共用扫描器，覆盖 client/timer-ui/app-ui；Hook 检查新增片段，CI 验证完整源码和共享 DOM 顺序。二选一统一用浏览器原生 `<select>` 菜单；`PillToggle` 仅保留无文字开关底层，不再提供二选一形态;禁裸 checkbox,特例注释 `allow-checkbox: <理由>`。守卫:hook + CI ratchet。
- 表头排序一律 `components/SortArrow`(文字右侧,仅当前列显示)。CI 守卫。
- 下拉/菜单宽度 fit-content,column flex 加 `align-self:flex-start`;禁钉 `min-width`。
- 锚定下拉面板(absolute + top:100%)必挂 `hooks/usePanelClamp` 钳视口,CSS 注明 `anchored-panel: clamped`;确证安全注明 `anchored-panel: safe (<理由>)`。守卫:hook + CI ratchet;实测 `audit:overflow` popup pass。
- 共享控件的页面定位覆盖不能依赖 CSS 加载顺序：用 `.共享class.角色class` 等明确作用域，禁止同优先级单 class 覆盖。absolute/fixed 改 relative 时显式重置原有 inset/top/left 等偏移，改 static 时重置 transform/translate；静态定位下未生效的 inset 不视为 bug。Hook `block-css-position-cascade.mts` 与 CI `css-position-cascade-guard.test.ts` 共用扫描器；规则内 `allow-css-position: 具体理由` 才能豁免，动态 class/复杂选择器仍须浏览器复核。
- 吸顶表头走 `components/sticky-table.css`(`.sticky-scroll` + `.sticky-thead`),禁手写 sticky thead;契约见文件头注。
- 新可复用组件/hook 登记 `/dev` catalog(`_catalog.tsx`)。CI 守卫:`dev-catalog-sync` + `dev-tokens-drift`。
- 答题/训练的对错提示统一复用 `components/TrainingFeedbackOverlay` 的绿色 ✅ / 红色 ❌,禁页面自画。
- 浏览器基线跟随当前 Next 官方支持范围，禁为旧 WebView/开发者工具下调 `browserslist`；旧内核走全站启动失败提示，顶层 `ssr:false` 加载态用 `ClientLoadStatus`。CI:`browser-support-policy.test.ts` + `timer-bootstrap.test.ts`。
- 项目菜单统一用 `components/PuzzlePicker`;WCA 筛选用默认菜单式 `WcaEventSelector`/`WcaEventMultiSelector`，师生编辑和双人计时浮层显式 `presentation="inline"`；比赛列表保留项目表头；禁页面自写项目菜单。hook + CI 守卫:`component-reuse-guard`。
- `/alg` case 详情统一走 `AlgCaseView`:静态主图用 `CaseThumb`,动画用 `AlgPlayer`;多朝向不得省略主图或另造结构,桌面一行一朝向且动画左公式右。
- **魔方静态图的本地绘制（2026-10-16）**：`/alg`、`/recon`、`/timer` 的应用内状态图优先复用现有 `CaseThumb` / `VisualCube` / 计时器共享绘图器，不依赖 `/v1/visualcube.svg` 的网络往返。当前题、上一个、弹窗等少量图使用 `local`；长列表、选择网格和旧成绩必须使用 `local` + `loading="lazy"`，由 `VisualCube` 复用 `LazyVisible`，在接近视口后才生成 SVG，并预留准确宽高。禁止为了本地化一次同步生成全库，也禁止把旧记录悄悄切回网络图；新增同类页面沿用此契约。动画继续用既有播放器，视频封面、静态资源与对外可分享的 SVG URL 不属本地绘图替换范围。回归见 `tests/visualcube-lazy-local.test.ts`；相关技能见 `.agents/skills/visualcube/SKILL.md`。
- 全局固定按钮对齐内容右沿:`right: max(16px, calc((100vw - <content-max-width>) / 2))`。
- chip/tab/下拉项不显示数量计数。
- WCA 时间锚点:时间序列默认视图从 2003-08-22 起步(第 0 帧 = 1982 快照),统计聚合必含 1982 场。
- 可为任务边界读取 `git status`/diff，仅需历史证据时读 `git log`；文件和配置的增删改遵守部署章节的长期授权、当次任务范围及权限边界，保留他人未提交工作，执行仍遵循全局回收站规则。
- 报根因/"修好了"/done 前必须实证(日志/EXPLAIN/run 输出/playwright);未证实标「假设」;性能/502/OOM 先 profile 禁猜。
- UI 验证先搜并用 Playwright MCP(可能延迟加载);fixtures 全集别采样。
- 新路由先 grep 防撞名;路由改名/合并不为旧路径加 redirect。

## WCA 统计筛选与数据一致性

- 为 WCA 纪录统计新增或修改级别／地区筛选时，必须使用 `WcaStatView` 的 `RecordSectionsView` 与 `selectRecordSection`；生成端通过 `GroupedStatistic` 输出带 `recordScope: { region, level, event, type }` 的分区，参考 `core/jobs/stats-build/src/core/record_scopes.ts` 和三个现有纪录统计。不得单独硬编码一套筛选选项。
- 筛选选项只来自当前条件下有行数据的分区；不能提供点进去才发现无数据的洲际、地区、项目或类型选项。只支持单次时，不提供平均或重复的“单次与平均”。整项统计未生成与某个组合确实无人达成要分别核实，不得把构建缺失当成无成绩。
- 先按地区、级别及适用的项目／类型计算排名，再分别截取 Top N；禁止在已经截断的全球榜单上过滤以冒充各洲或各项目完整榜单。世界纪录同时计入相应洲际／国家纪录；地区按选手取得成绩时的所属国家，不按比赛举办地。
- 新统计必须同时交付生成器和真实生成数据；修改 SQL 仍须遵守 `stats-build` skill 的实库校验要求。`tests/wca-record-filters.test.ts` 自动发现纪录统计并遍历全部生成分区，缺文件、缺筛选元数据、空分区、重复组合或不可达组合均失败。CI 用 `core/scripts/list-record-stat-fixtures.mjs` 同源发现需要检出的 JSON，不维护另一份新统计名单。
- 改用新数据形态或新渲染入口时，同步扩展上述发现逻辑及测试；自动检查只覆盖已纳管结构，不能代替新统计口径与数据完整性的审查。

## 登录系统与流程图同步

- `/dev/auth`（中文 `/zh/dev/auth`）是跨平台账号生命周期说明。修改登录/注册、第三方身份、绑定/解绑、找回密码、会话/回跳、合并或注销时，先读 `core/packages/client/app/[lang]/dev/auth/page.tsx`，同一任务同步流程图及中英文说明；不得把设计方案、已实现、已部署和真机验收混写。
- `tests/auth-doc-sync.test.ts` 已纳入 client test / CI：对已纳管的登录源码路径与内容计算指纹，新增、删除、改名同样触发，Windows 换行差异不触发。在 `core/` 运行 `node scripts/check-auth-doc-sync.mjs` 可独立检查。
- 完成流程复核后，用上述命令加 `--fingerprint` **只读取得**新指纹，在流程图源码的 `auth-doc-review` 注释中更新 `fingerprint` 与具体 `reason`。有行为变化必须改相应流程节点；仅重构/样式变化可保留图，但说明核对了哪些流程、为什么不变。禁止只刷新日期、只换指纹或自动生成空泛复核说明来消除失败。
- 新增不在命名/路径规则内的登录入口或原生适配时，同步守卫范围和覆盖测试；自动检查只能证明源码变化已被确认，不能代替语义审查。继续运行 `auth_flow_documentation.test.ts` 验证平台与生命周期边界。不得为了更新图新增第二套登录实现。

## 页面标题 / SEO metadata

新增路由或修改标题、SEO metadata、sitemap、hreflang、索引策略或长文结构化数据时使用 `document-title` skill，并必须读取其 [SEO 契约](.agents/skills/document-title/references/seo-metadata.md)；保留静态 metadata 单一来源与 SSG 边界。

## URL 状态(全站统一 nuqs)

- 页内状态进 URL 一律 `useQueryState`,禁裸 `history.pushState/replaceState` + 手写 `popstate`(maplibre/canvas/video 重组件例外加注释豁免)。CI `tests/url-state-no-raw-history.test.ts`(豁免加 ALLOWLIST + eslint-disable + 理由)。
- 大视图/大 tab/全屏浮层 → `.withOptions({ history: 'push' })`;筛选/排序/搜索 → 默认 replace;默认值 `.withDefault(x)`;枚举 `parseAsStringEnum`。
- 分页、列表/卡片布局、日历日周月显示、项目/轮次筛选、训练范围与练习内换题同样用 replace；URL 仍保留可分享状态，返回不应逐次撤销这些操作。真实内容导航（详情、课程章节、聊天会话、全屏浮层）才用 push。CI `tests/url-state-no-raw-history.test.ts` 用 AST 核对显式 `history: 'push'`（含条件分支及 setter 覆盖）；新增导航须在 `core/packages/client/scripts/navigation-history-allowlist.json` 按具体文件、调用和理由登记，禁止整页放行或为通过检查把筛选冒充导航。此守卫不替代对 router/AppLink 和间接动态配置的审阅。
- 沉浸浮层返回用 `history.back()`,`history.length<=1` fallback 硬导航父路由。
- `useQueryState` 只在页级 client 组件用,禁进全局 chrome;重排 query key 顺序走 `AppNuqsAdapter` 的 `processUrlSearchParams`。
- 范本:`app/[lang]/wca/comp/page.tsx` 的 `viewMode`。

## 主题/颜色

`/dev/infrastructure` 的设备图片必须是实际透明背景的产品抠图，不能把白底、棋盘格或其他底色烘焙进图片。仅检查 PNG/WebP 的 `hasAlpha` 不够：还要检查产品外空白区域的像素透明度，并在深色、浅色背景上预览。这个页面的透明 WebP 用 `next/image` 时保留 `unoptimized`，本地曾实测 Next 图片优化把它们转成白底 JPEG。替换已浏览过的同名图片时更换资源 URL，避免缓存继续显示旧图。

写任何 CSS 色值前调 `theme-tokens` skill(token 表 + dark-locked 页清单 + color-mix 规则);禁 `#888 #aaa` 等硬码灰阶。

透明背景材质只在 `glass-material.css` 定义，旧样式由 `site-surfaces.css` 适配；新表面复用 `data-site-surface="panel|popover|heading"`，禁页面另造透明度/blur，保留状态色和无障碍回退，详 `theme-tokens` skill。

多余底框只约束已确认的位置，复用现有材质 Hook/CI；截图巡检按需运行，不作为日常开发或提交的额外门槛，不凭候选自动扩大禁用范围，详 `docs/glass-menu-regression.md`。

- 按钮/链接的短悬停提示统一使用 `components/Tooltip`（`<Tooltip content={tr({zh,en})}>{(tip) => <button {...tip}>…</button>}</Tooltip>`），禁止另写页面级提示气泡或用 native `title` 代替需要设计样式的提示。触发属性放在实际按钮上；已有同名事件须组合调用。写入 Hook 和 CI 共用材质扫描器拦截 `content: attr(data-tooltip/data-tip/title)` 伪元素气泡（不覆盖任意 JSX 或动态样式）；组件负责 hover/focus、Escape、可移入提示、Portal 和视口钳制，页面不再定义 blur/透明度。可交互内容不放 Tooltip，点击展开的说明继续用 InfoTooltip。Portal 继承全站主题；局部配色预览须单独核验。

## i18n(繁体已移除)

- 全站只 en + zh-Hans。守卫:hook `block-handwritten-trad` + CI `i18n-removal-guard`(含 en/zh key 对齐)。
- 文案走 `tr({en,zh})` / `<T en zh/>` / `useT()`;长文/复用走 `t()` + `en.json`/`zh.json`;HTML lang `en`/`zh-Hans`。
- 禁内联 `isZh`/`i18n.language` 文案三元(`isZh ? '中' : 'EN'`);`isZh` 仅可作 util 参数。守卫:hook + CI ratchet。细则调 skill `i18n`。
- 一般社区魔方术语 zh 查 `client/app/[lang]/wiki/glossary.json`，WCA 专名与规则语境按下条官方来源核对，禁凭语感直译；陷阱表+黑名单守卫见 skill `i18n`。
- 翻译 WCA 规则、公告或意外事件记录前，先读 [WCA 英中翻译参考](core/packages/client/public/regulation/wca-translation-reference.md)，再按条款号查同目录 `wca-regulations-bilingual.md`；机构、菜单和页面用语直接查 WCA Weblate 简体中文项目（如 WIC = 廉政委员会）。网页入口 `/regulation/translation`。保留版本、主体、义务强弱和处罚范围，历史 WDC/WAC 不替换成当前机构或缩写，原译疑点单列，不把对齐语料视为已逐句审核。一般社区术语仍查词典。
- WCA 官网翻译以 [Weblate 简体中文项目](https://translate.worldcubeassociation.org/projects/wca/-/zh_Hans/)为主要来源，规则含义仍以适用版本英文为准。AI 优先查 `https://api.cuberoot.me/v1/wca/translations?q=<URL编码查询>&limit=5&v=1`，核对 ready/stale 和来源；未命中或服务不可用再查 Weblate，最后使用同提交的官方 GitHub locale 文件后备。不手改服务器镜像，不自造官方译名。具体检索步骤和权限边界在上述 MD 与 `i18n` skill 中维护。
- 教程项目选择器的 ivy 中文短名固定为「枫叶」,禁加通用品类后缀。
- 站内违禁词表 `.codex/banned-words.json`(hook `block-banned-words` 写入即拦,`.codex/` 自身豁免);用户说「添加违禁词:x」= 往该表加 `{word,use,why}` 一条。行内豁免注释 `allow-banned-word`。

## 指法记号（公式库 / 教程 / 模拟器）

改指法、`algHtml` 标记含义、指法导入/导出或 AI 公式转换前，先读 [统一指法记号契约](docs/fingertrick-notation.md)。保留富文本和纯文本两种写法，共用语义；删除线表示中指、斜体表示拇指，下划线须结合转动与来源判断，禁全部替换成 `p`。动作编排另读 `core/packages/client/app/[lang]/sim/engine/hands/FINGERTRICKS.md`；严格区分记号规格、解析支持和动画验收。

## Skill 路由

Skill 路径按 catalog 的 root alias 展开,禁猜路径。

主题命中 trigger 时主动调对应 skill,不凭记忆(描述已由 harness 加载,不在此列索引)。

## Space / Blender

Space 的 `.blend` 源工程及必要原始贴图纳入版本管理时必须使用 Git LFS，禁普通 Git 强制加入；`.blend1`、缓存和临时渲染不入库；当前暂缓 LFS 配置与资产上传，后续编辑先读 `design/space/README.md` 和 `docs/space-blender-tracker.md`。

## 造求解器 loop

`/loop 继续造求解器`(或"造求解器")= 读 `solver/SOLVER_LOOP.md` 全文,按 §0 推进 §1 backlog 下一个未完成单元。

## 造 SQ1 最优求解器 loop

`/loop 继续造 SQ1 最优求解器`(或"造 SQ1 最优")= 读 `solver/SQ1_WCA_LOOP.md` + `solver/SQ1_WCA_GODS_NUMBER.md` 全文,按前者 §0 推进;≤15GB 大表、禁 OOM；线程默认用机器可用并行度。

## 求解器磁盘表生成

执行命令、源码入口、进度查看与验收记录见 [solver/HIGH_MEMORY_TABLE_PROFILE.md](solver/HIGH_MEMORY_TABLE_PROFILE.md)。修改 H48 遍历或进度前先读 [solver/vendor/nissy-core/VENDOR.md](solver/vendor/nissy-core/VENDOR.md)，保留固定上游的计算边界及分布校验基准。

需要生成、补齐或重建 solver 磁盘大表时，统一从 `solver/` 运行 `cargo run --release --bin table_generator`。SQ1 精确表与 H48 h10 也由这个入口生成；只补单表用同一 binary 的 `--only sq1` / `--only h48-h10`，H48 小档位流程验证用 `--only h48-h7`，不要把 ignored test、`333opt/gen-table.mjs` 或上游工具当作给 AI 的独立建表步骤。H7 只验证生成和校验流程，不替代统计管道所需的 H10。三阶整解离线统计统一使用原生 H48 h10，经 `solver/333opt/solve_h10.mts` 接入；不再生成 cubeopt9。表根目录由 `CUBE_TABLE_DIR` 指定，默认 `solver/tables/`；逐表耗时和峰值 RSS 由生成器写入该目录。64 GiB Mac 上 H48 h10 的 RSS 警戒线为 57 GiB，触线停下报告；线程使用可用 CPU 并行度，不手工钳制 12/14。

H48 **建表**不得把正在写的表文件映射为计算缓冲区（禁止 file-backed mmap / MAP_SHARED 生成）：先在进程内存中生成，完成上游校验，再顺序写入临时文件、同步落盘并原子改名。2026-09-24 本机有上限对比显示文件映射 256 个短状态约 163 秒，而内存生成的上游加锁算法 32,768 个约 35 秒；不得为降低 RSS 擅自改回文件映射。读已完成表的只读映射与建表写入是不同用途，仍须遵守上述 H11 禁令。当前统一入口支持 H7 流程验证与正式 H10；nissy-core 此版本最高 H11（约 56.50 GiB 表），H12 不受支持。未来另获 H11 运行授权后也不能只改 `h10` 字符串：要同步生成器大小和资源警戒、原生求解器、TS 编排、统计管道、进度查看与 `/dev/solvers` 快照，并用真实表与样例验收。

## 造非 WCA 小魔方求解器 loop

`/loop 继续造小魔方求解器`(或"造非 WCA 求解器")= 读 `solver/NONWCA_PUZZLE_LOOP.md` 全文,按 §0 推进;纯 TS 路线(Ivy 范式,非 Rust),TIER D 前有 soft-gate。

## 论坛视频时长

“视频时长限制改成 X”=只改 `core/packages/shared/src/forum.ts` 的 `FORUM_VIDEO_MAX_DURATION_SECONDS`，前端提示/预检与服务端校验共用它。

## 项目菜单短名

### 项目图标先进入图标库（维护者要求，2026-10-20）

新增或修复具体拼图的图标时，先按 [wca-event skill](.agents/skills/wca-event/SKILL.md) 在 `core/packages/event-icon/svg/` 制作或复用真实 SVG，生成共享映射并确认 `/zh/icon`（英文 `/icon`）可查看、搜索和下载，再让模拟器、打乱器、计时器与 App 消费同一键。原创图放 `svg/puzzle/`，保留上游原稿；按实际外形、切割、阶数和联体重叠绘制，不借相似图冒充，不用文字缩写长期替代具体拼图的图标。训练阶段、自定义模式可保留语义文字徽标。同步中英文名称与事件别名，运行现有 `puzzle-icon-catalog.test.ts` 覆盖检查，并在图标库及实际菜单小尺寸、深浅主题下目检；新增模拟器必须同一任务交付图标，不留给下一轮 AI 补。

网站所有项目选择菜单（含分组、选中项、提示名称）不得出现「魔方」二字，例如「二重奏」「枫叶」「齿轮」。使用统一 PuzzlePicker 的展示规则，并在项目目录数据中直接写短名；不得改项目 ID、计算或保存值。此规则只约束项目菜单，不禁止文章正文等正常用词。写入守卫 `block-puzzle-menu-label.mts` 与 CI `puzzle-menu-label-guard.test.ts` 共同维护；新增菜单数据源时同步纳入检查。

项目菜单的三维尺寸省略乘号，写作 `233`、`334`、`335`，不写 `2×3×3`、`3x3x4`；中英文名称、左侧文字标签、选中提示保持一致。仅格式化展示，不改项目 ID。

## 2026-10-17 日常统计切换正式 Opt10

维护者明确要求将日常 333 整解统计切到正式 CubeRoot Opt10（32G 档）。此条取代上文日常必须使用 Nissy H10 的约定；不授权重建大表。`solve_h10.mts` 保留兼容文件名，默认 `H10_ENGINE=opt10`，使用 `opt10-release.mts verify` 核验的正式制品及 `.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat`（31,130,911,744 字节），不能与旧 H10 表互换。`H10_ENGINE=c|rust` 保留显式旧后端，须自行具备旧表。

统计专用 `scramble-stats-opt10-session` 经过原 guard，共享正式制品历史资源审查、独占锁、换出/压力/RSS/2 GiB 余量保护；不使用 ZBLL 的基线重审或到期例外，不重设已有基线。单进程、单批次 worker、默认最多16个搜索线程，全语料期间只加载一次表，已有 `out.0.csv` 按 ID 续算，逐行落盘。这里只修改入口，不启动整轮统计、不发布。下一次运行快捷指令仍按其原有完整计算后发布语义执行。

### 2026-10-17 日常 Opt10 统计启动规则更新（维护者明确授权）

维护者同意取消历史换出计数锁定、保留运行保护，并要求开始续跑。仅 `scramble-stats-opt10-session`：每次用户主动启动时核验正式制品、当前压力、可用内存和独占锁，以当前 boot/Swapouts 建立本轮固定基线；历史非零计数或旧停止记录不再永久阻止新任务。运行中不得更新基线，新增换出、异常压力、RSS 超限或余量不足仍立即停止，不自动重启。每轮基线、资源采样及停止证据单独保存在 `.tmp/scramble-stats-opt10/runs/<timestamp>-<pid>/`，保留全部旧记录及求解结果。此条取代此前日常统计对48/80的逐次批准要求，不扩大到其他研究或建表任务。

## 圆角

统一复用 `@2017yanr02/continuous-corners`：全站入口 `core/packages/client/app/layout.tsx` 的 `SiteCorners`；自定义／反向圆角用包内 `continuousCornerRadii` 生成。禁止用渐变、手绘曲线或 CSS squircle 替代；真圆保持圆形。

## 导航

新增或修改导航相关 UI 前，先查 `@app-foundation/navigation-ui` 的 README 与导出，优先复用；通用能力补进共享包，避免本站重复实现。

内部工作台与联系页侧栏复用 `@app-foundation/navigation-ui`，接入见 `core/packages/client/app/[lang]/{workspace,contact}/page.tsx`；布局、动画和圆角在共享包修改，业务菜单与权限留在本站。
