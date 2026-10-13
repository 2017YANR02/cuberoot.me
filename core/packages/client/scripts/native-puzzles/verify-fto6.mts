/** Browser acceptance using only public UI, DOM, clipboard and screenshots.
 * Start the existing client dev server separately, then run this script from
 * packages/client. BASE_URL may target a deployed build. No account is signed in.
 * WebGL dragging and deliberately disabled-WebGL fallback are separate cases.
 */
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { Move } from 'cubing/alg';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3000');
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('BASE_URL must be HTTP(S)');
const out = process.env.OUTPUT_DIR ? resolve(process.env.OUTPUT_DIR) : fileURLToPath(new URL('../../../../.tmp/fto6-browser/', import.meta.url));
mkdirSync(out, { recursive: true });
const results: Record<string, unknown>[] = [];
const webgl = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fallback = await chromium.launch({ args: ['--disable-webgl'] });
const go = async (page: Page, path: string): Promise<void> => {
  const response = await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  expect(response?.status()).toBe(200);
};
async function check(name: string, browser: Browser, action: (page: Page) => Promise<unknown>, locale = 'zh-CN'): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  const row: Record<string, unknown> = { name, base: base.href };
  try { row.evidence = await action(page); expect(errors).toEqual([]); row.passed = true; }
  catch (error) { row.passed = false; row.error = String(error); }
  finally {
    row.pageErrors = errors; row.url = page.url();
    await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: true }).catch(() => {});
    writeFileSync(resolve(out, `${name}.txt`), await page.locator('body').innerText().catch(() => 'Page unavailable'));
    results.push(row);
    writeFileSync(resolve(out, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(row));
    await context.close();
  }
}
const net = (page: Page) => page.locator('svg[aria-label="fto6"]').filter({ visible: true }).first();
async function colors(page: Page): Promise<string[]> {
  await expect(net(page).locator('polygon[data-piece]')).toHaveCount(288);
  return net(page).locator('polygon[data-piece]').evaluateAll(nodes => nodes.map(node => node.getAttribute('fill') ?? ''));
}
async function selectGenerator(page: Page): Promise<void> {
  await page.locator('.gen-config-toolbar .pp-trigger:visible').click();
  const selected = page.getByRole('menuitemcheckbox', { checked: true });
  while (await selected.count()) await selected.first().click();
  await page.getByRole('menuitemcheckbox', { name: '六阶 FTO', exact: true }).click();
  await page.keyboard.press('Escape');
}
const sequence = "F 2U 3BR 1-2L 1-3D'";
try {
  await check('3d-drag-and-record', webgl, async page => {
    await go(page, '/zh/sim?puzzle=fto6');
    await page.locator('.twisty-native-controls').waitFor();
    await expect(page.locator('.twisty-section--2d')).toHaveCount(0);
    const alg = page.getByPlaceholder('解法', { exact: true });
    await page.getByLabel('转动记号', { exact: true }).selectOption('3F');
    await page.locator('.twisty-fallback-move').click();
    await expect(alg).toHaveValue('3F');
    const reduce = page.getByRole('switch', { name: '消步', exact: true });
    if (await reduce.getAttribute('aria-checked') === 'true') await reduce.click();
    const dragged: Record<string, string> = {};
    const scene = page.locator('twisty-player').first();
    for (const depth of ['outer', 'inner', 'inner3', 'wide', 'wide3']) {
      await alg.fill(''); await alg.blur();
      await page.getByLabel('拖转层', { exact: true }).selectOption(depth);
      await page.waitForTimeout(500);
      const box = await scene.boundingBox();
      if (!box || box.width < 100) throw new Error('No visible 3D viewport');
      const before = await scene.screenshot();
      let recorded = '';
      for (const [rx, ry] of [[0.48, 0.5], [0.4, 0.45], [0.52, 0.4], [0.35, 0.6], [0.55, 0.6], [0.3, 0.4]]) {
        for (const [dx, dy] of [[75, -30], [-30, -75]]) {
          const x = box.x + rx * box.width, y = box.y + ry * box.height;
          await page.mouse.move(x, y); await page.mouse.down();
          await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
          await page.waitForTimeout(700);
          recorded = (await alg.inputValue()).trim();
          if (recorded) break;
        }
        if (recorded) break;
      }
      expect(recorded, `${depth}: real pointer drag must append a move, not merely orbit`).not.toBe('');
      const move = new Move(recorded.split(/\s+/).at(-1)!);
      const actualDepth = move.outerLayer !== undefined || move.family.endsWith('w')
        ? move.innerLayer === 3 ? 'wide3' : 'wide'
        : move.innerLayer === 3 ? 'inner3' : move.innerLayer === 2 ? 'inner' : 'outer';
      expect(actualDepth).toBe(depth);
      expect(before.equals(await scene.screenshot()), `${depth}: rendered frame must change`).toBe(false);
      dragged[depth] = recorded;
      await page.screenshot({ path: resolve(out, `3d-drag-${depth}.png`), fullPage: true });
    }
    return { renderer: 'real Chromium WebGL via SwiftShader, not a hardware FPS benchmark', dragged };
  });
  await check('fallback-playback-share-scramble', fallback, async page => {
    await go(page, '/zh/sim?puzzle=fto6');
    await page.locator('.twisty-section--2d').waitFor();
    const solved = await colors(page);
    const alg = page.getByPlaceholder('解法', { exact: true });
    await page.getByLabel('转动记号', { exact: true }).selectOption('3F');
    await page.locator('.twisty-fallback-move').click();
    await expect(alg).toHaveValue('3F');
    await expect.poll(() => colors(page)).not.toEqual(solved);
    await page.getByLabel('转动角度', { exact: true }).selectOption('-1');
    await page.locator('.twisty-fallback-move').click();
    await expect(alg).toHaveValue('');
    await expect.poll(() => colors(page)).toEqual(solved);
    await alg.fill(sequence); await alg.blur();
    await page.locator('.playback-bar-anchor').selectOption('moves');
    await page.getByLabel('播放', { exact: true }).click();
    await expect(page.locator('.playback-bar-bubble')).toHaveText('5', { timeout: 20_000 });
    const terminal = await colors(page);
    expect(terminal).not.toEqual(solved);
    await page.getByLabel('回到起点', { exact: true }).click();
    await expect.poll(() => colors(page)).toEqual(solved);
    await page.getByLabel('下一步', { exact: true }).click();
    await expect(page.locator('.playback-bar-bubble')).toHaveText('1');
    await page.getByLabel('跳到末尾', { exact: true }).click();
    await expect.poll(() => colors(page)).toEqual(terminal);
    await page.getByTitle('复制本页链接(含打乱 / 解法)', { exact: true }).click();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(shared).searchParams.get('puzzle')).toBe('fto6');
    expect(new URL(shared).searchParams.get('alg')).toBe(sequence);
    await go(page, shared);
    await page.locator('.twisty-section--2d').waitFor();
    await expect(page.getByPlaceholder('解法', { exact: true })).toHaveValue(sequence);
    await page.getByLabel('跳到末尾', { exact: true }).click();
    await expect.poll(() => colors(page)).toEqual(terminal);
    await page.getByLabel('随机打乱', { exact: true }).click();
    const setup = page.getByPlaceholder('打乱', { exact: true });
    await expect.poll(async () => (await setup.inputValue()).trim().split(/\s+/).length).toBe(72);
    await expect(page.getByPlaceholder('解法', { exact: true })).toHaveValue(sequence);
    await page.getByLabel('动画展示打乱', { exact: true }).click();
    await expect(page.getByLabel('暂停', { exact: true })).toBeVisible();
    await page.getByLabel('暂停', { exact: true }).click();
    return { facelets: 288, manualInverse: true, playbackSteps: 5, shareRestoredSameNet: true, scrambleLength: 72, explicitlyStartedScrambleAnimation: true };
  });
  await check('english-controls', webgl, async page => {
    await go(page, '/sim?puzzle=fto6');
    await expect(page.getByLabel('Move notation', { exact: true })).toBeVisible();
    await expect(page.getByLabel('6-layer FTO', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Solution', { exact: true })).toBeVisible();
    return { language: 'English', canonicalUrl: page.url() };
  }, 'en-US');
  await check('timer-event-preview', webgl, async page => {
    await go(page, '/zh/timer?event=fto6');
    await expect(page.getByLabel('六阶 FTO', { exact: true })).toBeVisible();
    await colors(page);
    const text = (await page.locator('.scramble-moves').innerText()).trim();
    expect(text.split(/\s+/)).toHaveLength(72);
    expect(text).toContain('1-2'); expect(text).toContain('1-3');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('六阶 FTO', { exact: true })).toBeVisible();
    await colors(page);
    expect(new URL(page.url()).searchParams.get('event')).toBe('fto6');
    return { event: 'fto6', scrambleLength: 72, fullEightFaceNet: true, retainedOnReload: true };
  });
  for (const mode of ['batch', 'paste', 'comp']) {
    await check(`generator-${mode}`, webgl, async page => {
      await go(page, `/zh/scramble/gen${mode === 'comp' ? '' : `?mode=${mode}`}`);
      await selectGenerator(page);
      if (mode === 'batch') {
        const count = page.getByLabel('每项打乱数', { exact: true });
        await count.fill('2'); await count.press('Enter');
      } else if (mode === 'paste') {
        await page.locator('.gen-tn-paste-area').fill(`1. ${sequence}\n2) 3F 2BR' 1-3U`);
      } else await page.getByTitle('生成打乱', { exact: true }).click();
      await expect(net(page)).toBeVisible({ timeout: 90_000 });
      const nets = page.locator('svg[aria-label="fto6"]:visible');
      const expectedCount = mode === 'comp' ? 7 : 2;
      await expect(nets).toHaveCount(expectedCount);
      for (const svg of await nets.all()) await expect(svg.locator('polygon[data-piece]')).toHaveCount(288);
      const rows = page.locator('.gen-tn-attempt-scramble:visible');
      await expect(rows).toHaveCount(expectedCount);
      if (mode !== 'paste') for (const row of await rows.all()) expect((await row.innerText()).trim().split(/\s+/)).toHaveLength(72);
      else expect(await rows.first().innerText()).toBe(sequence);
      const download = page.waitForEvent('download', { timeout: 120_000 });
      await page.getByTitle('下载 PDF', { exact: true }).filter({ visible: true }).click();
      const pdf = await download;
      const target = resolve(out, `fto6-${mode}.pdf`);
      await pdf.saveAs(target);
      expect(readFileSync(target).subarray(0, 5).toString()).toBe('%PDF-');
      return { mode, attemptCount: expectedCount, faceletsPerPreview: 288, pdfDownloaded: true };
    });
  }
} finally {
  await webgl.close(); await fallback.close();
}
if (results.some(row => row.passed !== true)) process.exitCode = 1;
