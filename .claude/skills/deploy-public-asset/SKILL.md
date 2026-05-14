---
name: deploy-public-asset
description: "Use when adding new public/static files to the site — images, fonts, geojson, textures, WASM modules, or any file served from repo root. Two separate deploy workflows have independent whitelists that BOTH need updating, or production 404s. Triggers: \"new public asset\", \"404\", \"deploy_core\", \"deploy_mirror\", \"textures/\", \"白名单\", 加静态资源."
---

# 部署机制 + 新增 public 资源

## Deploy Core 流程

`Deploy Core` workflow 在 push `main` 且 `core/**` 变更时触发：

1. `pnpm --filter @cuberoot/client build` 产出 `core/packages/client/dist/`
2. CI 把 `dist/*` **复制回仓库根目录**（`index.html`、`_assets/` 等），commit 成 `ci: rebuild SPA from core/`
3. GitHub Pages serve 根目录；`404.html = index.html` 做 SPA fallback
4. 同一 workflow 顺带 rsync `packages/server/dist/` 到 云服务器 并 `pm2 restart core-api`

**不要手动改根目录的 `_assets/`、`index.html`、`404.html`** —— CI 会覆写。
源码改 `core/`，构建产物由 CI 管理。
`ci: rebuild SPA from core/` 提交就是这个流程产生的。

## ⚠️ 新增 public 资源时必须同时改两处白名单

1. **`.github/workflows/deploy_core.yml`**：`git add -A <dir>/` 行（新目录）或 `git add -A <file>`（新文件）
2. **`.github/workflows/deploy_mirror.yml`**：`for d in ...`（目录）或 `for f in ...`（文件）

**漏一处则 GH Pages (cuberoot.me) 和 `www.cuberoot.me` 镜像有一个 404**。

## ⚠️ 本地 dev server 也要能访问 —— 根目录静态资源要**同时放 public/**

本地 `pnpm dev` 时，Vite 默认从 `core/packages/client/public/` serve 根路径文件。`serveRepoRoot` 插件只处理 `/tools/` 和 `/stats/` 前缀。所以根目录静态资源（如 `countries-110m.geojson`）要**两份**：

1. **仓库根**：`/countries-110m.geojson`（生产 GH Pages 直接 serve）
2. **Vite publicDir**：`core/packages/client/public/countries-110m.geojson`（本地 dev 通过 Vite 默认 publicDir 机制 serve，也会被 build 复制进 dist/）

**更新流程**：修改任一文件后，同步另一份。CI build 会把 public/ 的文件打进 dist/，然后 CI 再把 dist 复制回仓库根，最终两边的线上版本一致。

## 历史教训

- `textures/stars_milky_way_2k.jpg` 加了之后只改 deploy_core 忘了 deploy_mirror → 镜像站 404
- `countries-110m.geojson` 同样两处白名单 + 两处文件副本
- `cn_disputed_patches.geojson` 漏掉 public/ 副本 → 线上 OK、本地 dev 404
- workflow 自身 edit 不会重触发部署，除非把 `.github/workflows/deploy_core.yml` 加进 `paths:` 过滤
- 一次 push >300 文件（批量 rename / asset / media）时，GitHub Actions 路径过滤只看前 300，`core/**` 可能被挤出导致 Deploy Core 不触发；push 完立刻补 `gh workflow run deploy_core.yml --ref main`

## 验证

1. 本地 dev：打开 `http://127.0.0.1:5173/<new-file>` 应 200（没放 public/ 就 404）
2. push 之前：2 个 workflow 都已加新路径
3. push 之后：GH Actions 看 Deploy Core 是否成功
4. 线上：两个域名都打开新资源 URL 确认 200

## 不相关

- `stats/**` 目录已整目录 `git add -A stats/`，新 JSON 自动包含，**不用**加白名单
- `core/packages/client/src/**` 源码不需要白名单（CI build 后自动进 dist/）
