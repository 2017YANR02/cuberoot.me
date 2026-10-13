// Temporary acceptance runner; only public DOM, keyboard, pointer and clipboard APIs.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const out = '/tmp/native-puzzle-browser';
await mkdir(out, { recursive: true });
const report = { base, checks: [], consoleErrors: [], pageErrors: [], webgl: null };
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, permissions: ['clipboard-read', 'clipboard-write'] });
await context.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    return /webgl/i.test(kind) ? null : original.call(this, kind, ...args);
  };
});
async function open(path, ctx = context) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ url: page.url(), message: message.text() }); });
  page.on('pageerror', error => report.pageErrors.push({ url: page.url(), message: error.message }));
  await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded', timeout: 180000 });
  return page;
}
async function capture(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await writeFile(`${out}/${name}-dom.json`, JSON.stringify({
    url: page.url(), text: await page.locator('body').innerText(),
    controls: await page.locator('button,select,textarea,input').evaluateAll(nodes => nodes.map(el => ({ tag: el.tagName, text: el.textContent, label: el.getAttribute('aria-label'), title: el.getAttribute('title'), placeholder: el.getAttribute('placeholder'), value: el.value, cls: el.className }))),
  }, null, 2));
}
async function check(name, fn) {
  try { await fn(); report.checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, status: 'failed', error: String(error.stack || error) }); console.error(`FAIL ${name}: ${error}`); }
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
for (let attempt = 0; attempt < 120; attempt++) {
  try { const response = await fetch(`${base}/zh/sim?puzzle=cube2heli`); if (response.ok) break; } catch {}
  if (attempt === 119) throw new Error('Development server did not become ready');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await check('Chinese simulator: real 2D fallback, face/edge manual history, playback, share and invalid notation', async () => {
  const page = await open('/zh/sim?puzzle=cube2heli');
  try {
    await expect(page.locator('.twisty-section--2d')).toBeVisible();
    const polygons = page.locator('.twisty-container svg polygon');
    await expect(polygons).toHaveCount(48);
    const colors = () => polygons.evaluateAll(nodes => nodes.map(n => n.getAttribute('style') || n.getAttribute('fill')).join('|'));
    const solved = await colors();
    const notation = page.getByLabel('转动记号', { exact: true });
    const angle = page.getByLabel('转动角度', { exact: true });
    const choices = await notation.locator('option').evaluateAll(nodes => nodes.map(n => n.value));
    expect(choices.length).toBe(42);
    expect(choices).toContain('2DF'); expect(choices).toContain('DFw'); expect(choices).not.toContain('Fw');
    await notation.selectOption('F'); await angle.selectOption('1');
    await page.locator('.twisty-fallback-move').click();
    const solution = page.getByPlaceholder('解法', { exact: true });
    await expect(solution).toHaveValue(/F/);
    await expect.poll(colors).not.toBe(solved);
    await notation.selectOption('DF'); await page.locator('.twisty-fallback-move').click();
    await expect(solution).toHaveValue(/DF/);
    await page.getByRole('button', { name: '回到起点', exact: true }).click();
    await page.getByRole('button', { name: '播放', exact: true }).click();
    await expect(page.getByRole('button', { name: '跳到末尾', exact: true })).toBeDisabled({ timeout: 15000 });
    await page.getByRole('button', { name: '随机打乱', exact: true }).click();
    const setup = page.getByPlaceholder('打乱', { exact: true });
    await expect.poll(async () => (await setup.inputValue()).trim().split(/\s+/).length).toBe(40);
    await page.getByTitle('复制本页链接(含打乱 / 解法)', { exact: true }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get('puzzle')).toBe('cube2heli');
    const shared = await open(link);
    await expect(shared.getByPlaceholder('打乱', { exact: true })).toHaveValue(await setup.inputValue());
    await expect(shared.getByPlaceholder('解法', { exact: true })).toHaveValue(await solution.inputValue());
    await expect(shared.locator('.twisty-container svg polygon')).toHaveCount(48);
    await capture(shared, 'sim-shared'); await shared.close();
    const valid = await solution.inputValue();
    await solution.fill('Rw'); await expect(solution).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.twisty-fallback-move')).toBeDisabled();
    await solution.fill(valid); await expect(page.locator('.twisty-fallback-move')).toBeEnabled();
    await capture(page, 'sim-zh');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await capture(page, 'sim-mobile');
  } finally { await capture(page, 'sim-last'); await page.close(); }
});
await check('English simulator naming and manual controls', async () => {
  const page = await open('/sim?puzzle=cube2heli');
  try {
    await expect(page.getByRole('group', { name: 'Manual turns', exact: true })).toBeVisible();
    await expect(page.locator('.twisty-container svg polygon')).toHaveCount(48);
    await expect(page.locator('body')).toContainText('2×2 + Helicopter');
    await capture(page, 'sim-en');
  } finally { await capture(page, 'sim-en-last'); await page.close(); }
});
async function selectGeneratorPuzzle(page) {
  const trigger = page.locator('.gen-config-toolbar .pp-trigger').first();
  await trigger.click();
  for (let i = 0; i < 20 && await page.locator('.pp-popup [role="menuitemcheckbox"][aria-checked="true"]').count(); i++) {
    await page.locator('.pp-popup [role="menuitemcheckbox"][aria-checked="true"]').first().click();
  }
  await page.getByRole('menuitemcheckbox', { name: /二阶＋直升机/ }).click();
  await page.keyboard.press('Escape');
}
for (const mode of ['batch', 'paste', 'comp']) await check(`Scramble generator ${mode}: selection, real moves and complete nets`, async () => {
  const page = await open(`/zh/scramble/gen?mode=${mode}`);
  try {
    await selectGeneratorPuzzle(page);
    if (mode === 'paste') await page.locator('.gen-tn-paste-area').fill("F DF U'\nR2 2DF FLw");
    if (mode === 'batch') {
      await page.getByLabel('每项打乱数', { exact: true }).fill('2');
      await page.getByLabel('每项打乱数', { exact: true }).press('Tab');
    }
    if (mode === 'comp') await page.getByTitle('生成打乱', { exact: true }).click();
    const previews = page.locator('.gen-tn-attempt-preview');
    await expect.poll(() => previews.count(), { timeout: 60000 }).toBeGreaterThan(0);
    const count = await previews.count();
    if (mode !== 'comp') expect(count).toBe(2);
    for (let i = 0; i < count; i++) await expect(previews.nth(i).locator('svg polygon')).toHaveCount(48);
    const lines = await page.locator('.gen-tn-attempt-line').allTextContents();
    if (mode !== 'paste') for (const line of lines) expect(line.trim().split(/\s+/)).toHaveLength(40);
    expect(lines.length).toBeGreaterThan(0);
    await capture(page, `gen-${mode}`);
  } finally { await capture(page, `gen-${mode}-last`); await page.close(); }
});
await check('Timer: independent event, native 40-move scramble, next scramble and full preview', async () => {
  const page = await open('/zh/timer?players=1&event=cube2heli');
  try {
    const preview = page.getByRole('img', { name: 'cube2heli scramble preview', exact: true });
    await expect(preview.locator('svg polygon')).toHaveCount(48, { timeout: 60000 });
    const scramble = page.locator('.scramble-moves').first();
    await expect.poll(async () => (await scramble.innerText()).trim().split(/\s+/).length).toBe(40);
    const before = await scramble.innerText();
    await page.locator('body').click({ position: { x: 5, y: 400 } });
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => scramble.innerText()).not.toBe(before);
    await expect(preview.locator('svg polygon')).toHaveCount(48);
    expect(new URL(page.url()).searchParams.get('event')).toBe('cube2heli');
    await capture(page, 'timer');
  } finally { await capture(page, 'timer-last'); await page.close(); }
});
const three = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
await check('Normal WebGL browser: rendered puzzle and real pointer drag appends a move', async () => {
  const page = await open('/zh/sim?puzzle=cube2heli', three);
  try {
    await expect(page.getByLabel('转动记号', { exact: true })).toBeVisible();
    report.webgl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
    if (!report.webgl) throw new Error('WebGL unavailable: no claim of 3D pointer acceptance');
    await expect(page.locator('.twisty-section--2d')).toHaveCount(0);
    const canvas = page.locator('.twisty-container canvas').first();
    await expect(canvas).toBeVisible();
    await capture(page, 'sim-3d-before');
    const bounds = await canvas.boundingBox();
    const solution = page.getByPlaceholder('解法', { exact: true });
    let changed = false;
    for (const [x, y, dx, dy] of [[.5,.5,.15,0],[.45,.55,0,-.15],[.55,.5,.15,0],[.45,.45,-.15,0]]) {
      const before = await solution.inputValue();
      await page.mouse.move(bounds.x + bounds.width*x, bounds.y + bounds.height*y);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width*(x+dx), bounds.y + bounds.height*(y+dy), { steps: 14 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      if (await solution.inputValue() !== before) { changed = true; break; }
    }
    expect(changed, 'A real mouse drag on the rendered puzzle must append a move').toBe(true);
    await capture(page, 'sim-3d-after');
  } finally { await capture(page, 'sim-3d-last'); await page.close(); }
});
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
if (report.checks.some(check => check.status === 'failed')) process.exitCode = 1;
