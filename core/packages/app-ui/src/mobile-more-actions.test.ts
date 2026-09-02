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
    'more.stats-mobile': vi.fn(),
    'more.language-mobile': vi.fn(),
    'more.drill': vi.fn(),
    'more.bld-helper': vi.fn(),
    'more.fullscreen': vi.fn(),
    'more.manual-entry': vi.fn(),
    'more.solver': vi.fn(),
    'more.bulk': vi.fn(),
    'more.print': vi.fn(),
    'more.clear-event': vi.fn(),
  };
}

describe('Mobile timer More effect adapter', () => {
  it('lists App-hosted and Tools-hosted real effects in canonical order', () => {
    expect(MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS).toEqual([
      'more.marks',
      'more.stats-mobile',
      'more.language-mobile',
      'more.drill',
      'more.bld-helper',
      'more.fullscreen',
      'more.manual-entry',
      'more.solver',
      'more.bulk',
      'more.print',
      'more.clear-event',
    ]);
    expect(mobileTimerMoreMenuItems(context, 'en', handlers()).map((item) => item.id)).toEqual([
      'more.marks',
      'more.stats-mobile',
      'more.language-mobile',
      'more.drill',
      'more.fullscreen',
      'more.manual-entry',
      'more.solver',
      'more.bulk',
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
    expect(missing).toEqual(['more.replay']);
  });

  it('binds and runs every displayed callback, with shared bilingual labels', () => {
    const bound = handlers();
    const english = mobileTimerMoreMenuItems(context, 'en', bound);
    const chinese = mobileTimerMoreMenuItems(context, 'zh', bound);
    expect(english.map((item) => item.label)).toEqual([
      'Scramble marks',
      'Stats',
      'Language: 中文',
      'Drill mode',
      'Fullscreen',
      'Manual entry',
      'Solver',
      'Bulk scrambles',
      'Print',
      'Clear current event',
    ]);
    expect(chinese.map((item) => item.label)).toEqual([
      '打乱足迹',
      '统计',
      '语言：EN',
      '专项练习',
      '全屏',
      '手动录入',
      '通用求解器',
      '批量打乱',
      '打印',
      '清空当前项目',
    ]);
    for (const item of english) item.onSelect?.();
    for (const id of MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS.filter(
      (implementedId) => implementedId !== 'more.bld-helper',
    )) {
      expect(bound[id]).toHaveBeenCalledTimes(1);
    }
    expect(bound['more.bld-helper']).not.toHaveBeenCalled();
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

  it('keeps an active drill reachable so it can be changed or exited', () => {
    const items = mobileTimerMoreMenuItems(
      { ...context, drillActive: true },
      'en',
      handlers(),
    );
    expect(items.find((item) => item.id === 'more.drill')).toMatchObject({
      active: true,
      visible: true,
    });
  });

  it('exposes the BLD helper only for shared Speffz-capable events', () => {
    const bldHandlers = handlers();
    const bldItems = mobileTimerMoreMenuItems(
      { ...context, event: '333bld' },
      'en',
      bldHandlers,
    );
    expect(bldItems.map((item) => item.id)).toContain('more.bld-helper');
    bldItems.find((item) => item.id === 'more.bld-helper')?.onSelect?.();
    expect(bldHandlers['more.bld-helper']).toHaveBeenCalledTimes(1);
  });

  it('wires every implemented effect into App and removes the old sheet/fallback menu', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const css = readFileSync('src/app.css', 'utf8');
    expect(app).toContain('<TimerMoreMenu');
    expect(app).toContain("'more.marks': () => openToolsRoute('/timer/marks')");
    expect(app).toContain("'more.stats-mobile': () => setView('history')");
    expect(app).toContain("'more.language-mobile': toggleMoreLanguage");
    expect(app).toContain("'more.bld-helper': () => openToolsRoute('/alg/3bld/helper')");
    expect(app).toContain("'more.fullscreen': toggleTimerFullscreen");
    expect(app).toContain("'more.manual-entry': openManualEntry");
    expect(app).toContain("'more.solver': () => openToolsRoute('/scramble/solver?event=333')");
    expect(app).toContain("'more.bulk': () => openToolsRoute('/scramble/gen?mode=batch')");
    expect(app).toContain("'more.print': () => printControllerRef.current?.print()");
    expect(app).toContain("'more.clear-event': clearCurrentEvent");
    expect(app).toContain('repository.clearSessionEvent(sessionId, activeEvent)');
    expect(app).toContain('siteRouteUrl(language, toolsEntryRoute)');
    expect(app).toContain("mobileBackAction({");
    expect(app).toContain("mobileEmbedBackMessage(current)");
    expect(app).not.toContain('className="more-dialog"');
    expect(app).not.toContain('copy.openFullTimer');
    expect(css).not.toContain('.more-dialog');
    expect(css).not.toContain('.more-sheet-actions');
  });
});
