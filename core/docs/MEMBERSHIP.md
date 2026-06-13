# 会员订阅 (Membership / Subscription)

`/membership` 会员订阅功能。2026-06-13 实现。本文是「为什么这么设计」+「上线前你要做什么」。

## 调研结论(为什么这样设计)

1. **不建本站账号,沿用 WCA OAuth。** 站内用户就是 WCA 选手,WCA 登录是最低摩擦的身份源。
   会员状态直接挂在 `wca_id` 上(JWT 已携带)。业界做法也是「OAuth 身份 + 把订阅挂在内部 user id」,
   不为了收钱再造一套邮箱密码。*约束:没参加过比赛、无 wca_id 的人目前无法登录,故也无法成为会员(沿用现有 auth 限制)。*

2. **手动按周期续费,不做自动扣款。** 微信「自动续费/委托代扣」仅对企业/政府/事业单位开放,
   支付宝「周期扣款」也要企业过审 —— **个人拿不到自动代扣**。所以模型是:一次性买 月/年/永久,
   存 `expires_at`,到期提醒,手动再买。永久会员 `expires_at = NULL`。

3. **支付走聚合支付「虎皮椒 xunhupay」。** 个人(无营业执照)拿不到官方微信商户号 / 支付宝网站支付 API。
   虎皮椒等聚合支付允许个人用身份证 + 银行卡开通,给统一下单 + 异步 notify。
   代码做了 **provider 适配层**:将来若注册个体工商户拿到官方 API,只需加一个 provider,业务逻辑不动。
   Stripe / Paddle / Lago 对中国大陆个人都不可用,不考虑。

4. **薄自研计费层,不上 Lago/Kill Bill。** 三张表(plans / orders / memberships)+ 适配器,几百行,贴合现有 Hono + PG 栈。

## 数据模型

`migrations/0046_membership.sql`:
- `membership_plans` — 套餐(slug / period / period_count / price_cents / perks)。seed 了 月(¥10)/年(¥99)/永久(¥299),**价格是占位,上线前改**。
- `membership_orders` — 每次下单一条(`out_trade_no` 我方单号;status pending→paid;raw_notify 审计)。
- `memberships` — 每用户一行(plan_slug / expires_at / source / 选填 contact)。生效判定不存 status,读时算:`expires_at IS NULL 或 > now()`。

## 后端 `/v1/membership/*`(`packages/server/src/routes/membership.ts`)

| 端点 | 鉴权 | 说明 |
|---|---|---|
| `GET /plans` | 公开 | 在售套餐 + `payEnabled` |
| `GET /me` | 登录 | 本人会员状态 |
| `PUT /me/contact` | 登录 | 设置续费/找回联系方式 |
| `POST /orders` | 登录 | 下单,返回 xunhupay 收银台 url + 二维码 |
| `GET /orders/:no` | 登录(本人) | 查单(前端轮询;仍 pending 时主动向 xunhupay 查单补偿) |
| `POST /notify/xunhupay` | 公开 webhook | xunhupay 异步回调,**验签**后入账,回字面量 `success` |
| `POST /admin/grant` | admin | 手动开通/续期(给已打赏用户,或商户未配置时) |
| `GET /admin/list` | admin | 会员 + 最近订单 |
| `DELETE /admin/member/:wcaId` | admin | 撤销会员 |
| `PUT /admin/plans/:slug` | admin | 改套餐(价格/启用/文案/perks) |

**安全要点:**
- 签名算法 `@cuberoot/shared/payment`(排序非空参数 → `k=v&...` → 末尾追加 APPSECRET → MD5 小写),
  有单测 `tests/xunhupay_sign.test.ts`。
- 入账幂等:订单 `pending→paid` 用条件 UPDATE `WHERE status='pending' RETURNING` 锁定,只开通一次。
- **未配置商户密钥时 notify 一律拒绝**(返回 `fail`,绝不开通)—— 防空 secret 下被伪造请求白嫖会员。

## 前端

- `/membership` 页(`app/[lang]/membership/`):套餐卡 + 支付弹窗(选支付宝/微信 → 扫码 + 轮询) + 会员状态 + 续费联系方式 + admin 面板。
- 入口:打赏弹窗 `DonateModal` 顶部链接、`/support` 头部链接。
- `hooks/useMembership.ts`、`components/MembershipBadge.tsx`(已登记 /code 组件库)。

## 渠道(支付宝 vs 微信)

虎皮椒的渠道是**账号(APPID)级**,不是下单参数。两种部署:
- **单账号**:只填 `XUNHUPAY_APPID/APPSECRET`,两个按钮都走它(收银台 `url` 会自动判微信端/手机端)。
- **分账号**:若分别申请了微信、支付宝两个账号,额外填 `XUNHUPAY_WECHAT_*` / `XUNHUPAY_ALIPAY_*`,
  下单按 channel 选对应 creds,notify 按回调 `appid` 选对应 secret 验签。

---

## ✅ 已验证 / ⚠️ 未验证

- ✅ migration、签名单测、整套后端(下单/开通/续期叠加/永久/409 守卫/改价/notify 拒绝)已对 **本地 pg13 端到端跑通**。
- ✅ 前端 EN/ZH 渲染、登录门控、支付弹窗(选渠道→二维码→轮询)Playwright 验过。
- ⚠️ **xunhupay 真实网关从未联调**(无商户号)。请求/响应字段按官方文档(`xunhupay.com/doc/api/pay.html` / `search.html`)实现,
  但 **签名串末尾是否带 `&`** 官方与部分 SDK 有歧义:本实现按官方文本(无尾 `&`)。
  接入真商户后若验签失败,试 `buildSignBase` 末尾保留 `&` 的变体。先用小额(¥0.01 测试套餐)真扫一笔验证 notify 入账。

## 🔧 上线前你要做的事

1. **决定法务姿态**:
   - (a) 维持个人 + 聚合支付(最快,灰色地带);或
   - (b) 注册**个体工商户**(便宜,几天),解锁官方支付宝网站支付 + 微信商户号 + 开发票/正规报税。
   - 注意:对个人收费严格说需 **ICP 经营许可证**(要公司 + ≥¥100万注册资本,个人办不了),小站普遍靠聚合支付绕过 —— 真实但常被忽略的合规缺口。订阅收入是应税个人所得。
2. **注册虎皮椒** `https://www.xunhupay.com`:网站地址(已备案)+ 身份证 + 手机 + 银行卡(微信渠道)/ 实名支付宝(支付宝渠道)→ 拿 **APPID + APPSECRET**。
3. **填服务器 `.env`**(见 `.env.example` 末尾):`XUNHUPAY_APPID`、`XUNHUPAY_APPSECRET`、`PUBLIC_API_ORIGIN=https://api.cuberoot.me`、`PUBLIC_SITE_ORIGIN=https://www.cuberoot.me`,然后 `pm2 reload core-api --update-env`。
4. **改套餐价格**:admin 登录 `/membership` 底部面板直接改,或改 DB。
5. **部署**:push `core/**` → `deploy_core.yml` 自动跑 migration(创建三张表)+ 部署 server;前端走 Vercel / `deploy_next.yml`。
   notify 地址 `https://api.cuberoot.me/v1/membership/notify/xunhupay` 已被现有 nginx 反代覆盖,无需额外配置。
6. **真机验证**:配好后用 ¥0.01 临时套餐真扫一笔,确认 notify 入账(admin/list 看到 paid 订单 + 会员开通)。

## 本地测试

docker pg13(5433)已应用本 migration。只测后端可起一个只挂 membership 路由的临时 harness:
`DB_PORT=5433 DB_USER=postgres DB_PASS=dev DB_NAME=cuberoot_db JWT_SECRET=... tsx`(完整 server 因 sr-puzzlegen ESM 在 tsx 下起不来,要么用 esbuild bundle,要么只挂这一个路由)。
admin 端点用 `wcaId='2017YANR02'` 的 JWT(HS256,JWT_SECRET 签)即管理员。
