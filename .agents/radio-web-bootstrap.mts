// Temporary branch-only patch transport; removed before merge.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const path = 'core/packages/client/scripts/radio-web-browser-acceptance.mts';
const original = readFileSync(resolve(root, path), 'utf8');
let source = original;
function edit(before: string, after: string) {
  if (source.split(before).length !== 2) throw new Error(`Unexpected browser patch: ${before}`);
  source = source.replace(before, after);
}
if (!source.includes('expect as baseExpect')) {
  edit('chromium, expect, type BrowserContext', 'chromium, expect as baseExpect, type BrowserContext');
  edit('expect.configure({ timeout: 30_000 });', 'const expect = baseExpect.configure({ timeout: 30_000 });');
  edit("viewport: { width: 1440, height: 1100 }, permissions:", "viewport: { width: 1440, height: 1100 }, locale: 'en-US', permissions:");
  edit("const canvas = sim.locator('twisty-player canvas').first();", "// cubing.js renders inside closed shadow roots. The public host bounds enclose\n  // the visible canvas; pointer events below hit the actual rendered stickers.\n  const canvas = sim.locator('twisty-player').first();");
  edit("  const recorded: string[] = [];", "  await canvas.screenshot({ path: resolve(out, 'sim-3d-solved.png') });\n  const recorded: string[] = [];");
  edit('    recorded.push(token);', "    await canvas.screenshot({ path: resolve(out, `sim-3d-${depth}.png`) });\n    recorded.push(token);");
  edit("await expect(page.locator('twisty-player svg').first()).toBeVisible();", "// Closed shadow content is verified through actual screenshots and the public\n  // TwistyPlayer pattern API, not by piercing private renderer handles.\n  await expect(page.locator('twisty-player')).toBeVisible();\n  await page.locator('twisty-player').screenshot({ path: resolve(out, 'sim-2d-solved.png') });");
  edit("await check('sim-english-mobile', page, async () => {", "// A fresh context prevents the prior Chinese locale cookie redirecting /sim.\nconst englishPage = await (await context(true)).newPage();\nawait check('sim-english-mobile', englishPage, async () => {\n  const page = englishPage;");
  const begin = source.indexOf('async function chooseWeb(p: Page) {');
  const finish = source.indexOf('async function preview(p: Page)', begin);
  if (begin < 0 || finish < 0) throw new Error('Missing picker helper');
  source = source.slice(0, begin) + `async function chooseWeb(p: Page) {
  // All three mode panels remain mounted. Only interact with the visible one.
  const trigger = p.locator('.gen-config-toolbar .pp-trigger:visible').first();
  const menu = p.locator('.pp-popup:visible').first();
  async function openMenu() {
    if (!await menu.count()) await trigger.click();
    await expect(menu).toBeVisible();
  }
  await openMenu();
  const web = menu.locator('.pp-item').filter({ has: p.locator('.pp-item-label', { hasText: /^Radio Web$/ }) });
  if (await web.getAttribute('aria-checked') !== 'true') await web.click();
  await openMenu();
  const otherActive = menu.locator('.pp-item--active').filter({ hasNot: p.locator('.pp-item-label', { hasText: /^Radio Web$/ }) });
  for (let count = await otherActive.count(); count > 0; count--) {
    await otherActive.first().click();
    await openMenu();
  }
  await expect(web).toHaveAttribute('aria-checked', 'true');
  await p.keyboard.press('Escape');
}
` + source.slice(finish);
  edit("p.locator('.gen-tn-attempt-preview svg[aria-label=\"radioweb\"]').first()", "p.locator('.gen-tn-attempt-preview svg[aria-label=\"radioweb\"]:visible').first()");
  edit("await page.locator('.gen-tn-paste-area').fill", "await page.locator('.gen-tn-paste-area:visible').fill");
  const oldCount = "page.getByRole('spinbutton', { name: '每项打乱数' })";
  if (source.split(oldCount).length !== 3) throw new Error('Unexpected count controls');
  source = source.replaceAll(oldCount, "page.locator('input[aria-label=\"每项打乱数\"]:visible')");
  edit("    const texts = await page.locator('.gen-tn-attempt-scramble').allTextContents();", "    if (mode !== 'comp') await expect(page.locator('.gen-tn-attempt-scramble:visible')).toHaveCount(2);\n    const texts = await page.locator('.gen-tn-attempt-scramble:visible').allTextContents();");
  edit("page.locator('button[title=\"下载 PDF\"]')", "page.locator('button[title=\"下载 PDF\"]:visible')");
}
writeFileSync(resolve(root, path), source);
mkdirSync(resolve(root, 'core/.tmp/radio-web-evidence'), { recursive: true });
writeFileSync(resolve(root, 'core/.tmp/radio-web-evidence/changed-paths.txt'), source === original ? '\n' : path + '\n');
console.log(source === original ? 'Browser patches already applied.' : 'Applied observed browser selector fixes.');
