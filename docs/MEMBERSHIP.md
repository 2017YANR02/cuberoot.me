# CubeRoot 会员支付总体方案

状态：网站银行卡适配代码已完成并默认关闭；商户尚未获批/配置；五端共享登录源码已接线但生产/provider/设备矩阵未完成，原生内购尚未实现
最后更新：2026-08-31

本文是 CubeRoot 会员支付的设计事实源，供后续开发者和 AI 接续工作。实现前必须重新核对当前源码、商户资质、支付渠道后台和应用商店最新政策，不能把本文中的候选服务商当成已开通能力。

## 1. 目标

CubeRoot 最终提供一套跨网站和五端已安装客户端共用的会员权益：

- 网站支持支付宝、微信、中国银行卡和外国银行卡付款。
- 网站用户可主动打开对应的 Android 或 iOS App，并在 App 内完成原生商店支付。
- 无论从网站、Google Play 还是 App Store 购买，登录同一 CubeRoot 账号后看到同一会员状态。
- 支付成功、续费、到期、退款和撤销都由服务端核验，不相信客户端口头上报。
- 会员是对 CubeRoot 的支持及附加权益，不默认把现有免费核心工具改成付费墙。

### 1.1 用户已确认的接入条件

- CubeRoot 由中国开发者/经营主体运营。
- 用户确认网站所需备案已经具备；具体备案名称、主体一致性和支付服务商要求仍要在签约时逐项核对。
- 已有招商银行对公账户，可作为候选人民币结算账户。
- 仓库只记录“已具备对公账户”这一事实，不记录账号、开户信息、网银凭据或支付密钥。

以上条件显著提高了申请国内收单的可行性，但不等于已经取得银行卡收单资格。对公账户负责接收结算款；是否能收中国银联卡、Visa、Mastercard，以及能否结算人民币或外币，仍以收单机构对实际主体、业务类型和账户的审核结果为准。

## 2. 当前事实

### 网站与 API

当前实现位于：

- `core/packages/client/app/[lang]/membership/`
- `core/apps/api/src/routes/membership.ts`
- `core/apps/api/migrations/0046_membership.sql`
- `core/apps/api/src/payment/alipay.ts`
- `core/apps/api/src/payment/wechat.ts`
- `core/apps/api/src/payment/airwallex.ts`

当前能力：

- 套餐为月度、年度和永久会员，价格与启用状态来自数据库。
- 支持支付宝、微信、虎皮椒聚合渠道和管理员手动开通。
- 月度和年度当前都是一次性购买，到期后手动续费，不是真正的自动续费。
- 订单以 `out_trade_no` 幂等结算，异步回调验签后开通会员。
- 当前会员和订单主要以 `wca_id` 归属，尚未形成适合网站账号和五端已安装客户端的统一内部用户所有权。
- 已接入 Airwallex 托管银行卡收银台适配器，包含建单、HMAC webhook 验签、订单金额/币种核对、主动查单和幂等开通。
- 银行卡入口默认隐藏；只有真实商户凭据、webhook 密钥和对应渠道开关均配置后才会显示。代码就绪不代表中国大陆主体已经获批收单。

### 已安装客户端

五端共享产品层是 `core/packages/app-ui`。Android/iOS 使用 `core/apps/mobile` 的 Capacitor 宿主，Windows/macOS 使用同一个 `core/apps/desktop` Tauri 宿主，HarmonyOS NEXT 使用 `core/apps/harmony` ArkWeb 宿主；各平台工程只承载系统能力。

当前 App：

- 已复用网站唯一账号系统、PKCE 单次票据和共享认证客户端；源码 adapter 分别面向 Android/iOS Keychain/Keystore、Desktop 系统 keyring 和 HarmonyOS 系统安全存储。该源码已接线不等于生产部署、设备安全存储或真实 provider 登录已经通过，各平台仍按路线图分别验收。
- 没有会员页、会员状态或恢复购买。
- 没有 Google Play Billing、StoreKit 或其他支付 SDK。
- 没有网站到 App 的已验证购买交接。
- 仍按免费、无订阅 App 填写现有商店资料。

## 3. 不得混淆的三类付款

| 场景 | 正确支付通道 | 说明 |
|---|---|---|
| 网站支付宝、微信 | 现有网站支付服务商 | 一次性付款，后续是否自动续费取决于单独获批的代扣能力 |
| 网站银行卡 | 合规银行卡收单服务商的托管收银台 | 可做一次性付款；自动续费需另建订阅生命周期 |
| Android / iOS 内解锁数字会员权益 | Google Play Billing / Apple In-App Purchase | 默认方案，不能用网页银行卡入口冒充应用内支付 |

网站可以展示“在 CubeRoot App 中购买”，但 App 内不能在全球范围内默认引导用户绕过商店，到网页刷卡、支付宝或微信购买数字权益。部分地区存在特殊计划，只有在实际加入相应计划并按地区实现后才能启用。

政策事实源：

- [Apple App Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)

## 4. 网站银行卡付款

### 4.1 产品范围

首版银行卡支付只做网站托管收银台和一次性购买：

- 月度会员：一次买一个月，手动续费。
- 年度会员：一次买一年，手动续费。
- 永久会员：一次性非重复购买。

银行卡自动续费是后续独立阶段。它需要保存服务商 Customer / Subscription 引用、续费通知、失败重试、取消、退款、争议和账单状态，不能只在现有一次性订单上增加一个 `autoRenew` 布尔值。

### 4.2 中国卡与外国卡双通道

产品上统一叫“银行卡付款”，服务端保留两条独立支付轨道：

| 轨道 | 首要覆盖 | 首选呈现/结算 | 接入方向 |
|---|---|---|---|
| `card_cn` | 中国境内发行的银联借记卡、信用卡和企业网银 | CNY 标价，优先结算到现有招商银行对公账户 | 中国银联或具备资质的境内收单机构 |
| `card_global` | Visa、Mastercard；American Express、JCB、银联国际按实际开通能力增加 | 按收单协议支持的币种标价；可结算 CNY 或外币，但不得预设 | 明确接受中国大陆主体和数字会员业务的跨境收单机构 |

同一家服务商若书面确认能同时覆盖中国大陆主体、境内银联卡、国际卡和招商银行对公结算，可以由一个 provider 实现两条轨道；否则使用两个 provider 适配器。不要为了代码简单而强求一家服务商。

网站只展示后台实际启用的入口：

- `card_cn` 可用时显示“中国银行卡（银联）”。
- `card_global` 可用时显示“国际银行卡（Visa / Mastercard）”。
- 两条轨道由同一托管收银台可靠识别且支持相同结算规则时，可合并显示为“银行卡”，但订单仍记录实际轨道和卡组织。

支付宝或微信账户可能绑定银行卡，但那仍属于支付宝/微信支付，不等于 CubeRoot 已提供直接银行卡收银台。

### 4.3 收银台边界

- 优先使用支付服务商托管的 Checkout 页面。
- CubeRoot 页面和 API 不接收、不记录、不打印卡号、有效期或 CVC。
- 前端只请求创建订单并跳转到服务商返回的 HTTPS Checkout URL。
- 返回成功页只负责展示和轮询，不能据此开通会员。
- 服务端必须验签 webhook，并向服务商查询关键交易状态后幂等入账。
- 必须处理 3-D Secure / SCA、拒付、处理中、退款、撤销和争议。
- 页面显示实际币种和金额；不能默默把 CNY 当成其他结算币种。
- Visa、Mastercard、American Express、JCB、银联等品牌以最终服务商、商户地区、发卡地区和用户地区实际能力为准，不提前承诺。

[Stripe Checkout](https://docs.stripe.com/payments/checkout) 是托管收银台的技术参考，也支持一次性付款和订阅。但 Stripe 当前[官方支持地区列表](https://stripe.com/global)没有把中国大陆列为可直接开通 Payments 的支持地区，因此在确认 CubeRoot 实际签约主体、结算账户和后台通过审核前，不得安装 Stripe SDK、写死 Stripe 或把它展示为可用渠道。

[Airwallex 全球银行卡文档](https://www.airwallex.com/docs/payments/payment-methods/global/cards)可作为另一个尽调示例：其文档展示多种国际卡能力，但当前表格列出的部分卡组织可开户企业地区不包含中国大陆。因此“中国区有业务”或市场宣传不等于 CubeRoot 的中国大陆主体已获在线银行卡收单，必须以实际主体的书面准入结果为准。

### 4.4 服务商选择门槛

所有条件核实后才能确定银行卡服务商：

- CubeRoot 实际经营主体和注册地区可开户。
- `card_cn` 明确支持中国境内银联卡、CNY 标价，并能结算到招商银行对公账户。
- `card_global` 明确支持 Visa、Mastercard 和目标用户地区；其他卡组织按实际审核增加。
- 明确支持的呈现币种、结算币种、换汇路径和外汇/税务所需材料；不得假设普通人民币对公账户能直接接收外币。
- 提供托管收银台、3-D Secure、服务端 API、签名 webhook、主动查单、退款和争议查询。
- 费率、跨境费、货币转换、提现周期、保证金和拒付费用可接受。
- 允许销售本站实际描述的数字会员，不把它错误申报成捐赠或实体商品。
- 沙盒、生产账号和 webhook 均已实际验证。

当前代码选用 Airwallex 托管收银台作为首个 provider 适配器，但所有入口默认关闭。只有 CubeRoot 的实际中国大陆主体书面获批对应卡组织、结算路径并完成沙盒验证后，才能打开相应渠道；若申请不通过，保留统一渠道契约并替换 provider，不展示假按钮。

国内轨道可参考中国银联官方的[网银支付业务直联商户接入指引](https://open.unionpay.com/upload/download/%E4%B8%AD%E5%9B%BD%E9%93%B6%E8%81%94%E7%BD%91%E9%93%B6%E6%94%AF%E4%BB%98%E4%B8%9A%E5%8A%A1%E7%9B%B4%E8%81%94%E5%95%86%E6%88%B7%E6%8E%A5%E5%85%A5%E6%8C%87%E5%BC%95.1.0.pdf)，但最终可选择银联直联或合规收单机构间联，取决于准入、成本和接入复杂度。

### 4.5 现有 API 的预期扩展

保持“支付渠道”和“底层服务商”分离：

- `pay_channel`: `alipay | wechat | card_cn | card_global`
- `provider`: `alipay | wechat | xunhupay | airwallex | manual`

预期变化：

- `GET /v1/membership/plans` 的 `channels` 分别增加 `cardCn` 和 `cardGlobal`，只在对应生产商户实际可用时返回 `true`。
- `POST /v1/membership/orders` 接受 `channel: "card_cn" | "card_global"`，服务端选择对应的银行卡 provider。
- 银行卡下单响应返回短期 `hostedCheckout` 会话，前端通过官方 Components SDK 跳转到托管收银台；API 密钥不进入浏览器。
- Airwallex webhook 为 `POST /v1/membership/notify/airwallex`，仅处理验签通过且金额、币种、订单号、商户账户均匹配的 `payment_intent.succeeded`。
- 订单保存实际支付轨道、服务商、卡组织、呈现币种和结算币种；不得保存完整卡号，只可保存服务商允许返回的品牌和脱敏尾号等非敏感排障信息。
- `provider_txn` 保存服务商交易 ID；原始回调仅保存排障所需字段，敏感字段必须过滤。
- 为 provider 交易 ID、事件 ID建立唯一约束，重复 webhook 不得重复延长会员。

当前配置项位于 `core/apps/api/.env.example`：

```ini
AIRWALLEX_ENV=demo
AIRWALLEX_CLIENT_ID=
AIRWALLEX_API_KEY=
AIRWALLEX_ACCOUNT_ID=
AIRWALLEX_LOGIN_AS=
AIRWALLEX_WEBHOOK_SECRET=
AIRWALLEX_CARD_CN_ENABLED=0
AIRWALLEX_CARD_GLOBAL_ENABLED=0
```

`AIRWALLEX_LOGIN_AS` 仅在平台/多账户场景按商户后台要求填写。`AIRWALLEX_CARD_CN_ENABLED` 和 `AIRWALLEX_CARD_GLOBAL_ENABLED` 只能分别在对应轨道获批并完成验证后改为 `1`。生产 webhook 订阅事件为 `payment_intent.succeeded`，地址是 `https://api.cuberoot.me/v1/membership/notify/airwallex`。

## 5. 网站引导到移动端支付

### 5.1 用户流程

1. 用户在网站登录并选择套餐。
2. 用户主动点击“在 Android App 中购买”或“在 iPhone App 中购买”。
3. API 生成一次性、短有效期的购买交接票据，绑定内部用户、套餐、目标平台和随机 nonce。
4. 网站打开 `https://open.cuberoot.me/membership/checkout?t=<opaque-ticket>`。
5. 已安装 App 时通过 App Links / Universal Links 打开会员购买页；未安装时显示对应商店下载入口。
6. App 向 API 兑换票据，再从 Google Play 或 App Store 获取商品和当地价格。
7. App 调起原生购买，服务端核验交易后授予统一会员权益。
8. App 和网站重新请求会员状态。

`open.cuberoot.me` 只用于已验证深链和商店回退，不承载重复网站内容。不得自动强制打开 App；必须由用户点击触发。

### 5.2 票据安全

- URL 只含随机不透明票据，不含 JWT、WCA ID、邮箱、价格或支付结果。
- 票据单次使用，建议 1 至 5 分钟过期，数据库只保存摘要。
- 绑定创建者、套餐、平台和使用状态；兑换后立即失效。
- 兑换和创建接口都要限流并记录安全审计事件。
- 未登录、已过期、平台不符、重复兑换和离线均需明确错误状态。

## 6. Android 工作

- 在共享 React 会员页之外增加薄的 Google Play Billing 原生适配器，不复制一套 Android 业务 UI。
- 在 Play Console 创建月度、年度订阅或预付方案，以及永久会员一次性商品。
- 从 Play 返回的 `ProductDetails` 显示当地价格，不使用网站价格冒充商店价格。
- 购买时使用内部用户 ID 的不可逆映射作为账号关联信息。
- 将 `purchaseToken` 发到服务端，由服务端调用 Google Play Developer API 核验、授予权益并确认购买。
- 处理 pending、cancelled、failed、restored、grace period、account hold、expired、refunded 和 revoked。
- 接入 Real-time Developer Notifications；收到通知后再查官方 API 状态，通知本身不是付款凭证。
- 增加恢复购买和管理订阅入口。
- 配置 `android:autoVerify` App Links 与 `/.well-known/assetlinks.json`，使用正式 Play App Signing 指纹。

## 7. iOS 工作

- 在共享 React 会员页之外增加薄的 StoreKit 2 原生适配器，不复制一套 iOS 业务 UI。
- 在 App Store Connect 创建订阅组、月度/年度商品和永久会员非消耗型商品。
- 从 StoreKit `Product` 显示当地价格。
- 使用服务端签发的 UUID 作为 `appAccountToken`，关联 CubeRoot 内部用户。
- 服务端验证签名交易，并接入 App Store Server API 与 Server Notifications V2。
- 处理 current entitlements、transaction updates、恢复购买、续费失败、退款和撤销。
- 增加管理订阅入口。
- 配置 Associated Domains、AASA 和 Universal Links；会话存入 Keychain。
- 在 Sandbox、StoreKit 测试配置和 TestFlight 分别验证。

## 8. 统一账号与会员权益

移动支付实施前必须先解决账号所有权。目标是以站内稳定内部 `user_id` 为会员主体，WCA ID 只是可绑定身份之一。

不要让三个支付来源各自维护一份“是否会员”。服务端应保存来源交易和订阅，再计算一份统一权益：

```text
网站支付宝/微信/银行卡 ─┐
Google Play ───────────┼─> 已核验交易/订阅 ─> 统一会员权益 ─> 网站、Android、iOS
Apple App Store ───────┘
```

目标数据至少需要表达：

- 内部用户 ID、套餐、来源平台、provider 和环境。
- 我方订单号、服务商交易 ID、订阅 ID或购买 token。
- 原始购买、每次续费、开始与到期时间、自动续费状态。
- pending、active、grace、past_due、expired、refunded、revoked、disputed 等状态。
- webhook 事件 ID、事件时间、核验时间和幂等处理结果。
- 多来源权益重叠时的合并规则；永久会员不得被短期购买降级。

实现迁移前先检查当前 `app_users`、WCA 账号关联和 `memberships` 的真实关系，不凭本文猜列名。现有客户端仍需在迁移期间正常读取会员状态。

## 9. 商品语义

以下语义必须由产品所有者确认后再建商店商品：

| 套餐 | 网站首版 | Android / iOS 建议 |
|---|---|---|
| 连续包月 | 当前网站一次性月卡可保留；银行卡自动续费后置 | 自动续期订阅 |
| 年度会员 | 一次性一年 | 决定做自动续期年度，还是预付/非续期年度 |
| 永久会员 | 一次性 | Android 一次性商品；iOS 非消耗型商品 |

网站价格与商店价格可以不同，因为税费、汇率和商店费用不同。每个渠道必须展示该渠道返回的实际价格，不在客户端做临时换算。

## 10. 异常和边界条件

实现前必须覆盖：

- 用户未登录、账号被删除或切换账号。
- App 未安装、深链过期、重复点击、错误平台和无网络。
- 用户取消支付、银行卡被拒、3-D Secure 未完成、商店 pending。
- webhook 重复、乱序、延迟或暂时无法查单。
- 支付成功但客户端关闭，或回跳页面被拦截。
- 同一用户重复购买、已有永久会员再次购买、跨平台重复订阅。
- 续费失败、宽限期、取消但当期仍有效、退款、撤销和拒付。
- Sandbox 与 Production 交易串环境。
- App 审核账号、恢复购买和账号删除后的权益处理。

## 11. 实施顺序

### 阶段 A：产品与商户决策

- [ ] 向中国银联或境内收单机构确认 `card_cn` 准入，并验证 CNY 可结算到招商银行对公账户。
- [ ] 向跨境收单机构确认中国大陆主体的 `card_global` 准入，不接受仅针对境外主体的产品说明。
- [ ] 分别确定支持的卡组织、用户地区、呈现币种、结算币种、换汇路径、费率和退款/拒付规则。
- [ ] 确认现有对公账户的实际收款币种；如需外币账户或由服务商换汇结算，先完成银行和合规手续。
- [ ] 确定年度会员是否自动续费。
- [ ] 确定网站与商店是否同价。

### 阶段 B：网站银行卡一次性付款

- [x] 增加 `card_cn` 和 `card_global` 服务端渠道契约、Airwallex 适配器、配置校验和独立渠道可用性。
- [x] 增加托管 Checkout 下单、webhook、主动查单和幂等开通。
- [x] 在网站会员页只显示已配置并显式打开的中国银行卡或国际银行卡入口。
- [ ] 增加退款、拒付和争议事件对会员权益的撤销/人工复核流程。
- [ ] 两条轨道分别在沙盒与生产完成一笔真实闭环验证；不能用国际卡成功代替中国银联卡验收，反之亦然。

### 阶段 C：统一账号和权益

- [ ] 将会员归属迁移到稳定内部用户 ID，并兼容现有 WCA 会员。
- [ ] 增加来源交易、订阅、事件和统一 entitlement 模型。
- [ ] 完成移动端登录、安全存储、退出和账号删除流程。

### 阶段 D：网站到 App 交接

- [ ] 增加一次性购买票据接口。
- [ ] 配置 Android App Links 和 iOS Universal Links。
- [ ] 完成未安装、未登录、过期、离线和商店回退体验。

### 阶段 E：移动端原生购买

- [ ] Android Play Billing、服务端核验、通知、恢复购买和管理订阅。
- [ ] iOS StoreKit 2、服务端核验、通知、恢复购买和管理订阅。
- [ ] 更新隐私政策、Data Safety、App Privacy、审核账号和审核说明。
- [ ] 通过内部测试、Sandbox、TestFlight 和分阶段发布。

## 12. 后续 AI 接手规则

- 先读本文件，再读 `AGENTS.md`、`core/apps/mobile/README.md`、`docs/mobile-app-roadmap.md`、`docs/mobile-store-submission.md` 和当前会员源码。
- 政策、费用、SDK 版本、商户支持地区和线上渠道状态必须重新查询官方来源。
- 未看到商户后台已开通和沙盒成功证据，不得把某支付渠道标记为可用。
- 不创建假银行卡按钮、不伪造支付成功、不用 return URL 直接开通权益。
- 不把网页银行卡、支付宝或微信包装成 Apple / Google 应用内购买。
- Android 与 iOS 共用 React 业务页和稳定契约，只分别实现原生支付、深链和安全存储适配器。
- 修改 API 或数据库时使用 `server-deploy` skill；修改移动端时使用 `cuberoot-mobile` skill。
- 支付、登录或 SDK 进入 App 后，必须同步更新 `docs/mobile-store-submission.md`；有验证证据后才更新 `docs/mobile-app-roadmap.md` 进度。
- 默认只提交本任务文件；除非用户明确要求，不 push。

## 13. 官方参考

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple In-App Purchase 配置](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Google Play Billing integration](https://developer.android.com/google/play/billing/integrate)
- [Android App Links](https://developer.android.com/training/app-links/about)
- [Apple Universal Links](https://developer.apple.com/documentation/Xcode/supporting-associated-domains)
- [Stripe hosted Checkout 技术参考](https://docs.stripe.com/payments/checkout)
- [Stripe global availability](https://stripe.com/global)
- [中国银联网银支付业务直联商户接入指引](https://open.unionpay.com/upload/download/%E4%B8%AD%E5%9B%BD%E9%93%B6%E8%81%94%E7%BD%91%E9%93%B6%E6%94%AF%E4%BB%98%E4%B8%9A%E5%8A%A1%E7%9B%B4%E8%81%94%E5%95%86%E6%88%B7%E6%8E%A5%E5%85%A5%E6%8C%87%E5%BC%95.1.0.pdf)
- [Airwallex 全球银行卡能力与企业地区限制](https://www.airwallex.com/docs/payments/payment-methods/global/cards)
- [Airwallex Hosted Payment Page](https://www.airwallex.com/docs/js/payments/hosted-payment-page)
- [Airwallex API authentication](https://www.airwallex.com/docs/api/authentication/api_access_token)
- [Airwallex webhook signature verification](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events)
