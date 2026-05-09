---
name: port-and-credit
description: "Use when porting / forking / integrating an open-source project (npm dep, vendored source, fork-with-modifications) into this repo. Covers where credit goes and what NOT to delete. Triggers: \"复刻\", \"port\", \"fork\", \"vendored\", \"加致谢\", \"credit\", \"upstream\"."
---

# 复刻 / 集成 / 致谢

集成上游开源项目 = **必须**两处加致谢。漏一处就是 bug。

## 致谢两处

1. **根 `README.md`** 的 `## 🙏 Credits` 列表 — 一条 markdown bullet：项目链接 + 一句话用途
2. **`core/packages/client/src/pages/LandingPage.tsx`** 的 `<div className="credits">` — 末尾追加 ` ·{' '}<a href=... target="_blank" rel="noopener noreferrer">作者名</a>`

只加一处 = 站点 footer 或 README 缺一个，过段时间自己也找不到。

## 复刻规则

- 已有 12 模块归属表（见根 `CLAUDE.md`），改动前对照该表确认 fork 模块「可改 / 不可改」
- upstream 静态 fork（`/solver`、`/alg-trainers`、`/cstimer`）**不动源码**，只改 fork 后新增的包装层
- ported-to-React 模块（`/calc`、`/battle`、`/mosaic`、`/analyze`）只改 React 侧，不动 legacy worker / 原始算法 JS
- 引入新 npm 依赖在 `core/` 内 `pnpm add`（不能在仓库根，会写错 lockfile）

## 不删用户已有

集成新功能时**不要删**已有视图 / 选项 / 控件，即使你觉得新方案更好。用户原话："尽量不要删我已有的"。新功能并列加进去，让用户自己决定保留哪个。

## API 兼容

集成新渲染器 / 新数据源时，原有的简化 API 端点（如 `/v1/visualcube.svg`）通常不支持新路径 — 在 UI 里隐藏对应的「API 链接 / `<img>` 标签 / Markdown」复制按钮，避免用户复制出无效链接。下载（本地序列化 SVG/PNG）和分享链接（`/visualcube?...`）一般都还能用。
