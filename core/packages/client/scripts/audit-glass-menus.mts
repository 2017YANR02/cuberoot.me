// Run from core/: pnpm --filter @cuberoot/client exec node scripts/audit-glass-menus.mts
// Uses an existing dev/preview server; never starts or rebuilds it.
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const output = process.env.AUDIT_OUTPUT_DIR ?? join(tmpdir(), 'cuberoot-glass-audit');
mkdirSync(output, { recursive: true });

type Fixture = { name: string; path: string; panel: string; open: (page: Page) => Promise<unknown> };
const fixtures: Fixture[] = [
  { name: 'appearance', path: '/zh', panel: '.appearance-menu', open: p => p.locator('button[title="外观"]').first().click() },
  ...['calendar', 'list'].flatMap(view => [
    { name: `competition-${view}-countries`, path: `/zh/wca/comp?year=2026&month=10&view=${view}`, panel: '.region-picker-popup', open: (p: Page) => p.locator('.toolbar .region-picker-trigger').click() },
    { name: `competition-${view}-filters`, path: `/zh/wca/comp?year=2026&month=10&view=${view}`, panel: '.comp-filters-panel', open: (p: Page) => p.locator('.comp-filters-btn').click() },
  ]),
  { name: 'sum-of-ranks', path: '/zh/wca/results?events=333,222', panel: '.sor-race .region-picker-popup', open: async p => {
    await p.locator('.sor-census-toggle').first().click();
    await p.locator('.sor-race .region-picker-trigger').click();
  } },
  { name: 'person-distribution', path: '/zh/wca/persons/2017YANR02?tab=results', panel: '.viz-page .wca-pp-results', open: async p => {
    await p.getByRole('button', { name: '分布', exact: true }).click();
    await p.locator('.viz-page .wca-pp-input').fill('Feliks');
    await p.locator('.viz-page .wca-pp-item').first().waitFor();
  } },
  { name: 'space-puzzles', path: '/zh/space', panel: '.space-top-tools .pp-popup', open: p => p.locator('.space-top-tools .pp-trigger').first().click() },
];

const modes = [
  { name: 'system-light', theme: 'system', os: 'light', width: 1440, image: false },
  { name: 'system-dark', theme: 'system', os: 'dark', width: 1440, image: false },
  { name: 'explicit-light', theme: 'light', os: 'dark', width: 1440, image: false },
  { name: 'explicit-dark', theme: 'dark', os: 'light', width: 1440, image: false },
  { name: 'mobile', theme: 'dark', os: 'dark', width: 390, image: false },
  { name: 'image', theme: 'dark', os: 'dark', width: 1440, image: true },
] as const;

// Inspect actual computed styles, including ancestors outside the known static
// toolbar registry. A nested root is a defect when the menu extends beyond it.
function inspectMenu(element: Element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const issues: string[] = [];
  if (style.backdropFilter === 'none') issues.push('Menu has no backdrop filter');
  if (rect.left < -1 || rect.right > innerWidth + 1) issues.push('Menu exceeds viewport width');
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const s = getComputedStyle(ancestor), r = ancestor.getBoundingClientRect();
    const root = s.backdropFilter !== 'none' || s.filter !== 'none' || Number(s.opacity) < 1
      || s.maskImage !== 'none' || s.clipPath !== 'none' || /filter|opacity|mask|clip-path/.test(s.willChange);
    if (root && (rect.left < r.left - 1 || rect.right > r.right + 1 || rect.top < r.top - 1 || rect.bottom > r.bottom + 1)) {
      issues.push(`Menu escapes backdrop root: ${ancestor.tagName}.${ancestor.className}`);
    }
  }
  // A later chart's stacking context must not cover the visible menu body.
  for (const fraction of [0.25, 0.5, 0.75]) {
    const x = rect.left + rect.width / 2, y = rect.top + rect.height * fraction;
    if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit && hit !== element && !element.contains(hit)) issues.push(`Menu covered by ${hit.tagName}.${hit.className}`);
  }
  return { blur: style.backdropFilter, issues };
}

const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER_CHANNEL ?? 'chrome', headless: true });
const results: { fixture: string; mode: string; issues: string[]; blur?: string }[] = [];
try {
  for (const mode of modes) {
    const context = await browser.newContext({ viewport: { width: mode.width, height: 1000 }, colorScheme: mode.os, locale: 'zh-CN' });
    await context.addInitScript(({ theme, image }) => {
      if (window !== window.top) return;
      localStorage.setItem('theme', theme);
      localStorage.setItem('cuberoot_guided', 'true');
      localStorage.setItem('home-background.v1.dark', image ? '07' : 'transparent');
      localStorage.setItem('home-background.v1.light', image ? '07' : 'transparent');
    }, mode);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    for (const fixture of fixtures) {
      const row = { fixture: fixture.name, mode: mode.name, issues: [] as string[], blur: undefined as string | undefined };
      try {
        const response = await page.goto(base + fixture.path, { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
        await page.waitForFunction(() => !!document.body.dataset.siteScenery);
        await fixture.open(page);
        const panel = page.locator(fixture.panel);
        await panel.waitFor({ state: 'visible' });
        // Let menu transitions and clamp layout settle before hit testing.
        await page.waitForTimeout(250);
        Object.assign(row, await panel.evaluate(inspectMenu));
        if (mode.name === 'explicit-dark' || row.issues.length) {
          await page.screenshot({ path: join(output, `${mode.name}-${fixture.name}.png`) });
        }
      } catch (error) { row.issues.push(String(error)); }
      results.push(row);
      console.log(JSON.stringify(row));
      writeFileSync(join(output, 'report.json'), JSON.stringify(results, null, 2));
    }
    await context.close();
  }
} finally { await browser.close(); }
const failures = results.filter(row => row.issues.length);
console.log(`${results.length} cases, ${failures.length} failures; report: ${output}`);
if (failures.length) process.exitCode = 1;
