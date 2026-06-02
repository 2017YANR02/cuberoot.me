import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Next.js 没有 vite，vitest 用自己的 config。`@/*` → 包根，对齐 tsconfig paths。
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    pool: 'threads',
  },
});
