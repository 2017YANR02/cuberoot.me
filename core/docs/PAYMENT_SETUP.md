# 支付对接手册 (Payment Setup)

会员订阅 `/membership` 的**支付渠道对接 / 上线 / 续接**总手册。给站长 + 未来 AID 用:看完这一份就知道每个渠道现在到哪一步、代码在哪、还差什么、怎么接。

> 设计「为什么这么做」见 [`MEMBERSHIP.md`](./MEMBERSHIP.md);本文只讲**对接与运维**。
> **本文不含任何密钥 / 私钥 / 登录凭据**(它进 git)。真实凭据见:服务器 `/root/core-api/.env`、本机 `D:\cube\alipay-keys\`(支付宝密钥)、私有 memory `project_membership_subscription.md`。

最后更新:2026-06-18。

---

## 0. 一眼看现状

| 渠道 | 状态 | 备注 |
|---|---|---|
| **支付宝 · 电脑网站支付** | ✅ 已上线已验证 | ¥0.01 真扫,notify 正常入账 |
| **支付宝 · 手机网站支付** | ✅ 已上线已验证 | 2026-06-18 签约 + 手机 ¥0.01 验过;代码按 `clientType` pc/wap 自动分流 |
| **微信 · 普通支付(扫码 Native + H5)** | 🟡 代码就绪,待开商户号 | 开微信商户号 + 绑 APPID + 填 5 个 env 即可,**无需改代码** |
| **支付宝 · 自动续费(周期扣款)** | ⛔ 当前拿不到 | 卡「近 90 天活跃用户 ≥ 300」 |
| **微信 · 自动续费(委托代扣)** | ⛔ 当前拿不到 | 官方明写主体类型不含**个人独资企业**(本站主体) |
| **虎皮椒 xunhupay(聚合兜底)** | ⚪ 未配置 | 任一官方渠道没配时才回落;个人凭身份证+银行卡可开,作过渡 |

> 当前真实可收款渠道 = **支付宝(PC + 手机)**。微信普通支付差「开户」临门一脚。两种自动续费都被资质卡住(详见 §4)。

**⚠️ 待办(URGENT):** 套餐价格目前仍是测试价 **¥0.01**(支付已 LIVE,任何人能 1 分钱买会员)。需在 `/membership` 底部 admin 面板把 月/年/永久 改成真实价。见 §5。

---

## 1. 代码地图

| 层 | 文件 | 作用 |
|---|---|---|
| 后端路由 | `packages/server/src/routes/membership.ts` | `/v1/membership/*` 全部端点 + 下单派发 + notify 入账 + admin |
| 支付宝 provider | `packages/server/src/payment/alipay.ts` | RSA2 公钥模式:下单串签名 / notify 验签 / 查单 |
| 微信 provider | `packages/server/src/payment/wechat.ts` | APIv3:Native / H5 下单 / 回调 GCM 解密 / 查单 |
| 待签串(纯函数) | `packages/shared/src/payment.ts` | 虎皮椒 / 支付宝 / 微信 v3 的待签名串构造(浏览器安全,有单测) |
| 数据库 | `packages/server/migrations/0046_membership.sql` | `membership_plans` / `membership_orders` / `memberships` 三表 |
| 前端页 | `packages/client/app/[lang]/membership/{page,PayModal,AdminPanel,MemberContact}.tsx` | 套餐页 / 支付弹窗 / 管理面板 / 联系方式 |
| 前端 API | `packages/client/lib/membership-api.ts` | 调用封装 + `membershipExpiry()` 到期纯函数 |
| 到期提醒 | `packages/client/components/MembershipReminder.tsx` | 全局到期提醒条(挂 root layout) |
| 单测 | `packages/client/tests/membership-expiry.test.ts`、`official_pay_sign.test.ts`、`xunhupay_sign.test.ts` | 到期逻辑 + 各渠道签名/解密 round-trip |

**渠道择优逻辑**(`providerForChannel`):支付宝渠道 → 官方支付宝;微信渠道 → 官方微信;任一未配 → 虎皮椒兜底;都没配 → 该渠道按钮在前端隐藏(`/plans` 的 `channels` 暴露可用性)。

**notify 地址**(平台后台填这些,走现有 nginx 反代,无需额外配置):
- 支付宝:`https://api.cuberoot.me/v1/membership/notify/alipay`
- 微信:`https://api.cuberoot.me/v1/membership/notify/wechat`
- 虎皮椒:`https://api.cuberoot.me/v1/membership/notify/xunhupay`

> 实际上支付宝/微信的 notify_url 是**每笔下单时由代码传**的(不依赖后台「应用网关」之类),后台无需单独配 notify。

---

## 2. 环境变量(服务器 `/root/core-api/.env`)

完整模板见 `packages/server/.env.example`。改完执行:`pm2 restart core-api --update-env`(SSH:`ssh root@cuberoot`)。

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

# 虎皮椒兜底 —— 选填
XUNHUPAY_APPID=
XUNHUPAY_APPSECRET=
```

`paymentConfigured()` = 支付宝 OR 微信 OR 虎皮椒任一配齐;全空 = 支付关闭,退化为「仅 admin 手动开通」。

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

**坎:对公账户。** 微信对企业主体基本要求**企业对公账户**(支付宝那次宽松,微信更严)。个人独资企业可开对公户,但本站**目前还没有对公账户 → 微信普通支付暂缓,等开了对公户再走**。

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
