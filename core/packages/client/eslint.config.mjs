/**
 * Flat ESLint config for client — covers hand-written JS only (`.js/.mjs/.cjs`:
 * build + hook + audit scripts, test runners, service worker). TS/TSX is checked
 * by `typecheck` (tsgo) and by the CI ratchets in `tests/`, not here — there is
 * no TS parser, no React plugin, no Next plugin in this config.
 *
 * Two things it enforces:
 *  1. eslint's own `js.configs.recommended` baseline (+ a few hand-picked rules).
 *  2. ad-hoc playwright scripts must go through `scripts/headless.mjs` (which
 *     bakes in the MCP init script) instead of importing a browser engine.
 *
 * Run: `pnpm --filter @cuberoot/client lint`
 */

import js from '@eslint/js';
import globals from 'globals';

export default [
  // Global ignores — MUST be an object with `ignores` and NOTHING else. Put
  // `ignores` next to `files` and it only narrows THAT config object; the paths
  // still get scanned and fall through to ESLint 9's built-in `**/*.{js,mjs,cjs}`
  // default config, which lints them with zero rules. That's how `.next/dev`
  // chunks (turbopack keeps source comments) turned every inline
  // `// eslint-disable-next-line react-hooks/...` into a "Definition for rule was
  // not found" error — 171 of them, none from real source.
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.tmp/**',
      'public/cubing-chunks/**', // esbuild output of scripts/build-cubing-worker.mjs (gitignored)
      // Vendored / machine-generated JS. Not ours to style-police, and linting it
      // is what made a blanket `/* eslint-disable */` header necessary in the
      // first place — the ignore belongs in one list here, not in N file headers.
      'lib/roux/min2phase/**', // vendored min2phase solver
      'public/analyze-worker/**', // forked analyzer workers (see /analyze — upstream)
      'public/cubeopt/**', // wasm-bindgen glue
      'public/ffmpeg/**', // vendored ffmpeg.wasm
      'public/scramble_module.js', // emscripten output
      'public/vendor/**', // vendored 3rd-party scripts (e.g. jweixin WeChat JS-SDK)
      'wasm/**', // wasm-bindgen glue
    ],
  },

  // Baseline for our own JS. `recommended` needs real globals or `no-undef`
  // fires on every `require` / `process` / `self` — scripts run in node, the
  // worker + sw files in a browser, so both sets go in.
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Beyond recommended: the two footguns this codebase actually hits.
      // `no-eval` is load-bearing — tests/_analyzer_worker_runner.cjs and
      // scripts/wk-ios-test.cjs carry `eslint-disable-next-line no-eval`
      // exemptions that only mean something while this rule is on.
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },

  // CommonJS files: `require`/`module` are script-scope, not ESM.
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },

  {
    files: ['**/*.{mjs,js}'],
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
