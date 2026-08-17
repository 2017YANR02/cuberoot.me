# CubeRoot 教学与机构平台

从原独立平台仓库迁入的 Next.js 应用,现在是 CubeRoot monorepo 的 `@cuberoot/platform` 工作区。

## 技术栈

- **Next 16 App Router** + React 19 + TS5
- **Tailwind v4**(`@tailwindcss/postcss`,token 在 `app/globals.css`)
- lucide-react 图标
- RSC + Server Actions;公开内容页在 `next build` 时从 SQLite 预渲染

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
cd core
pnpm install
pnpm --filter @cuberoot/platform dev        # http://127.0.0.1:3100
pnpm --filter @cuberoot/platform build
pnpm --filter @cuberoot/platform typecheck
pnpm --filter @cuberoot/platform test
```

## 设计 token(`app/globals.css`)

- 品牌色 `--color-brand: #2A5DF4` / `brand-dark` / `brand-soft` / `brand-tint`
- 文字 `--color-ink / ink-2 / ink-3`
- 分割 `--color-line / line-soft`
- 背景 `--color-bg-soft`

## 产品边界

- 现有:课程、章节、学习进度、订单、会员、讲师 / 管理后台、支付和内容运营。
- 下一阶段:机构多租户、课包 / 剩余课时、排课 / 上课历史、训练任务、学员打卡作业、教师周反馈与家校沟通。
- 迁移记录、外部状态和旧仓库删除门槛见 [`docs/platform-migration.md`](../../../docs/platform-migration.md)。
