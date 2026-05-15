---
name: port-and-credit
description: "Use when porting / forking / integrating an open-source project into this repo. Single-source credits via credits_data.json + gen-credits. Triggers: \"复刻\", \"port\", \"fork\", \"vendored\", \"加致谢\", \"credit\", \"upstream\", \"credits_data.json\", \"gen-credits\"."
---

# 复刻 / 致谢

- credits 唯一 source: `core/packages/client/src/pages/credits_data.json` (字段: name/url/zh/en/long_en?)
- 加完跑 `pnpm --filter @cuberoot/client gen-credits` → README `<!-- credits:start -->` 块自动重写,JSON + README 一起 commit
- 禁手改 README credits bullet / AboutPage 硬编码 credit
- 新 npm dep 在 `core/` 内 `pnpm add`,不在仓库根
- upstream fork (`/solver` `/alg-trainers` `/cstimer`) 不动源码;ported (`/calc` `/battle` `/mosaic` `/analyze`) 不动 legacy worker
- 不删用户已有视图/控件,新功能并列加
- 新渲染器换旧 API 端点 → UI 隐藏对应 API 链接/img/markdown 复制按钮
