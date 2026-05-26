/**
 * Minimal flat ESLint config for client-next.
 *
 * Currently enforces ONE rule: ad-hoc playwright scripts (.mjs/.js) must go
 * through `scripts/headless.mjs` (which bakes in the MCP init script), not
 * import `chromium` / `firefox` / `webkit` directly from `@playwright/test`.
 *
 * Scope intentionally narrow (`**\/*.{mjs,js}`) — no TS parser, no React rules,
 * no Next plugin. Add those as separate config objects later if needed.
 *
 * Run: `pnpm --filter @cuberoot/client-next lint`
 */

export default [
  {
    files: ['**/*.{mjs,js}'],
    ignores: ['node_modules/**', '.next/**', '.tmp/png/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@playwright/test',
            importNames: ['chromium', 'firefox', 'webkit'],
            message: "Use `import { withPage } from '../scripts/headless.mjs'` (relative path may vary). It bakes in the shared MCP init script so MCP and standalone runs behave identically. The helper itself is the only file allowed to import a browser engine directly.",
          },
          {
            name: 'playwright',
            importNames: ['chromium', 'firefox', 'webkit'],
            message: "Use `import { withPage } from '../scripts/headless.mjs'` (relative path may vary).",
          },
          {
            name: 'playwright-core',
            importNames: ['chromium', 'firefox', 'webkit'],
            message: "Use `import { withPage } from '../scripts/headless.mjs'` (relative path may vary).",
          },
        ],
      }],
    },
  },
  // Exception: the helper itself MUST import a browser engine — that's its job.
  {
    files: ['scripts/headless.mjs'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
