import { test, expect, type Page, type TestInfo } from '@playwright/test';

const origin = process.env.CUBE2HELI_BASE_URL ?? 'http://127.0.0.1:3000';
test.use({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
test.setTimeout(180_000);

async function evidence(page: Page, info: TestInfo, name: string) {
  await info.attach(`${name}-dom`, { body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain' });
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

test.afterEach(async ({ page }, info) => {
  await evidence(page, info, 'page').catch(() => {});
  await info.attach('page-url', { body: page.url(), contentType: 'text/plain' });
});

async function chooseGeneratorPuzzle(page: Page) {
  // Inactive tab panels remain mounted. Never click a hidden panel's picker,
  // or assume that a pre-hydration SSR button already has its event handler.
  const trigger = page.locator('.gen-config-toolbar:visible .pp-trigger:visible').first();
  await expect(trigger).toBeVisible({ timeout: 90_000 });
  await expect(async () => {
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  const chosen = page.locator('.pp-item:visible').filter({ hasText: '二阶＋直升机' });
  await expect(chosen).toHaveCount(1);
  if (await chosen.getAttribute('aria-checked') !== 'true') await chosen.click();
  for (const other of await page.locator('.pp-item[aria-checked="true"]:visible').all()) {
    if (!(await other.innerText()).includes('二阶＋直升机')) await other.click();
  }
  await expect(chosen).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function assertNets(page: Page, count: number) {
  const nets = page.locator('.gen-tn-sheets:visible svg[aria-label="cube2heli"]');
  await expect(nets).toHaveCount(count, { timeout: 45_000 });
  for (const net of await nets.all()) {
    await expect(net).toBeVisible();
    await expect(net.locator('polygon[data-face]')).toHaveCount(48);
    expect(await net.locator('polygon[data-face]').evaluateAll((items) => new Set(items.map((item) => item.getAttribute('data-face'))).size)).toBe(6);
  }
}

test('3D simulator: manual moves, playback, history and exact share restoration', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/zh/sim?puzzle=cube2heli`, { waitUntil: 'domcontentloaded' });
  const moves = page.getByLabel('转动记号', { exact: true });
  const solution = page.getByPlaceholder('解法', { exact: true });
  const scramble = page.getByPlaceholder('打乱', { exact: true });
  await expect(moves).toBeEnabled({ timeout: 90_000 });
  await expect(page.getByLabel('拖转层', { exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await evidence(page, info, 'solved-3d');
  const options = await moves.locator('option').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  for (const token of ['F', 'DF', '2DF', 'DFw']) expect(options).toContain(token);
  for (const token of ['Fw', '3DFw']) expect(options).not.toContain(token);
  await moves.selectOption('F');
  await page.getByRole('button', { name: '转动 F', exact: true }).click();
  await expect(solution).toHaveValue('F');
  await page.waitForTimeout(1200);
  await evidence(page, info, 'manual-face-terminal');
  await moves.selectOption('DF');
  expect(await page.getByLabel('转动角度', { exact: true }).locator('option').allTextContents()).toEqual(['180°', '-180°']);
  await page.getByRole('button', { name: '转动 DF', exact: true }).click();
  await expect(solution).toHaveValue(/F DF/);
  await page.waitForTimeout(1200);
  await evidence(page, info, 'manual-edge-terminal');
  await page.getByRole('button', { name: '随机打乱', exact: true }).click();
  await expect(scramble).not.toHaveValue('', { timeout: 30_000 });
  const setup = await scramble.inputValue();
  expect(setup.trim().split(/\s+/)).toHaveLength(60);
  await evidence(page, info, 'random-terminal');
  await page.getByRole('button', { name: '动画展示打乱', exact: true }).click();
  // This documented action moves the scramble into the playable algorithm track.
  await expect(scramble).toHaveValue('');
  await expect(solution).toHaveValue(setup);
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await page.waitForTimeout(1600);
  await evidence(page, info, 'playback-middle');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '跳到末尾', exact: true }).click();
  await expect(page.getByLabel('拖动播放进度', { exact: true })).toHaveValue('60');
  await evidence(page, info, 'playback-terminal');
  await scramble.fill(setup);
  await solution.fill("F DF U' 2FL DBw");
  await page.locator('button[title="复制本页链接(含打乱 / 解法)"]').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(link).searchParams.get('puzzle')).toBe('cube2heli');
  const restored = await context.newPage();
  await restored.goto(link, { waitUntil: 'domcontentloaded' });
  await expect(restored.getByPlaceholder('解法', { exact: true })).toHaveValue("F DF U' 2FL DBw", { timeout: 60_000 });
  await expect(restored.getByPlaceholder('打乱', { exact: true })).toHaveValue(setup);
  await evidence(restored, info, 'share-restored');
  await restored.close();
  await info.attach('runtime-evidence', { body: JSON.stringify({ errors, options, copiedLink: link }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('3D surface pointer drag appends a genuine layer move', async ({ page }, info) => {
  await page.goto(`${origin}/zh/sim?puzzle=cube2heli`, { waitUntil: 'domcontentloaded' });
  const solution = page.getByPlaceholder('解法', { exact: true });
  await expect(page.getByLabel('拖转层', { exact: true })).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await expect(solution).toHaveValue('');
  const host = page.locator('.twisty-container');
  await evidence(page, info, 'drag-before');
  const box = await host.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Missing visible native player');
  // Normal pointer input on the front-face sticker region visible in the
  // solved screenshot. No private scene, raycaster, React or model access.
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.80, box.y + box.height * 0.52, { steps: 16 });
  await page.mouse.up();
  await expect(solution).not.toHaveValue('', { timeout: 15_000 });
  const move = await solution.inputValue();
  expect(move.trim().split(/\s+/)).toHaveLength(1);
  await page.waitForTimeout(1200);
  await evidence(page, info, 'drag-after');
  await info.attach('pointer-result', { body: JSON.stringify({ move, box }), contentType: 'application/json' });
});

for (const mode of ['comp', 'batch', 'paste'] as const) {
  test(`generator ${mode}: actual puzzle selection, scrambles and complete nets`, async ({ page }, info) => {
    await page.goto(`${origin}/zh/scramble/gen?mode=${mode}`, { waitUntil: 'domcontentloaded' });
    await chooseGeneratorPuzzle(page);
    let count: number;
    if (mode === 'comp') {
      await expect(page.locator('.gen-tn-event-card:visible')).toContainText('二阶＋直升机');
      await page.locator('button[title="生成打乱"]:visible').click();
      count = 7;
    } else if (mode === 'batch') {
      const input = page.getByLabel('每项打乱数', { exact: true });
      await input.fill('2');
      await input.press('Tab');
      count = 2;
    } else {
      await page.locator('textarea.gen-tn-paste-area:visible').fill("1. F DF U'\n2. R2 2DF FLw");
      count = 2;
    }
    await assertNets(page, count);
    const tokens = await page.locator('.gen-tn-sheets:visible code').allTextContents();
    expect(tokens.length).toBeGreaterThan(0);
    if (mode !== 'paste') expect(tokens[0].trim().split(/\s+/)).toHaveLength(60);
    await evidence(page, info, `${mode}-native-nets`);
  });
}

test('Timer retains the event and renders a 48-sticker random scramble net', async ({ page }, info) => {
  await page.goto(`${origin}/zh/timer?event=cube2heli`, { waitUntil: 'domcontentloaded' });
  const net = page.locator('svg[aria-label="cube2heli"]:visible').first();
  await expect(net).toBeVisible({ timeout: 90_000 });
  await expect(net.locator('polygon[data-face]')).toHaveCount(48);
  await expect(page.locator('.pp-trigger:visible').first()).toContainText('2Heli');
  const scramble = page.locator('.scramble-text:visible').first();
  expect((await scramble.innerText()).trim().split(/\s+/)).toHaveLength(60);
  await evidence(page, info, 'timer-native');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pp-trigger:visible').first()).toContainText('2Heli', { timeout: 60_000 });
  await expect(net).toBeVisible();
  expect(new URL(page.url()).searchParams.get('event')).toBe('cube2heli');
});

test.describe('No WebGL', () => {
  test.use({ launchOptions: { args: ['--disable-webgl'] }, viewport: { width: 390, height: 844 } });
  test('mobile English fallback remains usable without claiming 3D', async ({ page }, info) => {
    await page.goto(`${origin}/sim?puzzle=cube2heli`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('3D is unavailable. Showing a 2D net.', { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByLabel('Drag layer', { exact: true })).toHaveCount(0);
    const moves = page.getByLabel('Move notation', { exact: true });
    await expect(moves).toBeEnabled();
    await moves.selectOption('DFw');
    await page.getByRole('button', { name: 'Turn DFw', exact: true }).click();
    await expect(page.getByPlaceholder('Solution', { exact: true })).toHaveValue('DFw');
    await evidence(page, info, 'mobile-english-2d');
  });
});
