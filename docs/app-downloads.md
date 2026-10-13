# 下载页与安装包分发

状态：`REFERENCE`。下载页源码入口为 `core/packages/client/app/[lang]/download/`，中文 `/zh/download`，英文 `/download`；首页顶部入口位于设置和会员之间，暂仅管理员可见。此限制只控制入口展示，下载页仍可通过地址直接访问。

## 渠道与安装包

- 页面复用 `/icons/icon-512.png` 的现有 App 图标；Google Play 入口使用本地托管的官方中英文徽章，素材来源见 `core/packages/client/public/badges/README.md`。
- `core/packages/client/lib/app-downloads.ts` 集中维护官网分发链接。Google Play 指向公开的 `me.cuberoot.app` 商品页。
- `ANDROID_APK_URL` 当前为 `null`，页面显示禁用的「下载 APK」与准备中说明，不发送点击事件。2026-10-13 本机签名预检：四项 `MOBILE_UPLOAD_*` 发布签名环境变量均未配置；按所有者要求暂缓正式 APK 构建和托管，未生成或上传分发包。
- Windows、iOS、macOS、HarmonyOS NEXT 仅显示「即将发布」。
- 启用 APK 前，先核对当前代码、版本号、发布签名与 Play 安装覆盖升级兼容性，完成实际安装验证。不得把 debug、unsigned 或 CI 临时签名包用于官网分发。
- 将验证后的包上传到受控 HTTPS 静态存储，使用带版本号的不可变地址；确认响应、文件大小、SHA-256、续传和国内访问后再填写 `ANDROID_APK_URL`。安装包不提交源码 Git，不经业务 API 转发。当前任务未新增静态托管配置或自动上传流程。
- 发布新包先完成文件校验，再切换链接；撤回时改回已验证旧版或置 `null`，不覆盖同名版本文件。

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
