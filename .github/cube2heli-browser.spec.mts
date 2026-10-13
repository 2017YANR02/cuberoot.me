import { test, expect } from '@playwright/test';

const origin = process.env.CUBE2HELI_BASE_URL ?? 'http://127.0.0.1:3000';
test.use({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
test.setTimeout(180_000);

test.afterEach(async ({ page }, info) => {
  await info.attach('visible-dom', { body: await page.locator('body').ariaSnapshot().catch(() => 'No page DOM'), contentType: 'text/plain' });
  await info.attach('page-url', { body: page.url(), contentType: 'text/plain' });
  await page.screenshot({ path: info.outputPath('page.png'), fullPage: true }).catch(() => {});
});

test('simulator real UI: native manual turns, random scramble, playback and share', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/zh/sim?puzzle=cube2heli`, { waitUntil: 'domcontentloaded' });
  const moves = page.getByLabel('转动记号', { exact: true });
  await expect(moves).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText('二阶＋直升机：面转 90°', { exact: false })).toBeVisible();
  const options = await moves.locator('option').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  expect(options).toContain('F');
  expect(options).toContain('DF');
  expect(options).toContain('2DF');
  expect(options).toContain('DFw');
  expect(options).not.toContain('Fw');
  expect(options).not.toContain('3DFw');
  const solution = page.getByPlaceholder('解法', { exact: true });
  await moves.selectOption('F');
  await page.getByRole('button', { name: '转动 F', exact: true }).click();
  await expect(solution).toHaveValue(/F/);
  await page.screenshot({ path: info.outputPath('manual-face.png'), fullPage: true });
  await moves.selectOption('DF');
  expect(await page.getByLabel('转动角度', { exact: true }).locator('option').allTextContents()).toEqual(['180°', '-180°']);
  await page.getByRole('button', { name: '转动 DF', exact: true }).click();
  await expect(solution).toHaveValue(/DF/);
  await page.screenshot({ path: info.outputPath('manual-edge.png'), fullPage: true });
  await page.getByRole('button', { name: '随机打乱', exact: true }).click();
  const scramble = page.getByPlaceholder('打乱', { exact: true });
  await expect(scramble).not.toHaveValue('', { timeout: 30_000 });
  const setup = await scramble.inputValue();
  expect(setup.trim().split(/\s+/)).toHaveLength(60);
  await page.screenshot({ path: info.outputPath('random-terminal.png'), fullPage: true });
  await page.getByRole('button', { name: '动画展示打乱', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('playback-middle.png'), fullPage: true });
  await solution.fill("F DF U' 2FL DBw");
  await page.locator('button[title="复制本页链接(含打乱 / 解法)"]').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const url = new URL(link);
  expect(url.searchParams.get('puzzle')).toBe('cube2heli');
  const restored = await context.newPage();
  await restored.goto(link, { waitUntil: 'domcontentloaded' });
  await expect(restored.getByPlaceholder('解法', { exact: true })).toHaveValue("F DF U' 2FL DBw", { timeout: 60_000 });
  await expect(restored.getByPlaceholder('打乱', { exact: true })).toHaveValue(setup);
  await restored.screenshot({ path: info.outputPath('share-restored.png'), fullPage: true });
  await restored.close();
  await info.attach('runtime-evidence', { body: JSON.stringify({ errors, options, copiedLink: link, fallback: await page.locator('.twisty-section--2d').count(), dragControlVisible: await page.getByLabel('拖转层', { exact: true }).isVisible() }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

for (const route of ['timer?event=cube2heli', 'scramble/gen?mode=comp', 'scramble/gen?mode=batch', 'scramble/gen?mode=paste']) {
  test(`inspect actual ${route} entry`, async ({ page }, info) => {
    await page.goto(`${origin}/zh/${route}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.pp-trigger').first()).toBeVisible({ timeout: 120_000 });
    await page.locator('.pp-trigger').first().click();
    await info.attach('open-picker', { body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain' });
    await page.screenshot({ path: info.outputPath('picker.png'), fullPage: true });
  });
}
