import { test, expect, type Page } from '@playwright/test';

const alg = "F 2U' 3L 1-3D";
const solution = (page: Page) => page.getByPlaceholder('解法', { exact: true });
const tokens = (text: string) => text.trim().split(/\s+/).filter(Boolean);

async function withoutWebGL(page: Page) {
  // Capability simulation only. The real player, parser and state remain untouched.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (/^(webgl2?|experimental-webgl)$/.test(args[0])) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
}

async function selectOnlyFto6(page: Page) {
  const trigger = page.locator('.gen-config-toolbar .pp-trigger').first();
  await trigger.click();
  for (const selected of await page.getByRole('menuitemcheckbox', { checked: true }).all()) {
    await selected.click();
  }
  await page.getByRole('menuitemcheckbox', { name: /六阶 FTO/ }).click();
  await trigger.click();
}

test.afterEach(async ({ page }, info) => {
  await info.attach('visible-page', {
    body: await page.locator('body').innerText().catch(() => ''), contentType: 'text/plain',
  });
  await info.attach('page', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

test('2D capability fallback: manual depth, playback, scramble, history and share', async ({ page, context }) => {
  await withoutWebGL(page);
  await page.goto('/zh/sim?puzzle=fto6&anchor=start');
  await expect(page.locator('.twisty-section--2d')).toBeVisible();
  await expect(page.locator('.twisty-container svg polygon')).toHaveCount(288);
  await expect(page.getByLabel('转动记号').locator('option')).toHaveCount(40);
  const input = solution(page);
  await input.fill('');
  for (const move of ['F', '2U', '3L', '1-2B', '1-3D']) {
    await page.getByLabel('转动记号').selectOption(move);
    await page.locator('.twisty-fallback-move').click();
    await expect(input).toHaveValue(new RegExp(`${move}\\s*$`));
  }
  expect(tokens(await input.inputValue())).toEqual(['F', '2U', '3L', '1-2B', '1-3D']);
  await input.fill(alg);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.locator('.playback-bar-bubble')).toHaveText('4');
  await page.getByRole('button', { name: '回到起点', exact: true }).click();
  await expect(page.locator('.playback-bar-bubble')).toHaveText('0');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page.locator('.playback-bar-bubble')).toHaveText('1');
  await page.getByRole('button', { name: '随机打乱', exact: true }).click();
  await expect.poll(async () => tokens(await page.getByPlaceholder('打乱', { exact: true }).inputValue()).length).toBe(80);
  await expect(input).toHaveValue(alg);
  await page.getByRole('button', { name: '复制链接', exact: true }).click();
  const url = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(url.searchParams.get('puzzle')).toBe('fto6');
  expect(url.searchParams.get('alg')).toBe(alg);
  expect(tokens(url.searchParams.get('setup') ?? '')).toHaveLength(80);
  const replay = await context.newPage();
  await withoutWebGL(replay);
  await replay.goto(url.toString());
  await expect(solution(replay)).toHaveValue(alg);
  await expect(replay.locator('.twisty-container svg polygon')).toHaveCount(288);
  await replay.close();
  await input.fill('Fw');
  await expect(page.locator('.twisty-fallback-move')).toBeDisabled();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await input.fill(alg);
  await expect(page.locator('.twisty-fallback-move')).toBeEnabled();
});

test('software WebGL: actual 3D surface drags append outer and third-layer moves', async ({ page }, info) => {
  await page.goto('/zh/sim?puzzle=fto6');
  await expect(page.locator('.twisty-native-controls')).toBeVisible();
  await expect(page.locator('.twisty-section--2d')).toHaveCount(0);
  const canvas = page.locator('.twisty-container canvas').first();
  await expect(canvas).toBeVisible();
  await info.attach('webgl-capability', {
    body: JSON.stringify(await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return { webgl2: !!gl, renderer: gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null };
    })), contentType: 'application/json',
  });
  // Only public DOM input/mouse actions: no renderer, world or model injection.
  for (const depth of ['outer', 'inner3']) {
    await solution(page).fill('');
    await page.getByLabel('拖转层', { exact: true }).selectOption(depth);
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Missing visible 3D canvas');
    for (const [x, y, dx, dy] of [[.5, .45, 60, 0], [.45, .55, 0, 60], [.55, .4, -60, 30], [.5, .6, 50, -40]]) {
      const before = await solution(page).inputValue();
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * x + dx, box.y + box.height * y + dy, { steps: 12 });
      await page.mouse.up();
      try {
        await expect(solution(page)).not.toHaveValue(before, { timeout: 1500 });
        break;
      } catch { /* Try another visible face hit, never synthesize a move. */ }
    }
    const history = (await solution(page).inputValue()).trim();
    expect(history).toMatch(depth === 'inner3' ? /^3(?:F|B|D|U|L|BR|BL|R)'?$/ : /^(?:F|B|D|U|L|BR|BL|R)'?$/);
    await info.attach(`3d-${depth}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
});

test('English mobile fallback retains deep-link notation and native controls', async ({ page }) => {
  await withoutWebGL(page);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(`/sim?puzzle=fto6&alg=${encodeURIComponent(alg)}`);
  await expect(page.getByPlaceholder('Solution', { exact: true })).toHaveValue(alg);
  await expect(page.getByLabel('Move notation').locator('option')).toHaveCount(40);
  await expect(page.locator('.twisty-container svg polygon')).toHaveCount(288);
  await expect(page.locator('.twisty-fallback-notice')).toContainText('6-layer FTO');
});

test('batch and paste modes consume FTO6 scrambles and full eight-face nets', async ({ page }) => {
  await page.goto('/zh/scramble/gen?mode=batch');
  await selectOnlyFto6(page);
  await page.getByLabel('每项打乱数').fill('2');
  await page.getByLabel('每项打乱数').press('Enter');
  await page.getByTitle('重新生成', { exact: true }).click();
  await expect(page.locator('.gen-tn-attempt-line')).toHaveCount(2);
  for (const row of await page.locator('.gen-tn-sheet-table tr').all()) {
    expect(tokens(await row.locator('.gen-tn-attempt-line').innerText())).toHaveLength(80);
    await expect(row.locator('svg polygon')).toHaveCount(288);
  }
  await expect(page.getByText('练习打乱：80 步随机转动。', { exact: true })).toBeVisible();
  await page.goto('/zh/scramble/gen?mode=paste');
  await selectOnlyFto6(page);
  await page.locator('.gen-tn-paste-area').fill(`1. ${alg}\n2. F' 3B 1-2U`);
  await expect(page.locator('.gen-tn-sheet-table tr')).toHaveCount(2);
  await expect(page.locator('.gen-tn-sheet-table tr').first().locator('svg polygon')).toHaveCount(288);
  await expect(page.locator('.gen-tn-sheet-table tr').last().locator('svg polygon')).toHaveCount(288);
});

test('competition mode exposes FTO6 and generates practice sheets', async ({ page }) => {
  await page.goto('/zh/scramble/gen');
  await selectOnlyFto6(page);
  await page.getByTitle('生成打乱', { exact: true }).click();
  await expect(page.locator('.gen-tn-sheet-table tr').first()).toBeVisible();
  await expect(page.locator('.gen-tn-sheet-table tr').first().locator('svg polygon')).toHaveCount(288);
  await expect(page.locator('body')).toContainText('六阶 FTO');
});

test('Timer deep link, fresh generation and reload preserve the FTO6 event', async ({ page }) => {
  await page.goto('/zh/timer?event=fto6');
  await expect(page.locator('.scramble-moves').first()).toBeVisible();
  const strip = page.locator('.scramble-moves').first();
  await expect.poll(async () => tokens(await strip.innerText()).length).toBe(80);
  await expect(page.locator('[role="img"] svg polygon')).toHaveCount(288);
  const first = await strip.innerText();
  await page.keyboard.press('ArrowRight');
  await expect(strip).not.toHaveText(first);
  await expect.poll(async () => tokens(await strip.innerText()).length).toBe(80);
  await page.reload();
  await expect.poll(async () => tokens(await strip.innerText()).length).toBe(80);
  expect(new URL(page.url()).searchParams.get('event')).toBe('fto6');
  await expect(page.locator('[role="img"] svg polygon')).toHaveCount(288);
});
