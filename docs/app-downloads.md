# 下载页与安装包分发

状态：`REFERENCE`。下载页源码入口为 `core/packages/client/app/[lang]/download/`，中文 `/zh/download`，英文 `/download`；首页顶部入口位于设置和会员之间，暂仅管理员可见。此限制只控制入口展示，下载页仍可通过地址直接访问。

## 渠道与安装包

- 页面复用 `/icons/icon-512.png` 的现有 App 图标；Google Play 入口使用本地托管的官方中英文徽章，素材来源见 `core/packages/client/public/badges/README.md`。
- `core/packages/client/lib/app-downloads.ts` 集中维护官网分发链接。Google Play 指向公开的 `me.cuberoot.app` 商品页。
- `ANDROID_APK_URL` 指向官网正式签名包 `https://static.cuberoot.me/downloads/android/CubeRoot-0.1.0-1004.apk`，页面提供「下载 APK」并保留独立点击统计。
- Windows、iOS、macOS、HarmonyOS NEXT 仅显示「即将发布」。
- 官网 APK 使用维护者长期正式上传密钥，不能覆盖 Google Play 不同签名的安装版。页面明确提示 Play 用户继续通过 Play 更新，避免卸载丢失本地记录；本轮没有连接真机，未完成安装/升级及真实业务验收。不得把 debug、unsigned 或 CI 临时签名包用于官网分发。
- 将验证后的包上传到受控 HTTPS 静态存储，使用带版本号的不可变地址；确认响应、文件大小、SHA-256、续传和国内访问后再填写 `ANDROID_APK_URL`。安装包不提交源码 Git，不经业务 API 转发。静态文件位于服务器 `/www/wwwroot/toolkit/downloads/android/`，由 `ops/nginx/static.cuberoot.me.conf` 提供附件下载与单段 Range；nginx 配置仍通过 `deploy_nginx.yml` 发布。
- 发布新包先完成文件校验，再切换链接；撤回时改回已验证旧版或置 `null`，不覆盖同名版本文件。

## 官网 Android 0.1.0 (1004) 发布记录

- 构建源码 `5cb2a4b970`，保留其他任务本地改动，Mobile/shared/app-ui/timer-ui 无未提交业务修改。shared build、Mobile typecheck、49 项测试、Web build 与 Android sync 通过。
- JDK 21 Release 包，`me.cuberoot.app`，versionCode `1004`，minSdk 26、targetSdk 36、不可调试；18 项权限与 CI 白名单一致，16 KB ZIP 对齐和 APK v2/v3 签名验证通过。
- APK：`CubeRoot-0.1.0-1004.apk`，12,145,509 字节。SHA-256：`759c2796bd88d79bcd29740a3abf7dfeda8292babf61d279ddfc3ea433eac67b`。
- 签名证书 SHA-256：`fe511914cc90c6f31af71d0d4f86015a3a289a598fb1298845e7b5396e492ee2`，与历史正式上传证书一致。密钥与密码保留本机受保护目录及 macOS 钥匙串，不进入仓库、日志或服务器。
- 文件经暂存上传与 SHA-256 校验后原子放置，远端哈希与本地一致。版本文件禁止覆盖；下次发布必须使用新版本号/地址。
- 静态配置部署 `38351160024` 成功；公网完整下载及国内服务器 HTTPS 下载的 SHA-256 均一致，响应 200、APK MIME、附件头及长度正确；Range `1024-2047` 返回 206，内容与原包对应片段一致。下载页中英文 6 项定向测试和 client typecheck 通过。
- 官网分发不代表 Play 商店版本已更新，也不代表真机安装、覆盖升级或业务功能已验收。

## 基础统计

`POST /v1/downloads/events` 接收 `{ "channel": "play" | "apk", "language": "en" | "zh" }`，返回 `204`。上限 256 字节、每个来源 IP 每分钟 30 次，非法字段返回 `400`，超限返回 `429`。IP 仅用于现有进程内限流，不进入本事件日志。

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
