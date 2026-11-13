// @vitest-environment jsdom
// Real Chromium layout over the production React rows and production CSS.
// No Next server, credentials or remote API; grouping is a fixed projection.
import { act, createElement as h, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { AlgEntry } from '@cuberoot/shared/alg';

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/CubeKeyboardSection', () => ({ default: () => null }));
vi.mock('@/components/AlgMirrorPanel', () => ({ default: () => null, hasMirror: () => false }));
vi.mock('@/lib/f2l-solution-groups', () => ({ groupF2lSolutions: async () => ({
  groups: [{ key: 'pair', prefix: "U' R U R'", sourceIndices: [0, 2], options: [] }], ungrouped: [1],
}) }));
import AlgEditor from '@/components/AlgEditor';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import F2lSolutionGroups from '@/components/F2lSolutionGroups';

let browser: Browser;
beforeAll(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
});
afterAll(async () => { await browser?.close(); vi.unstubAllGlobals(); });

const css = ['app/[lang]/alg/alg.css', 'components/alg-formula-row.css', 'components/alg-tag-label.css', 'components/alg-input.css', '../timer-ui/src/compact-select.css']
  .map(path => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', path), 'utf8')).join('\n');
const entries: AlgEntry[] = [
  { alg: "U' R U R' U2 R U' R'", tags: ['beginner', 'mainstream'] },
  { alg: "F2 L' U' L U F2 U R U' R' F R U R' U' F' L U2 L' U2 R U' R'", tags: ['mainstream'] },
  { alg: "U' R U R' U R' F R F'" },
];

async function markup(editing: boolean, grouped: boolean, selected: boolean, toolsOpen = false, menuOpen = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const selectedAlgorithms = { 0: selected ? entries[0].alg : null };
  const group = (children: ReactNode, editableRows?: { key: string; node: ReactNode }[]) => h(F2lSolutionGroups, {
    cases: [], entries, setup: '', orientation: 0, onSelect() {}, children,
    selectedAlgorithm: selectedAlgorithms[0], editing, editableRows,
  });
  const add = h('button', { className: 'alg-editor-add' }, '+');
  const rows = entries.map((entry, i) => h(AlgFormulaReadRow, {
    key: i, tags: entry.tags, selected: selected && i === 0, className: 'alg-alg-row',
    actions: selected && i === 0 ? h('span', { className: 'alg-alg-len' }, '8') : null,
  }, entry.alg));
  try {
    await act(async () => root.render(h('div', {
      className: `alg-root is-f2l-orientation-grid${editing ? ' alg-case-inline-editor' : ''}`,
    }, editing ? h(AlgEditor, {
      initialValue: [entries], selectedAlgorithms, oriNames: ['FR'],
      renderRows: grouped ? editable => group(null, editable) : undefined,
      renderOrientation: children => h('div', { className: 'alg-case-detail-ori-algs' }, children),
    }) : h('div', { className: 'alg-case-detail-ori-algs' }, grouped ? group(rows) : rows, add))));
    if (!editing && grouped && selected) await act(async () => host.querySelector<HTMLElement>('.f2l-solution-play')!.click());
    if (editing) expect(host.querySelector('.alg-formula-generator, .alg-editor-gen')).toBeNull();
    if (toolsOpen) await act(async () => host.querySelector<HTMLButtonElement>('.alg-editor-tools-toggle')!.click());
    if (menuOpen) await act(async () => host.querySelector<HTMLButtonElement>('.alg-tag-select button')!.click());
    return host.innerHTML + (menuOpen ? document.querySelector('.alg-tag-menu')?.outerHTML ?? '' : '');
  } finally { await act(async () => root.unmount()); host.remove(); }
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    };
    return {
      rows: [...document.querySelectorAll('.alg-formula-row')].map(row => {
        const value = row.querySelector('.alg-formula-text')!;
        const text = document.createRange(); text.selectNodeContents(value);
        const r = text.getBoundingClientRect();
        return { row: rect(row), value: rect(value), text: [r.x, r.y, r.width, r.height],
          icon: rect(row.querySelector('.alg-formula-body .alg-tag-symbol svg')),
          flames: row.querySelectorAll('.alg-formula-body .lucide-flame').length,
          books: row.querySelectorAll('.alg-formula-body .lucide-book-open').length,
          weight: getComputedStyle(value).fontWeight };
      }).sort((a, b) => a.row![1] - b.row![1]),
      braces: [...document.querySelectorAll('.f2l-solution-brace')].map(rect),
      bottom: document.querySelector('.alg-case-detail-ori-algs')!.getBoundingClientRect().bottom,
    };
  });
}

for (const { width, touch } of [{ width: 390, touch: true }, { width: 390, touch: false }, { width: 688, touch: false }, { width: 1280, touch: false }]) for (const grouped of [false, true]) for (const selected of [false, true]) {
  it(`keeps read/edit geometry: ${width}px, touch=${touch}, grouped=${grouped}, selected=${selected}`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch });
    // These fixtures must never reach production, including accidental future fetches.
    await page.route('**/*', route => route.abort());
    try {
      const show = async (editing: boolean, toolsOpen = false) => {
        const html = await markup(editing, grouped, selected, toolsOpen);
        await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><style>
          body { margin: 16px; font-family: Arial, sans-serif; }
          .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
          .alg-root { max-width: 560px; padding: 0; }
          .alg-case-inline-editor .alg-editor-ori { margin-top: 0; }
          .alg-case-detail-ori-algs > .alg-editor-add { margin-top: 8px; min-height: 32px; }
        </style>${html}`);
        return measure(page);
      };
      const reading = await show(false);
      const editing = await show(true);
      expect(editing).toEqual(reading);
      expect(reading.rows).toHaveLength(3);
      expect(reading.rows.filter(row => row.icon)).toHaveLength(2);
      expect(reading.rows.filter(row => row.icon).map(row => row.icon!.slice(2))).toEqual([[14, 14], [14, 14]]);
      expect(reading.rows.map(row => [row.flames, row.books]).sort()).toEqual([[0, 0], [1, 0], [1, 1]]);
      expect(reading.braces).toHaveLength(grouped ? 1 : 0);
      if (width === 390) expect(reading.rows.some(row => row.value![3] > 27)).toBe(true);
      if (!touch) {
        await page.locator('.alg-editor-tools').first().hover();
        expect(await measure(page)).toEqual(editing);
        expect(await page.locator('.alg-editor-tools-group').first().isVisible()).toBe(false);
      }
      expect(await show(true, true)).toEqual(editing);
      expect(await page.locator('.alg-editor-tools-group').first().isVisible()).toBe(true);
      const separation = await page.locator('.alg-formula-row').first().evaluate(row => {
        const input = row.querySelector('.alg-editor-input')!.getBoundingClientRect();
        const toolbar = row.querySelector('.alg-editor-tools-group')!.getBoundingClientRect();
        return input.top - toolbar.bottom;
      });
      expect(separation).toBeGreaterThanOrEqual(6);
      // Focusing the real contenteditable must not add a border to the box model.
      await page.locator('.alg-editor-input').first().focus();
      expect(await measure(page)).toEqual(editing);
      const dotsOffsets = await page.locator('.alg-formula-row').evaluateAll(rows => rows.map(row => {
        const box = row.getBoundingClientRect();
        const dots = row.querySelector('.alg-editor-tools-toggle svg')!.getBoundingClientRect();
        return dots.y + dots.height / 2 - (box.y + box.height / 2);
      }));
      expect(dotsOffsets).toEqual([-1, -1, -1]);
    } finally { await page.close(); }
  });
}

for (const width of [390, 1280]) it(`shares icon and text sizes between the portaled menu and toolbar at ${width}px`, async () => {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.route('**/*', route => route.abort());
  try {
    await page.setContent(`<style>${css}</style>${await markup(true, false, false, true, true)}`);
    const sizes = await page.evaluate(() => {
      const dimensions = (selector: string) => [...document.querySelectorAll(selector)].map(el => {
        const box = el.getBoundingClientRect();
        return [box.width, box.height];
      });
      return {
        menu: dimensions('.alg-tag-menu svg'),
        toolbar: dimensions('.alg-editor-tools-group svg'),
        text: [...document.querySelectorAll('.alg-tag-menu [role="option"], .alg-editor-tools button')]
          .map(el => getComputedStyle(el).fontSize),
      };
    });
    expect(sizes.menu).toHaveLength(7);
    expect(sizes.menu).toEqual(Array(7).fill([14, 14]));
    expect(sizes.toolbar.length).toBeGreaterThan(0);
    expect(sizes.toolbar.every(size => size[0] === 14 && size[1] === 14)).toBe(true);
    expect(new Set(sizes.text)).toEqual(new Set(['14px']));
  } finally { await page.close(); }
});
