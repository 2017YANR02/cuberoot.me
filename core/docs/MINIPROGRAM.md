# 微信小程序（MINIPROGRAM.md）

> 2026-08-04 立项。可行性调研 + 上线路径。平台规则均**当日抓官方文档实证**，非记忆，链接见 §7。
> 关联：账号体系 `migrations/0064_user_accounts.sql`、支付 `PAYMENT_SETUP.md`、短信 `SMS_PHONE_LOGIN.md`。

## 0. 结论

**卡点不在资质，在渲染层。**

多数人做小程序死在主体资质上，本站反而已过大半：营业执照 + `cuberoot.me` 已 ICP 备案 + 微信开放平台已完成 ¥300 认证 —— 这三样正好是小程序的全部准入门槛。

真正的难点：小程序**无 DOM、无 window/document**，Next.js 16 / React 19 / nuqs / AppLink 全部作废，UI 层必须重写。

**但**：`client/lib/` 共 360 个 `.ts`、7.9 万行，其中只有 36 个碰 DOM/React —— **约 90% 的核心逻辑（kociemba、ivy-solver、batch-solver、打乱生成、Speffz、公式查表）可原样搬进小程序**。这把"重做一遍网站"降级成"给现有引擎套一层新壳"。

**做小程序的第一理由不是流量，是 iOS 蓝牙。** 小程序有完整 BLE API（`wx.createBLEConnection`），而 iOS Safari 根本不支持 Web Bluetooth —— GAN 智能魔方在 iPhone 上现在是死的，小程序里能活。这是网页版永远做不到的能力。

## 1. 资质现状

| 项 | 状态 | 备注 |
|---|---|---|
| 营业执照 | ✅ 上海魔方根教育科技工作室（个人独资企业） | 注册时主体类型选**企业**，不是「个体工商户」（阿里云那次同样的坑，见 `SMS_PHONE_LOGIN.md` §主体） |
| ICP 备案 | ✅ `cuberoot.me` 已备案 | 小程序服务器域名的**硬前提**，已满足 |
| 微信开放平台 | ✅ 已注册 + ¥300 认证（2026-07） | unionid 打通的前提，已满足 |
| 公众号「魔方根」 | ⚠️ **个人主体订阅号** | 历史包袱，**不能复用**。小程序须用营业执照另起企业号 |
| 对公账户 | ❌ 无 | 影响注册验证方式的选择，见 §4.1 |
| 微信支付商户号 | ❌ 未开通（卡对公账户） | 与小程序注册无关；反而小程序 appid 可用来绑商户号，见 §4.5 |
| 微信登录（网页扫码） | ⚠️ 代码就绪但 env 未配 | 线上 `/v1/auth/providers` 实测 `social.wechat: null` → **DB 里零条 wechat 身份行，无历史包袱** |

## 2. 平台硬约束（官方原文实证）

| 约束 | 官方数字 | 对本站的杀伤 |
|---|---|---|
| 包体积 | 单包 ≤ **2MB**，所有分包总和 ≤ **30MB**（服务商代开发 20MB） | `public/` 有 92MB；`ffmpeg-core.wasm` 单个 **32MB**，一个文件就超总限额 |
| WXWebAssembly | 只接受**代码包内路径**（支持 `.wasm` / `.wasm.br`），**不能从网络加载** | 16 个 `.wasm` 必须打进包。分析器 5 个（272–332KB）没问题；`cubeopt/` 9 个共 2.8MB 须拆独立分包 |
| Worker | **最大并发 1 个**；worker 目录**只打包 `.js`**，非 js 被忽略 | 项目有 15+ worker 且多个并行。wasm 必须放 worker 目录**外** |
| 服务器域名 | 必须 HTTPS + **经过 ICP 备案**；不支持 IP/localhost；**不支持父域名通配** | ✅ 已备案。但 `api.` / `static.` 要**逐个**填白名单，不能填 `*.cuberoot.me` |
| 渲染 | 无 DOM、无 `window`/`document` | Next.js / React 19 / nuqs / AppLink 全废 |
| canvas | 支持 `type="webgl"`，但是**原生组件**（层级最高，同层渲染 iOS 有失败率）；Canvas 2D 上限 1365×1365 | Three.js 需换官方 `threejs-miniprogram` 适配层或 XR-FRAME |
| web-view | **个人类型小程序不支持**；每页只能一个且铺满全屏；与小程序仅能通过 JSSDK 通信 | 用营业执照注册企业号即绕开 |

## 3. 路线选择

- **A. web-view 套壳** — 约 2 周。241 个页面全保住，但体验≈给微信加了个书签；iOS 有链接中文字符白屏坑；审核对纯套壳有排斥（工具类通常能过，不保证）。
- **B. 原生重写** — 2-3 个月。Taro/uni-app 都只到 React 18，接不住 React 19 + App Router，UI 全部重写，只能挑 5-10 页。
- **C. 混合 ← 采用**。原生外壳承载高频功能（计时器 + 智能魔方蓝牙、打乱生成、公式库查询、比赛/成绩查询），长尾 200+ 页（`/math` `/regulation` `/code` `/wiki` 教程）用 web-view 兜住。内容型工具站的通行做法。

## 4. 阶段一：注册 + 绑定 + unionid 打通 ← **当前在这**

### 4.1 注册（mp.weixin.qq.com）

1. [mp.weixin.qq.com](https://mp.weixin.qq.com) → 立即注册 → 选「小程序」。
2. **邮箱**：必须是**从未注册过公众号/小程序、且未绑定过个人微信号**的邮箱。建议专用一个（如 `mp@cuberoot.me`），别用站长常用邮箱 —— 一旦占用不可解绑。
3. 主体类型选 **企业** → 企业类型选 **企业**（个人独资企业归此类，**不要**选「个体工商户」）。
4. 填营业执照信息：企业名称、统一社会信用代码、法人姓名 + 身份证号（须与执照逐字一致）。
5. **主体验证方式**（关键决策，见下表）。
6. 填小程序名称 / 简介 / 类目。名称建议「魔方根」或「CubeRoot 魔方根」；类目选**工具 → 效率**（或 教育 → 在线教育）。名称**注册后 1 年内只能改 2 次**，慎填。

| 验证方式 | 费用 | 需对公账户 | 结果 |
|---|---|---|---|
| 对公打款 | 免费 | ✅ 需要 | 注册成功但**未认证**；日后要认证仍须单独付 ¥300 |
| 微信认证 + **法人扫脸** | ¥300/年 | ❌ **不需要** | 注册即「**已认证**」状态 |

**→ 本站选「微信认证 + 法人扫脸」**（无对公账户，且 web-view 本来就要求已认证，一步到位）。法人用**绑了本人银行卡的微信**扫码 + 人脸识别。

> ⚠️ **主体性质注册后唯一且不可变更**，平台不支持个人主体升级为企业主体。这一步选错要重开账号。

### 4.2 备案

小程序备案自 2023-09 起强制（境内主体）。入口：小程序后台 → 设置 → 基本设置 → 备案。营业执照 + 法人信息齐备，网站已备案，走流程即可。**备案通过前小程序无法发布上线**，所以和注册连着做。

### 4.3 绑定开放平台（unionid 的唯一开关）

官方文档特意强调了方向，**反了会找不到入口**：

> 登录微信开发者平台 → 控制台首页 → 「**我的业务 - 开放平台 - 绑定关系 - 小程序**」
> 注意**不是**「我的业务 - 小程序 - 绑定关系 - 开放平台」

绑定后，`wx.login` + `code2Session` 直接返回 unionid，**无须用户授权**。

必须绑到**与网站应用同一个**开放平台账号（即 2026-07 已认证那个），否则 unionid 不一致，打通失败。

### 4.4 unionid 打通方案

现有 `auth_identities` 表：`(provider, provider_uid)` 全局唯一，一条身份一行，多条指向同一 `app_users`。现有网站扫码登录 `social_login.ts:127` 已经是 `unionid || openid` 优先 unionid。

**方案：小程序登录复用 `provider='wechat'`，`provider_uid` 存 unionid。** 同一个人网页扫码登录和小程序登录落到同一行 → 账号天然打通，无需任何合并逻辑。

因为 DB 里目前**零条 wechat 行**（§1 实测），不存在"老数据存 openid、新数据存 unionid"的分裂风险 —— 这是现在就把两边一起接上的最好时机。

新增后端路由（`account_auth.ts`）：

```
POST /v1/auth/wechat/miniprogram   { code }   ← wx.login 拿到的 code
  → GET https://api.weixin.qq.com/sns/jscode2session
        ?appid={小程序APPID}&secret={小程序SECRET}&js_code={code}&grant_type=authorization_code
  → { openid, unionid, session_key }
  → loginWithIdentity('wechat', unionid || openid, ...)   ← 复用现有函数，不新写
```

新增 env（与网站应用的 `WECHAT_LOGIN_APP_ID/SECRET`、支付的 `WECHAT_*` 三者**互不相同，别混**）：

```
WECHAT_MINI_APP_ID=
WECHAT_MINI_APP_SECRET=
```

> ⚠️ `api.weixin.qq.com` **不能配进小程序服务器域名白名单**（官方安全限制），AppSecret 只能留在后端 —— 上面的调用本来就在服务端，符合要求。

### 4.5 顺带收益：微信支付 appid

`PAYMENT_SETUP.md` §3.2 提过"注册一个小程序省钱"来拿绑定商户号的 appid —— 这个小程序 appid 正好能用。但**对公账户那关仍在**，与小程序无关。

### 4.6 阶段一验收

- [ ] 小程序已注册，状态「已认证」
- [ ] 备案通过，可发布
- [ ] 开放平台绑定关系已建立（方向对：开放平台 → 绑定小程序）
- [ ] 服务器域名白名单填入 `https://api.cuberoot.me` + `https://static.cuberoot.me`（逐个，不通配）
- [ ] 实测：同一微信号，网页扫码登录 + 小程序登录 → `auth_identities` 只有一行，`app_users` 只有一个 uid

## 5. 阶段二：技术准备（不依赖资质，可并行）

1. **DOM 隔离**：把 `lib/` 里那 36 个碰 DOM/React 的文件挑出来做隔离，让纯逻辑层可被小程序直接 import。**对现有网站也是纯收益**（逻辑解耦、测试更好写），即使小程序不做也不浪费。
2. 按 2MB 主包倒推分包切法：分析器 wasm 进独立分包；`cubeopt/` 9 个文件单独一包。
3. Three.js → `threejs-miniprogram` 适配层验证（先拿 `/sim` 最简单的一个魔方试）。
4. Worker 并发 1 个的重构：现在多 worker 并行的地方要改成排队或合并。

## 6. 明确不迁（别在这上面耗时间）

- `/meet`、双人对战视频 —— LiveKit / 标准 WebRTC 小程序不支持，只有 RTMP 的 `live-pusher` 和 `voip-room`
- ffmpeg.wasm 相关（`/frame-count` 等）—— 32MB 单文件超总限额
- `/sim` 复杂 Three.js 场景、maplibre 地图、echarts 大图表 —— 留在 web-view 里

## 7. 官方文档

- [UnionID 机制说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html)（绑定方向的坑）
- [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html) / [code2Session](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html)
- [网络使用说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)（域名备案、`api.weixin.qq.com` 禁配）
- [分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)（2MB / 30MB）
- [WXWebAssembly](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/wasm.html)
- [多线程 Worker](https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html)（并发 1）
- [web-view](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)（个人主体不支持）
- [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html)
