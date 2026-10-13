import { defineConfig } from '@playwright/test';

// Browser-only contracts; .spec.ts is intentionally outside the Vitest suite.
// Set CUBEROOT_BROWSER_BASE_URL to validate a deployed build with the same UI actions.
export default defineConfig({
  testDir: '.',
  testMatch: 'native-fto6.spec.ts',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  outputDir: '../../.tmp/fto6-browser',
  reporter: [['list'], ['json', { outputFile: '../../.tmp/fto6-browser-report.json' }]],
  use: {
    baseURL: process.env.CUBEROOT_BROWSER_BASE_URL ?? 'http://127.0.0.1:3000',
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
});
