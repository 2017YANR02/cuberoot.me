/**
 * Shared headless chromium setup for all ad-hoc playwright scripts.
 *
 * Bakes in the same init script the MCP playwright browser uses
 * (`~/.claude/playwright-mcp-init.js` ),
 * so behavior matches between MCP and standalone runs.
 *
 * Usage — concise (auto teardown):
 *   import { withPage } from '../scripts/headless.mjs';
 *   await withPage(async (page) => {
 *     await page.goto('https://example.com/');
 *     await page.screenshot({ path: '.tmp/png/foo.png', fullPage: true });
 *   });
 *
 * Usage — lower level (you call browser.close()):
 *   import { openHeadless } from '../scripts/headless.mjs';
 *   const { browser, context, page } = await openHeadless();
 *   ...
 *   await browser.close();
 */

import { chromium } from '@playwright/test';

const INIT_SCRIPT = 'C:/Users/CubeRoot/.claude/playwright-mcp-init.js';

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

/**
 * Launch browser + context with init script pre-attached, run callback, tear down.
 * @template T
 * @param {(page: import('@playwright/test').Page, ctx: import('@playwright/test').BrowserContext) => Promise<T>} fn
 * @param {{
 *   viewport?: { width: number; height: number };
 *   contextOptions?: import('@playwright/test').BrowserContextOptions;
 *   launchOptions?: import('@playwright/test').LaunchOptions;
 * }} [opts]
 * @returns {Promise<T>}
 */
export async function withPage(fn, opts = {}) {
  const { browser, context, page } = await openHeadless(opts);
  try {
    return await fn(page, context);
  } finally {
    await browser.close();
  }
}

/**
 * Lower-level: returns { browser, context, page }. Caller must close browser.
 * Use when you need multi-page workflows or to keep the browser open.
 */
export async function openHeadless(opts = {}) {
  const browser = await chromium.launch(opts.launchOptions);
  const context = await browser.newContext(opts.contextOptions);
  await context.addInitScript({ path: INIT_SCRIPT });
  const page = await context.newPage();
  await page.setViewportSize(opts.viewport ?? DEFAULT_VIEWPORT);
  return { browser, context, page };
}
