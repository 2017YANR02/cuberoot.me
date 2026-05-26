# CLAUDE.md

## 项目

参考 `D:\cube\cube-platform\.tmp\魔方开放社群商业计划书.pdf` 搭的魔方门户站。技术栈对齐 `D:\cube\cuberoot.me\core\packages\client-next`,但改用 Next.js(不用 Vite)。

## 技术栈

Next 16 App Router + React 19 + TS5 + Tailwind v4(`@tailwindcss/postcss`)+ lucide-react。无 i18n、无 dark mode、无后端。全 SSG。

## 开发

```
pnpm install
pnpm dev          # 127.0.0.1:3100 (固定端口,别改)
pnpm build
pnpm typecheck    # tsc --noEmit,改 .ts/.tsx 必跑
```

`pnpm dev` 端口被占就先 kill 旧进程,不要换端口启动。

## 目录

- `app/` App Router 页面,每个一级目录一个板块
- `components/` 跨页复用,新建前先 Glob 同名
- `data/*.ts` 原始 mock,仅作 `pnpm db:seed` 的源,页面不再直接 import
- `db/` Drizzle schema / migrations / seed
- `lib/db/*.ts` server-side data layer,页面通过这里读 DB
- `app/admin/` 管理后台(单密码登录)
- `.tmp/png/` AI 自己产的截图(已 gitignore)

## 设计约定

- 主色 `#2A5DF4`,全部走 `app/globals.css` 的 `@theme` token(`text-brand` / `bg-brand-soft` / `border-line` 等),禁硬码颜色
- 卡片圆角 `rounded-[14px]`,边框 `border-line`,hover 走 `brand/40 + 阴影`
- 不用 emoji,图标全用 lucide-react
- 移动端默认折叠,Header 已自带 hamburger
- Section 标题统一走 `components/Section.tsx`,eyebrow + title + subtitle

## 数据库

- better-sqlite3 + Drizzle ORM,DB 文件 `./data.db` (gitignored)
- schema 在 `db/schema.ts`,业务表:courses / products / events / news / instructors / users / otp_codes / orders / instructor_applications / posts / comments / post_likes
- 改 schema 后:`pnpm db:generate` 生成 migration,`pnpm db:migrate` 应用
- `pnpm db:seed` 从 `data/*.ts` 灌数据(`onConflictDoUpdate`,可重复跑)
- 页面读数据走 `lib/db/<resource>.ts` 的 `list()` / `findById(id)`,不要直接 import `@/data/*`
- `lib/db/*` 都是 RSC-only(有 `import "server-only"`),不要在 client component 引

## 内容 / 社群

- Markdown 渲染走 `next-mdx-remote/rsc`,共享组件 `components/Markdown.tsx`(server-only)。资讯详情 `/news/[id]` 和帖子详情 `/community/posts/[id]` 都用它,Tailwind utility 自定义元素样式,不依赖 `@tailwindcss/typography`。
- 资讯 `news.body` 字段存 markdown,admin 表单大 textarea 直接编辑。
- 社群三表:`posts` (id, authorId, circleId, title, body, likes, createdAt) / `comments` (id, postId, authorId, body, createdAt) / `post_likes` (postId+userId 联合 PK,幂等防重赞)。点赞 / 评论 / 发帖走 `app/actions/community.ts` server actions,登录态用 `requireUser`。
- 圈子枚举 `CircleId = 'newbie' | 'speed' | 'blind' | 'campus'`,元信息(名称 / 描述 / 成员数)集中在 `lib/db/posts.ts` 的 `CIRCLE_META`,community 圈子卡和过滤页 `/community/circle/[id]` 都从这里取。"加入圈子" 仅视觉按钮,不持久化关系。
- 课程视频字段:`courses.videoUrl` / `coverUrl` / `nextLiveAt`。`components/CourseVideo.tsx` 按 URL 判断:`.mp4 / .webm` 直链走 `<video>`;`bilibili / vimeo / youtube` 走带 sandbox 的 `<iframe>`;其它兜底外链。无 `videoUrl` 不渲染视频区。`nextLiveAt` 存秒级 timestamp,详情页上方一个 brand-soft 小卡显示,无值不渲染。

## 管理后台

- 路径 `/admin`,默认密码 `admin123`,改环境变量 `ADMIN_PASSWORD`
- session cookie HMAC 签名,密钥 env `SESSION_SECRET`(生产必设),失效 7 天
- middleware 校验 `/admin/**` (除 `/admin/login`),未登录跳 login
- 资源编辑用 server actions(`actions.ts`),数组字段在表单里是 textarea 一行一个;课程大纲格式 `Week N | 主题`
- admin 路由 `robots: noindex`,不进入 sitemap

## 常见坑

- 日期显示禁用 `new Date("YYYY-MM-DD")`(SSR 时区会偏一天),直接字符串 split
- 详情页 `params` 是 `Promise<{ id: string }>`,要 `await`
- 动态路由必须导出 `generateStaticParams`,现在要 `async` 从 db 拉 id 列表
- better-sqlite3 是 native 模块,首次装包后跑 `pnpm install` 触发 build(pnpm-workspace.yaml 已 allowBuilds)

## 增长 / 运营 (Phase 4)

- SEO:`app/sitemap.ts` + `app/robots.ts` 动态拉 db;站点绝对 URL 走 `lib/site.ts` 读 `NEXT_PUBLIC_SITE_URL`(默认 `http://127.0.0.1:3100`)。OG image `app/og/route.tsx` 用 `next/og` 出 1200x630 PNG,`/og?title=...`。所有详情页 `generateMetadata` 都注入 `openGraph` + `twitter` + 指向 `ogImageUrl(title)` 的图。
- 埋点:`events_track` 表 + `POST /api/track`(`{name,payload?,url?}`,返 204),客户端走 `lib/track.ts`。匿名 cookie `cube_anon`(non-httpOnly,1y)。自动埋:`page_view`(`components/TrackPageView.tsx` 放 RootLayout Suspense 里)、`signup` / `login`(LoginForm 成功后)、`order_placed`(`TrackOnce` 在 `/orders/[id]` 首访)、`post_created`(`TrackOnce`,作者 30s 内首访)、`qr_landing`(`/qr/[code]`)。admin 查看 `/admin/events-track`。
- 优惠券 / 邀请码:`coupons` / `invite_codes` 两表;orders 加 `discount` + `couponCode` 列。`lib/db/coupons.ts` `findActive(code,refType,amount)` 校验 active / expires / 上限 / appliesTo / minAmount;`lib/db/invites.ts` `getOrCreateForUser` / `applyInviteOnSignup`。下单流程 server action `placeOrder` 接 `couponCode`,前端 `components/CouponBox.tsx` 调 `previewCoupon` 试算后再提交;新用户首登带 `?invite=XX` 透传到 `verify-otp`,自动 `applyInviteOnSignup` 并把 `rewardCoupon` 通过 `?toast=invite_reward&coupon=` 透传给 next 页。用户走 `/me/invite` 看自己的邀请码 + 复制(`components/CopyButton.tsx`)。
- 二维码落地:`qr_codes` 表;`/qr/[code]` 命中即 `incrementScans`,若 `target` 不是 `/` 自动 302(管理员预览加 `?stay=1`);未命中也响应通用欢迎页。admin `/admin/qr` 批量生成(前缀 + 数量),最大 500 一批。
- 部署:`Dockerfile`(node:20-alpine multi-stage,Next standalone 输出,better-sqlite3 native 模块 + `db/migrations` 复制进 runner)。`docker-compose.yml` 单服务 + named volume `/data/data.db`,宿主端口 3100 → 容器 3000。`.env.example` 列出 `ADMIN_PASSWORD` / `SESSION_SECRET` / `NEXT_PUBLIC_SITE_URL` / `DB_PATH`。详见 `DEPLOY.md`。`next.config.ts` 设 `output: "standalone"`。
- 不接 GA / Plausible / Sentry / Posthog,埋点全自建。
