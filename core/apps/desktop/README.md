# Windows / macOS 宿主

`@cuberoot/desktop` 是同一份 Tauri 薄宿主，两端消费 `@cuberoot/app-ui`；系统窗口、BLE、认证、凭据与文件能力留在宿主。不要另建 Windows 或 macOS 产品页面。

先读[五端文档入口](../../../docs/product/apps/README.md)与[共享产品层](../../packages/app-ui/README.md)，再查本目录 `package.json`、`src/`、`src-tauri/` 的实现与权限。构建、签名、公证、安装和设备验收分平台记录在[路线图](../../../docs/product/apps/mobile-app-roadmap.md)。

命令从 `core/` 执行：`pnpm --filter @cuberoot/desktop typecheck` 验证宿主；`pnpm --filter @cuberoot/desktop build` 构建 Web 资产；`pnpm --filter @cuberoot/desktop tauri:build` 才构建原生应用。按实际变更选择检查，不把 Web 资产构建称为原生发行验收。发布前读[发布契约](../../../docs/contributing/release.md)。

Windows 商店采用 MSIX，入口为 `pnpm --filter @cuberoot/desktop store:check` / `build:store`；需要 Partner Center 真实包身份。配置、独立 Windows CI、未签名产物及会员支付边界见[上架基础](../../../docs/compliance/windows-store-submission.md)。官网 EXE 继续使用原发布流程。

等待公司核验时，可从 `core/` 运行 `pnpm --filter @cuberoot/desktop store:materials --online`，检查公开链接/套餐并导出双语商店草稿、审核备注及空白身份模板；不加 `--online` 则仅离线准备。源文件在 `store/`，产物在 `.local-data/windows-store/materials-<unique>/`；它不生成 Windows 截图、正式身份或安装包，也不上传商店。`store:materials:check` 只校验不写文件。
