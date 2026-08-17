import { defineConfig } from "vitest/config";

// 项目仅有约定守卫类测试(无 React 渲染),node 环境足够;只扫 tests/ 避开 .next 等大目录。
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
