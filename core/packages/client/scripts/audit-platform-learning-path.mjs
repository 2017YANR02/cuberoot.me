// Run against a development homepage serving this checkout. Each scenario gets
// a fresh guest context so the audit never writes to an existing user profile.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

if (process.argv.includes('--help')) {
  console.log('node scripts/audit-platform-learning-path.mjs [homepage URL] (default http://127.0.0.1:3000/zh/platform)');
  process.exit(0);
}
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:3000/zh/platform');
const output = fileURLToPath(new URL('../../../../.local-data/platform-learning-path/', import.meta.url));
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });

async function checkClean(grid) {
  await expect(grid.locator('[style]')).toHaveCount(0);
  expect(await grid.evaluate(el => ({
    running: el.getAnimations({ subtree: true }).length,
    measuring: Boolean(el.parentElement.querySelector('.path-measure')),
    transient: el.hasAttribute('data-motion') || el.hasAttribute('style') || el.inert,
  }))).toEqual({ running: 0, measuring: false, transient: false });
}

async function checkContrast(grid) {
  const failures = await grid.evaluate(root => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    const luminance = () => {
      const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(n => {
        const v = n / 255;
        return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
      });
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    };
    const paint = color => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    };
    const issues = [];
    for (const node of root.querySelectorAll('span, strong, small, h3')) {
      if (!node.getClientRects().length || !node.textContent.trim() || node.querySelector('span,strong,small')) continue;
      const ancestors = [];
      for (let element = node; element; element = element.parentElement) ancestors.unshift(element);
      paint('white');
      for (const element of ancestors) paint(getComputedStyle(element).backgroundColor);
      const background = luminance();
      paint(getComputedStyle(node).color);
      const foreground = luminance();
      const ratio = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      if (ratio < 4.5) issues.push({text: node.textContent, ratio});
    }
    return issues;
  });
  expect(failures, 'text contrast against background colours').toEqual([]);
}

async function checkExpanded(grid) {
  const active = grid.locator('li[data-selected]');
  const bounds = await grid.boundingBox();
  const card = await active.boundingBox();
  expect(Math.abs(card.width - Math.min(bounds.width, 840))).toBeLessThan(1);
  expect(Math.abs(card.x + card.width / 2 - bounds.x - bounds.width / 2)).toBeLessThan(1);
  expect(Math.abs(card.y - bounds.y)).toBeLessThan(1);
  await expect(active.locator('.path-stage')).toBeDisabled();
  for (const link of await active.getByRole('link').all()) {
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await checkClean(grid);
}

async function run(width, reducedMotion) {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: {width, height: 960}, reducedMotion });
  try {
    const page = await context.newPage();
    const response = await page.goto(url.href, {waitUntil: 'domcontentloaded'});
    expect(response?.ok(), 'development homepage response').toBe(true);
    const section = page.getByRole('region', {name: '学习路径'});
    const grid = section.locator('ol.path-grid:not(.path-measure)');
    const stages = grid.locator('.path-stage');
    const first = grid.getByRole('link').first();
    await expect(stages).toHaveCount(6);
    await expect(stages.first()).toBeVisible();
    await checkContrast(grid);
    const capture = reducedMotion === 'no-preference' && (width === 375 || width === 1440);
    if (capture) await section.screenshot({path: join(output, width+'-before.png')});
    for (const index of [0, 2, 5]) {
      const stage = stages.nth(index);
      await grid.evaluate(el => {
        window.learningPathMotionObserved = false;
        const observer = new MutationObserver(() => {
          if (el.dataset.motion === 'running') {
            window.learningPathMotionObserved = true;
            observer.disconnect();
          }
        });
        observer.observe(el, {attributes:true, attributeFilter:['data-motion']});
      });
      // Begin observing before keyboard dispatch so slow browser round trips
      // cannot miss the short capture window. Freeze every path animation at
      // the same instant, then resume them after taking the screenshot.
      const midFrame = capture && index === 2 ? page.waitForFunction(() => {
        const grid = document.querySelector('.path-measure[data-layout="expanded"], .path-grid[data-motion][data-layout="expanded"]');
        const card = grid?.querySelector('li[data-selected]');
        const surface = grid?.parentElement.querySelector('[data-layout="compact"] li[data-selected]');
        const reveal = card?.getAnimations().find(a => a.effect.getKeyframes().some(frame => frame.clipPath))
          ?? surface?.getAnimations().find(a => a.effect.getKeyframes().some(frame => frame.transform?.includes('scale(')));
        if (!reveal) return false;
        const timing = reveal.effect.getTiming();
        const time = timing.delay + Number(timing.duration) * .7;
        for (const animation of grid.parentElement.getAnimations({subtree: true}).filter(a => a.playState === 'running')) {
          animation.pause();
          animation.currentTime = time;
        }
        return true;
      }, undefined, {timeout: 5000}) : null;
      await stage.focus();
      await page.keyboard.press(index === 2 ? 'Space' : 'Enter');
      if (reducedMotion === 'no-preference') {
        await expect.poll(() => page.evaluate(() => window.learningPathMotionObserved)).toBe(true);
        if (await grid.getAttribute('data-motion') === 'running') await page.keyboard.press('Enter');
        if (capture && index === 2) {
          await midFrame;
          await page.screenshot({path: join(output, width+'-expanding.png'), animations:'allow'});
          await grid.evaluate(el => el.parentElement.getAnimations({subtree:true}).filter(a => a.playState === 'paused').forEach(animation => animation.play()));
        }
      }
      await expect(first).toBeFocused();
      await expect(section.getByRole('status')).toContainText('已定位到');
      await checkExpanded(grid);
      await checkContrast(grid);
      if (capture && index === 2) await section.screenshot({path: join(output, width+'-expanded.png')});
      await page.setViewportSize({width: width < 700 ? 768 : 375, height: 960});
      await checkExpanded(grid);
      if (index === 2) await section.getByRole('button', {name:'换一个阶段'}).click();
      else await page.keyboard.press('Escape');
      await expect(stage).toBeFocused();
      await expect(grid).toHaveAttribute('data-layout','compact');
      await checkClean(grid);
      await page.setViewportSize({width, height: 960});
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(grid).toHaveAttribute('data-layout', width < 700 ? 'compact' : 'expanded');
    await expect(stages.nth(5)).toHaveAttribute('aria-current','step');
    console.log('PASS', width, reducedMotion);
  } finally {
    await context.close();
  }
}

try {
  await mkdir(output, {recursive:true});
  for (const width of [1440, 1280, 768, 360, 375, 390, 430]) {
    for (const motion of ['no-preference','reduce']) await run(width, motion);
  }
} finally {
  await browser.close();
}
