# 会员与支付：2026 年 6 月设计及接入记录

状态：`HISTORICAL`。两份早期手册合并归档，保留原始决策、资格限制、日期和验收证据；其中“当前”、旧公司主体、仅 WCA 登录及测试价格仅代表记录时点，不能据此改线上配置。当前入口见[会员与支付](../README.md)。

<a id="membership-design"></a>

# 会员订阅 (Membership / Subscription)

`/membership` 会员订阅功能。2026-06-13 实现。本文是「为什么这么设计」+「上线前你要做什么」。

> **支付渠道对接 / 上线 / 续接(支付宝、微信、银行卡、自动续费政策结论)总手册见 [`PAYMENT_SETUP.md`](#payment-setup)。** 网站银行卡与 Android/iOS 跨端支付路线见 [`../../docs/product/payments/MEMBERSHIP.md`](../MEMBERSHIP.md)。

## 调研结论(为什么这样设计)

1. **不建本站账号,沿用 WCA OAuth。** 站内用户就是 WCA 选手,WCA 登录是最低摩擦的身份源。
   会员状态直接挂在 `wca_id` 上(JWT 已携带)。业界做法也是「OAuth 身份 + 把订阅挂在内部 user id」,
   不为了收钱再造一套邮箱密码。*约束:没参加过比赛、无 wca_id 的人目前无法登录,故也无法成为会员(沿用现有 auth 限制)。*

2. **手动按周期续费 + 到期提醒,不做自动扣款。** 两家自动代扣对本主体当前都走不通(2026-06-18 核实):
   - 微信「自动续费(原委托代扣)」官方 2025 自助申请指引明写 **「仅支持主体类型为企业、政府机构、事业单位、社会组织类型」**,
     且 **个体工商户和个人独资企业不在允许范围内**。本站主体为**个人独资企业**(上海魔方根教育科技工作室)→ 大概率被主体类型卡住
     (用户量门槛反而友好:<20 用户也能开,情形三结算 T+14 —— 但主体类型不过则无意义)。残留不确定:微信商户号实际把个人独资归为哪类
     需向微信商户客服按真实商户号确认;H5 纯签约场景本身支持(非必须公众号/小程序,但需绑定一个 APPID)。
   - 支付宝「周期扣款 / 商家扣款」要求 **近 90 天活跃用户 ≥ 300**,新站达不到(可打 4007585858 问特殊通道)。
   - 当前生产模型仍是一次性买 月/年/永久,存 `expires_at`,**到期提醒 + 便捷续费**,手动再买。永久会员 `expires_at = NULL`。
     微信自动续费审核期间,连续包月和连续包年作为独立套餐默认不公开；审核通过并完成签约、扣款、通知和取消闭环后，后台公开这两项并关闭现有过渡套餐。

   **到期提醒 + 便捷续费(2026-06-18 已建,client-only):** `lib/membership-api.ts` 的纯函数 `membershipExpiry()`
   (lifetime/active/expired/daysLeft/expiringSoon,阈值 `EXPIRE_SOON_DAYS=7`,有单测 `tests/membership-expiry.test.ts`);
   `/membership` 状态条:即将到期黄色警示 + 已过期红色块 + 「立即续费」按钮(默认续上当前/上次套餐 → 回落月度);
   `?renew=1` 深链自动打开续费弹窗;全局 `components/MembershipReminder.tsx`(挂 root layout,即将到期/已过期登录会员任意页底部弹一条可关闭提醒,
   按到期日记忆关闭、续费后自然复位,/membership 页自身不弹)。提醒目前仅站内(无邮件/推送基建;邮件投递国内本就差)。

3. **支付:官方支付宝 / 官方微信支付 优先,虎皮椒聚合支付兜底(multi-provider 适配层)。**
   站长持有营业执照(上海魔方根教育科技工作室,个人独资企业)+ 网站已 ICP 备案,
   因此可申请 **官方支付宝「电脑/手机网站支付」** 与 **官方微信支付商户号(APIv3)** —— 费率更低(支付宝约 0.6%)、
   可开发票、资金直连、无聚合中间商,是首选。代码按渠道择优:支付宝渠道用官方支付宝,微信渠道用官方微信支付,
   任一未配置则回落 **虎皮椒 xunhupay**(个人凭身份证 + 银行卡即可开,作快速兜底 / 申请官方期间过渡)。
   三个 provider 共用同一套下单 / 入账 / 查单 / 幂等开通逻辑,只在「下单产物」「验签/解密」处分叉。
   Stripe / Paddle / Lago 对中国大陆主体都不可用,不考虑。

4. **薄自研计费层,不上 Lago/Kill Bill。** 三张表(plans / orders / memberships)+ provider 适配层,贴合现有 Hono + PG 栈。
   provider 文件:`apps/api/src/payment/alipay.ts`(官方支付宝,公钥模式 RSA2)、
   `apps/api/src/payment/wechat.ts`(官方微信 APIv3,SHA256-RSA2048 + AEAD_AES_256_GCM 回调解密);
   虎皮椒签名仍在 `routes/membership.ts` + `@cuberoot/shared/payment`。

## 数据模型

`migrations/0046_membership.sql` + `migrations/0180_membership_auto_renew_plan.sql` + `migrations/0181_enterprise_membership_plans.sql` + `migrations/0182_membership_plan_perks.sql`:
- `membership_plans` — 套餐(slug / period / period_count / price_cents / perks)。个人月度/年度和永久是当前一次性套餐；连续包月/包年是默认不公开的未来自动续费套餐；企业月度/年度沿用当前单账号会员开通流程。价格和公开状态都由后台控制。
- 个人权益 — 不限量三阶云端最少步快速求解、每月 10 把高手解法复盘、专属会员徽章、新功能抢先体验、致谢名单署名；永久会员另含永久有效说明。
- 企业权益 — 包含全部个人权益，另含师生主页与排名页展示、企业专属介绍页、教程/图文/视频云端存储和企业课程方案定制。
- `membership_orders` — 每次下单一条(`out_trade_no` 我方单号;status pending→paid;raw_notify 审计)。
- `memberships` — 每用户一行(plan_slug / expires_at / source / 选填 contact)。生效判定不存 status,读时算:`expires_at IS NULL 或 > now()`。

## 后端 `/v1/membership/*`(`apps/api/src/routes/membership.ts`)

| 端点 | 鉴权 | 说明 |
|---|---|---|
| `GET /plans` | 公开 | 在售套餐 + `payEnabled` + `channels`(各渠道是否可下单) |
| `GET /me` | 登录 | 本人会员状态 |
| `PUT /me/contact` | 登录 | 设置续费/找回联系方式 |
| `POST /orders` | 登录 | 下单(传 `channel` + `clientType` pc/wap),按渠道择优 provider,返回收银台 url 或二维码 |
| `GET /orders/:no` | 登录(本人) | 查单(前端轮询;仍 pending 时按 provider 主动查单补偿) |
| `POST /notify/alipay` | 公开 webhook | 官方支付宝异步回调,RSA2 **验签**后入账,回字面量 `success` |
| `POST /notify/wechat` | 公开 webhook | 官方微信 APIv3 回调,**GCM 解密**(+选配验签)后入账,回 `{code:'SUCCESS'}` |
| `POST /notify/xunhupay` | 公开 webhook | 虎皮椒异步回调,MD5 **验签**后入账,回字面量 `success` |
| `POST /admin/grant` | admin | 手动开通/续期(给已打赏用户,或商户未配置时) |
| `GET /admin/list` | admin | 会员 + 最近订单 |
| `DELETE /admin/member/:wcaId` | admin | 撤销会员 |
| `PUT /admin/plans/:slug` | admin | 改套餐(价格/启用/文案/perks) |

**安全要点:**
- 待签/待验串构造全在 `@cuberoot/shared/payment`(纯函数,浏览器安全,有单测);RSA / GCM 走 server `node:crypto`。
  - 官方支付宝:RSA2(SHA256withRSA),公钥模式。请求用商户应用私钥签(排除 `sign`);notify 用支付宝公钥验(排除 `sign`+`sign_type`)。
  - 官方微信 APIv3:请求 Authorization 签名 SHA256-RSA2048;回调 AEAD_AES_256_GCM 解密 —— **解密成功本身即鉴权**(APIv3 密钥仅商户与微信持有,无法伪造);另配 `WECHAT_PLATFORM_PUBKEY` 则再验应答签名(纵深防御)。
  - 虎皮椒:排序非空参数 → `k=v&...` → 末尾追加 APPSECRET → MD5 小写。
- 单测:`tests/official_pay_sign.test.ts`(支付宝 RSA2 / 微信 v3 签名 / GCM 解密 round-trip)、`tests/xunhupay_sign.test.ts`。
- 入账幂等:订单 `pending→paid` 用条件 UPDATE `WHERE status='pending' RETURNING` 锁定,只开通一次(三 provider 共用)。
- **对应商户未配置时该渠道 notify 一律拒绝**(`fail` / `FAIL`,绝不开通)—— 防空密钥下被伪造请求白嫖会员。

## 前端

- `/membership` 页(`app/[lang]/membership/`):套餐卡 + 支付弹窗(选支付宝/微信 → 扫码 + 轮询) + 会员状态 + 续费联系方式 + admin 面板。
- 入口:打赏弹窗 `DonateModal` 顶部链接、`/support` 头部链接。
- `hooks/useMembership.ts`、`components/MembershipBadge.tsx`(已登记 /dev 组件库)。

## 渠道择优 + 下单产物

下单按 `channel`(用户选支付宝/微信)× 是否配置官方 决定 provider;`clientType`(pc/wap,前端按 `useIsMobile` 传)决定产物:

| 渠道 | provider 优先级 | PC(pc) | 移动(wap) |
|---|---|---|---|
| 支付宝 | 官方支付宝 → 虎皮椒 | 电脑网站支付,返回收银台 `url`(新窗口打开 + 轮询) | 手机网站支付,返回 `url`(直接跳转) |
| 微信 | 官方微信 → 虎皮椒 | Native,`code_url` 服务端转 PNG 二维码 `qrcode`(扫码 + 轮询) | H5,返回 `h5_url`(直接跳转) |

`/plans` 的 `channels:{alipay,wechat}` 表示该渠道官方或虎皮椒任一已配置,前端据此显隐按钮。
虎皮椒渠道是**账号(APPID)级**:单账号两个按钮都走它;分账号可填 `XUNHUPAY_WECHAT_*` / `XUNHUPAY_ALIPAY_*` 覆盖。

---

## ✅ 已验证 / ⚠️ 未验证

- ✅ migration、整套后端(下单/开通/续期叠加/永久/409 守卫/改价/notify 拒绝)已对 **本地 pg13 端到端跑通**(xunhupay 阶段)。
- ✅ 前端 EN/ZH 渲染、登录门控、支付弹窗(选渠道→二维码→轮询)Playwright 验过。
- ✅ **官方 provider 用自造密钥对跑通真实模块 round-trip**:支付宝请求签名可被公钥验、notify 验签接受合法/拒绝篡改/拒绝缺签;
  微信 Authorization 签名对称、回调 GCM 解密出订单、篡改密文被拒。签名/解密单测 `tests/official_pay_sign.test.ts` 全绿。
- ⚠️ **三个真实网关都未联调**(无商户号):
  - 官方支付宝按公钥模式实现;务必在开放平台用**公钥模式**(非证书模式)创建应用,否则验签字段对不上。
  - 官方微信按 APIv3 Native + H5 实现;`WECHAT_APPID` 必须与商户号绑定,APIv3 密钥须 32 字节。
  - 虎皮椒签名串末尾 `&` 官方与 SDK 有歧义,本实现无尾 `&`;失败则试带尾变体。
  - 上线后先用 ¥0.01 套餐真扫一笔验证各渠道 notify 入账。

## 🔧 上线前你要做的事

> 站长已有营业执照(个人独资企业)+ 网站已 ICP 备案 → 直接走官方支付,虎皮椒可选作过渡。

1. **(可选,几天)申请官方商户**:
   - **支付宝**:[open.alipay.com](https://open.alipay.com) 创建「网页&移动应用」自研应用 → 开通「电脑网站支付」+「手机网站支付」→ **公钥模式** 上传应用公钥、保存支付宝公钥。拿 `ALIPAY_APP_ID` + 应用私钥 + 支付宝公钥。
   - **微信支付**:[pay.weixin.qq.com](https://pay.weixin.qq.com) 用营业执照开商户号(个人独资无对公账户可用法人本人银行卡走认证)→ 拿 `WECHAT_MCHID`、APIv3 密钥、商户证书序列号 + `apiclient_key.pem`;`WECHAT_APPID` 用与商户号绑定的公众号/应用 appid。
2. **(可选,当天)注册虎皮椒** [xunhupay.com](https://www.xunhupay.com) 作快速兜底:网站地址(已备案)+ 身份证 + 银行卡 → `XUNHUPAY_APPID/APPSECRET`。
3. **合规备忘**:对收费网站严格说还需 **ICP 经营许可证(增值电信)**,而它要求公司主体 + 注册资本 ≥ 100 万;
   个人独资企业(本主体出资额 10 万)办不下来,但**该证与支付开通无关**(支付只认 ICP 备案,已有),
   实践中小站普遍未办。属真实但常被跳过的合规缺口,知情即可。订阅收入按经营所得依法申报。
4. **填服务器 `.env`**(见 `.env.example`):配齐你申请到的那套(官方支付宝 / 官方微信 / 虎皮椒任一即可启用对应渠道)+
   `PUBLIC_API_ORIGIN` / `PUBLIC_SITE_ORIGIN`,然后 `pm2 reload core-api --update-env`。
5. **改套餐价格**:admin 登录 `/membership` 底部面板直接改(seed 占位 ¥10/¥99/¥299)。
6. **部署**:push `core/**` → `deploy_core.yml` 部署 server(migration 0046 已随上一笔 commit 部署,三表已建);前端走 Vercel / `deploy_next.yml`。
   notify 地址 `https://api.cuberoot.me/v1/membership/notify/{alipay,wechat,xunhupay}` 走现有 nginx 反代,无需额外配置;
   各平台后台的「异步通知 URL」填对应那条。
7. **真机验证**:用 ¥0.01 临时套餐每个已配渠道各真扫一笔,确认 notify 入账(admin/list 看到 paid 订单 + 会员开通)。

## 本地测试

- 签名 / 解密:`pnpm --filter @cuberoot/client exec vitest run tests/official_pay_sign.test.ts tests/xunhupay_sign.test.ts`。
- 官方 provider 真实模块 round-trip:用自造 RSA 密钥对设 `ALIPAY_*` / `WECHAT_*` env 后 dynamic-import `payment/{alipay,wechat}.js`(完整 server 因 sr-puzzlegen ESM 在 tsx 下起不来,只 import 这两个模块即可,它们不碰 sr-puzzlegen / db)。
- 业务流(下单/开通/续期/查单):docker pg13(5433)已应用 migration;admin 端点用 `wcaId='2017YANR02'` 的 HS256 JWT(JWT_SECRET 签)。


<a id="payment-setup"></a>

# 支付对接手册 (Payment Setup)

会员订阅 `/membership` 的**支付渠道对接 / 上线 / 续接**总手册。给站长 + 未来 AID 用:看完这一份就知道每个渠道现在到哪一步、代码在哪、还差什么、怎么接。

> 设计「为什么这么做」见 [`MEMBERSHIP.md`](#membership-design);本文只讲**对接与运维**。
> **本文不含任何密钥 / 私钥 / 登录凭据**(它进 git)。真实凭据见:服务器 `/root/core-api/.env`、本机 `D:\cube\alipay-keys\`(支付宝密钥)、私有 memory `project_membership_subscription.md`。

最后更新:2026-06-18。

---

## 0. 一眼看现状

| 渠道 | 状态 | 备注 |
|---|---|---|
| **支付宝 · 电脑网站支付** | ✅ 已上线已验证 | ¥0.01 真扫,notify 正常入账 |
| **支付宝 · 手机网站支付** | ✅ 已上线已验证 | 2026-06-18 签约 + 手机 ¥0.01 验过;代码按 `clientType` pc/wap 自动分流 |
| **微信 · 普通支付(扫码 Native + H5)** | 🟡 代码就绪,待开商户号 | 开微信商户号 + 绑 APPID + 填 5 个 env 即可,**无需改代码** |
| **银行卡 · 中国银联卡 / 国际卡** | 🟡 代码就绪,默认隐藏 | Airwallex 托管收银台;两条轨道分别审核、配置并验证后才打开 |
| **支付宝 · 自动续费(周期扣款)** | ⛔ 当前拿不到 | 卡「近 90 天活跃用户 ≥ 300」 |
| **微信 · 自动续费(委托代扣)** | ⛔ 当前拿不到 | 官方明写主体类型不含**个人独资企业**(本站主体) |
| **虎皮椒 xunhupay(聚合兜底)** | ⚪ 未配置 | 任一官方渠道没配时才回落;个人凭身份证+银行卡可开,作过渡 |

> 当前真实可收款渠道 = **支付宝(PC + 手机)**。微信普通支付差「开户」临门一脚。两种自动续费都被资质卡住(详见 §4)。

**⚠️ 待办(URGENT):** 套餐价格目前仍是测试价 **¥0.01**(支付已 LIVE,任何人能 1 分钱买会员)。需在 `/membership` 底部 admin 面板把 月/年/永久 改成真实价。见 §5。

---

## 1. 代码地图

| 层 | 文件 | 作用 |
|---|---|---|
| 后端路由 | `apps/api/src/routes/membership.ts` | `/v1/membership/*` 全部端点 + 下单派发 + notify 入账 + admin |
| 支付宝 provider | `apps/api/src/payment/alipay.ts` | RSA2 公钥模式:下单串签名 / notify 验签 / 查单 |
| 微信 provider | `apps/api/src/payment/wechat.ts` | APIv3:Native / H5 下单 / 回调 GCM 解密 / 查单 |
| 银行卡 provider | `apps/api/src/payment/airwallex.ts` | PaymentIntent / 托管收银台 / HMAC webhook / 主动查单 |
| 待签串(纯函数) | `packages/shared/src/payment.ts` | 虎皮椒 / 支付宝 / 微信 v3 的待签名串构造(浏览器安全,有单测) |
| 数据库 | `apps/api/migrations/0046_membership.sql` | `membership_plans` / `membership_orders` / `memberships` 三表 |
| 前端页 | `packages/client/app/[lang]/membership/{page,PayModal,AdminPanel,MemberContact}.tsx` | 套餐页 / 支付弹窗 / 管理面板 / 联系方式 |
| 前端 API | `packages/client/lib/membership-api.ts` | 调用封装 + `membershipExpiry()` 到期纯函数 |
| 到期提醒 | `packages/client/components/MembershipReminder.tsx` | 全局到期提醒条(挂 root layout) |
| 单测 | `packages/client/tests/membership-expiry.test.ts`、`official_pay_sign.test.ts`、`xunhupay_sign.test.ts` | 到期逻辑 + 各渠道签名/解密 round-trip |

**渠道择优逻辑**(`providerForChannel`):支付宝/微信优先走各自官方渠道,未配置时才回落虎皮椒;银行卡只走 Airwallex,没有凭据或对应轨道开关未启用时不回落。不可用渠道会由 `/plans` 的 `channels` 隐藏。

**notify 地址**(平台后台填这些,走现有 nginx 反代,无需额外配置):
- 支付宝:`https://api.cuberoot.me/v1/membership/notify/alipay`
- 微信:`https://api.cuberoot.me/v1/membership/notify/wechat`
- 银行卡:`https://api.cuberoot.me/v1/membership/notify/airwallex`
- 虎皮椒:`https://api.cuberoot.me/v1/membership/notify/xunhupay`

> 实际上支付宝/微信的 notify_url 是**每笔下单时由代码传**的(不依赖后台「应用网关」之类),后台无需单独配 notify。

---

## 2. 环境变量(服务器 `/root/core-api/.env`)

完整模板见 `apps/api/.env.example`。改完执行:`pm2 restart core-api --update-env`(SSH:`ssh root@cuberoot`)。

```ini
# 对外地址(notify / return 用,必须公网可达)
PUBLIC_API_ORIGIN=https://api.cuberoot.me
PUBLIC_SITE_ORIGIN=https://www.cuberoot.me

# 官方支付宝(公钥模式 RSA2)—— 已配置
ALIPAY_APP_ID=         # 应用 APPID(公开)
ALIPAY_PRIVATE_KEY=    # 商户应用私钥(PKCS8,单行 base64 或 PEM 都行)
ALIPAY_PUBLIC_KEY=     # 支付宝公钥(不是应用公钥!)
# ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do   # 默认即正式网关,无需填

# 官方微信支付 APIv3 —— 待填(开户后)
WECHAT_APPID=          # 绑定到商户号的 appid(公众号/小程序/移动应用任一)
WECHAT_MCHID=          # 商户号
WECHAT_API_V3_KEY=     # APIv3 密钥,必须正好 32 字节(自己在商户平台设)
WECHAT_CERT_SERIAL=    # 商户 API 证书序列号
WECHAT_PRIVATE_KEY=    # apiclient_key.pem 内容(单行或 PEM)
# WECHAT_PLATFORM_PUBKEY=   # 选填,配了则额外验回调签名(纵深防御)

# Airwallex 托管银行卡收银台 —— 审核和验证完成前保持两个 ENABLED=0
AIRWALLEX_ENV=demo          # 沙盒 demo;生产改 prod
AIRWALLEX_CLIENT_ID=
AIRWALLEX_API_KEY=
AIRWALLEX_ACCOUNT_ID=       # webhook 归属校验
AIRWALLEX_LOGIN_AS=         # 仅平台/多账户场景按后台要求填写
AIRWALLEX_WEBHOOK_SECRET=
AIRWALLEX_CARD_CN_ENABLED=0
AIRWALLEX_CARD_GLOBAL_ENABLED=0

# 虎皮椒兜底 —— 选填
XUNHUPAY_APPID=
XUNHUPAY_APPSECRET=
```

`paymentConfigured()` = 支付宝、微信、虎皮椒或已显式启用的银行卡轨道任一可用;全空 = 支付关闭,退化为「仅 admin 手动开通」。

**凭据安全铁律**:私钥 / APIv3 密钥**绝不贴进聊天、绝不进 git**。由站长放到本机或服务器,AI 走 SSH 直接写 `.env`,改完不 commit 那条命令。

---

## 3. 各渠道对接步骤

### 3.1 支付宝(已完成,留作参考 / 复用)

主体:上海魔方根教育科技工作室(个人独资,企业商户号)。应用为「网页&移动应用」自研应用,**公钥模式(非证书模式)** RSA2。

已开通产品:**电脑网站支付** + **手机网站支付**(均已签约)。

开放平台「开发信息」页只有 **接口加签方式** 是必需(已设公钥模式 ✅);其余 **接口内容加密方式 / 服务器IP白名单 / 应用网关 / 授权回调地址** 对网站支付**全不用配**(应用网关是平台级异步消息,≠ 支付 notify)。

密钥:本机 `D:\cube\alipay-keys\`(应用私钥 PKCS8 + 单行 / 应用公钥 / 支付宝公钥)。服务器 `.env` 已填,旧备份 `.env.bak.alipay-*`。

踩过的坑:① 建应用时「绑定商家账号」必须选企业号(别用个人号);② 加签 Step2 可用 openssl 自造密钥替代官方密钥工具(页面底部「可用其他工具」);③ **海外(美国)IP 配加签会触发风控**「当前操作可能存在风险」,重试 / 换国内 IP / 打 95188 可解。

### 3.2 微信 · 普通支付(待开户,代码已就绪)

> 收益 = 用户多一个「微信扫码 / H5」付款渠道。**与自动续费无关**(自动续费见 §4,当前主体拿不到)。

需要**两样**:① 微信支付商户号(MCHID);② 一个绑定到商户号的 APPID。

**对公账户。** 用户已确认 CubeRoot 具备招商银行对公账户；开户时仍需核对账户名与签约主体完全一致，并以微信实际审核结论为准。

**开户流程**(等有对公户后):
1. 入口 [pay.weixin.qq.com](https://pay.weixin.qq.com/) → 「商户接入」,**用长期微信号扫码**(该号成超级管理员)。官方图文:[企业接入指引](https://pay.weixin.qq.com/static/applyment_guide/applyment_detail_qiye.shtml)。
2. 材料:营业执照(统一社会信用代码)+ 法人身份证正反面 + **企业对公账户** + 经营场景选「线上→网站」填 `https://www.cuberoot.me`(已备案)。
3. 提交(1-2 工作日审核)→ 超管做「[商户开户意愿确认](https://pay.weixin.qq.com/static/help_guide/business_registration.shtml)」(法人/超管人脸)→ 签约拿交易权限。

**APPID**(Native 扫码 + H5 都需一个绑定到 mchid 的 appid,可为 公众号 / 小程序 / 开放平台移动应用任一):
- 省钱:注册一个**小程序**(免费),用它的 appid 绑定。
- 最稳:注册**认证服务号**(公众号,企业认证 ¥300/年)。
- 绑定:商户平台 → 账户中心 → AppID 账号管理。

**开户后给 AI 对接**(把下面 5 个填进 `.env`,`apiclient_key.pem` 走 SSH 不贴聊天):
`WECHAT_MCHID` / `WECHAT_APPID` / `WECHAT_API_V3_KEY`(商户平台→账户中心→API安全里设的 32 位)/ `WECHAT_CERT_SERIAL`(API 证书序列号)/ `WECHAT_PRIVATE_KEY`(apiclient_key.pem 内容)。
另需在商户平台配「支付授权目录 / H5 域名」(到时 AI 给具体值)。填完 `pm2 restart core-api --update-env`,前端 `/plans` 的 `channels.wechat` 自动变 true,微信按钮出现,¥0.01 真扫验一笔。

### 3.3 虎皮椒(可选兜底)

[xunhupay.com](https://www.xunhupay.com) 注册(个人凭身份证+银行卡)→ 拿 `XUNHUPAY_APPID` / `XUNHUPAY_APPSECRET` 填 `.env`。任一官方渠道没配时自动回落它。有官方后可不用。

### 3.4 银行卡托管收银台(代码就绪,待商户审批)

当前 provider 为 Airwallex，前端通过 `@airwallex/components-sdk` 跳转托管页面，CubeRoot 不接收卡号、有效期或 CVC。`card_cn` 只请求 UnionPay，`card_global` 请求 Visa、Mastercard、American Express 和 JCB；最终能否展示和交易以商户后台实际获批能力为准。

后台完成开户后：创建 API 凭据，配置 `payment_intent.succeeded` webhook 到上面的银行卡回调地址，复制 webhook secret，再填写 §2 的环境变量。先用 `AIRWALLEX_ENV=demo` 分别验证两条轨道；某轨道闭环成功后才把对应 `AIRWALLEX_CARD_*_ENABLED` 改成 `1`。中国大陆主体和招商银行对公账户的准入、币种与结算路径不能仅依据产品宣传推断，必须保留服务商书面确认。

---

## 4. 自动续费(委托代扣 / 周期扣款)—— 政策结论

> **2026-06-18 核实结论:本站主体(个人独资企业)当前两边都拿不到自动续费。** 因此**没有写任何自动续费代码**(避免给拿不到的产品写不可测的投机代码)。下面是事实依据 + 真要做的现实路径。

### 4.1 微信 · 自动续费(原委托代扣)

官方 2025 自助申请指引明写:**「仅支持主体类型为企业、政府机构、事业单位、社会组织类型的特约商户及普通特约商户申请」**,且 **个体工商户和个人独资企业不在允许范围内**。

- 用户量门槛反而宽松(不是卡点):情形一 去重用户 ≥300、投诉率 ≤0.05% → 结算 T+0;情形二 20-300、≤0.1% → T+7;情形三 **<20 用户、无门槛 → T+14**。
- 但**主体类型不过则一切白搭**。残留不确定:微信商户号实际把「个人独资企业」归为哪一类,需开户后按真实商户号问微信商户客服确认。
- 场景:H5 纯签约**支持**(非必须公众号/小程序,但需绑一个 APPID)。
- 入口(若资质过):商户平台 → 产品中心 → 我的产品 → 支付拓展工具 → 委托代扣。

### 4.2 支付宝 · 自动续费(周期扣款 / 商家扣款)

硬门槛:**近 90 天活跃用户 ≥ 300**,新站达不到。可打商家客服 **4007585858** 问有无特殊行业通道(不保证)。

### 4.3 现实路径(真要自动续费,三选一)

1. **改主体为有限责任公司**(注册资本可低)→ 微信委托代扣主体类型即可过 → 这是最直接的解。
2. **先用手动 + 到期提醒跑量**,攒到支付宝 300 活跃用户 → 开支付宝周期扣款。
3. **维持现状**:手动按周期付款 + 到期提醒 + 一键续费(见 §6)。对小站这是体面且常见的做法,很多用户反而反感自动扣款。

> ⛔ 不要用第三方「聚合代扣」绕过资质 —— 灰色,有资金/合规/封号风险。

### 4.4 等资质就绪后 AI 怎么接(给未来的自己)

资质批下来后,**按批准的具体产品**(委托代扣 v2 papay / v3 扣费服务,二者 API 不同)再实现:① `membership_subscriptions` 合约表(存协议号 + 状态 + 下次扣款);② 后端 签约入口 / 签约 notify / 周期扣款申请 / 扣款 notify / 解约;③ 前端 开通自动续费 + 查看 + **便捷取消**(合规强制:显著提示 + 随时可退订);④ 定时扣款任务。**别在拿到资质前预先实现**(产品/字段未定,易返工)。合规依据:国内自动续费法规要求「显著提示 + 便捷取消」+ 提交「会员权益页 + 退订路径」截图。

---

## 5. 改套餐价格(上线必做)

**方式 A(推荐,UI):** admin 微信/管理员登录 → `/membership` 页底部「会员管理」面板 → 改月/年/永久价格(单位:元)→ 保存。

**方式 B(API):** `PUT /v1/membership/admin/plans/:slug`,body `{ "priceCents": 1990 }`(分)。需 admin JWT。也可改 `nameZh/nameEn/active/sort/perks/period/periodCount`。

seed 占位价:月 ¥10 / 年 ¥99 / 永久 ¥299(`migrations/0046`)。**当前被测试改成了 ¥0.01,务必改回。**

---

## 6. 已建:到期提醒 + 便捷续费(2026-06-18,纯前端)

手动续费体验优化,无外部依赖,push 后随 Vercel / Next 上线:

- **`membershipExpiry()`**(`lib/membership-api.ts`,纯函数 + 单测):算 lifetime / active / expired / daysLeft / expiringSoon,阈值 `EXPIRE_SOON_DAYS=7`。
- **`/membership` 状态条**:即将到期变黄「还有 X 天」、已过期变红,都带「立即续费」按钮(默认续上当前/上次套餐 → 回落月度 → 第一档)。`?renew=1` 深链自动打开续费弹窗。
- **全局提醒条** `components/MembershipReminder.tsx`(挂 root layout):登录会员即将到期/已过期时,站内任意页底部弹一条可关闭提醒,点「续费」直达。按到期日记忆关闭、续费后自然复位,`/membership` 页自身不弹。
- 提醒目前**仅站内**(无邮件 / 推送基建;邮件投递国内本就差)。要加邮件提醒需另接 SMTP / 推送服务。

---

## 7. 验证清单(每开一个渠道都跑一遍)

1. `.env` 填好 → `pm2 restart core-api --update-env`。
2. `curl https://api.cuberoot.me/v1/membership/plans` → 看 `payEnabled:true` 且对应 `channels.xxx:true`。
3. 临时把某套餐改 ¥0.01 → 前端真扫一笔 → 看 admin/list 出现 `paid` 订单 + 会员开通 + `expires_at` 正确。
4. 服务器日志 `[membership] granted ... via <provider>` 确认 notify 入账。
5. 验完把价格改回真实价。
6. 本地签名/解密回归:`pnpm --filter @cuberoot/client exec vitest run tests/official_pay_sign.test.ts tests/xunhupay_sign.test.ts tests/membership-expiry.test.ts`。
