/**
 * Actual browser acceptance, not a mocked renderer. Start client dev separately,
 * then run from core: pnpm --filter @cuberoot/client exec node --import tsx scripts/radio-web-browser-acceptance.mts
 * NATIVE_PUZZLE_ID=radiojam also verifies Radio Jam with the same actual controls.
 * BASE_URL may target a deployed preview. Uses isolated anonymous contexts only.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect as baseExpect, type BrowserContext, type Page } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const id = process.env.NATIVE_PUZZLE_ID ?? 'radioweb';
if (id !== 'radioweb' && id !== 'radiojam') throw new Error('Unsupported acceptance target');
const puzzleName = { radioweb: 'Radio Web', radiojam: 'Radio Jam' }[id];
const puzzleLabel = new RegExp(`^${puzzleName}$`);
const out = resolve(import.meta.dirname, `../../../.tmp/${id}-evidence`);
mkdirSync(out, { recursive: true });
const expect = baseExpect.configure({ timeout: 30_000 });
const checks: { name: string; status: 'passed' | 'failed' | 'skipped'; detail?: unknown }[] = [];
const errors: { url: string; error: string }[] = [];
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(base, { signal: AbortSignal.timeout(20_000) })).ok) break; } catch { /* dev startup */ }
  if (attempt >= 30) throw new Error(`Browser target did not become ready: ${base}`);
  await pause(2000);
}
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const contexts: BrowserContext[] = [];
async function context(noWebGL = false) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
  contexts.push(ctx);
  if (noWebGL) await ctx.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  ctx.on('page', (page) => {
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(120_000);
    page.on('pageerror', (error) => errors.push({ url: page.url(), error: String(error) }));
  });
  return ctx;
}
async function check(name: string, page: Page, run: () => Promise<unknown>) {
  try {
    const detail = await run();
    checks.push({ name, status: 'passed', detail });
    console.log(`PASS ${name}`, detail ?? '');
  } catch (error) {
    checks.push({ name, status: 'failed', detail: String(error) });
    console.error(`FAIL ${name}`, error);
    writeFileSync(resolve(out, `${name}.html`), await page.content().catch(() => 'unavailable'));
    writeFileSync(resolve(out, `${name}.txt`), await page.locator('body').innerText().catch(() => 'unavailable'));
  } finally {
    await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: true, timeout: 15_000 }).catch(() => undefined);
    writeFileSync(resolve(out, 'browser-report.json'), JSON.stringify({ base, puzzle: id, checks, errors }, null, 2));
  }
}
async function open(page: Page, path: string) {
  const response = await page.goto(new URL(path, base).toString(), { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
}
const solution = (page: Page) => page.getByPlaceholder(/^(解法|Solution)$/);
const setup = (page: Page) => page.getByPlaceholder(/^(打乱|Scramble)$/);
const end = (page: Page) => page.getByRole('button', { name: /^(跳到末尾|Skip to end)$/ });
async function pattern(page: Page) {
  return page.locator('twisty-player').evaluate(async (element) => {
    const player = element as unknown as { experimentalModel: { currentPattern: { get(): Promise<{ patternData: unknown }> } } };
    return JSON.stringify((await player.experimentalModel.currentPattern.get()).patternData);
  });
}
async function move(page: Page, token: string, amount = '1') {
  await page.getByRole('combobox', { name: /^(转动记号|Move notation)$/ }).selectOption(token);
  await page.getByRole('combobox', { name: /^(转动角度|Turn angle)$/ }).selectOption(amount);
  await page.locator('.twisty-native-controls .twisty-fallback-move').click();
}
const gl = await context();
const sim = await gl.newPage();
await check('sim-3d-drag', sim, async () => {
  await open(sim, `/zh/sim?puzzle=${id}&anchor=start`);
  await expect(sim.locator('.twisty-native-controls')).toBeVisible();
  const info = await sim.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    return { webgl: !!gl, version: gl?.getParameter(gl.VERSION) ?? null };
  });
  if (!info.webgl || await sim.locator('.twisty-section--2d').count()) {
    checks.push({ name: 'actual-3d-piece-drag', status: 'skipped', detail: 'WebGL unavailable: only the 2D fallback was exercised.' });
    return info;
  }
  // cubing.js renders inside closed shadow roots. The public host bounds enclose
  // the visible canvas; pointer events below hit the actual rendered stickers.
  const canvas = sim.locator('twisty-player').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing rendered canvas bounds');
  await canvas.screenshot({ path: resolve(out, 'sim-3d-solved.png') });
  const recorded: string[] = [];
  for (const depth of ['outer', 'inner', 'wide']) {
    await sim.getByRole('combobox', { name: '拖转层' }).selectOption(depth);
    const before = await solution(sim).inputValue();
    const previousPattern = await pattern(sim);
    let result = before;
    for (const [fx, fy, dx, dy] of [[0.5, 0.45, 65, 20], [0.43, 0.55, -60, 30], [0.58, 0.55, 45, -55]]) {
      await sim.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      await sim.mouse.down();
      await sim.mouse.move(box.x + box.width * fx + dx, box.y + box.height * fy + dy, { steps: 14 });
      await sim.mouse.up();
      await pause(600);
      result = await solution(sim).inputValue();
      if (result !== before) break;
    }
    expect(result, `real piece drag in ${depth} depth must append a turn`).not.toBe(before);
    const token = result.trim().split(/\s+/).at(-1)!;
    if (depth === 'inner') expect(token).toMatch(/^2[A-T]/);
    if (depth === 'wide') expect(token).toMatch(/w/);
    if (depth === 'outer') expect(token).toMatch(/^[A-T](?:2|'|2')?$/);
    await expect.poll(() => pattern(sim)).not.toBe(previousPattern);
    await canvas.screenshot({ path: resolve(out, `sim-3d-${depth}.png`) });
    recorded.push(token);
  }
  return { ...info, recorded, verified: 'Actual pointer events on the rendered 3D canvas; turn history and native pattern changed for outer, inner and wide layers.' };
});

const flat = await context(true);
const page = await flat.newPage();
await check('sim-2d-playback-history-share', page, async () => {
  await open(page, `/zh/sim?puzzle=${id}&anchor=start`);
  await expect(page.locator('.twisty-section--2d')).toBeVisible();
  // Closed shadow content is verified through actual screenshots and the public
  // TwistyPlayer pattern API, not by piercing private renderer handles.
  await expect(page.locator('twisty-player')).toBeVisible();
  await page.locator('twisty-player').screenshot({ path: resolve(out, 'sim-2d-solved.png') });
  await expect(page.getByRole('combobox', { name: '转动记号' }).locator('option')).toHaveCount(60);
  await page.getByRole('button', { name: '随机打乱', exact: true }).click();
  await expect.poll(() => setup(page).inputValue()).not.toBe('');
  expect((await setup(page).inputValue()).trim().split(/\s+/)).toHaveLength(60);
  await solution(page).fill("R 2L' Gw [F,U]");
  // At anchor=start, start is correctly disabled; seek to end first.
  await end(page).click();
  await page.getByRole('button', { name: '回到起点', exact: true }).click();
  const initial = await pattern(page);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect.poll(() => pattern(page)).not.toBe(initial);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await end(page).click();
  const finished = await pattern(page);
  expect(finished).not.toBe(initial);
  const before = await solution(page).inputValue();
  await move(page, '2R', '-1');
  await expect.poll(() => solution(page).inputValue()).not.toBe(before);
  expect(await solution(page).inputValue()).toContain("2R'");
  // A manual turn already seeks to its newly appended endpoint.
  await expect(end(page)).toBeDisabled();
  await expect.poll(() => pattern(page)).not.toBe(finished);
  const sharedPattern = await pattern(page);
  await page.locator('button[title="复制本页链接(含打乱 / 解法)"]').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const link = new URL(copied);
  expect(link.searchParams.get('puzzle')).toBe(id);
  expect(link.searchParams.get('setup')).toBe(await setup(page).inputValue());
  expect(link.searchParams.get('alg')).toBe(await solution(page).inputValue());
  const reload = await flat.newPage();
  await reload.goto(copied);
  await expect(reload.locator('.twisty-native-controls')).toBeVisible();
  await end(reload).click();
  await expect.poll(() => pattern(reload)).toBe(sharedPattern);
  await reload.close();
  return { copied, view: 'forced no-WebGL native SVG', manual: "2R'", randomMoves: 60 };
});
// A fresh context prevents the prior Chinese locale cookie redirecting /sim.
const englishPage = await (await context(true)).newPage();
await check('sim-english-mobile', englishPage, async () => {
  const page = englishPage;
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, `/sim?puzzle=${id}&anchor=start&alg=R`);
  await expect(page.getByRole('combobox', { name: 'Move notation' })).toBeVisible();
  await move(page, 'Rw');
  await expect.poll(() => solution(page).inputValue()).toContain('Rw');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  return { viewport: '390x844', overflow };
});
await page.setViewportSize({ width: 1440, height: 1100 });
async function choosePuzzle(p: Page) {
  // All three mode panels remain mounted. Only interact with the visible one.
  const trigger = p.locator('.gen-config-toolbar .pp-trigger:visible').first();
  const menu = p.locator('.pp-popup:visible').first();
  async function openMenu() {
    // The competition panel hydrates after its first SSR paint. Retry the
    // public trigger only while collapsed, never toggle an already open menu.
    await expect.poll(async () => {
      if (await menu.count()) return true;
      if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
      return await menu.count() > 0;
    }, { timeout: 30_000, intervals: [500, 1000] }).toBe(true);
  }
  await openMenu();
  const target = menu.locator('.pp-item').filter({ has: p.locator('.pp-item-label', { hasText: puzzleLabel }) });
  if (await target.getAttribute('aria-checked') !== 'true') await target.click();
  await openMenu();
  const otherActive = menu.locator('.pp-item--active').filter({ hasNot: p.locator('.pp-item-label', { hasText: puzzleLabel }) });
  for (let count = await otherActive.count(); count > 0; count--) {
    await otherActive.first().click();
    await openMenu();
  }
  await expect(target).toHaveAttribute('aria-checked', 'true');
  await p.keyboard.press('Escape');
}
async function preview(p: Page) {
  const svg = p.locator(`.gen-tn-attempt-preview svg[aria-label="${id}"]:visible`).first();
  await expect(svg).toBeVisible();
  await expect(svg.locator('polygon')).toHaveCount(440);
  return svg;
}
for (const mode of ['batch', 'paste', 'comp']) {
  await check(`scramble-${mode}`, page, async () => {
    await open(page, `/zh/scramble/gen?mode=${mode}`);
    await choosePuzzle(page);
    if (mode === 'paste') await page.locator('.gen-tn-paste-area:visible').fill("1. R U F\n2. 2R' Lw G");
    if (mode === 'batch') {
      await page.locator('input[aria-label="每项打乱数"]:visible').fill('2');
      await page.locator('input[aria-label="每项打乱数"]:visible').press('Tab');
    }
    if (mode === 'comp') await page.locator('button[title="生成打乱"]').click();
    await preview(page);
    if (mode !== 'comp') await expect(page.locator('.gen-tn-attempt-scramble:visible')).toHaveCount(2);
    const texts = await page.locator('.gen-tn-attempt-scramble:visible').allTextContents();
    expect(texts.length).toBeGreaterThanOrEqual(2);
    if (mode === 'paste') expect(texts[0].replace(/\s+/g, ' ').trim()).toBe('R U F');
    if (mode === 'batch') {
      const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
      await page.locator('button[title="下载 PDF"]:visible').click();
      const download = await downloadPromise;
      const pdf = resolve(out, `${id}-scrambles.pdf`);
      await download.saveAs(pdf);
      expect(readFileSync(pdf).subarray(0, 5).toString()).toBe('%PDF-');
    }
    return { mode, previewFacelets: 440, scrambles: texts };
  });
}
await check('timer-project-and-preview', page, async () => {
  await open(page, `/zh/timer?event=${id}`);
  const svg = page.locator(`svg[aria-label="${id}"]`).first();
  await expect(svg).toBeVisible({ timeout: 60_000 });
  await expect(svg.locator('polygon')).toHaveCount(440);
  expect(new URL(page.url()).searchParams.get('event')).toBe(id);
  await page.reload();
  await expect(svg).toBeVisible();
  await expect(svg.locator('polygon')).toHaveCount(440);
  return { event: id, previewFacelets: 440, reloadPreservesEvent: true };
});
for (const ctx of contexts) await ctx.close();
await browser.close();
writeFileSync(resolve(out, 'browser-report.json'), JSON.stringify({ base, puzzle: id, checks, errors }, null, 2));
if (checks.some(({ status }) => status === 'failed')) process.exitCode = 1;
