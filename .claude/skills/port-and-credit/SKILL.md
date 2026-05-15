---
name: port-and-credit
description: "Use when porting / forking / integrating an open-source project (npm dep, vendored source, fork-with-modifications) into this repo. Single-source credits via credits_data.json + gen-credits script. Covers what NOT to delete. Triggers: \"复刻\", \"port\", \"fork\", \"vendored\", \"加致谢\", \"credit\", \"upstream\", \"credits_data.json\", \"gen-credits\"."
---

# 复刻 / 集成 / 致谢

集成上游开源项目 = **必须**加致谢。单一数据源 → 自动同步 README + /about。

## 单一数据源

`core/packages/client/src/pages/credits_data.json` 是唯一 source。Schema:

```json
{
  "name": "user/repo or domain",
  "url": "https://...",
  "zh": "中文短描述",
  "en": "English short desc",
  "long_en": "可选,README 用的长描述(没有就 fallback en)"
}
```

加完一条 → 跑 **`pnpm --filter @cuberoot/client gen-credits`** → README 的 `<!-- credits:start --><!-- credits:end -->` 块自动重写 → `git add` JSON + README 一起 commit。

**禁** 直接编辑 README 的 Credits bullet 区(下次跑脚本会被覆盖);**禁** 在 AboutPage 里硬编码 credit。/about 的 `<ul className="about-credits">` 直接 `import CREDITS from './credits_data.json'`,加一条数据它自动出现。

## 复刻规则

- 已有 12 模块归属表（见根 `CLAUDE.md`），改动前对照该表确认 fork 模块「可改 / 不可改」
- upstream 静态 fork（`/solver`、`/alg-trainers`、`/cstimer`）**不动源码**，只改 fork 后新增的包装层
- ported-to-React 模块（`/calc`、`/battle`、`/mosaic`、`/analyze`）只改 React 侧，不动 legacy worker / 原始算法 JS
- 引入新 npm 依赖在 `core/` 内 `pnpm add`（不能在仓库根，会写错 lockfile）

## 不删用户已有

集成新功能时**不要删**已有视图 / 选项 / 控件，即使你觉得新方案更好。用户原话："尽量不要删我已有的"。新功能并列加进去，让用户自己决定保留哪个。

## API 兼容

集成新渲染器 / 新数据源时，原有的简化 API 端点（如 `/v1/visualcube.svg`）通常不支持新路径 — 在 UI 里隐藏对应的「API 链接 / `<img>` 标签 / Markdown」复制按钮，避免用户复制出无效链接。下载（本地序列化 SVG/PNG）和分享链接（`/visualcube?...`）一般都还能用。
