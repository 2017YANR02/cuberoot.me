import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const origin = process.env.CUBEROOT_TUTORIAL_URL ?? 'http://127.0.0.1:3000';
const useWebKit = process.argv.includes('--webkit');
const quick = process.argv.includes('--quick');
const lastLayerOnly = process.argv.includes('--last-layer');
const evidence = new URL('../../../../.tmp/png/', import.meta.url);
const minRenderedCubeRatio = 0.45;
const widths = [320, 375, 390, 440, 480, 600, 744, 760, 761, 844, 1024, 1280, 1440, 1920];
const heights = [320, 350, 390, 499, 500, 501, 568, 720, 844, 956, 1024, 1200];
const examples = [[320, 320], [320, 568], [390, 844], [440, 956], [568, 320], [844, 390],
  [956, 440], [744, 900], [760, 760], [761, 760], [768, 1024], [1024, 768], [1440, 900], [1920, 1200]];
const bySize = new Map((quick ? examples : [...widths.flatMap(width => heights.map(height => [width, height])), ...examples])
  .map(([width, height]) => [width + '×' + height, { width, height }]));
const views = [...bySize.values()];
const route = '/zh/tutorial/2x2-lbl';
const browser = useWebKit ? await webkit.launch() : await chromium.launch({
  ...(process.env.CUBEROOT_CHROMIUM_PATH
    ? { executablePath: process.env.CUBEROOT_CHROMIUM_PATH } : { channel: 'chrome' }),
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' });
await page.addInitScript(() => {
  const hideIndicator = () => document.querySelector('nextjs-portal')?.style.setProperty('display', 'none', 'important');
  const observer = new MutationObserver(hideIndicator);
  observer.observe(document, { childList: true, subtree: true });
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const cube = () => page.locator('[data-course-cube]');
const canvas = () => cube().locator('canvas').first();
const progress = () => page.getByRole('slider');
const showPractice = () => page.getByRole('button', { name: '练习本节' }).click();
const review = () => page.getByRole('button', { name: '回看本节教程' }).click();
const next = () => page.getByRole('button', { name: '下一节' }).click();
const unfinishedQuiz = () => page.getByRole('dialog', { name: '本节还没学完', exact: true });
async function skipUnfinishedSection() {
  await next();
  await unfinishedQuiz().getByRole('button', { name: '跳到下一节', exact: true }).click();
}
const currentSection = id => page.locator('[data-course-section="' + id + '"]').waitFor();
const waitForStep = (step, section = null) => page.waitForURL(url =>
  url.searchParams.get('step') === step && url.searchParams.get('section') === section);
const setViewport = async viewport => {
  await page.setViewportSize(viewport);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
async function ready() {
  await page.locator('[data-course-cube][data-ready="true"] canvas').first().waitFor();
}
async function evidenceScreenshot(name) {
  await mkdir(evidence, { recursive: true });
  const path = fileURLToPath(new URL(name + '.png', evidence));
  await page.screenshot({ path });
  return path;
}

async function checkOverview(locale, id = 'overview') {
  const introduction = id === 'overview';
  const labels = locale === 'en'
    ? { steps: ['First layer', 'Yellow face', 'Corner placement'], previous: 'Previous section' }
    : { steps: ['底层', '黄面', '角位置'], previous: '上一节' };
  const overview = page.locator('[data-course-reading][data-tutorial-layout="E"][data-course-section="' + id + '"]');
  await overview.waitFor();
  if (introduction) {
    assert.deepEqual(await overview.locator('h2').allTextContents(), labels.steps.map((title, index) => (index + 1) + '. ' + title));
  } else {
    assert.equal(await overview.locator('button, a').count(), 0, 'A chapter overview can open another section');
    assert.equal(await overview.locator('figcaption').count(), 1, 'The overview did not explain the chapter goal');
  }
  assert.equal(await overview.locator('.puzzle-art svg').count(), introduction ? labels.steps.length : 2, 'Missing overview diagrams');
  assert.equal(await progress().count(), 0, 'Overview reserved a playback control');
  assert.equal(await page.locator('.course-action').count(), 0, 'Overview showed a practice entry');
  assert.equal(await page.getByRole('button', { name: labels.previous }).isDisabled(), introduction, 'Unexpected previous-page state');
  const lastSelector = introduction ? '.course-overview-steps li:last-child' : 'figcaption';

  for (const [width, height] of examples) {
    await setViewport({ width, height });
    const report = await overview.evaluate((section, selector) => {
      const footer = document.querySelector('[data-course-footer]');
      const lastStep = section.querySelector(selector);
      const scrollport = section.querySelector('[data-fit-fallback]') ?? section;
      const offset = scrollport.scrollTop;
      scrollport.scrollTop = scrollport.scrollHeight;
      const last = lastStep.getBoundingClientRect();
      const end = footer.getBoundingClientRect();
      const content = section.getBoundingClientRect();
      const body = document.documentElement;
      const result = {
        fitsViewport: body.scrollWidth <= body.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1,
        footerClear: content.bottom <= end.top + 1 && end.bottom <= body.clientHeight + 1,
        lastStepReachable: last.bottom <= scrollport.getBoundingClientRect().bottom + 1,
        diagramsFit: [...section.querySelectorAll('.puzzle-art svg')].every(svg => {
          const image = svg.getBoundingClientRect();
          return image.width >= 40 && image.left >= content.left - 1 && image.right <= content.right + 1;
        }),
      };
      scrollport.scrollTop = offset;
      return result;
    }, lastSelector);
    assert(Object.values(report).every(Boolean), id + ' (' + locale + ') ' + width + '×' + height + ': ' + JSON.stringify(report));
  }
  console.log(id + ' (' + locale + ') passed at ' + examples.length + ' viewports.');
}

async function checkLessonLinks() {
  const detail = '?step=lesson-2&section=white-blue-red';
  await setViewport({ width: 1280, height: 850 });
  await page.goto(origin + route + detail);
  await currentSection('white-blue-red');
  await ready();
  await page.locator('[data-course-turn-exploration]').waitFor();
  assert.equal(await progress().count(), 0, 'The linked quiz showed playback controls');

  const historyBefore = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: '白橙蓝角', exact: true }).click();
  await waitForStep('lesson-2', 'white-orange-blue');
  await currentSection('white-orange-blue');
  await next();
  await unfinishedQuiz().getByRole('button', { name: '继续学习', exact: true }).click();
  await unfinishedQuiz().waitFor({ state: 'hidden' });
  await waitForStep('lesson-2', 'white-orange-blue');
  await skipUnfinishedSection();
  await waitForStep('lesson-2', 'white-blue-red');
  assert.equal(await page.evaluate(() => history.length), historyBefore, 'In-chapter navigation added a history entry');

  await page.reload();
  await currentSection('white-blue-red');
  await ready();
  await page.locator('[data-course-turn-exploration]').waitFor();
  await page.getByRole('button', { name: '黄面', exact: true }).click();
  await waitForStep('lesson-3');
  await currentSection('yellow-overview');
  await page.goBack();
  await waitForStep('lesson-2', 'white-blue-red');
  await currentSection('white-blue-red');
  await page.goForward();
  await currentSection('yellow-overview');

  await page.goto(origin + route + '?step=lesson-2');
  await currentSection('bottom-overview');
  await page.goto(origin + route + '?step=lesson-2&section=white-green-orange');
  await currentSection('white-green-orange');
  await page.getByRole('heading', { name: '把右后的空位转到右前', exact: true }).waitFor();
  await skipUnfinishedSection();
  await waitForStep('lesson-2', 'bottom-flowchart');
  await currentSection('bottom-flowchart');
  assert.equal(await page.locator('[data-course-section="bottom-flowchart"] button').count(), 4);
  await page.goto(origin + route + '?step=white-blue-red');
  await currentSection('white-blue-red');
  await page.goto(origin + route + '?step=unknown');
  await page.locator('[data-course-reading]').waitFor();
  console.log('Lesson URLs passed: direct links, reload, invalid step, and browser history.');
}

async function assertLayout(mode, viewport) {
  await setViewport(viewport);
  const result = await page.evaluate(() => {
    const element = name => document.querySelector('[data-course-' + name + ']');
    const box = node => {
      const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    const body = document.documentElement;
    const stage = element('stage');
    const caption = element('caption');
    const footer = element('footer');
    const transport = element('transport');
    const controls = [...footer.querySelectorAll('button:not(:disabled), summary')].filter(node =>
      node.getClientRects().length && (!node.closest('.tutorial-section-popover') || node.closest('details[open]')));
    const isClickable = node => {
      const bounds = box(node);
      return node.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2));
    };
    const lastLine = caption.querySelector('.course-copy')?.lastElementChild;
    let canReadToEnd = true;
    if (lastLine && caption.scrollHeight > caption.clientHeight + 1) {
      const oldOffset = caption.scrollTop;
      const oldCubeTop = box(element('cube')).top;
      const oldFooterTop = box(footer).top;
      caption.scrollTop = caption.scrollHeight;
      canReadToEnd = box(lastLine).bottom <= box(caption).bottom + 1
        && box(element('cube')).top === oldCubeTop && box(footer).top === oldFooterTop;
      caption.scrollTop = oldOffset;
    }
    return {
      documentSize: [body.scrollWidth, body.scrollHeight, body.clientWidth, body.clientHeight],
      stage: box(stage), cube: box(element('cube')), caption: box(caption), footer: box(footer), transport: transport && box(transport),
      layout: stage.dataset.tutorialLayout,
      columns: getComputedStyle(element('grid')).gridTemplateColumns.split(' ').length,
      coveredControls: controls.filter(node => !isClickable(node)).map(node => node.innerText || node.getAttribute('aria-label')),
      horizontalCaptionOverflow: caption.scrollWidth - caption.clientWidth,
      canReadToEnd,
    };
  });
  const name = mode + ' ' + viewport.width + '×' + viewport.height;
  const [sw, sh, cw, ch] = result.documentSize;
  const { stage, cube: square, caption, footer, transport } = result;
  assert(sw <= cw + 1 && sh <= ch + 1, name + ' page overflow ' + result.documentSize);
  assert(square.width >= 84 && square.height >= 84, name + ' cube viewport too small ' + JSON.stringify(square));
  assert(square.left >= stage.left - 1 && square.right <= stage.right + 1
    && square.top >= stage.top - 1 && square.bottom <= stage.bottom + 1, name + ' cube exceeds the stage');
  const wide = stage.width > stage.height && stage.width >= 440 && stage.height >= 120;
  assert.equal(result.columns, wide ? 2 : 1, name + ' column count');
  assert(wide ? square.right <= caption.left + 1 : square.bottom <= caption.top + 1, name + ' cube covers the explanation');
  assert(caption.height >= 32 && result.horizontalCaptionOverflow <= 1, name + ' explanation is too small or clipped horizontally');
  assert(result.canReadToEnd, name + ' the last caption line is unreachable or moves the cube');
  assert(stage.bottom <= (transport ?? footer).top + 1 && (!transport || transport.bottom <= footer.top + 1) && footer.bottom <= ch + 1,
    name + ' play or page controls overlap the lesson or viewport');
  assert.deepEqual(result.coveredControls, [], name + ' covered controls');
  return result;
}

function questionLayoutTargets(action) {
  const caption = page.locator('[data-course-caption]');
  return {
    canvas: canvas(),
    footer: page.locator('[data-course-footer]'),
    progress: caption.locator('.course-question-progress'),
    heading: caption.locator('h2'),
    prompt: caption.locator('.course-question-copy p').first(),
    ...(action && { action }),
  };
}

async function capturePositions(targets) {
  return Object.fromEntries(await Promise.all(Object.entries(targets).map(async ([name, target]) => {
    const bounds = await target.boundingBox();
    assert(bounds, name + ' has no layout box');
    return [name, bounds];
  })));
}

async function assertPositionsUnchanged(scenario, targets, before) {
  const after = await capturePositions(targets);
  for (const [name, bounds] of Object.entries(before)) {
    for (const property of ['x', 'y', 'width', 'height']) {
      assert(Math.abs(bounds[property] - after[name][property]) <= 0.5,
        scenario + ' changed ' + name + ' ' + property + ' from ' + bounds[property] + ' to ' + after[name][property]);
    }
  }
}

/** Read the rendered WebGL output so an oversized canvas cannot hide an undersized puzzle. */
async function readRenderedCube() {
  const handle = canvas();
  const bounds = await handle.boundingBox();
  const png = (await handle.screenshot()).toString('base64');
  return page.evaluate(async ({ png, bounds }) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + png;
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, sample.width, sample.height);
    const pixel = (x, y) => data.slice((y * sample.width + x) * 4, (y * sample.width + x) * 4 + 3);
    let minX = sample.width, minY = sample.height, maxX = 0, maxY = 0;
    for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
      const [r, g, b] = pixel(x, y);
      if (Math.max(r, g, b) < 80 || Math.max(r, g, b) - Math.min(r, g, b) < 62) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return { width: (maxX - minX + 1) * bounds.width / sample.width, height: (maxY - minY + 1) * bounds.height / sample.height };
  }, { png, bounds });
}

async function scan(mode, expectedLayout) {
  let min = Infinity;
  let max = 0;
  for (const viewport of views) {
    const result = await assertLayout(mode, viewport);
    assert.equal(result.layout, expectedLayout);
    min = Math.min(min, result.cube.width);
    max = Math.max(max, result.cube.width);
  }
  process.stdout.write(mode + ' ' + views.length + ' viewports, cube viewport ' + Math.round(min) + '–' + Math.round(max) + ' px\n');
}

async function keyboardMoves(moves, board = cube()) {
  for (const token of moves.split(' ')) {
    const key = token[0].toLowerCase();
    const input = token.endsWith("'") ? 'Shift+' + key.toUpperCase() : key;
    await board.press(input);
    if (token.includes('2')) await board.press(input);
  }
}

async function visibleSlotHintPixels(surface = canvas()) {
  return surface.evaluate(async node => {
    const image = new Image();
    image.src = node.toDataURL();
    await image.decode();
    const buffer = document.createElement('canvas');
    buffer.width = image.width;
    buffer.height = image.height;
    const context = buffer.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, buffer.width, buffer.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 100 && data[i] - data[i + 1] > 40 && data[i + 2] - data[i] > 40) count++;
    }
    return count;
  });
}

function inverseTurn(move) {
  if (move.includes('2')) return move;
  return move.endsWith("'") ? move.slice(0, -1) : move + "'";
}

async function dragCube(fractionX, fractionY, deltaX, deltaY, steps = 6) {
  const bounds = await canvas().boundingBox();
  const x = bounds.x + bounds.width * fractionX;
  const y = bounds.y + bounds.height * fractionY;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps });
  await page.mouse.up();
}

async function restart() {
  await page.getByRole('button', { name: '重来', exact: true }).click();
  await ready();
}

async function selectSticker(view, fractionX, fractionY, touch = false) {
  const surface = view.locator('[data-course-cube][data-ready="true"] canvas').first();
  await surface.waitFor();
  const { width, height } = await surface.boundingBox();
  const position = { x: width * fractionX, y: height * fractionY };
  if (touch) await surface.tap({ position });
  else await surface.click({ position });
}

async function continueQuestion(view, step, touch = false) {
  const answered = view.locator('[data-course-question="' + step + '"][data-course-answer="correct"]');
  const button = answered.getByRole('button', { name: '继续', exact: true });
  if (touch) await button.tap();
  else await button.click();
}

async function checkInteractiveAnimations() {
  const preview = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  try {
    await preview.clock.install();
    await preview.goto(origin + route + '?step=white-orange-blue');
    const board = preview.locator('[data-course-cube][data-ready="true"]');
    const surface = board.locator('canvas').first();
    const { x, y, width, height } = await surface.boundingBox();
    const startX = Math.round(x + width * .5);
    const startY = Math.round(y + height * .5);
    await preview.clock.pauseAt(new Date(Date.now() + 1000));
    await preview.mouse.move(startX, startY);
    await preview.mouse.down();
    await preview.mouse.move(startX - 24, startY);
    await preview.mouse.up();
    await preview.clock.runFor(96);
    const firstPose = await surface.evaluate(node => node.toDataURL());
    await preview.clock.runFor(144);
    assert.notEqual(await surface.evaluate(node => node.toDataURL()), firstPose, 'The snap did not render intermediate poses');
    assert.equal(await board.getAttribute('data-move-count'), '0', 'The cube committed before the animation finished');
    await preview.clock.runFor(144);
    await preview.locator('[data-last-move="y"][data-move-count="1"]').waitFor();
    await preview.clock.runFor(64);
    const readColors = () => surface.evaluate(async node => {
      const image = new Image();
      image.src = node.toDataURL();
      await image.decode();
      const buffer = document.createElement('canvas');
      buffer.width = node.width;
      buffer.height = node.height;
      const context = buffer.getContext('2d');
      context.drawImage(image, 0, 0);
      const rgb = (fx, fy) => [...context.getImageData(Math.round(buffer.width * fx), Math.round(buffer.height * fy), 1, 1).data].slice(0, 3);
      return { background: rgb(.34, .35), target: rgb(.66, .69) };
    });
    const chroma = rgb => Math.max(...rgb) - Math.min(...rgb);
    const before = await readColors();
    assert(chroma(before.background) > 100 && chroma(before.target) > 100, 'Expected two saturated stickers before finding the corner');
    const showHint = async step => {
      const hint = preview.locator('[data-course-question="' + step + '"]').getByRole('button', { name: '提示', exact: true });
      const bounds = await hint.boundingBox();
      assert(bounds, 'The answer hint is missing');
      await preview.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    };
    await showHint(1);
    await preview.clock.runFor(110);
    const fadingIn = await readColors();
    assert(chroma(fadingIn.background) > 0 && chroma(fadingIn.background) < chroma(before.background),
      'The other corners did not fade to gray');
    await preview.clock.runFor(200);
    const muted = await readColors();
    assert(chroma(muted.background) <= 1, 'The other corners never became gray');
    assert.deepEqual(muted.target, before.target, 'The hint recolored the target corner');
    await preview.clock.runFor(1170);
    const fadingOut = await readColors();
    assert(chroma(fadingOut.background) > 0 && chroma(fadingOut.background) < chroma(before.background),
      'The gray hint did not fade out');
    await preview.clock.runFor(220);
    assert.deepEqual(await readColors(), before, 'The gray hint did not restore the original colors');
    assert.equal(await board.getAttribute('data-move-count'), '1', 'Showing the hint moved the cube');
    assert.equal(await preview.locator('[data-course-question="1"]').getAttribute('data-course-answer'), 'pending',
      'The gray hint answered the question');

    await preview.mouse.click(x + width * .41, y + height * .69);
    await preview.clock.runFor(1000);
    const answered = preview.locator('[data-course-question="1"][data-course-answer="correct"]');
    await answered.waitFor();
    assert.deepEqual(await readColors(), before, 'A correct answer started the fade before Continue');
    const button = await answered.getByRole('button', { name: '继续', exact: true }).boundingBox();
    assert(button, 'Continue did not appear after the correct answer');
    await preview.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
    await preview.clock.runFor(400);
    await preview.locator('[data-course-question="2"][data-course-answer="pending"]').waitFor();
    const midway = await readColors();
    assert(chroma(midway.background) > 0 && chroma(midway.background) < chroma(before.background), 'The background sticker did not fade');
    await preview.clock.runFor(400);
    const after = await readColors();
    assert(chroma(after.background) <= 1, 'The background sticker never became gray');
    assert.deepEqual(after.target, before.target, 'The target sticker changed color or moved');
    assert.equal(await preview.locator('[data-course-question="2"]').getByRole('button', { name: '提示', exact: true }).count(), 0,
      'The placement question showed a hint button');
  } finally {
    await preview.close();
  }
}

async function checkTouchRotation() {
  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true,
    isMobile: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  try {
    await touchPage.goto(origin + route + '?step=white-orange-blue');
    const board = touchPage.locator('[data-course-cube][data-ready="true"]');
    const session = await touchPage.context().newCDPSession(touchPage);
    const swipe = async (distance, vertical = false, fractionX = .5, fractionY = .5) => {
      const bounds = await board.locator('canvas').first().boundingBox();
      assert(bounds, 'Touch lesson did not mount a canvas');
      const x = bounds.x + bounds.width * fractionX;
      const y = bounds.y + bounds.height * fractionY;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++) {
        const delta = distance * step / 8;
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
          x: vertical ? x : x + delta, y: vertical ? y + delta : y,
        }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe(-65);
    await touchPage.locator('[data-last-move="y"]').waitFor();
    await selectSticker(touchPage, .41, .69, true);
    await continueQuestion(touchPage, 1, true);
    await touchPage.locator('[data-course-question="2"][data-course-answer="pending"]').waitFor();
    await touchPage.setViewportSize({ width: 844, height: 390 });
    assert.equal(await touchPage.locator('[data-course-answer]').getAttribute('data-course-question'), '2');
    await touchPage.setViewportSize({ width: 390, height: 844 });
    const placementQuestion = touchPage.locator('[data-course-question="2"]');
    await placementQuestion.getByText('现在在底层右前，白格朝前。', { exact: true }).waitFor();
    await swipe(104);
    await placementQuestion.and(touchPage.locator('[data-course-answer="pending"]')).waitFor();
    await swipe(45, true);
    await board.and(touchPage.locator('[data-move-count="2"]')).waitFor();
    assert.equal(await placementQuestion.getAttribute('data-course-answer'), 'pending');
    await swipe(45);
    await placementQuestion.getByText('摆对了！', { exact: true }).waitFor();
    await swipe(80);
    await board.and(touchPage.locator('[data-move-count="4"]')).waitFor();
    await placementQuestion.and(touchPage.locator('[data-course-answer="pending"]')).waitFor();
    await swipe(-135);
    await placementQuestion.getByText('摆对了！', { exact: true }).waitFor();
    await touchPage.getByRole('button', { name: '练习本节' }).tap();
    await swipe(65);
    await touchPage.locator('[data-last-move^="y"]').waitFor();
    await touchPage.setViewportSize({ width: 844, height: 390 });
    assert.equal(await board.getAttribute('data-move-count'), '1', 'Changing orientation lost the touch rotation');

    await touchPage.setViewportSize({ width: 390, height: 844 });
    await touchPage.goto(origin + route + '?step=white-blue-red');
    const exploration = touchPage.locator('[data-course-turn-exploration]');
    await swipe(65, true, .40, .50);
    await exploration.and(touchPage.locator('[data-blocked-face="L"]')).waitFor();
    assert.equal(await board.getAttribute('data-move-count'), '0', 'Touch committed a blocked left turn');
    await swipe(75, false, .55, .46);
    await exploration.locator('[data-face="U"][data-tried="true"]').waitFor();
    const top = await board.getAttribute('data-last-move');
    await swipe(70, true, .70, .52);
    await exploration.locator('[data-face="R"][data-tried="true"]').waitFor();
    const right = await board.getAttribute('data-last-move');
    await swipe(67, true, .31, .46);
    await exploration.locator('[data-face="F"][data-tried="true"]').waitFor();
    const front = await board.getAttribute('data-last-move');
    await keyboardMoves([front, right, top].map(inverseTurn).join(' '), board);
    await exploration.getByRole('button', { name: '继续', exact: true }).tap();
    const alignment = touchPage.locator('[data-course-question="2"][data-corner-reveal="1"]');
    await alignment.waitFor();
    assert.equal(await alignment.getAttribute('data-course-answer'), 'pending');
    assert.equal(await board.getAttribute('data-move-count'), '6', 'Quiz 2 lost the first quiz’s turn history');
    const pose = alignment.getByText(/^现在在/);
    await pose.waitFor();
    for (let count = 7; count <= 9; count++) {
      const previousPose = await pose.textContent();
      await swipe(75, false, .55, .46);
      await board.and(touchPage.locator('[data-move-count="' + count + '"]')).waitFor();
      await touchPage.waitForFunction(previous => {
        const status = document.querySelector('[data-course-question="2"] .course-question-status')?.textContent;
        return status && status !== previous;
      }, previousPose);
      if (await alignment.getAttribute('data-course-answer') === 'correct') break;
    }
    await alignment.getByRole('heading', { name: '完成，可以继续', exact: true }).waitFor();
  } finally {
    await touchPage.close();
  }
}

async function checkLastLayerChapters() {
  await page.goto(origin + route + '?step=lesson-3');
  await checkOverview('zh', 'yellow-overview');
  await page.goto(origin + route + '?step=lesson-3&section=yellow-flowchart');
  await page.getByText('进入角位置', { exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('step') === 'lesson-4' && !url.searchParams.has('section'));
  await checkOverview('zh', 'corner-overview');
  await page.goto(origin + route + '?step=lesson-4&section=corner-flowchart');
  const flowchart = page.locator('[data-course-section="corner-flowchart"][data-tutorial-layout="G"]');
  await flowchart.waitFor();
  const cards = flowchart.locator('[data-eye-case]');
  assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-eye-case'))),
    ['headlights', 'no-headlights'], 'The headlights cards are in the wrong order');
  await flowchart.locator('[data-eye-case="headlights"]').click();
  await page.waitForURL(url => url.searchParams.get('section') === 'headlights');
  await page.getByRole('button', { name: '下一节', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('section') === 'no-headlights');

  const right = "R U R' U R U2' R'";
  const left = "L' U' L U' L' U2 L";
  const corners = "x' R2 D2 R' U' R D2 R' U R' x";
  const cases = [
    ['right-fish', 3, "U'", right],
    ['left-fish', 3, 'U', left],
    ['two-touch', 3, "U'", right],
    ['four-no-touch', 3, 'U', right],
    ['headlights', 4, 'y', corners],
    ['no-headlights', 4, '', corners],
  ];
  for (const [section, chapter, align, alg] of cases) {
    await setViewport({ width: 1440, height: 900 });
    await page.goto(`${origin}${route}?step=lesson-${chapter}&section=${section}`);
    await currentSection(section);
    await ready();
    const board = await canvas().elementHandle();
    const question = page.locator(`[data-course-section="${section}"]`);
    const advance = question.getByRole('button', { name: '继续', exact: true });
    assert.equal(await progress().count(), 0, 'The main quiz showed playback controls');
    if (section === 'right-fish') {
      await question.getByRole('button', { name: '辨识视频', exact: true }).click();
      const fishVideo = page.getByRole('dialog', { name: '辨识左鱼和右鱼', exact: true });
      await fishVideo.getByRole('slider', { name: '演示进度' }).press('End');
      await fishVideo.locator('[data-tutorial-layout="D"]').waitFor();
      await fishVideo.getByRole('button', { name: '关闭视频', exact: true }).click();
      assert.equal(await cube().getAttribute('data-move-count'), '0', 'Watching the fish video moved the quiz cube');
    }
    if (chapter === 4) {
      const heading = section === 'headlights' ? '把眼放在右面' : '做公式造眼';
      await question.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await question.getAttribute('data-course-question'), '1');
    }
    if (section === 'headlights') {
      await question.getByRole('button', { name: '什么是眼？', exact: true }).click();
      const video = page.getByRole('dialog', { name: '什么是眼？', exact: true });
      const playhead = video.getByRole('slider', { name: '演示进度' });
      await video.locator('figure[data-active="true"] canvas').waitFor();
      await video.getByText('顶面全黄以后，观察四个侧面的顶排。', { exact: true }).waitFor();
      for (let step = 0; step < 6; step++) await playhead.press('ArrowRight');
      await video.getByText('同一侧面的顶排，两格颜色相同，就是一对眼。', { exact: true }).waitFor();
      await playhead.press('End');
      await video.locator('[data-tutorial-layout="D"]').waitFor();
      assert.deepEqual(await video.locator('figcaption').allTextContents(), ['有眼', '无眼']);
      for (const viewport of [{ width: 320, height: 320 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await setViewport(viewport);
        assert(await video.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1),
          'The headlights video needs scrolling');
      }
      await video.getByRole('button', { name: '关闭视频', exact: true }).click();
      await video.waitFor({ state: 'hidden' });
      assert.equal(await cube().getAttribute('data-move-count'), '0', 'Watching the concept video moved the quiz cube');
      await setViewport({ width: 1440, height: 900 });
    }
    if (section === 'right-fish' || section === 'left-fish') {
      const heading = section === 'right-fish' ? '把右鱼的鱼头放左前' : '把左鱼的鱼头放右前';
      await question.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await question.getAttribute('data-course-question'), '1');
      await assertLayout('Yellow-face alignment ' + section, { width: 390, height: 844 });
    }
    const steps = question.getByRole('list', { name: '本节进度' }).locator('li');
    assert.deepEqual(await steps.allTextContents(), align ? ['摆到位', '做公式'] : ['做公式']);
    assert.equal(await steps.first().getAttribute('aria-current'), 'step');
    if (align) {
      const usesUFace = align.startsWith('U');
      const hintText = '这一步只转 U 面';
      const turnHint = cube().getByText(hintText, { exact: true });
      await keyboardMoves(usesUFace ? 'R' : 'x');
      assert.equal(await cube().getAttribute('data-move-count'), '0', 'Alignment accepted the wrong axis');
      if (usesUFace) {
        await turnHint.waitFor();
        assert.equal(await question.getByText(hintText, { exact: true }).count(), 0, 'The turn hint was repeated in the caption');
      }
      if (section === 'headlights') {
        const lockBadge = cube().getByText('转体已锁定', { exact: true });
        const dualTurnHint = cube().getByText('这一步只转 U 面，或做 y 方向转体', { exact: true });
        const correct = question.and(page.locator('[data-course-answer="correct"]'));
        await dualTurnHint.waitFor();
        assert.equal(await question.getByRole('button', { name: /^转体 y/ }).count(), 0, 'Alignment showed separate rotation buttons');
        assert.equal(await lockBadge.count(), 0, 'The y axis was available but the lock badge was shown');
        await keyboardMoves('R z');
        assert.equal(await cube().getAttribute('data-move-count'), '0', 'Headlights accepted an unrelated turn');

        await dragCube(.48, .07, -90, 0);
        await page.locator('[data-course-cube][data-last-move="y"]').waitFor();
        await correct.waitFor();
        assert.equal(await lockBadge.count(), 0, 'Aligning the headlights showed the lock badge');
        assert(await advance.isEnabled(), 'A y rotation did not enable Continue');
        const continueBox = await advance.boundingBox();
        await keyboardMoves('y');
        assert(await advance.isDisabled(), 'A y rotation from the goal did not disable Continue');
        await keyboardMoves("y'");
        await correct.waitFor();
        await dragCube(.49, .48, 78, 0);
        await page.locator('[data-course-cube][data-last-move="U\u0027"][data-move-count="4"]').waitFor();
        assert(await advance.isDisabled(), 'Continue stayed enabled after a U turn moved the headlights away');
        assert.deepEqual(await advance.boundingBox(), continueBox, 'The Continue button moved when the headlights left the goal');
        await keyboardMoves('y');
        await correct.waitFor();
        assert.equal(await cube().getAttribute('data-move-count'), '5', 'The last y rotation was not committed');
      } else await keyboardMoves(align);
      if (usesUFace) {
        await question.and(page.locator('[data-course-answer="correct"]')).waitFor();
        assert.equal(await advance.isEnabled(), true, 'Continue was disabled after aligning');
        await turnHint.waitFor({ state: 'hidden' });
        await setViewport({ width: 1440, height: 900 });
        const canvasBox = await canvas().boundingBox();
        await dragCube(.48, .52, 0, 70);
        await turnHint.waitFor();
        const hintBox = await turnHint.boundingBox();
        const releaseX = canvasBox.x + canvasBox.width * .48;
        const releaseY = canvasBox.y + canvasBox.height * .52 + 70;
        assert(Math.abs(hintBox.x + hintBox.width / 2 - releaseX) < 8
          && Math.abs(hintBox.y + hintBox.height - releaseY) < 16, 'The turn hint was not anchored near the mouse release');
        assert.equal(await cube().getAttribute('data-move-count'), '1', 'A non-U turn changed the cube after aligning');
        assert.equal(await advance.isEnabled(), true, 'A blocked turn disabled Continue');
        await keyboardMoves(inverseTurn(align));
        await question.and(page.locator('[data-course-answer="pending"]')).waitFor();
        assert.equal(await cube().getAttribute('data-move-count'), '2', 'U was blocked after aligning');
        assert.equal(await advance.isEnabled(), false, 'Continue stayed enabled after moving out of alignment');
        await keyboardMoves(align);
      }
      await advance.click();
    }
    const openingCount = await cube().getAttribute('data-move-count');
    await keyboardMoves('F');
    assert.equal(await cube().getAttribute('data-move-count'), openingCount, 'The quiz accepted a turn outside the algorithm');
    if (chapter === 4) {
      assert.equal(await question.getByRole('button', { name: '什么是眼？', exact: true }).count(), 0,
        'The concept video button was still present in the algorithm quiz');
      assert.equal(await question.getByRole('button', { name: /^转体 x/ }).count(), 0,
        'The x rotation showed a separate button');
    }
    if (section === 'two-touch' || chapter === 4) {
      await assertLayout('Guided ' + section, { width: 768, height: 1024 });
      await assertLayout('Guided ' + section, { width: 844, height: 390 });
      await assertLayout('Guided ' + section, { width: 320, height: 320 });
      const quizMoveCount = await question.locator('.course-alg > span').count();
      await question.getByRole('button', { name: '看公式演示', exact: true }).click();
      const demo = page.getByRole('dialog');
      await demo.getByRole('button', { name: '下一步', exact: true }).click();
      assert.equal(await demo.getByRole('listitem').count(), quizMoveCount, 'The demonstration and quiz have different move counts');
      for (const viewport of [{ width: 320, height: 320 }, { width: 844, height: 390 }]) {
        await setViewport(viewport);
        const box = await demo.boundingBox();
        assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
          'The demonstration dialog extends outside the viewport');
        assert(await demo.evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1 && dialog.scrollHeight <= dialog.clientHeight + 1),
          'The demonstration needs scrolling');
      }
      await page.keyboard.press('Escape');
      await demo.waitFor({ state: 'hidden' });
      assert.equal(await cube().getAttribute('data-move-count'), openingCount, 'The demonstration moved the quiz cube');
    }
    assert(await board.evaluate(node => node === document.querySelector('[data-course-cube] canvas')), 'The cube was replaced between questions');
    await board.dispose();
    if (section === 'no-headlights') {
      await setViewport({ width: 1440, height: 900 });
      await dragCube(.45, .45, -50, 0);
      await question.getByText("这一步做 x'", { exact: true }).waitFor();
      assert.equal(await cube().getAttribute('data-move-count'), '0', 'A wrong whole-cube drag was accepted');
      await dragCube(.45, .45, 0, 35);
      await page.locator('[data-course-cube][data-last-move="x\u0027"]').waitFor();
      await keyboardMoves(alg.slice(3));
    } else await keyboardMoves(alg);
    if (section === 'headlights') {
      await question.locator('.course-alg [aria-current="step"]').filter({ hasText: /^U$/ }).waitFor();
      await keyboardMoves('U');
    }
    await question.getByRole('heading', { name: '已完成', exact: true }).waitFor();
    await showPractice();
    await ready();
    assert.equal(await cube().getAttribute('data-complete'), 'false', 'The practice started at its goal');
    await keyboardMoves([align, alg].filter(Boolean).join(' '));
    await page.locator('[data-complete="true"]').waitFor();
  }
  await page.goto(origin + '/tutorial/2x2-lbl?lang=en&step=lesson-4&section=corner-flowchart');
  await page.locator('[data-course-section="corner-flowchart"] [data-eye-case="headlights"]').click();
  await page.getByRole('heading', { name: 'Put the headlights on the right', exact: true }).waitFor();
  await ready();
  await assertLayout('English corner alignment', { width: 390, height: 844 });
  assert.deepEqual(errors, [], 'Unexpected page errors');
  console.log('Passed all six yellow-face and corner-placement quizzes and exercises.');
}

if (lastLayerOnly) {
  try {
    await checkLastLayerChapters();
  } catch (error) {
    try { console.error('Failure screenshot:', await evidenceScreenshot('2x2-lbl-last-layer-failure')); } catch {}
    throw error;
  } finally { await browser.close(); }
}

if (!lastLayerOnly) try {
  const entry = await page.goto(origin + '/zh/tutorial?puzzle=2x2');
  assert(entry?.ok(), 'Tutorial directory failed to load (HTTP ' + entry?.status() + ')');
  await page.locator('a[href="/zh/tutorial/2x2-lbl"]').click();
  await page.waitForURL('**' + route);
  await checkOverview('zh');
  await next();
  await waitForStep('lesson-2');
  await currentSection('bottom-overview');
  await checkOverview('zh', 'bottom-overview');
  await next();
  await waitForStep('lesson-2', 'white-orange-blue');
  await ready();
  await page.getByRole('heading', { name: '找出白橙蓝角', exact: true }).waitFor();
  assert.equal(await progress().count(), 0, 'Corner identification has a progress slider');
  assert.equal(await page.locator('[data-course-transport]').count(), 0, 'Corner identification has a playback row');
  await scan('Find the first corner', 'F');
  let smallestRenderedRatio = 1;
  for (const [width, height] of [[320, 320], [390, 844], [844, 390], [1440, 900]]) {
    const result = await assertLayout('Rendered first corner', { width, height });
    const rendered = await readRenderedCube();
    const ratio = Math.min(rendered.width / result.cube.width, rendered.height / result.cube.height);
    smallestRenderedRatio = Math.min(smallestRenderedRatio, ratio);
    assert(ratio >= minRenderedCubeRatio,
      'Visible puzzle too small at ' + width + '×' + height + ': '
      + (ratio * 100).toFixed(1) + '% < ' + minRenderedCubeRatio * 100 + '%');
  }
  console.log('Rendered cube across four screenshot checks: ' + (smallestRenderedRatio * 100).toFixed(1)
    + '% minimum on either axis, ' + minRenderedCubeRatio * 100 + '% required.');

  await selectSticker(page, .04, .04);
  assert.equal(await page.locator('[data-course-answer]').getAttribute('data-course-answer'), 'pending', 'Clicking the background selected a corner');
  const originalQuestion = questionLayoutTargets();
  const originalQuestionPositions = await capturePositions(originalQuestion);
  await selectSticker(page, .34, .35);
  const wrongBubble = page.getByText('你选的是「白蓝红角」。再试一次。', { exact: true });
  await wrongBubble.waitFor();
  await assertPositionsUnchanged('Incorrect-answer bubble', originalQuestion, originalQuestionPositions);
  await assertLayout('Incorrect corner feedback', { width: 320, height: 320 });
  await wrongBubble.waitFor({ state: 'hidden', timeout: 5000 });
  await setViewport({ width: 1440, height: 900 });
  await page.reload();
  await ready();
  // Pitch is already at its upper edge. A mostly vertical drag should snap pitch.
  await dragCube(.40, .40, 52, 0);
  await dragCube(.40, .40, 20, 90, 1);
  await page.locator('[data-course-cube][data-last-move="x\'"][data-move-count="1"]').waitFor();
  await dragCube(.40, .40, -8, 0, 1);
  await page.waitForTimeout(420);
  assert.equal(await cube().getAttribute('data-move-count'), '1', 'A small horizontal adjustment triggered a second turn');
  assert((await readRenderedCube()).width > 80, 'A diagonal drag lost the cube from the viewport');

  await page.reload();
  await ready();
  const rightView = await canvas().screenshot();
  // From R 30° to just under L 30° takes 104 px at .01 radians per pixel.
  await dragCube(.38, .45, 52, 0);
  assert(!(await canvas().screenshot()).equals(rightView), 'The free view did not persist when released');
  assert.equal(await cube().getAttribute('data-move-count'), '0');
  const bounds = await canvas().boundingBox();
  const x = Math.round(bounds.x + bounds.width * .38);
  const y = Math.round(bounds.y + bounds.height * .45);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 52, y, { steps: 4 });
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'The cube snapped before 30°');
  await page.mouse.move(x + 53, y);
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'A short overdrag snapped the cube');
  await page.mouse.move(x + 72, y);
  await page.locator('[data-course-cube][data-last-move="y\'"][data-move-count="1"]').waitFor();
  await page.mouse.move(x + 110, y, { steps: 5 });
  await page.mouse.up();
  assert.equal(await cube().getAttribute('data-move-count'), '1', 'One drag committed multiple snaps');
  assert.equal(await page.locator('[data-course-answer]').getAttribute('data-course-answer'), 'pending', 'Dragging the cube submitted an answer');
  await setViewport({ width: 844, height: 390 });
  assert.equal(await cube().getAttribute('data-move-count'), '1', 'Resize cleared the identification rotation');
  await setViewport({ width: 1440, height: 900 });
  await selectSticker(page, .31, .55);
  await continueQuestion(page, 1);
  await page.locator('[data-course-question="2"][data-course-answer="pending"]').waitFor();

  await page.reload();
  await ready();
  await dragCube(.46, .47, -24, 0);
  await page.locator('[data-course-cube][data-last-move="y"][data-move-count="1"]').waitFor();
  const beforeQuestion = await canvas().elementHandle();
  await selectSticker(page, .41, .69);
  await continueQuestion(page, 1);
  const placementQuestion = page.locator('[data-course-question="2"]');
  await placementQuestion.getByRole('heading', { name: '把魔方摆到位', exact: true }).waitFor();
  assert(await canvas().evaluate((node, previous) => node === previous, beforeQuestion), 'The cube remounted when the question advanced');
  assert.equal(await cube().getAttribute('data-move-count'), '1', 'Advancing to the second question discarded the recorded turn');
  const placementProgress = placementQuestion.getByRole('list', { name: '本节进度' });
  assert.deepEqual(await placementProgress.getByRole('listitem').allTextContents(), ['认角块', '转体摆放']);
  await placementQuestion.getByText('现在在底层右前，白格朝前。', { exact: true }).waitFor();
  assert.equal(await placementQuestion.getAttribute('data-course-answer'), 'pending');
  await assertLayout('Live placement feedback', { width: 320, height: 320 });
  await setViewport({ width: 1440, height: 900 });
  await dragCube(.36, .45, 104, 0);
  await dragCube(.46, .47, 0, 30);
  await page.locator('[data-course-cube][data-move-count="2"]').waitFor();
  assert.equal(await placementQuestion.getAttribute('data-course-answer'), 'pending', 'An incorrect placement was accepted');
  await placementQuestion.getByText('现在在底层右后，白格朝下。', { exact: true }).waitFor();
  await dragCube(.46, .47, 30, 0);
  await placementQuestion.getByText('摆对了！', { exact: true }).waitFor();
  await cube().getByRole('status').filter({ hasText: '摆对了！' }).waitFor();
  await placementQuestion.getByText('现在在底层左后，白格朝下。', { exact: true }).waitFor();
  assert.equal(await cube().getAttribute('data-move-count'), '3');
  await dragCube(.46, .47, -135, 0);
  await page.locator('[data-course-cube][data-move-count="4"]').waitFor();
  await placementQuestion.getByText('现在在底层右后，白格朝下。', { exact: true }).waitFor();
  assert.equal(await placementQuestion.getAttribute('data-course-answer'), 'pending');
  await dragCube(.46, .47, 135, 0);
  await placementQuestion.getByText('摆对了！', { exact: true }).waitFor();
  assert.equal(await cube().getAttribute('data-move-count'), '5');
  await assertLayout('Placement feedback', { width: 320, height: 320 });

  await setViewport({ width: 1440, height: 900 });
  await page.reload();
  await ready();
  await dragCube(.46, .47, -24, 0);
  await page.locator('[data-course-cube][data-last-move="y"][data-move-count="1"]').waitFor();
  await dragCube(.36, .45, 104, 0);
  await dragCube(.46, .47, 0, 30);
  await page.locator('[data-course-cube][data-move-count="2"]').waitFor();
  await dragCube(.46, .47, 30, 0);
  await page.locator('[data-course-cube][data-move-count="3"]').waitFor();
  const beforeReorientation = await canvas().elementHandle();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await selectSticker(page, .25, .52);
  await continueQuestion(page, 1);
  await page.locator('[data-course-cube][data-drag-enabled="true"]').waitFor();
  const placementStatus = placementQuestion.locator('.course-question-status');
  const position = await placementStatus.innerText();
  assert.match(position, /现在在底层(右后|左前)，白格朝下。/);
  assert.equal(await placementQuestion.getAttribute('data-course-answer'), 'pending', 'A pose reached in question 1 completed question 2');
  assert.equal(await placementProgress.locator('[data-done="true"]').count(), 1);
  await placementProgress.locator('[aria-current="step"]').getByText('转体摆放').waitFor();
  await assertLayout('Reorientation prompt', { width: 390, height: 844 });
  await assertLayout('Reorientation prompt', { width: 844, height: 390 });
  await assertLayout('Reorientation prompt', { width: 320, height: 320 });
  await setViewport({ width: 1440, height: 900 });
  assert.equal(await cube().getAttribute('data-move-count'), '3', 'Automatic orientation was recorded as a student move');
  assert(await canvas().evaluate((node, previous) => node === previous, beforeReorientation), 'Reorientation remounted the cube');
  assert.equal(await placementQuestion.getAttribute('data-course-answer'), 'pending', 'The scripted turn was accepted as an answer');
  await dragCube(.46, .47, position.includes('右后') ? 135 : -135, 0);
  await placementQuestion.getByText('摆对了！', { exact: true }).waitFor();
  await cube().getByRole('status').filter({ hasText: '摆对了！' }).waitFor();
  assert.equal(await placementProgress.locator('[data-done="true"]').count(), 2);
  assert.equal(await cube().getAttribute('data-move-count'), '4');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  console.log('Placement from an already correct pose passed.');

  await next();
  await waitForStep('lesson-2', 'white-blue-red');
  await ready();
  const turnExploration = page.locator('[data-course-turn-exploration]');
  const continueAfterTurns = turnExploration.getByRole('button', { name: '继续', exact: true });
  const quizProgress = page.getByRole('list', { name: '本节进度', exact: true });
  const activeQuiz = quizProgress.locator('[aria-current="step"]');
  assert.deepEqual(await quizProgress.getByRole('listitem').allTextContents(), ['试转三面', '把角块移到左前', '上勾下回']);
  assert.equal(await activeQuiz.textContent(), '试转三面');
  assert.equal(await quizProgress.locator('[data-done="true"]').count(), 0);
  assert(await continueAfterTurns.isDisabled(), 'The intro can be skipped without trying any faces');
  await scan('White–blue–red free face turns', 'F');
  await setViewport({ width: 1440, height: 900 });
  const initialTurnView = await canvas().screenshot();
  await dragCube(.06, .06, -22, -16);
  assert(!(await canvas().screenshot()).equals(initialTurnView), 'Dragging empty space did not adjust the view');
  await dragCube(.06, .06, 130, 130);
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'Dragging empty space turned the whole cube');
  assert((await canvas().screenshot()).equals(initialTurnView), 'Dragging empty space exceeded the view limits');
  for (const face of ['B', 'D']) {
    await keyboardMoves(face);
    assert.equal(await turnExploration.getAttribute('data-blocked-face'), face);
    assert.equal(await cube().getAttribute('data-move-count'), '0', 'Keyboard input committed a protected face');
  }
  const trialBounds = await canvas().boundingBox();
  const cappedFraming = Math.min(trialBounds.width, trialBounds.height) > 380;
  const dragX = trialBounds.x + trialBounds.width * (cappedFraming ? .42 : .40);
  const dragY = trialBounds.y + trialBounds.height * .50;
  const restingFrame = await canvas().evaluate(node => node.toDataURL());
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragX, dragY + 70, { steps: 6 });
  try {
    await page.waitForFunction(frame => document.querySelector('[data-course-cube] canvas').toDataURL() !== frame, restingFrame);
  } finally {
    await page.mouse.up();
  }
  const springBackHint = cube().getByText('转 L 面会带动已摆好的白橙蓝角。', { exact: true });
  await springBackHint.waitFor();
  await page.waitForFunction(frame => document.querySelector('[data-course-cube] canvas').toDataURL() === frame, restingFrame);
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'The spring-back recorded a move');
  await springBackHint.waitFor({ state: 'hidden', timeout: 5000 });
  await dragCube(.55, .46, 75, 0);
  await turnExploration.locator('[data-face="U"][data-tried="true"]').waitFor();
  const top = await cube().getAttribute('data-last-move');
  await page.keyboard.down('Alt');
  try {
    await dragCube(.70, .52, 0, 70);
  } finally {
    await page.keyboard.up('Alt');
  }
  await turnExploration.locator('[data-face="R"][data-tried="true"]').waitFor();
  const right = await cube().getAttribute('data-last-move');
  await dragCube(cappedFraming ? .35 : .31, cappedFraming ? .47 : .46, 0, 67);
  await turnExploration.locator('[data-face="F"][data-tried="true"]').waitFor();
  const front = await cube().getAttribute('data-last-move');
  assert.equal(await page.locator('[data-course-question="2"]').count(), 0, 'The second quiz opened automatically');
  assert.equal(await activeQuiz.getAttribute('data-done'), 'true', 'The first quiz was not marked complete');
  await keyboardMoves('B');
  assert.equal(await cube().getAttribute('data-move-count'), '3', 'A blocked attempt changed the tried faces');
  await keyboardMoves([inverseTurn(front), inverseTurn(right), inverseTurn(top), 'U'].join(' '));
  const firstQuizCanvas = await canvas().elementHandle();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await setViewport({ width: 320, height: 320 });
  await continueAfterTurns.click();
  const alignment = page.locator('[data-course-question="2"]');
  await alignment.and(page.locator('[data-corner-reveal="1"]')).waitFor();
  assert(await quizProgress.evaluate(node => node.closest('[data-course-caption]').scrollTop === 0),
    'The second quiz inherited the first quiz’s scroll position');
  assert.equal(await activeQuiz.textContent(), '把角块移到左前');
  assert.equal(await quizProgress.locator('[data-done="true"]').count(), 1);
  assert(await firstQuizCanvas.evaluate(node => node === document.querySelector('[data-course-cube] canvas')), 'Quiz 2 remounted the cube');
  await firstQuizCanvas.dispose();
  assert.equal(await cube().getAttribute('data-move-count'), '7', 'Quiz 2 lost the first quiz’s turn history');
  const alignmentHeading = alignment.getByRole('heading', { name: '把白蓝红角移到左前方', exact: true });
  await alignmentHeading.waitFor();
  await alignment.getByText(/^现在在顶层(左后|右后|右前)/).waitFor();
  assert.equal(await alignment.getAttribute('data-course-answer'), 'pending', 'Quiz 2 accepted a corner already in place at entry');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  console.log('Free face turns and state-preserving corner reveal passed.');
  assert.equal(await progress().count(), 0, 'The white–blue–red quiz still showed a video');
  await scan('White–blue–red quiz', 'F');
  await setViewport({ width: 1440, height: 900 });
  await dragCube(.06, .06, -24, -15);
  assert.equal(await cube().getAttribute('data-move-count'), '7', 'Inspecting the cube recorded a whole-cube turn');
  await keyboardMoves('L');
  assert.equal(await cube().getAttribute('data-move-count'), '7', 'Quiz 2 committed a protected turn');
  const slotHint = alignment.getByRole('button', { name: '哪里是左前方？', exact: true });
  assert.equal(await visibleSlotHintPixels(), 0, 'The corner hint appeared without a request');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  try {
    await slotHint.evaluate(button => button.click());
    await page.clock.runFor(64);
    assert(await visibleSlotHintPixels() > 1500, 'The two violet corners did not render');
    await dragCube(.06, .06, 16, 9);
    await page.clock.runFor(64);
    assert(await visibleSlotHintPixels() > 100, 'Adjusting the view dismissed the corner hint');
  } finally {
    await page.clock.resume();
  }
  const originalPrompt = await alignment.locator('p').first().innerText();
  const alignedHeading = alignment.getByRole('heading', { name: '完成，可以继续', exact: true });
  for (let index = 0; index < 3 && !await alignedHeading.isVisible(); index++) {
    const previous = await alignment.locator('.course-question-status').innerText();
    await keyboardMoves('U');
    await alignment.getByText(previous, { exact: true }).waitFor({ state: 'hidden' });
  }
  await alignment.getByText(/^现在在顶层左前/).waitFor();
  assert.equal(await visibleSlotHintPixels(), 0, 'The corner hint stayed visible after a turn');
  await alignedHeading.waitFor();
  assert.equal(await quizProgress.locator('[data-done="true"]').count(), 2);
  await assertLayout('Front-left alignment result', { width: 320, height: 320 });
  await keyboardMoves('U');
  await alignmentHeading.waitFor();
  assert.equal(await alignment.locator('p').first().innerText(), originalPrompt, 'Leaving the target did not restore the original prompt');
  assert.equal(await alignment.getAttribute('data-course-answer'), 'pending', 'Leaving the target left the completion state active');
  assert.equal(await quizProgress.locator('[data-done="true"]').count(), 1, 'Leaving the target kept its progress check');
  const continueToInsertion = alignment.getByRole('button', { name: '继续', exact: true });
  assert(await continueToInsertion.isDisabled(), 'Quiz 3 can start with the corner outside the two goal slots');
  await keyboardMoves("U'");
  await alignment.getByText(/^现在在顶层左前/).waitFor();
  await alignment.getByRole('heading', { name: '完成，可以继续', exact: true }).waitFor();
  assert(await continueToInsertion.isEnabled(), 'Returning to a goal slot did not re-enable Continue');

  const alignmentCanvas = await canvas().elementHandle();
  const alignedFrame = await alignmentCanvas.evaluate(node => node.toDataURL());
  const alignmentMoves = await cube().getAttribute('data-move-count');
  await alignment.getByRole('button', { name: '继续', exact: true }).click();
  const insertion = page.locator('[data-course-question="3"]');
  await insertion.locator('.course-alg').getByText("L' U' L U", { exact: true }).waitFor();
  assert.equal(await activeQuiz.textContent(), '上勾下回');
  assert.equal(await cube().getAttribute('data-move-count'), alignmentMoves, 'Quiz 3 lost the second quiz’s turn history');
  assert(await alignmentCanvas.evaluate(node => node === document.querySelector('[data-course-cube] canvas')), 'Quiz 3 remounted the cube');
  await page.waitForFunction(frame => document.querySelector('[data-course-cube] canvas').toDataURL() !== frame, alignedFrame);
  await alignmentCanvas.dispose();
  await assertLayout('Left-hand trigger quiz', { width: 320, height: 320 });
  assert.equal(await insertion.getAttribute('data-course-answer'), 'pending', 'Aligning the corner completed the insertion quiz');
  await keyboardMoves('L U');
  assert.equal(await cube().getAttribute('data-move-count'), alignmentMoves, 'Quiz 3 accepted the wrong face or direction');
  assert.equal((await insertion.locator('.course-alg [aria-current]').textContent()).trim(), "L'");
  await setViewport({ width: 1440, height: 900 });
  const guidedFrame = await canvas().evaluate(node => node.toDataURL());
  await dragCube(.55, .46, 75, 0);
  await cube().getByText("这一步转 L'", { exact: true }).waitFor();
  await page.waitForFunction(frame => document.querySelector('[data-course-cube] canvas').toDataURL() === frame, guidedFrame);
  assert.equal(await cube().getAttribute('data-move-count'), alignmentMoves, 'A rejected drag moved the puzzle');

  const teach = insertion.getByRole('button', { name: '教我上勾下回', exact: true });
  await teach.click();
  const demo = page.getByRole('dialog', { name: '左手上勾下回', exact: true });
  await demo.locator('canvas').waitFor();
  await demo.locator('[data-demo-ready="true"]').waitFor({ timeout: 120000 });
  assert.deepEqual(await demo.locator('.course-demo-cues li span').allTextContents(), ['上', '勾', '下', '回']);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 320 }]) {
    await setViewport(viewport);
    const bounds = await demo.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y >= 0
      && bounds.y + bounds.height <= viewport.height, 'The demonstration dialog exceeds the viewport');
    assert(await demo.evaluate(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1),
      'The demonstration dialog needs scrolling');
  }
  await demo.getByRole('button', { name: '下一步', exact: true }).click();
  await demo.locator('.course-demo-cues [aria-current]').getByText('上', { exact: true }).waitFor();
  await demo.getByRole('button', { name: /^勾 U'/ }).click();
  await demo.locator('.course-demo-cues [aria-current]').getByText('勾', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await demo.waitFor({ state: 'hidden' });
  assert.equal(await cube().getAttribute('data-move-count'), alignmentMoves, 'Watching the demonstration changed the puzzle');
  await teach.click();
  await demo.waitFor();
  await page.mouse.click(2, 2);
  await demo.waitFor({ state: 'hidden' });

  await keyboardMoves("L'");
  assert.equal((await insertion.locator('.course-alg [aria-current]').textContent()).trim(), "U'");
  await keyboardMoves('U');
  assert.equal(await cube().getAttribute('data-move-count'), String(Number(alignmentMoves) + 1), 'Quiz 3 accepted the second turn in reverse');
  assert.equal(await cube().locator('[data-course-round-bubble]').count(), 0, 'A partial round showed a completion bubble');
  await keyboardMoves("U' L U");
  await insertion.getByRole('heading', { name: '白蓝红角归位了！', exact: true }).waitFor();
  await cube().getByText('已完成 1 次', { exact: true }).waitFor();
  assert.equal(await quizProgress.locator('[data-done="true"]').count(), 3);

  await next();
  await waitForStep('lesson-2', 'white-red-green');
  await ready();
  await setViewport({ width: 1440, height: 900 });
  assert.deepEqual(await quizProgress.getByRole('listitem').allTextContents(), ['试转两面', '把角块移到右前', '右手上勾下回']);
  await scan('White–red–green free turns', 'F');
  const tryTwoFaces = page.locator('[data-course-turn-exploration]');
  const continueRight = tryTwoFaces.getByRole('button', { name: '继续', exact: true });
  const twoFaceTargets = {
    ...questionLayoutTargets(continueRight),
    topFace: tryTwoFaces.locator('[data-face="U"] code'),
    rightFace: tryTwoFaces.locator('[data-face="R"] code'),
  };
  const beforeTryingFaces = await capturePositions(twoFaceTargets);
  await keyboardMoves('F');
  await cube().getByText('转 F 面会带动前两个已归位的角块。', { exact: true }).waitFor();
  assert.equal(await cube().getAttribute('data-move-count'), '0');
  await keyboardMoves('U');
  await tryTwoFaces.locator('[data-face="U"][data-tried="true"]').waitFor();
  await assertPositionsUnchanged('First free-turn feedback', twoFaceTargets, beforeTryingFaces);
  assert(await continueRight.isDisabled(), 'One face was enough to complete the third corner opening');
  await keyboardMoves("R R' U'");
  await tryTwoFaces.locator('[data-face="R"][data-tried="true"]').waitFor();
  await assertPositionsUnchanged('Completed free-turn feedback', twoFaceTargets, beforeTryingFaces);
  await continueRight.click();
  assert.equal(await cube().getAttribute('data-move-count'), '4');
  const rightAlignment = page.locator('[data-course-question="2"]');
  await rightAlignment.getByRole('button', { name: '哪里是右前方？', exact: true }).waitFor();
  await scan('White–red–green alignment', 'F');
  await keyboardMoves("U'");
  await rightAlignment.getByRole('button', { name: '继续', exact: true }).click();
  await assertLayout('White–red–green insertion', { width: 320, height: 320 });
  await keyboardMoves("R U R' U' R U R' U'");
  await cube().getByText('已完成 1 次，继续', { exact: true }).waitFor();
  await cube().getByText('已完成 2 次，继续', { exact: true }).waitFor();
  await keyboardMoves("R U R' U'");
  await page.getByRole('heading', { name: '白红绿角归位了！', exact: true }).waitFor();
  await cube().getByText('已完成 3 次', { exact: true }).waitFor();

  await next();
  await waitForStep('lesson-2', 'white-green-orange');
  await ready();
  await scan('White–green–orange reorientation', 'F');
  await setViewport({ width: 1440, height: 900 });
  const continueRotation = page.locator('[data-course-turn-exploration]').getByRole('button', { name: '继续', exact: true });
  const slotFeedback = page.getByText('空位到了右前，接下来就能用右手「上勾下回」。', { exact: true });
  const rotationTargets = questionLayoutTargets(continueRotation);
  const beforeRotation = await capturePositions(rotationTargets);
  const originalView = await canvas().screenshot();
  await dragCube(.38, .45, 52, 0);
  assert(!(await canvas().screenshot()).equals(originalView), 'The last corner did not allow a free viewing adjustment');
  const rotationBounds = await canvas().boundingBox();
  const rotationX = Math.round(rotationBounds.x + rotationBounds.width * .38);
  const rotationY = Math.round(rotationBounds.y + rotationBounds.height * .45);
  await page.mouse.move(rotationX, rotationY);
  await page.mouse.down();
  await page.mouse.move(rotationX - 52, rotationY, { steps: 4 });
  await page.waitForTimeout(420);
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'The last corner snapped before passing 30°');
  await page.mouse.move(rotationX - 53, rotationY);
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'A short overdrag rotated the last corner');
  await page.mouse.move(rotationX - 72, rotationY);
  await page.locator('[data-course-cube][data-last-move="y"][data-move-count="1"]').waitFor();
  await page.mouse.move(rotationX - 100, rotationY);
  await page.mouse.up();
  await page.waitForTimeout(420);
  assert.equal(await cube().getAttribute('data-move-count'), '1', 'One drag committed multiple snaps');
  assert(await continueRotation.isEnabled(), 'The leftward snap did not move the slot to the required corner');
  await slotFeedback.waitFor();
  await assertPositionsUnchanged('Desktop rotation feedback appeared', rotationTargets, beforeRotation);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 320 }]) {
    await setViewport(viewport);
    const mode = 'Rotation feedback ' + viewport.width + '×' + viewport.height;
    const withFeedback = await capturePositions(rotationTargets);
    await keyboardMoves("y'");
    await slotFeedback.waitFor({ state: 'hidden' });
    assert(await continueRotation.isDisabled(), 'The opposite rotation moved the slot to the required corner');
    await assertPositionsUnchanged(mode + ' disappeared', rotationTargets, withFeedback);
    await keyboardMoves('y');
    await slotFeedback.waitFor();
    await assertPositionsUnchanged(mode + ' reappeared', rotationTargets, withFeedback);
  }
  const rotationCount = await cube().getAttribute('data-move-count');
  await continueRotation.click();
  const lastAlignment = page.locator('[data-course-question="2"]');
  await lastAlignment.getByRole('heading', { name: '把白绿橙角移到空位上方', exact: true }).waitFor();
  await keyboardMoves('R');
  await cube().getByText('转 R 面会带动已经归位的角块。', { exact: true }).waitFor();
  assert.equal(await cube().getAttribute('data-move-count'), rotationCount);
  await scan('White–green–orange alignment', 'F');
  await keyboardMoves('U');
  await lastAlignment.getByRole('button', { name: '继续', exact: true }).click();
  await assertLayout('White–green–orange insertion', { width: 320, height: 320 });
  await keyboardMoves("R U R' U'");
  await page.getByText('底层完成。底面全白，四个侧面的底排也各自同色。', { exact: true }).waitFor();
  await setViewport({ width: 390, height: 844 });
  const sectionMenu = page.locator('.course-section-picker summary');
  await sectionMenu.click();
  const popover = await page.locator('.course-section-picker .tutorial-section-popover').boundingBox();
  assert(popover && popover.x >= 0 && popover.x + popover.width <= 390, 'Mobile menu exceeds the viewport');
  await page.locator('.course-section-picker [aria-current="page"]').waitFor();
  await sectionMenu.click();

  await page.getByRole('button', { name: '上一节' }).click();
  await currentSection('white-red-green');
  await page.getByRole('button', { name: '上一节' }).click();
  await currentSection('white-blue-red');
  await page.getByRole('button', { name: '上一节' }).click();
  await currentSection('white-orange-blue');
  await showPractice();
  await ready();
  assert.match(await canvas().evaluate(node => getComputedStyle(node).backgroundImage), /radial-gradient/);
  assert(await page.getByRole('button', { name: '上一节' }).isDisabled(), 'First exercise can navigate to the introduction');
  await scan('Positioning practice', 'F');
  await setViewport({ width: 680, height: 810 });
  await dragCube(.5, .5, 65, 0);
  await page.locator('[data-last-move^="y"]').waitFor();
  assert.equal(await cube().getAttribute('data-complete'), 'false', 'Turning the wrong axis completed the positioning exercise');
  const count = await cube().getAttribute('data-move-count');
  await setViewport({ width: 844, height: 390 });
  assert.equal(await cube().getAttribute('data-move-count'), count, 'Resizing discarded a committed whole-cube move');
  await setViewport({ width: 680, height: 810 });
  await restart();
  await dragCube(.07, .25, 0, 65);
  await page.locator('[data-last-move^="x"]').waitFor();
  assert.equal(await cube().getAttribute('data-complete'), 'false', 'An x rotation completed the positioning exercise');
  await restart();
  await dragCube(.94, .25, 0, 65);
  await page.locator('[data-last-move^="z"]').waitFor();
  await page.locator('[data-complete="true"]').waitFor();

  await next();
  await ready();
  assert.equal(await cube().getAttribute('data-complete'), 'false', 'The insertion started solved');
  await cube().press('x');
  await dragCube(.05, .05, 100, 0);
  assert.equal(await cube().getAttribute('data-move-count'), '0', 'The fixed-orientation exercise accepted a whole-cube turn');
  await keyboardMoves("U L' U' L U");
  await page.locator('[data-complete="true"]').waitFor();

  await review();
  await skipUnfinishedSection();
  await waitForStep('lesson-2', 'white-red-green');
  await currentSection('white-red-green');
  await page.getByRole('heading', { name: '现在还有哪些面可以自由转？', exact: true }).waitFor();
  await skipUnfinishedSection();
  await waitForStep('lesson-2', 'white-green-orange');
  await currentSection('white-green-orange');
  await page.getByRole('heading', { name: '把右后的空位转到右前', exact: true }).waitFor();
  await skipUnfinishedSection();
  await waitForStep('lesson-2', 'bottom-flowchart');
  await currentSection('bottom-flowchart');
  assert.equal(await page.locator('[data-course-section="bottom-flowchart"] button').count(), 4);
  await page.getByRole('button', { name: '上一节' }).click();
  await currentSection('white-red-green');
  await showPractice();
  await ready();
  await keyboardMoves("U' R U R' U'");
  assert.equal(await cube().getAttribute('data-complete'), 'false', 'An unsolved white–red–green corner was accepted');
  await keyboardMoves("R U R' U' R U R' U'");
  await page.locator('[data-complete="true"]').waitFor();
  await next();
  await currentSection('white-green-orange');
  await ready();
  await keyboardMoves('y U');
  assert.equal(await cube().getAttribute('data-complete'), 'false', 'A first layer with a missing corner was accepted');
  await keyboardMoves("R U R' U'");
  await page.locator('[data-complete="true"]').waitFor();

  await checkLastLayerChapters();

  await checkLessonLinks();
  await page.goto(origin + '/tutorial/2x2-lbl?lang=en');
  await checkOverview('en');
  await page.getByRole('button', { name: 'Next section' }).click();
  await checkOverview('en', 'bottom-overview');
  await page.getByRole('button', { name: 'Next section' }).click();
  await ready();
  for (const [width, height] of examples) await assertLayout('English', { width, height });
  await setViewport({ width: 320, height: 320 });
  assert(await page.locator('[data-course-caption]').evaluate(node => node.scrollHeight <= node.clientHeight + 1),
    'The first English caption needs scrolling at 320×320');
  if (!useWebKit) await checkTouchRotation();
  await checkInteractiveAnimations();
  assert.deepEqual(errors, [], 'Unexpected page errors');
  console.log('Passed: corner questions and named wrong answers, whole-cube drag, lesson navigation and layout, and all exercise goals.');
  if (!useWebKit) console.log('Passed: all three corner questions on touch, touch rotation, and persistence across viewport orientations.');
} catch (error) {
  try { console.error('Failure screenshot:', await evidenceScreenshot('2x2-lbl-layout-failure')); } catch {}
  throw error;
} finally {
  await browser.close();
}
