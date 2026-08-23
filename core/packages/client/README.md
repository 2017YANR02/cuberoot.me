# @cuberoot/client

cuberoot.me 的现役且唯一 Web 前端，包含 `/platform/*` 产品入口及其复用的 `/org/*`、`/learn/*` 深链，基于 React 19、Next.js 16 App Router 和 Turbopack。旧 Vite SPA、`client-vite` 与 `packages/platform` 前端都已退役；开发、构建和生产启动均由本 package 提供。

## 运行

在 `core/` 下执行：

```bash
pnpm install
pnpm --filter @cuberoot/client dev
```

本地地址为 `http://127.0.0.1:3000/`。开发环境的 `/v1/*` 请求由 `next.config.ts` rewrites 代理；需要只让某个 API 域走本地 Hono 时，按 `packages/server/scripts/README.md` 使用 `LOCAL_DOMAINS`。

## 验证

```bash
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/client exec vitest run <tests/file.test.ts>
pnpm --filter @cuberoot/client build
```

dev server 运行时不要同时执行 `next build`，两者共用 `.next/`。Vitest 只负责单元测试，不参与网站的开发、构建或生产运行。

## 目录

- `app/[lang]/`：App Router 页面与布局
- `components/`：跨页共享组件
- `hooks/`：共享 React hooks
- `lib/`：Web 浏览器端与 Next 服务端共用的 Web 私有逻辑
- `public/`：由 Next 直接提供的静态资源
- `tests/`：Vitest 测试与架构守卫

`tests/next-only-frontend.test.ts` 会阻止旧网站包、Vite 配置、Vite 运行时依赖和 `import.meta.env` 回流到现役网站代码。

稳定的跨端契约和纯逻辑进 `@cuberoot/shared` 的显式 subpath；不从 server、mobile、miniprogram 或已退役 `packages/platform` 导入应用源码。
