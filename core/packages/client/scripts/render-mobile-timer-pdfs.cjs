const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const previewUrl = process.argv[2] || 'http://127.0.0.1:5187/';
const preflightOnly = process.env.TIMER_PDF_PREFLIGHT === '1';
const outputDirectory = path.resolve(
  process.argv[3] || path.join(__dirname, '../../../../output/pdf'),
);

function fixtureSolves(language) {
  const scrambles = [
    "R U R' U' F2 D L2 B2 R2 U2 F' L' D2",
    "F2 L2 D2 B2 U R2 F' U2 L D' B R2",
    "U2 R2 F2 D2 L2 B2 U' F R' D L2 U2",
  ];
  return Array.from({ length: 36 }, (_, index) => {
    const number = index + 1;
    const penalty = number % 13 === 0
      ? 'DNS'
      : number % 11 === 0
        ? 'DNF'
        : number % 7 === 0
          ? '+2'
          : 'ok';
    const qa = `QA${String(number).padStart(2, '0')}`;
    const comment = language === 'zh'
      ? `${qa} 中文分页验收：长备注必须完整换行，不能遮挡、截断或溢出。\n第二行保留。`
      : `${qa} English pagination QA: this long comment must wrap without clipping, overlap, or overflow.\nKeep this second line.`;
    return {
      id: `pdf-${language}-${String(number).padStart(2, '0')}`,
      timeMs: 8_500 + index * 173,
      penalty,
      scramble: `${scrambles[index % scrambles.length]} ${qa}`,
      event: '333',
      ts: Date.UTC(2026, 7, 1 + index, 17, index % 60, 0),
      comment,
    };
  });
}

async function seedTimer(page, language) {
  const manualScramble = "R U R' U' F2 D L2 B2 R2 U2";
  await page.evaluate(async ({ fixtureLanguage, solves, manual }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('cuberoot-mobile', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open timer database'));
    });
    try {
      const data = await new Promise((resolve, reject) => {
        const transaction = database.transaction('app-state', 'readonly');
        const request = transaction.objectStore('app-state').get('timer');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not read timer data'));
      });
      if (!data) throw new Error('Timer data was not initialized');
      data.settings.language = fixtureLanguage;
      data.settings.event = '333';
      data.settings.manualScrambles = manual;
      const sessionId = data.database.activeSessionId;
      const session = data.database.sessions.find((item) => item.id === sessionId);
      if (session) session.name = fixtureLanguage === 'zh' ? 'PDF 验收分组' : 'PDF QA session';
      data.database.dataBySession[sessionId]['333'] = solves;
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('app-state', 'readwrite');
        transaction.objectStore('app-state').put(data, 'timer');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Could not seed timer data'));
        transaction.onabort = () => reject(transaction.error || new Error('Timer seed was aborted'));
      });
    } finally {
      database.close();
    }
  }, { fixtureLanguage: language, solves: fixtureSolves(language), manual: manualScramble });
}

async function renderLanguage(browser, language) {
  const isChinese = language === 'zh';
  const context = await browser.newContext({
    locale: isChinese ? 'zh-CN' : 'en-US',
    timezoneId: 'America/Los_Angeles',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__timerPrintCalled = false;
    window.print = () => { window.__timerPrintCalled = true; };
  });

  await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell').waitFor();
  await seedTimer(page, language);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell').waitFor();

  const sourceLabel = isChinese ? '打乱来源' : 'Scramble source';
  const manualLabel = isChinese ? '手动输入' : 'Manual input';
  await page.getByRole('button', { name: sourceLabel }).click();
  await page.getByRole('option', { name: manualLabel }).click();
  await page.locator('.scramble-text').filter({ hasText: "R U R' U'" }).waitFor();

  await page.getByRole('button', { name: isChinese ? '更多' : 'More' }).click();
  await page.getByRole('menuitem', { name: isChinese ? '打印' : 'Print' }).click();
  await page.waitForFunction(() => window.__timerPrintCalled === true);
  await page.waitForFunction(() => document.body.classList.contains('timer-printing'));
  await page.locator('.timer-print-document').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });

  const geometry = await page.locator('.timer-print-document').evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  if (geometry.width <= 0 || geometry.scrollWidth > geometry.width) {
    throw new Error(`${language} print overflow: ${JSON.stringify(geometry)}`);
  }
  const bodyChildren = await page.locator('body > *').evaluateAll((elements) => elements.map((element) => ({
    className: element.className,
    display: getComputedStyle(element).display,
  })));
  const visibleNonPortal = bodyChildren.filter((item) => (
    !String(item.className).includes('timer-print-portal') && item.display !== 'none'
  ));
  if (visibleNonPortal.length > 0) {
    throw new Error(`${language} global print isolation failed: ${JSON.stringify(visibleNonPortal)}`);
  }

  const outputPath = path.join(outputDirectory, `cuberoot-timer-${language}.pdf`);
  if (!preflightOnly) {
    await page.pdf({
      path: outputPath,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    });
  }
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.waitForFunction(() => !document.body.classList.contains('timer-printing'));
  await context.close();
  return { language, outputPath, geometry };
}

(async () => {
  mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const results = [];
    for (const language of ['zh', 'en']) results.push(await renderLanguage(browser, language));
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
