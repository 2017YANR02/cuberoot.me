# 会员订阅 (Membership / Subscription)

`/membership` 会员订阅功能。2026-06-13 实现。本文是「为什么这么设计」+「上线前你要做什么」。

> **支付渠道对接 / 上线 / 续接(支付宝、微信普通支付、自动续费政策结论)总手册见 [`PAYMENT_SETUP.md`](./PAYMENT_SETUP.md)。** 要对接支付先看那份。

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
   - 结论:auto-renew 当前两边都拿不到 → 模型是一次性买 月/年/永久,存 `expires_at`,**到期提醒 + 便捷续费**,手动再买。永久会员 `expires_at = NULL`。
     真要自动续费,现实路径是改主体为有限责任公司(微信)或攒够 300 活跃(支付宝),届时再接入。

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
   provider 文件:`packages/server/src/payment/alipay.ts`(官方支付宝,公钥模式 RSA2)、
   `packages/server/src/payment/wechat.ts`(官方微信 APIv3,SHA256-RSA2048 + AEAD_AES_256_GCM 回调解密);
   虎皮椒签名仍在 `routes/membership.ts` + `@cuberoot/shared/payment`。

## 数据模型

`migrations/0046_membership.sql`:
- `membership_plans` — 套餐(slug / period / period_count / price_cents / perks)。seed 了 月(¥10)/年(¥99)/永久(¥299),**价格是占位,上线前改**。
- `membership_orders` — 每次下单一条(`out_trade_no` 我方单号;status pending→paid;raw_notify 审计)。
- `memberships` — 每用户一行(plan_slug / expires_at / source / 选填 contact)。生效判定不存 status,读时算:`expires_at IS NULL 或 > now()`。

## 后端 `/v1/membership/*`(`packages/server/src/routes/membership.ts`)

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
- `hooks/useMembership.ts`、`components/MembershipBadge.tsx`(已登记 /code 组件库)。

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
