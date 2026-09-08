# 抖音直播文字记录导出

本地工具。给出直播复盘链接后，自动复用登录状态、读取全部时间段、去重并保存 TXT。TXT 只保留正文，段落之间空一行，不附时间、昵称或统计头。无需 F12、手动滚动或导出 HAR。

只处理链接指定的场次。页面提示非公开直播时，立即跳过，不读取文字记录响应正文，也不继续请求其他分段。只有页面存在可播放回放来源且没有非公开提示时才开始读取；回放不可用时停止，不尝试获取隐藏内容。

## 使用

首次使用桌面「抖音文字记录导出」快捷方式，粘贴链接，在打开的专用浏览器中登录。工具自动继续，完成后用记事本打开 TXT。以后双击同一快捷方式使用即可。

AI 或终端调用（默认后台运行）：

```powershell
node D:/cube/cuberoot.me/scripts/douyin-transcript/cli.mjs 'https://anchor.douyin.com/anchor/review?type=0&roomId=7682751505497279270'
```

首次登录或登录过期，加 `--login`。人工启动脚本始终打开专用浏览器，便于在需要时完成登录；CLI 默认无界面。

```powershell
pwsh -NoProfile -File D:/cube/cuberoot.me/scripts/douyin-transcript/start.ps1
node D:/cube/cuberoot.me/scripts/douyin-transcript/cli.mjs '复盘链接' --login -o 'D:/导出/本场直播.txt'
```

其他场次：在平台点「切换场次」，选择左侧日期，再点右侧对应场次的「查看复盘」，复制地址栏链接。工具严格核对链接中的 roomId；登录后跳转到其他场次，会重新定位原链接。

默认保存到桌面，文件名包含直播日期、roomId 和导出时间，不覆盖已有文件。AI 在本仓库验证时请用 `-o` 指向 `.tmp/png/`。成功时 stdout 输出一行 JSON（含 `path`、`count`、`complete`）；进度和错误输出到 stderr，失败退出码为 1。非公开场次错误码为 `PRIVATE_ROOM`，没有输出 TXT。

现有 HAR 也可直接转换，无需启动浏览器：

```powershell
node D:/cube/cuberoot.me/scripts/douyin-transcript/cli.mjs --har 'C:/Users/CubeRoot/Desktop/anchor.douyin.com.har' -o 'D:/导出/直播.txt'
```

HAR 模式用于用户已经确认可导出的记录；HAR 不一定包含页面的公开状态，离线转换不会额外判断公开状态。HAR 中存在多个直播间时，需同时传入目标复盘链接。

## 完整性

- 按直播起止时间补全 30 分钟分段，允许最后一个分段超过关播时间；只保留直播范围内的记录。
- 每段须 HTTP 200、业务状态成功、字段和时间范围有效。覆盖缺段时停止，不写「完整版」。空时间段允许没有识别文字。
- 优先在已登录页面中补充分段；如果失败，自动滚动文字记录区域触发页面加载。默认读取超时 180 秒，可用 `--timeout 600` 调整。
- 仅相同时间、昵称和内容三者都相同才去重。相同内容在不同时间出现会保留。
- 使用北京时间计算，不受电脑所在时区影响。TXT 为 UTF-8 BOM、LF 换行，保留平台语音识别原文。

## 本机依赖与验证

Node.js 22+、pnpm、Playwright。此工具复用本机 Codex 的 Chromium 配置和 `~/.codex/bin/pw-no-webrtc.cjs`；找不到 WebRTC 禁用脚本会停止启动。Chromium 路径优先读 `DOUYIN_BROWSER_EXECUTABLE`，其次读 `~/.codex/playwright-mcp.json`，最后使用 Playwright 自带路径。

```powershell
Set-Location D:/cube/cuberoot.me/scripts/douyin-transcript
pnpm install --frozen-lockfile
pnpm test
```

登录状态只保存在 `%LOCALAPPDATA%/DouyinTranscript/browser-profile`，不读取日常 Chrome 配置，不把 Cookie 写入 TXT、日志或仓库。不要同时运行多个导出实例。验证提示、登录失效和平台结构变化可能需要人工处理。

浏览器测试使用隔离上下文与合成响应，不访问真实抖音，也不读取登录配置。已另行使用真实链接验证 2026-09-07 场次自动导出 240 条，与完整 HAR 一致。
