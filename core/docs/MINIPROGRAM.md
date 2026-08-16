# CubeRoot 微信小程序跟踪

> 最后更新：2026-08-16。本文是小程序的架构约定、当前状态、上线清单和迭代记录。后续开发先更新这里，不再另建互相冲突的计划。

## 1. 产品路线

小程序采用“原生外壳 + 网站能力”的混合架构。

- 网站继续负责计时器、公式库、比赛、百科和课程等成熟功能。
- 小程序原生层只负责微信登录、一级导航、加载失败恢复，以及未来的蓝牙、订阅消息等微信专属能力。
- 网站功能默认通过 `web-view` 复用；只有 `web-view` 做不到、体验明显不合格，或必须调用微信 API 时，才考虑原生实现。
- 原生实现需要算法或数据逻辑时，先从网站提取到 `@cuberoot/shared`，再由两端共同引用；不复制页面组件和业务规则。

这条路线的目标不是把网站再写一遍，而是让网站保持唯一业务来源，小程序提供微信入口和平台增量能力。

## 2. 维护边界

| 改动 | 唯一入口 | 约束 |
|---|---|---|
| 网站入口、标题、说明、顺序 | `packages/miniprogram/src/lib/web-routes.ts` | 不在 WXML 里再写一份列表 |
| 网站和 API 域名 | `packages/miniprogram/src/lib/runtime-config.ts` | 只使用已在小程序后台配置的 HTTPS 域名 |
| `web-view` 加载、失败和重试 | `packages/miniprogram/src/lib/web-view-page.ts` | 计时页和通用网页共用，不各自补丁 |
| 登录、会话和错误文案 | `packages/miniprogram/src/lib/auth.ts` | AppSecret 永远只在服务端 |
| 跨端计时数据类型和纯逻辑 | `@cuberoot/shared/timer` | 不复制网站计时器 UI |
| 全局视觉变量和通用按钮 | `packages/miniprogram/src/app.wxss` | 页面只写自身布局 |
| 账号落库 | 服务端 `account_auth.ts` + `wechat_miniprogram.ts` | 网站和小程序都只用 UnionID |

新增一个网站工具入口时，只改路由表并补测试。新增原生功能前，先在本文件写清楚为什么不能继续复用网站。

## 3. 当前状态

### 平台配置

- [x] 企业主体小程序已注册并完成微信认证。
- [x] 小程序已绑定到网站应用所在的同一微信开放平台账号。
- [x] request 合法域名已配置为 `https://api.cuberoot.me`。
- [x] 业务域名已配置为 `https://cuberoot.me`，校验文件已部署。
- [x] 服务类目 `工具 > 信息查询` 已通过并设为主类目。
- [x] 基础信息已提交审核；最后一次后台截图显示为“审核中”，结果需在发布前复查。
- [ ] 小程序备案尚未完成。
- [ ] 上传前把基础库从 `trial` 选择为当时的稳定版本，并在真机复测。
- [ ] AppSecret 曾在协作过程中暴露，正式联调前必须在后台重新生成，并同步更新服务端环境变量。

### 工程能力

- [x] 微信开发者工具可导入 `packages/miniprogram/`，产物目录为 `dist/`。
- [x] 计时器通过 `web-view` 复用网站，并已在真机正常打开。
- [x] 公式库、WCA 比赛、魔方百科和课程使用统一路由表打开网站。
- [x] 原生微信登录已接入后端 `/v1/auth/wechat/miniprogram`。
- [x] 登录只接受 UnionID；缺失时拒绝创建账号，避免同一用户产生两个账号。
- [x] 微信开发者工具的旧 Chromium 兼容边界固定为 Chrome 91，并有网站回归测试保护。
- [x] 小程序构建目标固定为 Chrome 91，避免产物使用模拟器不支持的语法。
- [x] `web-view` 统一处理非法地址、加载失败和重试。
- [x] 开发监听覆盖 TS、WXML、WXSS 和 JSON，不再要求手动重启构建。
- [ ] 网站扫码登录和小程序登录落到同一个 `uid` 的线上验收尚未完成。
- [ ] 登录后的原生会话与 `web-view` 网站会话尚未打通。

## 4. 账号方案

网站扫码登录和小程序登录都以同一开放平台返回的 UnionID 作为：

```text
provider = wechat
provider_uid = unionid
```

禁止在 UnionID 缺失时回退到 OpenID。两者命名空间不同，回退会把一个用户拆成两个账号。

原生小程序的 JWT 存在小程序本地存储中，网站登录态存在网页环境中，两者不会自动共享。后续若要让 `web-view` 自动登录，必须增加服务端一次性换票流程：小程序用 JWT 申请短时单次 ticket，网页消费 ticket 后写入安全 Cookie。禁止把长期 JWT 放进 URL。

## 5. 开发和验收

在 `core/` 运行：

```powershell
pnpm --filter @cuberoot/miniprogram dev
pnpm --filter @cuberoot/miniprogram check
```

微信开发者工具导入 `core/packages/miniprogram`，不是 `dist`。`project.config.json` 和 `project.private.config.json` 是本机配置，不提交 AppID 之外的任何凭据。

每轮完成定义：

1. 先搜索网站和 `@cuberoot/shared` 是否已有逻辑、数据或组件契约。
2. 修改唯一来源，不在页面层复制路由、状态或文案。
3. `pnpm --filter @cuberoot/miniprogram check` 全绿。
4. 微信开发者工具模拟器检查无持续 Loading、无脚本错误。
5. 至少一台真机检查首页、返回、登录、失败重试和窄屏文字。
6. 更新本文件的状态、风险和迭代记录。
7. 检查提交内容，不包含 AppSecret、临时校验文件或其他 AI 的改动。

## 6. 上线阻塞清单

按顺序处理：

1. 等基础信息审核完成，确认最终名称、头像和简介。
2. 完成小程序备案。
3. 重新生成 AppSecret，只写入服务端环境变量并部署；旧密钥立即失效。
4. 真机执行一次“网站扫码登录 + 小程序微信登录”，确认两端为同一 `uid`。
5. 按实际收集的信息填写用户隐私保护指引，不声明未使用的权限。
6. 选择稳定基础库，上传体验版，管理员和体验成员完成回归。
7. 上传正式版本，填写版本说明，提交微信审核。
8. 审核通过后发布；发布后再次检查登录、`web-view`、返回路径和错误恢复。

备案和平台审核可以与代码开发并行，但未完成前不能宣布已经上线。

## 7. 近期迭代队列

### P0：首版上线

- [ ] 完成备案、密钥轮换和同账号验收。
- [ ] 完成模拟器与 iOS、Android 真机回归。
- [ ] 补上传前的隐私与版本信息。
- [ ] 上传体验版并处理代码质量扫描中的真实问题。

### P1：减少登录割裂

- [ ] 设计并实现原生登录到网站 Cookie 的一次性换票。
- [ ] 在“我的”页显示网站账号关联状态和清晰的恢复入口。
- [ ] 为换票接口补过期、重放、退出登录和跨账号测试。

### P2：微信专属增量

- [ ] 先做 BLE 技术验证，只复用网站已有智能魔方协议层，不复制设备解析代码。
- [ ] 验证后台计时、息屏、断连重连和 iOS 真机限制后，再决定是否做原生智能计时器。
- [ ] 仅在用户主动订阅后接入比赛或课程提醒。

暂不原生迁移复杂 Three.js、地图、视频通话、ffmpeg.wasm 和大型分析器。它们继续由网站承载，除非出现明确的平台需求和收益。

## 8. 已知风险

- 纯 `web-view` 页面会受网站发布影响，因此网站的 Chrome 91 回归测试不能删除。
- 模拟器正常不等于真机正常，尤其是登录、业务域名、Cookie 和蓝牙能力。
- `web-view` 与原生层是两个存储环境，不能假设 localStorage、Cookie 或 JWT 自动互通。
- 小程序包体、基础库和审核规则会变化；涉及发布规则时以当时后台和官方文档为准。
- 主体、类目、名称和隐私声明必须与实际产品一致，不能为了审核临时写一套与产品不符的描述。

## 9. 迭代记录

### 2026-08-16：维护性收口

- 发现页改为从统一路由表生成，去掉 WXML 中的重复入口和文案。
- 计时页与通用网页共用 `web-view` 状态、失败提示和重试逻辑。
- 网站域名和 API 域名集中到运行配置。
- 构建目标固定为 Chrome 91；开发监听覆盖所有小程序源文件。
- 新增路由、登录、运行配置和 `web-view` 状态回归测试。
- 新增页面声明与页面文件完整性检查，避免新增导航后漏交 WXML、WXSS 或页面配置。
- 会话校验只更新当前仍有效的同一 token，避免退出或重新登录后被旧请求恢复旧会话。
- 在微信开发者工具 Stable v2.01.2510290 模拟器实测计时器完整渲染，未再出现持续 Loading。
- 重写本文，记录平台现状、维护边界、密钥轮换和上线阻塞项。

### 2026-08-16：开发者工具兼容修复

- 网站浏览器目标加入 Chrome 91，解决真机正常但微信开发者工具持续显示 Loading 的问题。
- 增加网站测试，防止以后升级构建目标时再次破坏微信开发者工具模拟器。

### 首版工程

- 建立原生外壳、计时器 `web-view`、工具入口和“我的”页。
- 接入小程序登录后端并坚持 UnionID 单账号策略。
- 配置 request 合法域名、业务域名、开放平台绑定和服务类目。

## 10. 官方入口

- [UnionID 机制](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html)
- [小程序登录](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)
- [服务端 code2Session](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html)
- [网络与服务器域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [web-view](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)
- [小程序备案指引](https://developers.weixin.qq.com/miniprogram/product/record/guidelines.html)
