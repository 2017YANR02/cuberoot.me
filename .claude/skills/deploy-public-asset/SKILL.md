---
name: deploy-public-asset
description: "Use when adding new public/static files to the site — images, fonts, geojson, textures, WASM modules. Live site is Next.js: assets go in client-next/public/ (no repo-root copy, no whitelist). Shared fork/stats static lives in tools/ + stats/ served by static.cuberoot.me. Triggers: \"new public asset\", \"404\", \"public/\", \"textures/\", \"加静态资源\", \"static asset\", \"public 资源\"."
---

# 新增 public / 静态资源

线上前端是 **Next.js (`packages/client-next`)**;Vite + 根目录 commit + GH Pages 镜像(deploy_mirror)已于 2026-06-14 全部移除。旧的"两处白名单 + 仓库根再放一份"机制已作废。

## 常规 public 资源(图片 / 字体 / geojson / wasm 等)

直接放进 **`core/packages/client-next/public/<file>`** —— 完事。

- Next 在 `/<file>` 路径直接 serve(绝对路径如 `/fonts/x.woff2`、`/cubeopt/...`)。
- 部署自动带上:`deploy_next.yml`(systemd standalone,public/ 打进 tar)+ Vercel(push 自动 build)。
- **不要**在仓库根再放一份,**不要**改 workflow 白名单。
- 本地 dev `http://127.0.0.1:3000/<file>` 验证 200。

## 共享 fork / stats 静态(`tools/` + `stats/`)

仓库根的 `tools/`(forks: Solver / AlgTrainer / csTimer)和 `stats/`(WCA stats JSON)由 **static.cuberoot.me** 服(服务器 `/www/wwwroot/toolkit/{tools,stats}/`);Vercel/Next 上 `app/{tools,stats}/[...slug]/route.ts` fallback 反代过去。

- 加到这两个目录要确保上线到 static.cuberoot.me(见 memory `reference_static_toolkit_deploy`)。
- 本地 dev 由 `app/{tools,stats}/[...slug]/route.ts` catch-all 从仓库根 serve。
- `stats/**` 走 CI 日更管道(stats.yml),一般不手动加。

## 验证

1. 本地:`http://127.0.0.1:3000/<path>` → 200
2. 线上:push 后 `https://cuberoot.me/<path>` → 200(public 资源走 Next;tools/stats 走 static.cuberoot.me fallback)
