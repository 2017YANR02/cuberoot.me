# 交接清单

最后更新:2026-05-26。覆盖到 Phase 4 + 支付 P1/P2/P3。

## TL;DR

- 站点骨架完整,可以本地跑通(`pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev`)
- 支付 Provider 抽象层就位,Stripe / 微信 V3 / 支付宝代码骨架完整,**未配置 env 时自动禁用**,只走 mock
- 部署文档见 [DEPLOY.md](./DEPLOY.md);项目约定见 [CLAUDE.md](./CLAUDE.md)
- 真要上线 / 接真支付,请先看下面"上线前必做"

## 上线前必做(blocker)

### 1. 必改环境变量

`.env` 复制自 `.env.example`,以下三项 dev 默认值上线必改:

| 变量 | dev 默认 | 上线 |
|---|---|---|
| `ADMIN_PASSWORD` | `admin123` | 强密码(≥16 位混合字符) |
| `SESSION_SECRET` | `change-me` | `openssl rand -hex 32` 出来的强随机 |
| `NEXT_PUBLIC_SITE_URL` | `http://127.0.0.1:3100` | 真实 HTTPS 域名,影响 sitemap / OG / 邀请链接 / 支付回调 |

### 2. 数据库初始化

```
pnpm db:migrate     # 跑全部 migration(0000 → 0005)
# 不要跑 pnpm db:seed,seed 是 mock 数据
```

迁移用 SQLite (`data.db`)。换 PG 见 DEPLOY.md。

### 3. Admin 路径加固

- 默认密码必改
- `/admin/**` 全部 `noindex`,但不防扫站。建议反代层加 IP 白名单或 basic auth 二次拦
- middleware 校验已在,session cookie HMAC 签名 7 天失效

## 接真支付(可选,但要钱)

### 资质准备(各通道独立)

| 通道 | 需要 | 哪里办 |
|---|---|---|
| Stripe | 信用卡商户(海外业务用) | dashboard.stripe.com 免费注册 |
| 微信支付 V3 | 商户号(MCHID)+ APIv3 密钥 + 商户证书 + APPID | pay.weixin.qq.com,要营业执照 + 备案域名 |
| 支付宝 | 应用 ID + RSA2 私钥 + 支付宝公钥 | open.alipay.com,要营业执照 |

公共前提:**ICP 备案的 HTTPS 域名 + 公网服务器**。本地联调可用 cloudflared / ngrok 隧道。

### env 填写

参见 `.env.example` 注释。任一通道环境变量任一项为空,该 provider 自动 `enabled: false`,订单页不会显示对应按钮,callback 路由对它返 404。**不会因为没填就崩**。

### 商户后台回调 URL 填写

| 通道 | URL |
|---|---|
| Stripe | `https://你的域名/api/payments/stripe/callback` |
| 微信 V3 | `https://你的域名/api/payments/wechat/callback` |
| 支付宝 | `https://你的域名/api/payments/alipay/callback` |

Stripe 控制台填 webhook 时勾选事件 `checkout.session.completed`(可选加 `charge.refunded`)。

## 已知代码层面 TODO

### 支付相关

- **微信支付平台证书未做自动拉取 + 验签** — `lib/payments/providers/wechat.ts` 的 `verifyCallback` 目前以"AES-GCM 解密成功 + APIv3 密钥正确 + trade_state=SUCCESS"作为信任凭据。生产严格做法:加 cron job 拉 `/v3/certificates`、缓存平台公钥、回调用 `verifySign` 二次校验。代码注释里已标 TODO。
- **Stripe payment_intent 二次往返** — 退款时每次都调 `sessions.retrieve(expand)` 拿 payment_intent。优化:webhook 收到 `checkout.session.completed` 时把 payment_intent 落 `orders.providerId` 一起。
- **微信退款异步结果通知未监听** — 当前 refund 只看 SDK 同步返回的 status。微信会异步推送退款结果到回调,需要在 `app/api/payments/wechat/callback/route.ts` 加事件类型分发。
- **部分退款 UI 未做** — `app/actions/refund.ts` 已预留 `amount?` 参数,但 admin 页面只暴露全额退款按钮。
- **Stripe currency 写死 USD** — `lib/payments/providers/stripe.ts:37`。国内业务建议改 CNY(需 Stripe 账号支持 CNY)。

### 用户系统

- **OTP 短信通道未对接** — `lib/db/otp.ts` 生成验证码,但发送只 `console.log`。生产要接阿里云短信 / 腾讯云短信 / Twilio。
- **没密码 / 邮箱字段** — users 表只有 phone,纯 OTP 登录。要加密码登录的话需要 schema 改动 + 加密(bcrypt / argon2)。
- **没邮件通知** — 订单完成、退款、申请通过等场景都没邮件。要接 SendGrid / Resend / 自建 SMTP。

### 内容 / 后台

- **富文本编辑器** — `news.body` 现在 admin 后台是 textarea 直接编辑 markdown。要 WYSIWYG 可考虑 TipTap / Lexical。
- **图片 / 视频上传** — `courses.coverUrl` / `courses.videoUrl` / `products` 图片都只能填外链 URL,没本地上传。要做的话:
  - 简单:写到 `public/uploads/`,加文件大小限制
  - 推荐:接对象存储(S3 / R2 / OSS / COS)
- **课程视频权限** — 当前 `CourseVideo.tsx` 没校验用户是否已购,任何人都能看 videoUrl。要做付费墙:在 server 端检查 `lib/db/orders.ts` 是否有该用户对该课的 paid 订单,未购替换成预告片或购买引导。

### 社群

- **加入圈子无持久化** — `app/community/circle/[id]` 的"加入"按钮纯视觉,没建关系表。要做的话加 `circle_members(circleId, userId, joinedAt)` 表。
- **禁言 / 举报 / 删帖** — 没做。admin 当前没社群管理页。

### 运营

- **优惠码 / 邀请码自动生成** — admin 后台目前只能手动新建一条。要批量发码可写脚本 + admin import。
- **埋点数据可视化** — `/admin/events-track` 只列原始事件,没漏斗 / 留存图表。要看转化加 charting 库(recharts)。

## 运营备忘

### 后台页面索引

| 路径 | 用途 |
|---|---|
| `/admin/login` | 管理员登录(密码 ADMIN_PASSWORD) |
| `/admin/courses` `/admin/products` `/admin/events` `/admin/news` `/admin/instructors` | 资源 CRUD |
| `/admin/users` | 用户列表 |
| `/admin/orders` | 订单管理(标记已付 / 取消 / 退款) |
| `/admin/applications` | 讲师申请审核 |
| `/admin/coupons` | 优惠券管理 |
| `/admin/qr` | 二维码批量生成(NFC / 印物料用) |
| `/admin/events-track` | 埋点流水 |
| `/admin/reconcile` | 支付对账与流水 |

### 邀请码机制

- 每个用户登录后自动生成自己的邀请码 `/me/invite`
- 新用户首登带 `?invite=XX` 透传到 verify-otp,自动绑定并发奖励券
- 奖励券模板在 `lib/db/invites.ts` 的 `applyInviteOnSignup`

### 二维码落地

- `/qr/[code]` 命中即增加 scan 计数,若 `target !== "/"` 自动 302 跳转
- 适合印刷物料(传单 / 名片)+ 线下扫码统计
- 管理员加 `?stay=1` 不跳转可预览

## 已知限制 / 风险

- **SQLite 单机**:并发上限 100 写/s 左右,够初期但量上来要切 PG(见 DEPLOY.md)
- **没接 CDN / 静态资源走源站**:图片直接走 Next 服务器,要加 CDN 见 Next 文档 `images.loader`
- **无监控 / 告警**:没接 Sentry / Posthog / Datadog。崩了不会自动通知,要靠日志 + 手动看
- **没接备份自动化**:DEPLOY.md 给了 cron 备份命令,要自己起
- **数据导出工具未做**:要导用户 / 订单批量数据要手写 SQL

## 想加新功能时

1. 看 [CLAUDE.md](./CLAUDE.md) 项目约定(品牌色 token / 不要 emoji / mobile 适配)
2. 新组件前 `Glob` 搜同名,避免重复造轮子
3. 改 schema 后:`pnpm db:generate` → 检查 `db/migrations/00xx_*.sql` → `pnpm db:migrate`
4. server-only 模块加 `import "server-only"`,client 模块加 `"use client"`
5. server action 改完跑 `pnpm typecheck`,改 UI 跑 `pnpm dev` 浏览器对一下

## 联系

- 仓库:GitHub `RuiminYan/cube-platform`(private)
- 部署文档:[DEPLOY.md](./DEPLOY.md)
- 项目约定:[CLAUDE.md](./CLAUDE.md)
