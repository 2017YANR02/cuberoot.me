/**
 * 「重新分析」这条迁移 —— reanalyzeAll。
 * =========================================================================
 *
 * Sprint 16 之后它的职责变小了:新还原落盘时自己就带分段,这条迁移只负责**补旧账**
 * (以及识别器改了之后重算一遍)。所以要测死的是三件事:
 *
 *   1. 只写该写的 —— 算出来跟存着的一样就不写(幂等,点第二次必须 0 更新);
 *   2. 算不出来的要**清掉**旧值,不能留一份陈的在库里;
 *   3. 跳过的东西真跳过:非三阶系项目、没有动作流的成绩。
 *
 * 它跟录入路径共用 `stageSegmentsFor`,所以「同一把还原补出来的分段」和
 * 「当场落盘的分段」不可能不一样 —— 这里顺带把这点也钉住。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Solve } from '@/app/[lang]/timer/_lib/types';

const store: { data: Record<string, Solve[]> } = { data: {} };
const writes: Array<{ event: string; solves: Solve[] }> = [];

vi.mock('@/app/[lang]/timer/_lib/storage/db', () => ({
  loadAll: () => store.data,
  updateSolves: (event: string, solves: Solve[]) => {
    writes.push({ event, solves });
    const list = store.data[event] ?? [];
    for (const u of solves) {
      const i = list.findIndex(s => s.id === u.id);
      if (i >= 0) list[i] = u;
    }
  },
}));

const { reanalyzeAll } = await import('@/app/[lang]/timer/_lib/storage/reanalyze');
const { stageSegmentsFor } = await import('@/app/[lang]/timer/_lib/reconstruct/stage_segments');

const SCRAMBLE = "D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'";
const SOLUTION = "U R' F R' B B L U F F R' F F U U R U B' U U B F L F L' F F U' F U U L' U L U' L' U' L U U F U R U' R' F' U' F F U' F F D R R B B U B B D' R R U".split(' ');

function solveOf(id: string, over: Partial<Solve> = {}): Solve {
  return {
    id,
    ts: 1_700_000_000_000,
    timeMs: 7_000,
    scramble: SCRAMBLE,
    event: '333',
    penalty: 'ok',
    moves: SOLUTION.map((m, i) => ({ m, ts: Math.round((i * 7_000) / SOLUTION.length) })),
    ...over,
  } as Solve;
}

beforeEach(() => {
  writes.length = 0;
  store.data = {};
});

describe('reanalyzeAll', () => {
  it('给缺分段的旧成绩补上,补出来的跟录入时算的一样', async () => {
    const fresh = solveOf('a');
    store.data = { '333': [fresh] };

    const r = await reanalyzeAll();
    expect(r.scanned).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.eventsTouched).toEqual(['333']);

    const written = writes[0].solves[0];
    expect(written.stageSegments?.pllCase).toBe('PLL T');
    // 迁移补的和录入路径当场算的必须是同一份。
    expect(written.stageSegments).toEqual(stageSegmentsFor(fresh));
  });

  it('再跑一遍不写任何东西(幂等)', async () => {
    store.data = { '333': [solveOf('a')] };
    await reanalyzeAll();
    writes.length = 0;

    const r2 = await reanalyzeAll();
    expect(r2.scanned).toBe(1);
    expect(r2.updated).toBe(0);
    expect(writes).toHaveLength(0);
  });

  it('存着的分段是陈的就重写', async () => {
    const stale = solveOf('a');
    // 故意把 case 名改错,模拟识别器改之前存下的那一版。
    stale.stageSegments = { ...stageSegmentsFor(stale)!, pllCase: 'PLL Ja' };
    store.data = { '333': [stale] };

    const r = await reanalyzeAll();
    expect(r.updated).toBe(1);
    expect(writes[0].solves[0].stageSegments?.pllCase).toBe('PLL T');
  });

  it('打乱跟动作流对不上时,重算出来的是「走不到还原」而不是留着那份好数据', async () => {
    const broken = solveOf('a', { scramble: 'R U R U R U R U R U' });
    // 库里存着一份「好」的分段(比如打乱后来被改过),但按现在这条打乱走不到还原。
    broken.stageSegments = stageSegmentsFor(solveOf('ref'))!;
    store.data = { '333': [broken] };

    const r = await reanalyzeAll();
    expect(r.updated).toBe(1);
    expect(writes[0].solves[0].stageSegments?.solvedMs ?? null).toBeNull();
    expect(writes[0].solves[0].stageSegments?.pllCase ?? null).toBeNull();
    // 顺带记一笔:`stageSegments: undefined` 那条清空分支只在**走的过程中抛**时才
    // 走得到 —— 打乱解析不了会退回还原态继续走,空动作流在扫之前就被跳过了。
    // 它是防御性的,不是这条用例覆盖的路径。
  });

  it('非三阶系项目和没动作流的成绩不算不写', async () => {
    store.data = {
      '222': [solveOf('a', { event: '222' })],
      '444': [solveOf('b', { event: '444' })],
      '333': [solveOf('c', { moves: undefined }), solveOf('d', { moves: [] })],
    };

    const r = await reanalyzeAll();
    expect(r.scanned).toBe(0);
    expect(r.updated).toBe(0);
    expect(writes).toHaveLength(0);
  });

  it('进度回调的分母只数真要算的那些', async () => {
    store.data = {
      '333': [solveOf('a'), solveOf('b', { moves: undefined })],
      '222': [solveOf('c', { event: '222' })],
    };

    const seen: Array<{ scanned: number; total: number }> = [];
    await reanalyzeAll(p => seen.push({ scanned: p.scanned, total: p.total }));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].total).toBe(1);
    expect(seen[seen.length - 1].scanned).toBe(1);
  });
});
