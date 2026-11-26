# 共享 App 产品层

`@cuberoot/app-ui` 承载五端共享 React 产品组合、三栏状态和 App 级交互；系统能力通过 adapter 注入。它不拥有网站 Next 路由，也不直接调用原生 API。

阅读顺序：[五端合同与进度](../../../docs/product/apps/README.md) → [单一来源合同](../../../docs/product/apps/cross-platform-app-contract.md) → 本包 `package.json` 的公开 exports 与 `src/index.ts` → 受影响宿主。工具首页随 App 打包，目录与搜索匹配复用 `@cuberoot/shared/site-directory`；全站搜索、工具和账号管理子页继续使用网站路由。「我的」及其登录页随 App 打包，第一方表单通过 `@cuberoot/app-ui/account-forms` 与网站共用。计时器 UI 归 `@cuberoot/timer-ui`，稳定领域规则归 `@cuberoot/shared`。

在 `core/` 执行 `pnpm --filter @cuberoot/app-ui typecheck`；行为改动只跑相关 Vitest 文件。不要因为共享代码变化就全量打包所有宿主。平台运行、实体设备与完整 parity 的验收见专题跟踪，包级测试不能替代它们。
