# 下载页与安装包分发

状态：`REFERENCE`。下载页源码入口为 `core/packages/client/app/[lang]/download/`，中文 `/zh/download`，英文 `/download`；首页顶部入口位于设置和会员之间，对所有用户显示，无需登录。

## 渠道与安装包

- 页面复用 `/icons/icon-512.png` 的现有 App 图标；Google Play 入口使用本地托管的官方中英文徽章，素材来源见 `core/packages/client/public/badges/README.md`。
- `core/packages/client/lib/app-downloads.ts` 集中维护官网分发链接。Google Play 指向公开的 `me.cuberoot.app` 商品页。
- 下载页读取 `https://static.cuberoot.me/downloads/android/latest.json` 的版本、不可变 APK 地址；首屏和网络失败回退到同源 `latest.apk`。两者均禁止缓存，分别由服务端原子替换，APK 就绪后才更新版本清单。页面保留独立点击统计。
- Windows 提供安装版和免安装 EXE 两个入口，读取同源 `/downloads/windows/latest.json`；尚无有效清单时禁用，不回退到本机旧包。iOS、macOS、HarmonyOS NEXT 仍显示「即将发布」。
- 官网 APK 使用维护者长期正式上传密钥，不能覆盖 Google Play 不同签名的安装版。页面明确提示 Play 用户继续通过 Play 更新，避免卸载丢失本地记录；本轮没有连接真机，未完成安装/升级及真实业务验收。不得把 debug、unsigned 或 CI 临时签名包用于官网分发。
- 将验证后的包上传到受控 HTTPS 静态存储，使用带版本号的不可变地址；确认响应、文件大小、SHA-256、续传和国内访问后再切换最新版本指针。安装包不提交源码 Git，不经业务 API 转发。静态文件位于服务器 `/www/wwwroot/toolkit/downloads/android/`，由 `ops/nginx/static.cuberoot.me.conf` 提供附件下载与单段 Range；nginx 配置仍通过 `deploy_nginx.yml` 发布。
- 发布新包先完成文件校验，再切换链接；撤回时改回已验证旧版或置 `null`，不覆盖同名版本文件。

## 手动一键 Android 发布

### 管理员官网发布（Android / Windows）

正式入口为 `/admin/releases`（中文 `/zh/admin/releases`）及手动 `app_release.yml`；下载页的管理员链接指向该后台页面。普通 push 继续由 `test.yml` 检查和构建，不发布下载包。旧 `android_release.yml` / Mac 命令保留为独立 Play 和历史制品恢复入口；官网日常发布使用新入口，不交替操作两个发布协调器。

`app_release.yml` 固定已审核 main 提交，使用环境 `app-release`。该环境必须仅允许 main 部署；如配置每次人工审批，网页任务会等待审批，不能宣称无人值守一键发布。授权的管理员发布无需额外审批时不设置 required reviewers。工作流的 `run_number=N` 是正式发布序号，版本为 `1.floor(N/1000).(N%1000)`，Android versionCode 为 `1000000+N`；首次为 `1.0.1 / 1000001`。失败允许跳号，重试同一 run 保持版本；不要删除并重建该工作流以重置序号。发布端拒绝降级及同版本内容替换。Windows 两份 EXE 共用同一版本，全部公网哈希校验通过后才原子替换清单。

环境 secrets（不写源码、不输出日志）：

- `ANDROID_KEYSTORE_BASE64`：现有正式 JKS 的 Base64；必须对应 `ANDROID_RELEASE_CERTIFICATE`，不得新建替代密钥。
- `ANDROID_STORE_PASSWORD`、`ANDROID_KEY_PASSWORD`、`ANDROID_KEY_ALIAS`：该 JKS 的密码与别名。
- `APP_RELEASE_SSH_KEY`、`APP_RELEASE_SSH_HOST`（`user@host`）、`APP_RELEASE_KNOWN_HOSTS`：静态站发布 SSH 凭据及预先核验的主机公钥，不在运行时无验证接受新主机密钥。

API 配置 `APP_RELEASE_GITHUB_TOKEN`：限定 `2017YANR02/cuberoot.me`、Contents read / Actions write 的 fine-grained token，仅留在 API 服务器环境，不传给网页。`GET/POST /v1/admin/app-releases` 使用现有 Bearer 登录与 `requireAdmin`，不接受通用 X-Admin-Key。GET 返回 main 提交、最近任务与待确认请求；POST 只接受 UUID、main 的精确 SHA、android/windows/both 和更新说明。main 已变化返回 409，需刷新后重新确认。没有 token 时管理页显示未配置，不假装已发包。

请求回执默认保存在 API 主机持久目录 `/root/core-api/data/app-release-requests.json`，可用 `APP_RELEASE_STATE_PATH` 指定同一共享持久卷；PG advisory transaction lock 协调同机多进程。没有数据库 schema 变更。部署不可清除此文件；如果未来多机运行 API，必须共用该文件或迁入事务存储。网络超时保留 unknown 状态，先根据请求 UUID 在 Actions 核对是否启动，不自动重发。若人工确认 GitHub 从未接收，维护者在持有同一 advisory lock 的维护窗口将该条回执标记 rejected 后才可新建发布，不能以超时为理由直接删除回执。completed 回执永久保留以支持幂等，历史任务从 GitHub 列表淘汰后不会再次阻塞。

这是对原「私钥仅留 Mac」流程的明确变更：维护者已授权将正式签名凭据配置到受保护 CI 环境。代码落地不代表这些 secrets 已配置。构建任务只在签名步骤获得 Android 密钥；发布任务仅获得 SSH 凭据。Windows 当前不做 Authenticode 签名，首次下载可能显示 SmartScreen 提示；Tauri updater 尚未启用，应用内更新入口下载新版供用户安装。

发布任务分别保留 Android/Windows 制品 30 天。官网不可变文件保留在静态服务器；Windows 使用 `/downloads/windows/latest.json`，包含安装版、免安装 EXE 的 URL、大小和 SHA-256。免安装 EXE 需要现有 WebView2，数据仍使用应用数据目录，不承诺移动 EXE 即携带数据。发布前需验证干净 Windows 上安装/启动、登录回跳、覆盖更新与成绩保留；构建通过不替代这些验收。

每个平台独立切换清单，另一平台失败不回退已成功的平台。失败可重跑失败 job，完整重跑已发布 run 会因不可变制品保护而拒绝不同内容。撤回官网入口只能阻止后续下载；已安装用户需要以更高版本发布修正版，不能强制降级。

### 本机 Mac 点击入口

2026-10-14 已在维护者 Mac 的 Apple「快捷指令」App 创建「发布 Android」，按维护者选择仅放在 App 内，不加入 Dock 或菜单栏。点击播放后自动打开终端进度窗口，运行下面的官网 APK + Play 正式版命令，无需输入命令。仍须先把目标代码推送到 main，运行期间保持 Mac 联网；官网发布和 Google 审核状态分别看结果。

快捷指令只有一个运行 Shell 脚本操作：`open -a Terminal "$HOME/.local/bin/发布 Android.command"`。本机启动文件进入 `${CUBEROOT_REPO:-$HOME/Developer/cuberoot.me}/core`，复用 `pnpm android:release --play production`，保留现有发布锁和错误退出状态；日志在 `~/.local/state/cuberoot/android-release/`。凭据仍由正式发布脚本读取，快捷指令不保存凭据。换 Mac 须重新配置，不能假定该个人启动文件存在。

验证：启动文件 `--check` 仅调用发布入口的 `--help`，通过；快捷指令实际点击后已确认启动目标 `.command` 进程，验证时使用临时发布锁阻止构建发布，随后已清理该锁及本次探针进程。本轮未发布新包。

### 命令行入口

在维护者 Mac 的 `core/` 运行：

- `pnpm android:release`：构建并发布官网 direct APK。
- `pnpm android:release --play production`：同一提交构建官网 APK 和 Play AAB，分别发布官网、提交 Google Play 正式轨道。
- `pnpm android:release --play internal`：官网 APK + Play 内部测试轨道。
- 加 `--only-play --play production`：仅提交 Play，不切换官网下载包；仍复用同一构建/签名实现。
- 加 `--build-only`：只构建、正式签名并保存，暂不发布；验收后用输出的 `--resume <目录>` 发布同一批文件，无需重建。

只有手动 workflow_dispatch 触发 Android Release Build；普通 push 不会发包。仅发官网包时，若相对上次版本没有 Android/共享库/构建输入变化则跳过（仅网站/API/文档变化不会重打）；显式 build-only 和 Play 发布不跳过。入口固定最新 origin/main 提交，不打包当前目录未提交内容；云端依赖/Gradle缓存减少重复工作，Mac 仅签名发布。私钥、密码、Play 服务账号文件始终留在维护者电脑；配置路径见 `core/scripts/android-release/release.ts --help`，配置仅存文件位置，不存密码。云端产物是 unsigned staging，不能直接给用户安装。

版本号从官网清单和（选择 Play 时）API 已用版本的最大值递增。官网发布有本机锁、服务端锁、校验和、证书/包名检查、禁止同名覆盖与降级；上传校验完成后原子替换 latest.apk，随后原子替换 latest.json。每次构建的提交、版本、校验值和发布回执保存在本机 builds 目录。失败保留产物；官网成功而 Play 失败时分别报告，不宣称同时上线。

App「我的」页由宿主提供原生版本和渠道：direct 检查官网清单、提示新版并打开下载，给出允许浏览器安装/覆盖升级说明；play 只打开 Google Play。iOS/桌面/鸿蒙不提供 Android 更新入口。不会静默安装；1004 没有检查更新功能，必须先手动下载安装新包。Google Play API提交成功仍须另查审核与公开可用状态。

## 官网 Android 0.1.0 (1004) 发布记录

- 构建源码 `5cb2a4b970`，保留其他任务本地改动，Mobile/shared/app-ui/timer-ui 无未提交业务修改。shared build、Mobile typecheck、49 项测试、Web build 与 Android sync 通过。
- JDK 21 Release 包，`me.cuberoot.app`，versionCode `1004`，minSdk 26、targetSdk 36、不可调试；18 项权限与 CI 白名单一致，16 KB ZIP 对齐和 APK v2/v3 签名验证通过。
- APK：`CubeRoot-0.1.0-1004.apk`，12,145,509 字节。SHA-256：`759c2796bd88d79bcd29740a3abf7dfeda8292babf61d279ddfc3ea433eac67b`。
- 签名证书 SHA-256：`fe511914cc90c6f31af71d0d4f86015a3a289a598fb1298845e7b5396e492ee2`，与历史正式上传证书一致。密钥与密码保留本机受保护目录及 macOS 钥匙串，不进入仓库、日志或服务器。
- 文件经暂存上传与 SHA-256 校验后原子放置，远端哈希与本地一致。版本文件禁止覆盖；下次发布必须使用新版本号/地址。
- 静态配置部署 `38351160024` 成功；公网完整下载及国内服务器 HTTPS 下载的 SHA-256 均一致，响应 200、APK MIME、附件头及长度正确；Range `1024-2047` 返回 206，内容与原包对应片段一致。下载页中英文 6 项定向测试和 client typecheck 通过。
- 官网分发不代表 Play 商店版本已更新，也不代表真机安装、覆盖升级或业务功能已验收。

## 基础统计

`POST /v1/downloads/events` 接收 `{ "channel": "play" | "apk" | "windows-installer" | "windows-portable", "language": "en" | "zh" }`，返回 `204`。上限 256 字节、每个来源 IP 每分钟 30 次，非法字段返回 `400`，超限返回 `429`。IP 仅用于现有进程内限流，不进入本事件日志。

点击普通链接时独立发送 `keepalive` 请求，不等待统计响应、不带账号凭据；统计故障不阻断商店跳转或文件下载。禁用按钮不记录事件。暂不记录页面浏览、访客 ID、完整 URL、Referer、User-Agent 或安装数据。

后端复用 `diagnosticLog` 输出 JSON 行：`event=download_click`、服务端时间、进程 PID、`platform=android`、渠道、语言。沿用 API 的 PM2 标准输出日志，不新增数据表或常驻统计服务。日志保留周期取决于运行环境轮转策略，此功能不承诺永久保留；已有日志可跨进程重启汇总。尚无后台统计页面。

先从部署进程的标准输出日志取得所需期间的原始 JSON 行文件，再从 `core/` 执行以下 PowerShell 命令（文件名示例，替换为实际导出的文件）：

```powershell
Get-Content -LiteralPath C:\logs\core-api-out.log | pnpm --filter @cuberoot/server exec tsx scripts/summarize-downloads.ts
```

脚本流式读取标准输入，忽略非下载日志，输出按 UTC 自然日、渠道、语言汇总的 TSV：`date_utc / channel / language / clicks`。输入应使用无 PM2 终端前缀的原始日志；多个轮转日志不能重复导入相同记录。

计数仅代表后端收到的点击事件，重复点击会累加；离线、拦截、限流可能漏计，公开接口也不能杜绝伪造。因此不是独立用户数、完成下载数、安装数或精确转化率。实际文件流量与传输错误在启用托管后看静态服务/CDN 日志，商店安装数据看商店后台。

## 本地验证与发布边界

从 `core/` 执行：

```powershell
pnpm --filter @cuberoot/server exec vitest run tests/downloads.test.ts
pnpm --filter @cuberoot/client exec vitest run tests/app-downloads.test.ts tests/page-metadata-coverage.test.ts tests/site-material-guard.test.ts
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/server typecheck
```

修改需要分别发布 Web 和 API；仅本地修改不会使线上收集接口生效。常规 Web 开发代理默认指向线上 API，新接口部署前可能返回 404，页面下载行为仍独立可用。上线前核对中英页面、窄屏导航、深浅主题与 APK 实际状态。浏览器自动化仅在所有者要求时进行。
