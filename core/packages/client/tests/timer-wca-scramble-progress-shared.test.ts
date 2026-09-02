// @vitest-environment jsdom

import {
  shouldIgnoreTimerTarget,
  TIMER_OVERLAY_IDS,
  TimerWcaScrambleProgress,
  type TimerWcaScrambleProgressLabels,
} from '@cuberoot/timer-ui';
import {
  TIMER_WCA_SCRAMBLE_PROGRESS_COPY,
  timerWcaScrambleProgressLabels,
} from '@cuberoot/shared/timer';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const labels: TimerWcaScrambleProgressLabels = timerWcaScrambleProgressLabels('en');

describe('shared TimerWcaScrambleProgress', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('owns the bilingual marks/progress formulas in shared', () => {
    const en = timerWcaScrambleProgressLabels('en');
    const zh = timerWcaScrambleProgressLabels('zh-Hans');
    expect(TIMER_WCA_SCRAMBLE_PROGRESS_COPY.marksTitle).toEqual({
      en: 'Who did this scramble',
      zh: '谁做过这条打乱',
    });
    expect(en.marks(2)).toBe('2 did it');
    expect(en.practicedTitle(1, 2)).toContain('Only 2 WCA scrambles');
    expect(zh.allMarks).toBe('全站足迹');
    expect(zh.allPracticed(2)).toBe('2 条已全部练过');
    expect(zh.practiced(1, 2)).toBe('已练 1/2');
  });

  it('renders only non-zero marks, canonical names and flags, and optional progress states', () => {
    act(() => root.render(createElement(TimerWcaScrambleProgress, {
      allMarksHref: '/timer/marks',
      labels,
      language: 'zh',
      markCount: 2,
      marked: true,
      marks: [
        {
          country: 'CN',
          dateLabel: '2026-09-02',
          name: 'Xuanyi Geng (耿暄一)',
          personHref: '/wca/persons/2019GENG01',
          timeLabel: '8.12',
          wcaId: '2019GENG01',
        },
        {
          dateLabel: '2026-09-01',
          name: 'A Very Long Foreign Cuber Name That Must Wrap Without Overflow',
          personHref: '/wca/persons/2020LONG01',
          wcaId: '2020LONG01',
        },
      ],
      progress: { seen: 1, total: 2 },
    })));

    const trigger = host.querySelector<HTMLButtonElement>('.scramble-marks-chip')!;
    expect(trigger.textContent).toContain('2 did it');
    expect(trigger.classList.contains('marked')).toBe(true);
    expect(host.querySelector('.scramble-pool-run')?.textContent).toBe('1/2 practiced');

    act(() => trigger.click());
    expect(document.querySelector('.scramble-marks-name')?.textContent).toBe('耿暄一');
    expect(document.querySelector('.country-flag')).not.toBeNull();
    expect(document.querySelector('.scramble-marks-all')?.getAttribute('href')).toBe('/timer/marks');
    expect(document.querySelector('.scramble-marks-list')?.textContent).not.toContain('(耿暄一)');

    act(() => root.render(createElement(TimerWcaScrambleProgress, {
      labels,
      language: 'en',
      markCount: 0,
      progress: { seen: 2, total: 2 },
    })));
    expect(host.querySelector('.scramble-marks-chip')).toBeNull();
    expect(host.querySelector('.scramble-pool-run')?.classList.contains('done')).toBe(true);
    expect(host.querySelector('.scramble-pool-run')?.textContent).toContain('All 2 practiced');
  });

  it('does not bubble navigation and closes on outside pointer or Escape with focus recovery', () => {
    const parentClick = vi.fn();
    const parentPointerDown = vi.fn();
    const navigatePerson = vi.fn();
    const navigateAll = vi.fn();
    const onOpenChange = vi.fn();
    act(() => root.render(createElement('div', {
      onClick: parentClick,
      onPointerDown: parentPointerDown,
    },
      createElement(TimerWcaScrambleProgress, {
        labels,
        language: 'en',
        markCount: 1,
        marks: [{
          dateLabel: '2026-09-02',
          name: 'Xuanyi Geng (耿暄一)',
          personHref: '/wca/persons/2019GENG01',
          wcaId: '2019GENG01',
        }],
        onNavigateAllMarks: navigateAll,
        onNavigatePerson: navigatePerson,
        onOpenChange,
      }),
    )));

    const trigger = host.querySelector<HTMLButtonElement>('.scramble-marks-chip')!;
    act(() => trigger.click());
    expect(onOpenChange).toHaveBeenLastCalledWith(true, {
      id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
      reason: 'trigger',
    });
    const person = document.querySelector<HTMLAnchorElement>('.scramble-marks-name')!;
    expect(person.textContent).toBe('Xuanyi Geng');
    expect(shouldIgnoreTimerTarget(trigger)).toBe(true);
    expect(shouldIgnoreTimerTarget(person)).toBe(true);
    expect(shouldIgnoreTimerTarget(person.closest('.scramble-marks-pop'))).toBe(true);
    act(() => person.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(document.querySelector('.scramble-marks-pop')).not.toBeNull();
    act(() => person.click());
    expect(navigatePerson).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
      reason: 'select',
    });
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    const allMarks = document.querySelector<HTMLButtonElement>('.scramble-marks-all')!;
    expect(shouldIgnoreTimerTarget(allMarks)).toBe(true);
    act(() => allMarks.click());
    expect(navigateAll).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();

    act(() => trigger.click());
    expect(document.activeElement).toBe(document.querySelector('.scramble-marks-name'));
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(document.querySelector('.scramble-marks-pop')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
      reason: 'escape',
    });
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(document.querySelector('.scramble-marks-pop')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
      reason: 'outside',
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps synthetic owner ids as non-interactive text without an explicit person href', () => {
    const navigatePerson = vi.fn();
    act(() => root.render(createElement(TimerWcaScrambleProgress, {
      language: 'en',
      markCount: 1,
      marks: [{ dateLabel: '2026-09-02', name: 'Email User', wcaId: 'uid:42' }],
      onNavigatePerson: navigatePerson,
    })));
    act(() => host.querySelector<HTMLButtonElement>('.scramble-marks-chip')!.click());
    const name = document.querySelector<HTMLElement>('.scramble-marks-name')!;
    expect(name.tagName).toBe('SPAN');
    expect(name.classList.contains('scramble-marks-name--static')).toBe(true);
    const css = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/scramble-strip.css')), 'utf8');
    expect(css).toMatch(/\.scramble-marks-name--static\s*\{\s*cursor:\s*default;/);
    act(() => name.click());
    expect(navigatePerson).not.toHaveBeenCalled();
  });

  it('owns 44px targets, viewport-safe panel width and long-name wrapping', () => {
    const css = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/scramble-strip.css')), 'utf8');
    expect(css).toMatch(/\.scramble-marks-chip[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(css).toMatch(/anchored-panel: clamped[\s\S]*?\.scramble-marks-pop[\s\S]*?position:\s*fixed;[\s\S]*?max-width:\s*calc\(100vw - 16px\);/);
    expect(css).toMatch(/\.scramble-marks-name[\s\S]*?min-height:\s*44px;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.scramble-marks-all[\s\S]*?min-height:\s*44px;/);
  });

  it('flips above and clamps the full panel in a low landscape viewport', () => {
    const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    const viewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return this.classList.contains('scramble-marks-pop') ? 180 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return this.classList.contains('scramble-marks-pop') ? 260 : 0; },
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        height: 240,
        offsetLeft: 0,
        offsetTop: 0,
        removeEventListener: vi.fn(),
        width: 480,
      },
    });
    let triggerTop = 190;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const trigger = this.classList.contains('scramble-marks-chip');
      const left = trigger ? 200 : 0;
      const top = trigger ? triggerTop : 0;
      const width = trigger ? 80 : 260;
      const height = trigger ? 40 : 180;
      return {
        bottom: top + height, height, left, right: left + width, top, width, x: left, y: top,
        toJSON: () => ({}),
      };
    });

    const nav = document.createElement('nav');
    try {
      document.body.append(nav);
      Object.defineProperty(nav, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          bottom: 240, height: 61, left: 0, right: 480, top: 179, width: 480, x: 0, y: 179,
          toJSON: () => ({}),
        }),
      });
      act(() => root.render(createElement(TimerWcaScrambleProgress, {
        labels,
        language: 'en',
        markCount: 1,
        marks: [{ dateLabel: '2026-09-02', name: 'Test Cuber', wcaId: '2019TEST01' }],
        viewportBottomInset: nav.getBoundingClientRect().height,
      })));
      act(() => host.querySelector<HTMLButtonElement>('.scramble-marks-chip')!.click());
      const panel = document.querySelector<HTMLElement>('.scramble-marks-pop')!;
      expect(panel.style.top).toBe('8px');
      expect(panel.style.maxHeight).toBe('163px');
      expect(panel.style.left).toBe('110px');
      expect(panel.style.visibility).toBe('visible');
      expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight))
        .toBeLessThanOrEqual(nav.getBoundingClientRect().top - 8);

      triggerTop = 60;
      act(() => window.dispatchEvent(new Event('scroll')));
      expect(panel.style.top).toBe('106px');
      expect(panel.style.maxHeight).toBe('65px');
      expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight))
        .toBeLessThanOrEqual(nav.getBoundingClientRect().top - 8);

      triggerTop = -100;
      act(() => window.dispatchEvent(new Event('scroll')));
      expect(panel.style.top).toBe('8px');
      expect(panel.style.maxHeight).toBe('163px');
      expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight))
        .toBeLessThanOrEqual(nav.getBoundingClientRect().top - 8);
    } finally {
      nav.remove();
      if (heightDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', heightDescriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
      if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', widthDescriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
      if (viewportDescriptor) Object.defineProperty(window, 'visualViewport', viewportDescriptor);
      else Reflect.deleteProperty(window, 'visualViewport');
    }
  });

  it('waits for a controlled host to close and restores focus when open becomes false', () => {
    const onOpenChange = vi.fn();
    const render = (open: boolean) => root.render(createElement(TimerWcaScrambleProgress, {
      language: 'en',
      markCount: 1,
      marks: [{ dateLabel: '2026-09-02', name: 'Test Cuber', wcaId: '2019TEST01' }],
      onOpenChange,
      open,
    }));

    act(() => render(true));
    const trigger = host.querySelector<HTMLButtonElement>('.scramble-marks-chip')!;
    expect(document.querySelector('.scramble-marks-pop')).not.toBeNull();
    act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
      reason: 'outside',
    });
    expect(document.querySelector('.scramble-marks-pop')).not.toBeNull();

    act(() => render(false));
    expect(document.querySelector('.scramble-marks-pop')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    act(() => render(true));
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.wcaScrambleMarks,
      reason: 'escape',
    });
  });

  it('is the sole Web marks/progress UI and the Web marks client stays a shared thin adapter', () => {
    const solo = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    const timerCss = readFileSync('app/[lang]/timer/timer.css', 'utf8');
    const marksClient = readFileSync('app/[lang]/timer/_lib/marks.ts', 'utf8');

    expect(solo).toContain('<TimerWcaScrambleProgress');
    expect(solo).not.toContain('className="scramble-marks"');
    expect(solo).not.toContain('className={`scramble-pool-run');
    expect(timerCss).not.toMatch(/\.scramble-marks\s*\{/);
    expect(timerCss).not.toMatch(/\.scramble-pool-run\s*\{/);
    expect(marksClient).toContain('fetchTimerWcaScrambleMarks');
    expect(marksClient).toContain('postTimerWcaScrambleMark');
    expect(marksClient).toContain('updateTimerWcaScrambleMarkIfExists');
    expect(marksClient).toContain('timerWcaScrambleMarkKeyIdentity');
    expect(solo).toMatch(
      /const onDocDown = \(e: PointerEvent\)[\s\S]*?shouldIgnoreTimerTarget\(t\)[\s\S]*?timerShouldStopFromExternalPointer/,
    );
    expect(solo).toContain('const writeMode = timerWcaScrambleMarkWriteMode({');
    expect(solo).toContain("writeMode === 'upsert'");
    expect(solo).toContain('await updateMarkIfExists(meta, timeCs, authUser.country || \'\')');
    expect(solo).not.toContain('const knownMarks = cachedMarks');
    expect(solo).not.toContain("allMarks: tr({ zh: '全站足迹'");
  });

  it('keeps the Web marks adapter URL, auth and response behavior', async () => {
    vi.resetModules();
    localStorage.setItem('cuberoot_jwt', 'test-token');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const {
      addMark,
      fetchMarks,
      markPersonHref,
      updateMarkIfExists,
    } = await import('@/app/[lang]/timer/_lib/marks');
    const key = { ci: 'Comp2026', e: '333', r: '1', g: 'A', x: 0 as const, n: 2 };

    fetcher.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, marks: [{
        wcaId: '2019TEST01', name: 'Test Cuber', country: 'CN', timeCs: 812, createdAt: 1,
      }] }),
    });
    await expect(fetchMarks(key)).resolves.toMatchObject({ count: 1 });
    expect(fetcher.mock.calls[0]?.[0]).toContain('/v1/scramble-marks?ci=Comp2026');

    fetcher.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, createdAt: 2 }),
    });
    await expect(addMark(key, 812, 'CN')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    });

    fetcher.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, updated: false, createdAt: null }),
    });
    await expect(updateMarkIfExists(key, 812, '')).resolves.toBe(false);
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toMatchObject({
      ...key,
      timeCs: 812,
      country: '',
    });
    expect(markPersonHref('/zh', '2019TEST01')).toBe('/zh/wca/persons/2019TEST01');
    expect(markPersonHref('/zh', 'u42')).toBeUndefined();
  });
});
