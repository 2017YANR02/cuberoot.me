# CubeRoot 微信小程序

原生小程序外壳。成熟业务页面通过 `web-view` 直接复用网站，微信登录和未来的蓝牙等平台能力使用原生实现。完整状态和维护约定见 [`../../docs/MINIPROGRAM.md`](../../docs/MINIPROGRAM.md)。

## 开发

从 `core/` 运行：

```powershell
pnpm --filter @cuberoot/miniprogram dev
pnpm --filter @cuberoot/miniprogram check
```

微信开发者工具导入本目录，工具会读取 `dist/`。开发监听会处理 TS、WXML、WXSS 和 JSON 的变化。

首次构建可用 `WECHAT_MINI_APP_ID` 生成本机 `project.config.json`；后续构建会保留已有正式 AppID 和明确的数字基础库。没有配置时才使用游客 AppID。

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
pnpm --filter @cuberoot/miniprogram build
pnpm --filter @cuberoot/miniprogram release:check
```

检查器会阻止未确认密钥轮换的发布，也会在发现新的隐私敏感 API 时直接失败。确认变量只是防遗忘闸门，不能代替真实轮换；先在后台生成新密钥、更新服务端，再执行发布检查。
