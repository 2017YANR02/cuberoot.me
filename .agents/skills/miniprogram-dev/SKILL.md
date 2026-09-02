---
name: miniprogram-dev
description: Use when modifying or debugging the CubeRoot WeChat or Douyin Mini Program under core/apps/miniprogram, including WXML/WXSS, assets, build/dist, code-quality scans, platform adapters, upload, or release.
---

# 小程序开发

- 在 `core/` 运行命令；源码在 `apps/miniprogram/src/`，静态资源在 `apps/miniprogram/assets/`，`dist/` 仅由构建生成，禁止手改。
- 先复用现有组件、数据契约和平台适配器；小程序不得依赖 React DOM、Next 或另一 app 的源码。
- WXML 表达式直接写 `&&` / `||`，禁止 HTML 实体。
- 改源码、资源或构建脚本后运行 `pnpm --filter @cuberoot/miniprogram build`；改共享逻辑或双端适配时运行 `check:all`。
- 改 WXML 后关闭微信开发者工具项目再重开，做干净编译。
- 代码质量里的图片/音频 200KB 警告按构建后资源总量处理；优化真实源文件并重建，禁止只压 `dist/`，二维码必须保留可扫描性。
- JS、WXML、WXSS 上传压缩属于开发者工具「详情 → 本地设置」，与图片/音频体积是两类检查，禁止混为一谈。
- 构建成功不等于已上传、审核或发布；仅在真实完成对应步骤后声明完成。
