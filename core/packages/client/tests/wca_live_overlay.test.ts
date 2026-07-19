/**
 * overlayDeltaPure —— 近期纪录 overlay 对世界/全国名次增量的去重逻辑单测。
 *
 * 背景:世界排名分母是周更快照(wca_results_flat),不含刚结束的比赛。overlay 用 WCA Live 近期
 * 纪录补上跨赛事滞后,但必须按每人快照 PB 去重(快照已计入的选手不重复 +1)。见
 * server/src/utils/wca_live_overlay.ts。
 *
 * 真实触发场景:郭铠希 1.52 斜转平均在快照里 WR3,但 Grohmann 已在刚结束的 Euro 2026 跑出 1.47
 * (快照未收录)→ 真实应为 WR4。
 */
import { describe, it, expect } from 'vitest';
import { overlayDeltaPure, type OverlayEntry } from '../../server/src/utils/wca_live_overlay';

const e = (wcaId: string, value: number, compId: string, iso2 = 'CN'): OverlayEntry => ({
  wcaId, value, compId, iso2,
});

describe('overlayDeltaPure', () => {
  it('adds a fresh faster record-setter absent from the snapshot (Grohmann case)', () => {
    // 郭铠希 1.52(value=152)。Grohmann 在 Euro 跑 1.47(147),快照无其成绩 → +1 → WR3 变 WR4。
    const entries = [e('2015GROH01', 147, 'Euro2026', 'CZ')];
    const snapshot = new Map<string, number>(); // Grohmann 快照缺席
    expect(overlayDeltaPure(entries, snapshot, 152)).toEqual({ world: 1, national: 0 });
  });

  it('skips a record-setter already counted in the snapshot below value', () => {
    // 该选手赛前官方 PB 已 149(<152),快照早已计入 → 不重复加。
    const entries = [e('2015GROH01', 147, 'Euro2026', 'CZ')];
    const snapshot = new Map<string, number>([['2015GROH01', 149]]);
    expect(overlayDeltaPure(entries, snapshot, 152)).toEqual({ world: 0, national: 0 });
  });

  it('counts strictly-faster only (equal value does not count)', () => {
    const entries = [e('X', 152, 'C1'), e('Y', 153, 'C1')];
    const snapshot = new Map<string, number>();
    expect(overlayDeltaPure(entries, snapshot, 152)).toEqual({ world: 0, national: 0 });
  });

  it('dedups the same person across multiple records', () => {
    const entries = [e('X', 150, 'C1'), e('X', 148, 'C2')];
    const snapshot = new Map<string, number>();
    expect(overlayDeltaPure(entries, snapshot, 152).world).toBe(1);
  });

  it('excludes entries from excludeComp (client already adjusts that comp)', () => {
    const entries = [e('X', 150, 'ThisComp'), e('Y', 149, 'OtherComp')];
    const snapshot = new Map<string, number>();
    expect(overlayDeltaPure(entries, snapshot, 152, { excludeComp: 'ThisComp' }).world).toBe(1);
  });

  it('national delta only counts same-country candidates', () => {
    const entries = [e('X', 150, 'C1', 'CN'), e('Y', 149, 'C2', 'CZ')];
    const snapshot = new Map<string, number>();
    expect(overlayDeltaPure(entries, snapshot, 152, { countryIso2: 'CN' })).toEqual({
      world: 2,
      national: 1,
    });
  });

  it('returns zero for a non-positive value', () => {
    const entries = [e('X', 150, 'C1')];
    expect(overlayDeltaPure(entries, new Map(), 0)).toEqual({ world: 0, national: 0 });
    expect(overlayDeltaPure(entries, new Map(), -1)).toEqual({ world: 0, national: 0 });
  });

  it('is a no-op with an empty overlay', () => {
    expect(overlayDeltaPure([], new Map(), 152)).toEqual({ world: 0, national: 0 });
  });
});
