# CubeRoot 微信 / 抖音小程序

微信与抖音共用这一份原生外壳源码。成熟业务页面通过 `web-view` 复用网站运行界面，不导入 Web 源码；登录、BLE 和网页桥接只在平台适配层分流。`package.json`、`src/`、两个项目配置模板与 [`../../docs/MINIPROGRAM.md`](../../docs/MINIPROGRAM.md) 是局部事实源。

## 开发

从 `core/` 运行：

```powershell
pnpm --filter @cuberoot/miniprogram dev
pnpm --filter @cuberoot/miniprogram check:all
```

微信开发者工具导入本目录并读取 `dist/`；抖音开发者工具直接导入 `dist-douyin/`。`check:all` 只跑一次类型检查和测试，再构建两个目标；单独检查抖音时运行 `check:douyin`。
抖音构建后可打开 `.tmp/wx-to-tt-log/__wxToTT/report/index.html` 查看官方转换器的逐文件报告；它包含本机路径并且每次可重建，因此不提交生成页。
构建会先验证本机项目配置和全部源码 JSON，并在 `.tmp` 生成完整候选产物后再替换 `dist/`；配置或编译失败时保留上一份可用产物和小程序身份。
跨包源码依赖由 esbuild 的实际解析图统一驱动构建指纹和开发监听；新增 `@cuberoot/shared` 子路径后不需要维护额外文件清单。

首次构建可分别用 `WECHAT_MINI_APP_ID` 和 `DOUYIN_MINI_APP_ID` 生成并保留被忽略的本机项目配置。微信 `release:check` 只接受 CubeRoot 官方身份；抖音尚未做上传闸门，`check:douyin` 只证明工程产物可生成。

## 单一来源

- 网站入口：`src/lib/web-routes.ts`
- API 和网站域名：`src/lib/runtime-config.ts`
- 网页加载状态：`src/lib/web-view-page.ts`
- 登录与会话：`src/lib/auth.ts`
- 平台 API、登录端点和网页标记：`src/lib/platform.ts`
- 必须原生化的跨端纯逻辑：先提取到 `@cuberoot/shared`，确认有调用方后再添加依赖

不要按平台复制页面。只有平台 API、离线能力或明确的性能需求无法通过 `web-view` 满足时，才新增原生页面。

## 安全和发布

后端按目标需要 `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET` 或 `DOUYIN_MINI_APP_ID` / `DOUYIN_MINI_APP_SECRET`。密钥只放服务端环境变量，不写入本目录、构建产物、URL 或文档。

两个平台后台都必须配置网络、业务域名和真实隐私声明。抖音登录会在用户手动同意用户协议与隐私政策后调用 `tt.login({ force: true })`，本机退出只清除本机小程序会话。抖音资质审核期间可以继续开发；正式 AppID、后台能力与域名配置、开发者工具和真机回归、平台审核全部完成前不得宣称上线。

上传前必须在开发者工具确认稳定基础库，再运行：

```powershell
$env:WECHAT_MINI_LIB_VERSION='<已确认的稳定版本>'
$env:WECHAT_MINI_BASIC_INFO_APPROVED='1'
$env:WECHAT_MINI_FILING_COMPLETED='1'
$env:WECHAT_MINI_PRIVACY_REVIEWED='1'
$env:WECHAT_MINI_IOS_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_ANDROID_REAL_DEVICE_TESTED='1'
$env:WECHAT_MINI_GAN16UI_TESTED='1' # Android 真机完成 GAN 16 ui 全链路回归后设置
$env:WECHAT_MINI_GOCUBE_TESTED='1'
$env:WECHAT_MINI_GIIKER_TESTED='1'
$env:WECHAT_MINI_MOYU_TESTED='1'
pnpm --filter @cuberoot/miniprogram build
pnpm --filter @cuberoot/miniprogram release:check
```

`release:check` 会自动运行类型检查和全部小程序回归测试，再检查正式身份、基础库、人工发布确认、凭据扫描、源码与上传产物指纹等发布条件。

检查器会阻止未确认基础信息、备案、后台隐私指引或双平台真机回归的发布，也会在源码或上传包发现 AppSecret、私钥、新的隐私敏感 API、错误发布身份或异常包体积时直接失败。当前项目预算为总包 512 KiB、单文件 128 KiB，用于尽早发现误打包网站资源，不代表平台极限。确认变量只是防遗忘闸门，不能代替真实操作；每次只在对应事项真实完成后设置。
