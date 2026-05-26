# 魔方开放社群 · cube_platform

参考商业计划书《一站式魔方垂直综合服务平台》搭建的前端门户站。
技术栈对齐 `D:\cube\cuberoot.me\core\packages\client-next`,改用 Next.js(不用 Vite)。

## 技术栈

- **Next 16 App Router** + React 19 + TS5
- **Tailwind v4**(`@tailwindcss/postcss`,token 在 `app/globals.css`)
- lucide-react 图标
- 全静态(SSG),`next build` 全部页面预渲染

## 目录

```
app/                Next App Router
  page.tsx          Landing
  about/            关于我们
  courses/          课程列表 + [id] 详情
  shop/             商城列表 + [id] 详情
  events/           赛事列表 + [id] 详情
  community/        社群
  news/             资讯
  instructors/      讲师列表
  instructors/apply 讲师入驻申请
components/         SiteHeader/Footer/Section/Button/Badge/FeatureCard/StatCard
data/               全部 mock(courses / products / events / news / instructors)
```

## 开发

```bash
pnpm install
pnpm dev          # http://127.0.0.1:3100
pnpm build
pnpm typecheck
```

## 设计 token(`app/globals.css`)

- 品牌色 `--color-brand: #2A5DF4` / `brand-dark` / `brand-soft` / `brand-tint`
- 文字 `--color-ink / ink-2 / ink-3`
- 分割 `--color-line / line-soft`
- 背景 `--color-bg-soft`

## 后续

- 数据落 API / 数据库(可接 Hono + PG,对齐 cuberoot 服务端)
- 商城支付 / 赛事报名 / 讲师入驻表单接入
- 用户登录态(SSO / WCA OAuth 等)
- 搜索 / 筛选 / 分页
