# HarmonyOS NEXT 宿主

`@cuberoot/harmony` 使用 ArkTS + ArkWeb 薄宿主，消费同一份 `@cuberoot/app-ui`。共享业务和 UI 不复制到 ArkTS；平台 adapter 负责鸿蒙系统能力。

先读[五端文档入口](../../../docs/product/apps/README.md)与[共享产品层](../../packages/app-ui/README.md)，再查 `package.json`、`src/`、原生工程及 `scripts/check-native-config.mjs`。当前宿主与设备证据只见[路线图](../../../docs/product/apps/mobile-app-roadmap.md)，unsigned HAP 或源码存在不代表设备与商店验收完成。

命令从 `core/` 执行：`pnpm --filter @cuberoot/harmony typecheck` 验证 TS；`pnpm --filter @cuberoot/harmony build` 检查配置并构建、同步 Web 资产。原生 HAP 的工具链、签名与设备安装按实际工程配置和路线图核对，不能用这个 Web 构建替代。
