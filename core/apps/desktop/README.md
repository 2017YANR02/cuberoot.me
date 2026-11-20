# Windows / macOS 宿主

`@cuberoot/desktop` 是同一份 Tauri 薄宿主，两端消费 `@cuberoot/app-ui`；系统窗口、BLE、认证、凭据与文件能力留在宿主。不要另建 Windows 或 macOS 产品页面。

先读[五端文档入口](../../../docs/product/apps/README.md)与[共享产品层](../../packages/app-ui/README.md)，再查本目录 `package.json`、`src/`、`src-tauri/` 的实现与权限。构建、签名、公证、安装和设备验收分平台记录在[路线图](../../../docs/product/apps/mobile-app-roadmap.md)。

命令从 `core/` 执行：`pnpm --filter @cuberoot/desktop typecheck` 验证宿主；`pnpm --filter @cuberoot/desktop build` 构建 Web 资产；`pnpm --filter @cuberoot/desktop tauri:build` 才构建原生应用。按实际变更选择检查，不把 Web 资产构建称为原生发行验收。发布前读[发布契约](../../../docs/contributing/release.md)。

Windows 商店采用 MSIX，入口为 `pnpm --filter @cuberoot/desktop store:check` / `build:store`；需要 Partner Center 真实包身份。配置、独立 Windows CI、未签名产物及会员支付边界见[上架基础](../../../docs/compliance/windows-store-submission.md)。官网 EXE 继续使用原发布流程。

## Mac App Store

Mac App Store 与 iOS 使用同一 App Store Connect 记录。商店构建走 `pnpm --filter @cuberoot/desktop build:mac-app-store`，使用 `me.cuberoot.app` 和 App Sandbox。本机需安装两个 macOS Rust 目标，`aarch64-apple-darwin` 和 `x86_64-apple-darwin`。官网桌面构建继续使用 `me.cuberoot.desktop`。商店首版沿用 iOS 已有的 AI 与在线内容限制，会员页使用 Apple 渠道视图。

1. 本地验证可给构建命令加 `--no-sign`。发行时通过额外的 `--config` 指向本机生成的 Tauri JSON，将 `bundle.macOS.files.embedded.provisionprofile` 设置为 Mac App Store 描述文件的绝对路径。签名私钥和描述文件保存在本机，不能进入 Git。
2. 签名前确保普通用户可以读取 App 包内文件和进入目录。用 Apple Distribution 身份签署 `.app`，用 Mac Installer Distribution 身份经 `productbuild --component` 生成 `.pkg`。核对签名、沙盒、版本和构建号。[Tauri 打包说明](https://v2.tauri.app/distribute/app-store/)
3. 用 `asc --profile CubeRoot builds upload --app 6816632957 --pkg <文件> --version <版本> --build-number <构建号> --wait` 上传。关联 `MAC_OS` 版本草稿，按实际加密算法和发售地区填写加密出口信息，核对 Mac 截图及资料，再用 `asc review submit --platform MAC_OS` 预检并送审。[Apple 加密出口说明](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/)

## Windows 发布工作

等待公司核验时，可从 `core/` 运行 `pnpm --filter @cuberoot/desktop store:materials --online`，检查公开链接/套餐并导出双语商店草稿、审核备注及空白身份模板；不加 `--online` 则仅离线准备。源文件在 `store/`，产物在 `.local-data/windows-store/materials-<unique>/`；它不生成 Windows 截图、正式身份或安装包，也不上传商店。`store:materials:check` 只校验不写文件。
