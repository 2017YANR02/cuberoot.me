import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.{ts,mjs}'],
    environment: 'node',
    testTimeout: 120_000,
    pool: 'threads',
  },
});
