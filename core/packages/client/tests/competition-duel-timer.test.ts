// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionSelfTimer } from '@/components/competitions/CompetitionSelfTimer';
import { DuelTimer } from '@/components/competitions/DuelTimer';
import type { CompetitionDuel } from '@/lib/online-competition-api';

const api = vi.hoisted(() => ({ setCompetitionDuelPhase: vi.fn(), recordCompetitionDuel: vi.fn() }));
vi.mock('@/lib/online-competition-api', () => api);
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const epoch = Date.parse('2026-11-25T04:00:00Z');
const iso = (value: number) => new Date(value).toISOString();
const now = () => new Date().toISOString();

function duel(overrides?: Partial<NonNullable<CompetitionDuel['activeGame']>>): CompetitionDuel {
  return {
    id: 'match', eventId: 'event', project: '333', device: 'ordinary', status: 'in_progress', registrationId: 'a',
    supervisionMode: 'offline', requiresSupervision: false, checkedIn: false,
    ownName: 'Alice', opponentName: 'Bob', ownScore: 1, opponentScore: 0,
    serverNow: iso(epoch), gameNumber: 2, startAt: iso(epoch - 5000), canPlay: true,
    scramble: 'R U', ownReady: true, opponentReady: true, ownResult: null, opponentFinished: false, runId: null, opponentPhase: null,
    activeGame: { gameNumber: 2, authoritativeTiming: true, inspectAt: null, solveAt: null,
      scrambleDeadlineAt: iso(epoch + 55_000), inspectionSeconds: 15, ...overrides },
  };
}

describe('ordinary duel timer', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const keyboard = (type: 'keydown' | 'keyup', key = ' ') => {
    const event = new KeyboardEvent(type, { key, code: key === ' ' ? 'Space' : 'KeyK', cancelable: true });
    window.dispatchEvent(event);
    return event;
  };
  const button = (label: string) => Array.from(host.querySelectorAll('button')).find(element => element.textContent === label)!;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    vi.setSystemTime(epoch);
    localStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.setCompetitionDuelPhase.mockReset().mockImplementation(async (_id, _game, phase) => ({
      inspectAt: iso(epoch), solveAt: phase === 'solving' ? now() : null,
    }));
    api.recordCompetitionDuel.mockReset().mockImplementation(async (_id, _game, result) => ({ recorded: true, result }));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('uses Space to inspect, a held release to start, and another key to stop', async () => {
    await act(async () => root.render(createElement(DuelTimer, { duel: duel(), clockOffset: epoch, onSaved: vi.fn() })));
    expect(host.querySelector('output')?.textContent).toBe('55s');
    await act(async () => {
      expect(keyboard('keydown').defaultPrevented).toBe(true);
      keyboard('keyup');
    });
    expect(api.setCompetitionDuelPhase).toHaveBeenNthCalledWith(1, 'match', 2, 'inspecting');
    await act(async () => {
      keyboard('keydown');
      vi.advanceTimersByTime(100);
      keyboard('keyup');
    });
    expect(api.setCompetitionDuelPhase).toHaveBeenCalledTimes(1);
    await act(async () => {
      keyboard('keydown');
      vi.advanceTimersByTime(310);
    });
    expect(host.querySelector('output')?.hasAttribute('data-ready')).toBe(true);
    expect(api.setCompetitionDuelPhase).toHaveBeenCalledTimes(1);
    await act(async () => { keyboard('keyup'); });
    expect(api.setCompetitionDuelPhase).toHaveBeenNthCalledWith(2, 'match', 2, 'solving');
    await act(async () => {
      vi.advanceTimersByTime(1234);
      expect(keyboard('keydown', 'k').defaultPrevented).toBe(true);
    });
    expect(host.querySelector('output')?.textContent).toBe('1.23');
    await act(async () => button('提交本局成绩').click());
    expect(api.recordCompetitionDuel).toHaveBeenCalledWith('match', 2, { centiseconds: 123, penalty: 'none' }, expect.any(String));
  });

  it('uses the same hold controls for a self-service attempt and fills the observation penalty', async () => {
    const onResult = vi.fn();
    await act(async () => root.render(createElement(CompetitionSelfTimer, { disabled: false, onResult })));
    await act(async () => { keyboard('keydown'); keyboard('keyup'); });
    await act(async () => { vi.advanceTimersByTime(15100); });
    expect(host.querySelector('output')?.textContent).toBe('+2');
    await act(async () => { keyboard('keydown'); vi.advanceTimersByTime(300); keyboard('keyup'); });
    await act(async () => { vi.advanceTimersByTime(5820); keyboard('keydown', 'k'); });
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ centiseconds: 582, penalty: '+2' });
    expect(host.querySelector('output')?.textContent).toBe('5.82 +2');
    expect(api.setCompetitionDuelPhase).not.toHaveBeenCalled();
    expect(api.recordCompetitionDuel).not.toHaveBeenCalled();
  });

  it('fills a DNF when a self-service inspection runs out', async () => {
    const onResult = vi.fn();
    await act(async () => root.render(createElement(CompetitionSelfTimer, { disabled: false, onResult })));
    await act(async () => { keyboard('keydown'); keyboard('keyup'); });
    await act(async () => { vi.advanceTimersByTime(17100); });
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ centiseconds: null, penalty: 'DNF' });
    expect(host.querySelector('output')?.textContent).toBe('DNF');
  });

  it('restores inspection from the server timestamp and submits DNF after the grace period', async () => {
    api.setCompetitionDuelPhase.mockResolvedValueOnce({ inspectAt: iso(epoch - 14_000), solveAt: null })
      .mockResolvedValueOnce({ inspectAt: iso(epoch - 14_000), solveAt: null, result: { centiseconds: null, penalty: 'DNF' } });
    await act(async () => root.render(createElement(DuelTimer, {
      duel: duel({ inspectAt: iso(epoch - 14_000) }), clockOffset: epoch, onSaved: vi.fn(),
    })));
    expect(host.querySelector('output')?.textContent).toBe('1s');
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(host.querySelector('output')?.textContent).toBe('+2');
    await act(async () => { vi.advanceTimersByTime(1700); });
    expect(host.querySelector('output')?.textContent).toBe('DNF');
    expect(api.setCompetitionDuelPhase).toHaveBeenCalledWith('match', 2, 'timeout');
    expect(button('开始还原').disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(api.setCompetitionDuelPhase).toHaveBeenCalledTimes(2);
    expect(button('提交本局成绩').disabled).toBe(true);
    expect(api.recordCompetitionDuel).not.toHaveBeenCalled();
  });

  it('keeps click controls for inspection, starting, and stopping', async () => {
    await act(async () => root.render(createElement(DuelTimer, { duel: duel(), clockOffset: epoch, onSaved: vi.fn() })));
    await act(async () => button('打乱完成，开始观察').click());
    await act(async () => button('开始还原').click());
    await act(async () => {
      vi.advanceTimersByTime(1700);
      button('停表').click();
    });
    expect(host.querySelector('output')?.textContent).toBe('1.70');
  });
});
