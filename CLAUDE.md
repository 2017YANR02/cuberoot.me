# CLAUDE.md

## 项目

参考 `D:\cube\cube-platform\.tmp\魔方开放社群商业计划书.pdf` 搭的魔方门户站。技术栈对齐 `D:\cube\cuberoot.me\core\packages\client-next`,但改用 Next.js(不用 Vite)。

## 技术栈

Next 16 App Router + React 19 + TS5 + Tailwind v4(`@tailwindcss/postcss`)+ lucide-react + better-sqlite3 + Drizzle ORM。SSG + RSC + Server Actions,自带 admin 后台。

## 开发

```
pnpm install
pnpm dev          # 127.0.0.1:3100 (固定端口,别改)
pnpm build
pnpm typecheck    # tsgo --noEmit(@typescript/native-preview),改 .ts/.tsx 必跑
pnpm db:generate / db:migrate / db:seed
```

端口被占 `taskkill /F /IM node.exe` 杀旧 dev,**别换端口**。turbopack HMR 死循环闪屏:`rm -rf .next` 重启。

## 目录

- `app/` App Router 页面;`(authed)` 路由组走鉴权
- `components/` 跨页复用,新建前 Glob 同名
- `data/*.ts` 原始 mock,仅作 `pnpm db:seed` 的源,页面不直接 import
- `db/` Drizzle schema / migrations / seed
- `lib/db/*.ts` server-side data layer(都 `import "server-only"`,client 不能引)
- `lib/{sms,storage,auth,payments,search}/` 各 provider / helper
- `app/admin/` 管理后台,`app/instructor/` 讲师后台
- `.tmp/png/` AI 自产截图(已 gitignore)

## 设计约定

- 主色 `#2A5DF4`,全走 `app/globals.css` 的 `@theme` token(`text-brand` / `bg-brand-soft` / `border-line`),禁硬码颜色
- 卡片 `rounded-[14px] border-line`,hover `brand/40 + 阴影`,不加多余 border/background/padding
- 不用 emoji,图标全 lucide-react
- 移动端默认折叠,Header 自带 hamburger
- Section 标题统一走 `components/Section.tsx`
- 说明气泡用 `components/Tooltip.tsx`(桌面 hover / 手机点按,fixed 定位不被 overflow 裁剪)

## 数据库

DB 文件 `./data.db`(gitignored),Drizzle schema 在 `db/schema.ts`。当前业务表:

- 基础:`users` / `otp_codes` / `instructors` / `instructor_applications`
- 内容:`courses` / `lessons` / `products` / `events` / `news` / `posts` / `comments` / `post_likes`
- 学习:`learning_progress`(user x lesson)
- 交易:`orders` / `payment_logs` / `coupons` / `invite_codes`
- 运营:`events_track` / `qr_codes`
- 可观测:`error_logs` / `request_logs`(慢请求 >500ms 才记)

页面读数据走 `lib/db/<resource>.ts` 的 `list()` / `listPaged({q,page,pageSize})` / `findById(id)`,不要直接 import `@/data/*`。

## 鉴权

- admin: cookie `cube_admin`(HMAC-SHA256,env `SESSION_SECRET`),`/admin/login` 单密码 `ADMIN_PASSWORD`(默 `admin123`)
- 用户: cookie `cube_user`,手机号 + OTP 登录
- 路由保护用 `proxy.ts`(Next 16 把 `middleware.ts` 改名 `proxy.ts`,exported function 也叫 `proxy`),covers `/admin/**` + `/instructor/**`
- server-side 用 `requireUser()` / `requireAdmin()` / `requireInstructor()`(`lib/auth/*`)

## 内容 / 社群

- Markdown 走 `next-mdx-remote/rsc`,共享 `components/Markdown.tsx`(server-only)。资讯 `news.body` + 帖子详情都用
- 社群三表 `posts` / `comments` / `post_likes`,操作走 `app/actions/community.ts` server actions
- 圈子枚举 `CircleId = 'newbie' | 'speed' | 'blind' | 'campus'`,元信息集中在 `lib/db/posts.ts` 的 `CIRCLE_META`;"加入圈子" 仅视觉按钮不持久化

## 课程 / 付费墙 / 学习进度

- 课程结构:`courses` (元信息 + price + instructorId) + `lessons` (idx / title / durationSec / videoKey / videoUrl / free)
- 已购校验:`canAccessCourse(user, course, lesson?)` 返 `{allowed, reason}`,reason ∈ `price_zero / free_lesson / paid / not_logged_in / not_paid`
- 视频取流走 `/api/lessons/[id]/video`(nodejs runtime),校验后 302 到 `signedVideoUrl(key)`。local storage 直接 `/uploads/<key>`,远端 TODO 真签名 URL 防盗链
- 学习进度 `learning_progress`(`userId,lessonId` 唯一),`LessonPlayer` timeupdate 节流 10s 调 `updateProgress(lessonId,positionSec,completed)`
- `/me/courses` 我的课程,`courseProgressPercent` 计算完成率,"继续学习" 跳最近 progress 的 lesson
- admin `_LessonsPanel` 章节编辑,视频 `UploadField` 上传 mp4
- 兼容老字段:`courses.videoUrl` / `coverUrl` 仍可用;`courses.nextLiveAt`(秒级 timestamp)无值不渲染

## 搜索

- SQLite FTS5(5 张虚拟表 + 15 触发器,见 `0008_phase3_search_fts.sql`)覆盖 courses / products / events / news / posts
- CJK 用 `unicode61` 没法分词,自定 SQL 函数 `cube_seg` 在 `lib/search/segment.ts` 插空格;查询时 `buildFtsQuery(q)` 加前缀通配
- 统一接口 `lib/db/search.ts` `searchCourses / Products / Events / News / Posts` + `searchAll(q, limitPerType)`
- `/search?q=` 分组结果页;`HeaderSearch` 在 header 右侧;列表页用 `ListSearch` + `Pagination`(server 渲染分页)

## 支付

- provider 抽象 `lib/payments/`:`mock_wechat` / `mock_alipay` / `stripe` / `wechat` / `alipay`,接口返 `redirect | qrcode | done`
- env 缺失 provider 自动 enabled:false;Stripe Checkout / WeChat V3 Native 扫码 / Alipay 电脑网站支付
- 下单流程:`placeOrder({couponCode?})` server action → `startPayment(orderId, providerId)`;qrcode 走 `QrCodeModal` 3s 轮询 `/api/orders/[id]/status`
- 回调统一 `app/api/payments/[provider]/callback/route.ts`(nodejs runtime),provider 可定义 response body
- 退款 admin 走 `app/actions/refund.ts` `refundOrder`,写 `payment_logs`;对账 `/admin/reconcile`

## 短信 / 存储 / 上传

- SMS provider 抽象 `lib/sms/`:`console`(默认 fallback,只 log)/ `aliyun` / `tencent`,手写 V3 签名无 SDK 依赖。`SMS_PROVIDER` 空降级 console
- Storage provider 抽象 `lib/storage/`:`local`(默认,落 `public/uploads/<yyyy-mm>/<uuid>.<ext>`)/ `r2` / `s3` / `oss` / `cos`,手写 sigv4 / OSS / COS 签名。`STORAGE_PROVIDER` 空走 local
- 上传 `POST /api/upload`(admin 鉴权,200MiB 上限,multipart),返 `{url, key}`;client 走 `components/FileUpload.tsx` 真实进度,`UploadField` 拼输入框 + 上传

## 可观测

- `error_logs` 表 + `lib/db/logs.ts` `logError({level,message,stack?,path?,userId?})`;`app/global-error.tsx` 兜底
- `request_logs` 慢请求 >500ms,`logSlowRequest({...})`;目前仅 payment callback 埋点,新 route 按同模板加
- admin `/admin/logs` Tabs 切 errors / slow requests

## 讲师后台

- 字段:`users.role` (`user|instructor|admin`)、`users.instructorId`、`courses.instructorId`、`instructors.userId`
- `/instructor/{,/courses,/students,/earnings}`,`requireInstructor()` 守门
- 分成 70% 固定 `INSTRUCTOR_REVENUE_SHARE`(`lib/db/instructor-stats.ts`),月度汇总;**未做结算 `instructor_payouts` 表**,earnings 仅展示
- admin 入驻审核通过自动建/绑定 user + 设 role + 双向关联 instructor

## 管理后台

- 路径 `/admin`,密码 `ADMIN_PASSWORD` env,session HMAC + cookie 7 天失效
- 资源编辑用 server actions(`actions.ts`),数组字段 textarea 一行一个;课程大纲 `Week N | 主题`
- admin 路由 `robots: noindex`,不进 sitemap

## 增长 / 运营

- SEO:`app/sitemap.ts` + `app/robots.ts` 动态拉 db;站点绝对 URL 走 `lib/site.ts` 读 `NEXT_PUBLIC_SITE_URL`(默 `http://127.0.0.1:3100`)。OG image `app/og/route.tsx` 用 `next/og` 出 1200x630 PNG。详情页 `generateMetadata` 注入 `openGraph` + `twitter` + `ogImageUrl(title)`
- 埋点:`events_track` 表 + `POST /api/track`({name,payload?,url?}),客户端走 `lib/track.ts`。匿名 cookie `cube_anon`(non-httpOnly,1y)。自动埋:`page_view` / `signup` / `login` / `order_placed` / `post_created` / `qr_landing`。admin 看 `/admin/events-track`
- 优惠券 / 邀请码:`coupons` / `invite_codes`,orders 带 `discount` + `couponCode`。下单 server action 接 `couponCode`,前端 `CouponBox` 调 `previewCoupon` 试算;新用户 `?invite=XX` 透传到 verify-otp,`applyInviteOnSignup` + `rewardCoupon` 透传 toast。用户在 `/me/invite` 看自己邀请码
- 二维码落地:`qr_codes`;`/qr/[code]` 命中 `incrementScans`,target ≠ `/` 自动 302(预览加 `?stay=1`)。admin `/admin/qr` 批量生成(最大 500 一批)
- 不接 GA / Plausible / Sentry / Posthog,埋点全自建

## PWA

- `public/manifest.json` + 手写 `public/sw.js`(无 workbox 依赖):cache-first 静态资源 + network-first HTML + api 透传 + offline fallback
- 图标 `app/icons/[size]/route.tsx` 走 `next/og` SSG 出 192/512/maskable-512 PNG;`app/icon.tsx` + `apple-icon.tsx` Next 约定
- `SwRegister` 仅 production 注册,dev 不注册避免 HMR 闹;`PwaInstallButton` 监听 `beforeinstallprompt`,iOS Safari 不触发(用户自己 → 添加到主屏幕)
- 离线壳 `/offline`

## 部署

- 线上 https://platform.cuberoot.me(2026-05-28);push main → `.github/workflows/deploy.yml`(CI build + scp,学 mira)。
- systemd `platform-next` 反代 :3004,unit 在 `ops/platform-next.service`(start.sh 定位 nvm node)。
- nginx vhost 不在本 repo,在 cuberoot.me repo `ops/nginx/platform.cuberoot.me.conf`。
- CI 两坑:node-version 必须 24(better-sqlite3 ABI);`db:migrate+seed` 排在 `next build` 前(`app/sitemap.ts` 构建期查 DB)。build 时设 `NEXT_PUBLIC_SITE_URL=https://platform.cuberoot.me`。
- 持久库 `/var/lib/cube-platform/data.db`(`DB_PATH` env,部署目录外),重新部署不覆盖;首次从 bundle seed。
- 持久库已存在时,部署 restart 前跑 `ops/migrate.cjs`(随包发,自包含、drizzle `__drizzle_migrations` 兼容)补未应用迁移;失败回滚。加表加列正常写 drizzle migration 即可,不用手 ALTER。
- secrets:`DEPLOY_HOST/USER/SSH_KEY` 在 cube-platform repo,key 是专用 `platform-deploy-ci`(跟 mira / 主站分开)。
- `ADMIN_PASSWORD` / `SESSION_SECRET` 线上仍是代码默认值(`admin123` / `dev-cube-secret-change-me`),要硬化在 systemd unit 加 `Environment=`(别 commit 真值)。
- `next.config.ts` 设 `output: "standalone"` + `serverExternalPackages: ["wechatpay-node-v3","alipay-sdk"]`。
- 备选:`Dockerfile` + `docker-compose.yml`(named volume `/data/data.db`)仍在,本地容器跑用;线上走上面的 systemd。

## 常见坑

- 日期显示禁用 `new Date("YYYY-MM-DD")`(SSR 时区偏一天),用字符串 split
- 详情页 `params` / `searchParams` 是 Promise,要 `await`
- 动态路由必须导出 `generateStaticParams`,要 `async` 从 db 拉 id 列表
- better-sqlite3 native 模块,首次装包要 `pnpm install` 触发 build(pnpm-workspace.yaml 已 allowBuilds)
- turbopack 在 Windows 偶发 panic + HMR 死循环闪屏:`rm -rf .next` 重启 dev
- FTS5 触发器只覆盖 insert/update/delete,migration 里有一次性 backfill;新装环境跑完 migration 就好,不用手动同步
