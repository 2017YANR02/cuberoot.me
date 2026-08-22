# CubeRoot 旧 Platform 归档

从原独立平台仓库迁入的历史源码。独立前端已经退役,不再测试、构建或部署;主站 `@cuberoot/client` 的 `/org` 与 `/learn` 是唯一教学入口。这里仅保留必要的数据导出、取证与回滚参考。

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

## 归档检查

```bash
cd core
pnpm install
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

- 历史内容:课程、章节、学习进度、订单、会员、讲师 / 管理后台、支付和内容运营。
- 新能力一律进入主站与 Core,不在此目录继续开发产品功能。
- 迁移记录、外部状态和旧仓库删除门槛见 [`docs/platform-migration.md`](../../../docs/platform-migration.md)。
