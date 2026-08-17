# CubeRoot 微信小程序

原生小程序外壳。成熟业务页面通过 `web-view` 直接复用网站，微信登录和未来的蓝牙等平台能力使用原生实现。完整状态和维护约定见 [`../../docs/MINIPROGRAM.md`](../../docs/MINIPROGRAM.md)。

## 开发

从 `core/` 运行：

```powershell
pnpm --filter @cuberoot/miniprogram dev
pnpm --filter @cuberoot/miniprogram check
```

微信开发者工具导入本目录，工具会读取 `dist/`。开发监听会处理 TS、WXML、WXSS 和 JSON 的变化。
构建会先验证本机项目配置和全部源码 JSON，并在 `.tmp` 生成完整候选产物后再替换 `dist/`；配置或编译失败时保留上一份可用产物和小程序身份。

首次构建可用 `WECHAT_MINI_APP_ID` 生成本机 `project.config.json`；后续构建会保留已有正式 AppID 和明确的数字基础库。没有配置时才使用游客 AppID。开发时可以使用测试身份，但 `release:check` 只接受 CubeRoot 官方小程序 AppID，避免把正式包上传到其他账号。

## 单一来源

- 网站入口：`src/lib/web-routes.ts`
- API 和网站域名：`src/lib/runtime-config.ts`
- 网页加载状态：`src/lib/web-view-page.ts`
- 登录与会话：`src/lib/auth.ts`
- 必须原生化的跨端纯逻辑：先提取到 `@cuberoot/shared`，确认有调用方后再添加依赖

不要把网站页面再实现一遍。只有微信 API、离线能力或明确的性能需求无法通过 `web-view` 满足时，才新增原生页面。

## 安全和发布

后端需要 `WECHAT_MINI_APP_ID` 和 `WECHAT_MINI_APP_SECRET`。AppSecret 只放服务端环境变量，不写入本目录、构建产物、URL 或文档。

小程序后台必须配置 request 合法域名和业务域名。上传前选择稳定基础库，并在模拟器和真机各完成一次回归。

上传前必须在开发者工具确认稳定基础库，再运行：

```powershell
$env:WECHAT_MINI_LIB_VERSION='<已确认的稳定版本>'
$env:WECHAT_MINI_SECRET_ROTATED='1' # 仅在后台轮换并更新服务端后设置
$env:WECHAT_MINI_BASIC_INFO_APPROVED='1'
$env:WECHAT_MINI_FILING_COMPLETED='1'
$env:WECHAT_MINI_PRIVACY_REVIEWED='1'
$env:WECHAT_MINI_IOS_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_ANDROID_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_GAN16UI_TESTED='1' # Android 真机完成 GAN 16 ui 全链路回归后设置
$env:WECHAT_MINI_GOCUBE_TESTED='1'
pnpm --filter @cuberoot/miniprogram build
pnpm --filter @cuberoot/miniprogram release:check
```

`release:check` 会自动运行类型检查和全部小程序回归测试，再检查正式身份、基础库、密钥轮换确认、四项人工发布确认、源码与上传产物指纹等发布条件。

检查器会阻止未确认密钥轮换、基础信息、备案、后台隐私指引或双平台真机回归的发布，也会在发现新的隐私敏感 API、错误发布身份或异常包体积时直接失败。当前项目预算为总包 512 KiB、单文件 128 KiB，用于尽早发现误打包网站资源，不代表平台极限。确认变量只是防遗忘闸门，不能代替真实操作；每次只在对应事项真实完成后设置。
