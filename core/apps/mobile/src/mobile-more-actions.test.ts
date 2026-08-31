import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { TIMER_MORE_ACTION_IDS, type TimerMoreActionContext } from '@cuberoot/shared/timer';

import {
  MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS,
  mobileTimerMoreMenuItems,
  type MobileTimerMoreActionHandlers,
} from './mobile-more-actions';

const context: TimerMoreActionContext = {
  compactViewport: true,
  drillActive: false,
  event: '333',
  fullscreen: false,
  solveCount: 2,
};

function handlers(): MobileTimerMoreActionHandlers {
  return {
    'more.marks': vi.fn(),
    'more.language-mobile': vi.fn(),
    'more.fullscreen': vi.fn(),
    'more.manual-entry': vi.fn(),
    'more.print': vi.fn(),
    'more.clear-event': vi.fn(),
  };
}

describe('Mobile timer More effect adapter', () => {
  it('lists only six App-hosted real effects in canonical order', () => {
    expect(MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS).toEqual([
      'more.marks',
      'more.language-mobile',
      'more.fullscreen',
      'more.manual-entry',
      'more.print',
      'more.clear-event',
    ]);
    expect(mobileTimerMoreMenuItems(context, 'en', handlers()).map((item) => item.id)).toEqual([
      'more.marks',
      'more.language-mobile',
      'more.fullscreen',
      'more.manual-entry',
      'more.print',
      'more.clear-event',
    ]);
  });

  it('keeps every omitted Web action as an explicit gap', () => {
    const missing = TIMER_MORE_ACTION_IDS.filter(
      (id) => !MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS.includes(
        id as (typeof MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS)[number],
      ),
    );
    expect(missing).toEqual([
      'more.stats-mobile',
      'more.drill',
      'more.bld-helper',
      'more.replay',
      'more.solver',
      'more.bulk',
    ]);
  });

  it('binds and runs every displayed callback, with shared bilingual labels', () => {
    const bound = handlers();
    const english = mobileTimerMoreMenuItems(context, 'en', bound);
    const chinese = mobileTimerMoreMenuItems(context, 'zh', bound);
    expect(english.map((item) => item.label)).toEqual([
      'Scramble marks',
      'Language: 中文',
      'Fullscreen',
      'Manual entry',
      'Print',
      'Clear current event',
    ]);
    expect(chinese.map((item) => item.label)).toEqual([
      '打乱足迹',
      '语言：EN',
      '全屏',
      '手动录入',
      '打印',
      '清空当前项目',
    ]);
    for (const item of english) item.onSelect?.();
    for (const id of MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS) {
      expect(bound[id]).toHaveBeenCalledTimes(1);
    }
  });

  it('inherits fullscreen active and clear disabled state from shared', () => {
    const items = mobileTimerMoreMenuItems(
      { ...context, fullscreen: true, solveCount: 0 },
      'en',
      handlers(),
    );
    expect(items.find((item) => item.id === 'more.fullscreen')?.active).toBe(true);
    expect(items.find((item) => item.id === 'more.clear-event')?.disabled).toBe(true);
  });

  it('wires all six effects into App and removes the old sheet/fallback menu', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const css = readFileSync('src/app.css', 'utf8');
    expect(app).toContain('<TimerMoreMenu');
    expect(app).toContain("'more.marks': () => openToolsRoute('/timer/marks')");
    expect(app).toContain("'more.language-mobile': toggleMoreLanguage");
    expect(app).toContain("'more.fullscreen': toggleTimerFullscreen");
    expect(app).toContain("'more.manual-entry': openManualEntry");
    expect(app).toContain("'more.print': () => printControllerRef.current?.print()");
    expect(app).toContain("'more.clear-event': clearCurrentEvent");
    expect(app).toContain('repository.clearSessionEvent(sessionId, activeEvent)');
    expect(app).toContain('siteRouteUrl(language, toolsEntryRoute)');
    expect(app).not.toContain('className="more-dialog"');
    expect(app).not.toContain('copy.openFullTimer');
    expect(css).not.toContain('.more-dialog');
    expect(css).not.toContain('.more-sheet-actions');
  });
});
