// Read-only visual inventory; suspected decoration is reported, never auto-removed.
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { unframedSurfaces } from './site-surface-policy.mts';

const args = process.argv.slice(2);
const option = (key: string, fallback: string) => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const output = option('output', join(tmpdir(), 'cuberoot-surface-audit'));
const theme = option('theme', 'dark');
if (!['light', 'dark'].includes(theme)) throw new Error('--theme must be light or dark');
const width = Number(option('width', '1440'));
if (!Number.isFinite(width) || width < 320 || width > 2560) throw new Error('--width must be 320–2560');
const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const primaryRoutes = ['/zh', '/zh/wca', '/zh/wca/comp?year=2026&month=10&country=cn', '/zh/wca/comp?view=list', '/zh/wca/records', '/zh/wca/fun-stats', '/zh/wca/prediction', '/zh/recon', '/zh/scramble/gen', '/zh/scramble/stats', '/zh/sim', '/zh/alg/3x3', '/zh/site', '/zh/appearance', '/zh/wb', '/zh/about', '/zh/wiki', '/zh/teachers', '/zh/cube-history', '/zh/math/god', '/zh/math/probability', '/zh/alg/commutator'];
const staticRoutes = args.includes('--all-static') ? readdirSync(join(root, 'app/[lang]'), { recursive: true, encoding: 'utf8' })
  .filter(path => /(^|\/)page\.tsx$/.test(path) && !path.split('/').some(part => part.startsWith('[') || part.startsWith('_')))
  .map(path => '/zh/' + path.replace(/\/?page\.tsx$/, '').split('/').filter(part => !part.startsWith('(')).join('/')) : [];
const routes = [...new Set(args.filter(arg => arg.startsWith('/')).length
  ? args.filter(arg => arg.startsWith('/'))
  : [...primaryRoutes, ...unframedSurfaces.map(policy => policy.route).filter(Boolean), ...staticRoutes])];
mkdirSync(output, { recursive: true });

type Finding = { selector: string; target: string; text: string; reason: string; count: number; known: boolean; screenshot?: string };
const report: { route: string; findings: Finding[]; missing: string[]; error?: string }[] = [];
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function save() {
  writeFileSync(join(output, 'report.json'), JSON.stringify({ theme, width, routes: report }, null, 2));
  writeFileSync(join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Surface audit</title>
    <h1>布局背景巡检</h1><p>${escape(theme)} · ${width}px · ${report.length}/${routes.length} 页。可疑项需要人工确认；图片最多展示每页前 8 类，其余仍列在报告中。错误包含请求失败或已登记规则回归。</p>
    ${report.map(row => `<section><h2><a href="${escape(base + row.route)}">${escape(row.route)}</a></h2>
      ${row.error ? `<p role="alert">${escape(row.error)}</p>` : ''}
      ${row.missing.length ? `<p>未挂载，不能算通过：${escape(row.missing.join(', '))}</p>` : ''}
      ${row.findings.map(f => `<article><h3>${f.known ? '规则回归' : '待确认'}：${escape(f.selector)} (${f.count})</h3><p>${escape(f.text)} — ${escape(f.reason)}</p>${f.screenshot ? `<img width="720" style="max-width:100%" src="${escape(f.screenshot)}">` : '<p>无截图，见选择器。</p>'}</article>`).join('') || '<p>没有发现符合本次扫描条件的可疑外层。</p>'}</section>`).join('')}`);
}

const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER_CHANNEL ?? 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme as 'light' | 'dark', locale: 'zh-CN' });
  await context.addInitScript(theme => {
    if (window !== top) return;
    localStorage.setItem('theme', theme);
    localStorage.setItem('home-background.v1.dark', '01');
    localStorage.setItem('home-background.v1.light', '01');
  }, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  for (const route of routes) {
    const row: typeof report[number] = { route, findings: [], missing: [] };
    try {
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
      await page.waitForFunction(() => !!document.body.dataset.siteScenery);
      await page.waitForTimeout(400);
      if (route.includes('/wca/results?events=')) {
        const toggle = page.locator('.sor-census-toggle').first();
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        await page.locator('.sor-race-bar').waitFor();
      }
      if (route.includes('/wca/persons/')) {
        await page.getByRole('button', { name: '分布', exact: true }).click();
        await page.locator('.viz-page .toolbar').waitFor();
      }
      const expected = unframedSurfaces.filter(policy => policy.route.split('?')[0] === route.split('?')[0]);
      for (const policy of expected) {
        try { await page.locator(policy.selector).first().waitFor({ state: 'visible', timeout: 5000 }); }
        catch { row.missing.push(policy.selector); }
      }
      row.findings = await page.evaluate(policies => {
        const findings = new Map<string, Finding>();
        // Inspect structure as well as known names, so a newly named wrapper
        // around controls can still appear in the review inventory.
        const candidates = new Set(document.querySelectorAll('header,nav,h2,h3,div,section,form'));
        for (const policy of policies) for (const element of document.querySelectorAll(policy.selector)) candidates.add(element);
        for (const element of candidates) {
          const policy = policies.find(policy => element.matches(policy.selector));
          const rect = element.getBoundingClientRect();
          if (!policy && (rect.width < 160 || rect.height < 8 || rect.height > 280 || element.closest('table,[role="dialog"],[role="menu"],[role="listbox"]'))) continue;
          if (element.matches('button,input,select,a')) continue;
          if (!policy && !element.matches('header,nav,h2,h3') && element.querySelectorAll('button,input,select').length < 2) continue;
          const painted: string[] = [];
          for (const pseudo of [null, '::before', '::after']) {
            const style = getComputedStyle(element, pseudo);
            if (pseudo && ['none', 'normal'].includes(style.content)) continue;
            const fills = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none';
            const border = ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && style.getPropertyValue(`border-${side.toLowerCase()}-color`) !== 'rgba(0, 0, 0, 0)');
            const shadow = style.boxShadow !== 'none';
            if (border || shadow || fills) painted.push(`${pseudo ?? 'element'}: ${[fills && '背景', border && '边框', shadow && '阴影'].filter(Boolean).join('/')}`);
          }
          if (!painted.length) continue;
          const selector = policy?.selector ?? element.tagName.toLowerCase() + [...element.classList].map(name => '.' + CSS.escape(name)).join('');
          const identity = selector + painted.join();
          const existing = findings.get(identity);
          if (existing) { existing.count++; continue; }
          const id = String(findings.size);
          element.setAttribute('data-surface-audit', id);
          // Heading fills remain review candidates, not automatic violations.
          const known = !!policy && (policy.kind === 'scenery-content'
            ? document.body.hasAttribute('data-site-scenery')
            : policy.kind === 'container' || painted.some(reason => reason.includes('边框')));
          findings.set(identity, { selector, target: `[data-surface-audit="${id}"]`, text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 100), reason: painted.join('; '), count: 1, known });
        }
        return [...findings.values()];
      }, expected);
      for (const [index, finding] of row.findings.slice(0, 8).entries()) {
        const element = page.locator(finding.target);
        try {
          await element.scrollIntoViewIfNeeded();
          await element.evaluate(element => (element as HTMLElement).style.outline = '3px solid var(--accent)');
          finding.screenshot = `${report.length}-${index}.png`;
          await page.screenshot({ path: join(output, finding.screenshot) });
          await element.evaluate(element => (element as HTMLElement).style.removeProperty('outline'));
        } catch { finding.screenshot = undefined; }
      }
    } catch (error) { row.error = String(error); }
    report.push(row);
    save();
    console.log(JSON.stringify({ route, candidates: row.findings.length, regressions: row.findings.filter(f => f.known).length, missing: row.missing, error: row.error }));
  }
  await context.close();
} finally { await browser.close(); }
console.log(`Report: ${join(output, 'index.html')}`);
if (report.some(row => row.error || row.missing.length || row.findings.some(finding => finding.known))) process.exitCode = 1;
