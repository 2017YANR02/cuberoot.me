/**
 * 把一条**对战**成绩认回本机计时记录(`battleReconIndex` / `battleReconKey`)。
 * =========================================================================
 *
 * 对战记分板和本机计时记录是两本账:前者只存数字(时间 / 罚时 / 打乱),后者存整把
 * (转动流 / 姿态流 / 分段)。智能魔方那条路会把同一把按 Solo 的格式也留一份,所以
 * 对战那一行**可能**有对应的复盘 —— 但两边没有共用的 id,给对战自己的持久化格式加
 * 一个 id 是要迁移的,所以改成按内容认:同一条打乱 + **没取整的**用时。
 *
 * 三件事要钉住:
 *   1. 认得回来(打乱和用时都对得上);
 *   2. **宁可不认也不能认错** —— 打乱不同、用时差一点点、没有转动流,都不给入口;
 *   3. 整份记录只读一次(逐行去查会把一次 localStorage 解析乘上行数)。
 */

import { describe, it, expect, vi } from 'vitest';

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const g = globalThis as unknown as {
  window?: unknown;
  localStorage?: ReturnType<typeof makeLocalStorage>;
};
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage();

const db = await import('@/app/[lang]/timer/_lib/storage/db');
const { battleReconIndex, battleReconKey } = db;

const DB_KEY = 'cuberoot-timer.v3';
const SCR = "R U R' U' F2 L D2";

interface SeedSolve {
  id: string;
  timeMs: number;
  scramble: string;
  moves?: Array<{ m: string; ts: number }>;
}

function seed(solves: SeedSolve[]): void {
  g.localStorage!.setItem(DB_KEY, JSON.stringify({
    version: 3,
    sessions: [{ id: 's1', name: 'main', createdTs: 1 }],
    activeSessionId: 's1',
    dataBySession: {
      s1: {
        '333': solves.map(s => ({
          id: s.id,
          timeMs: s.timeMs,
          penalty: 'ok',
          scramble: s.scramble,
          event: '333',
          ts: 1,
          ...(s.moves ? { moves: s.moves } : {}),
        })),
      },
    },
  }));
}

const withMoves = (id: string, timeMs: number, scramble = SCR): SeedSolve =>
  ({ id, timeMs, scramble, moves: [{ m: 'R', ts: 0 }, { m: 'U', ts: 120 }] });

describe('battleReconIndex', () => {
  it('打乱和用时都对得上就认回来', () => {
    seed([withMoves('a', 8123.456)]);
    const { index } = battleReconIndex('333');
    expect(index.get(battleReconKey(SCR, 8123.456))?.id).toBe('a');
  });

  it('**没有转动流的把不进索引** —— 认回来也没复盘可看', () => {
    seed([{ id: 'a', timeMs: 8123.456, scramble: SCR }]);
    expect(battleReconIndex('333').index.size).toBe(0);
  });

  it('空的转动流也不算(手动录入 / 从别处导进来的)', () => {
    seed([{ id: 'a', timeMs: 8123.456, scramble: SCR, moves: [] }]);
    expect(battleReconIndex('333').index.size).toBe(0);
  });

  it('用时差一点点就不认 —— 这正是不取整的原因', () => {
    seed([withMoves('a', 8123.456)]);
    const { index } = battleReconIndex('333');
    expect(index.get(battleReconKey(SCR, 8123.457))).toBeUndefined();
    expect(index.get(battleReconKey(SCR, 8123))).toBeUndefined();
  });

  it('同样的用时、不同的打乱,不认', () => {
    seed([withMoves('a', 8123.456)]);
    const { index } = battleReconIndex('333');
    expect(index.get(battleReconKey("U R U' R'", 8123.456))).toBeUndefined();
  });

  it('同一条打乱拧了两把(重来一次),认到后拧的那把', () => {
    // 打乱一样、用时不一样 —— 键里带用时,两把各占一格,不会互相盖
    seed([withMoves('early', 9000.5), withMoves('later', 7000.25)]);
    const { index } = battleReconIndex('333');
    expect(index.get(battleReconKey(SCR, 9000.5))?.id).toBe('early');
    expect(index.get(battleReconKey(SCR, 7000.25))?.id).toBe('later');
  });

  it('没有打乱的记录不进索引(认不出是哪一把)', () => {
    seed([{ id: 'a', timeMs: 8123.456, scramble: '', moves: [{ m: 'R', ts: 0 }] }]);
    expect(battleReconIndex('333').index.size).toBe(0);
  });

  it('这个事件一条记录都没有时给空索引,不抛', () => {
    seed([]);
    const { index, solves } = battleReconIndex('333');
    expect(index.size).toBe(0);
    expect(solves).toEqual([]);
    expect(battleReconIndex('222').index.size).toBe(0);
  });

  it('顺带把整份列表带出来 —— 复盘面板要拿它算个人分段均值', () => {
    seed([withMoves('a', 1000), { id: 'b', timeMs: 2000, scramble: SCR }]);
    const { index, solves } = battleReconIndex('333');
    expect(solves.map(s => s.id)).toEqual(['a', 'b']);   // 没转动流的也在列表里
    expect(index.size).toBe(1);                          // 但进不了索引
  });

  it('**整份记录只读一次** —— 逐行去查会把解析乘上行数', () => {
    seed(Array.from({ length: 40 }, (_, i) => withMoves(`s${i}`, 1000 + i)));
    const spy = vi.spyOn(g.localStorage!, 'getItem');
    battleReconIndex('333');
    expect(spy.mock.calls.filter(c => c[0] === DB_KEY)).toHaveLength(1);
    spy.mockRestore();
  });
});

describe('battleReconKey', () => {
  it('用时和打乱都进键,任一不同就是不同的键', () => {
    expect(battleReconKey(SCR, 1)).toBe(battleReconKey(SCR, 1));
    expect(battleReconKey(SCR, 1)).not.toBe(battleReconKey(SCR, 2));
    expect(battleReconKey(SCR, 1)).not.toBe(battleReconKey('U', 1));
  });

  it('分隔符不会被打乱字符串里的内容伪造出来(打乱里没有 `|`)', () => {
    // 万一以后打乱记号里出现 `|`,这条会红 —— 那时键要换个分隔法
    expect(SCR).not.toContain('|');
    expect(battleReconKey(SCR, 12.5)).toBe(`12.5|${SCR}`);
  });
});
