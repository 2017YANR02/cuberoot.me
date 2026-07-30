/**
 * 通知流 → 人会数的步数（htm.ts）。
 * =========================================================================
 *
 * 智能魔方的协议是 `face << 1 | direction` —— **只有 90 度**（见 bluetooth/gan_v2.ts）。
 * 所以真机流里永远不会出现 `R2`,只会出现 `R R`。谁要数步数就必须先合并,否则:
 *   - HTM 和 QTM 在每一把智能魔方成绩里都相等（两个格子一个数);
 *   - 效率拿用户的 90 度数去比求解器的 HTM,每个双层转白扣一步。
 *
 * 规则:相邻同面合并,净转动取模 4;转完等于没转（`R R'`）就不算步。整体旋转、
 * 换面、别的记号都断开这一段。**只合并相邻**的 —— `R L R` 还是两步 R,虽然两个 R
 * 隔着 L 可交换,但步数就是这么数的。
 */
import { describe, it, expect } from 'vitest';

import { htmMoves, countHtm } from '@/app/[lang]/timer/_lib/reconstruct/htm';
import type { SolveMove } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

/** 每 100ms 一个通知。 */
function stream(tokens: string): SolveMove[] {
  return tokens.split(/\s+/).filter(Boolean).map((m, i) => ({ m, ts: i * 100 }));
}

describe('htmMoves', () => {
  it('相邻同面两个 90 度 = 一步双层转', () => {
    const r = htmMoves(stream('R R'));
    expect(r).toHaveLength(1);
    expect(r[0].m).toBe('R2');
    expect(r[0].quarters).toBe(2);
    // 时间戳取这一步**开始**的那一刻,索引覆盖整段。
    expect(r[0].ts).toBe(0);
    expect(r[0].endTs).toBe(100);
    expect(r[0].startIdx).toBe(0);
    expect(r[0].endIdx).toBe(1);
  });

  it('三个 90 度 = 一步反向转,四个 = 没转', () => {
    expect(htmMoves(stream('R R R')).map(h => h.m)).toEqual(["R'"]);
    expect(htmMoves(stream('R R R R'))).toEqual([]);
  });

  it('转完又转回来不算步(废步那条轴去管)', () => {
    expect(countHtm(stream("R R'"))).toBe(0);
    expect(countHtm(stream("R R' R"))).toBe(1);
    expect(countHtm(stream("U2 U2"))).toBe(0);
  });

  it('只合并相邻的:隔着别的面就是两步', () => {
    expect(countHtm(stream('R L R'))).toBe(3);
    expect(countHtm(stream('R U R'))).toBe(3);
  });

  it('整体旋转断开合并,而且自己不算步', () => {
    expect(countHtm(stream("R y R"))).toBe(2);
    expect(countHtm(stream('y y2'))).toBe(0);
    expect(htmMoves(stream("R y R")).map(h => h.m)).toEqual(['R', 'R']);
  });

  it('宽层 / 中层跟外层不是同一面,不合并', () => {
    expect(countHtm(stream('R Rw'))).toBe(2);
    expect(countHtm(stream('R r'))).toBe(2);
    expect(countHtm(stream('M M'))).toBe(1);          // 同记号还是要合并
    expect(htmMoves(stream('M M')).map(h => h.m)).toEqual(['M2']);
  });

  it('已经写成 HTM 的流原样通过(手动输入 / 测试夹具)', () => {
    const tokens = "F2 U' F2 D R2 B2 U B2 D' R2 U";
    expect(countHtm(stream(tokens))).toBe(11);
    expect(htmMoves(stream(tokens)).map(h => h.m).join(' ')).toBe(tokens);
  });

  it('真机口径的一整把:64 个通知 = 50 步', () => {
    const raw = "U R' F R' B B L U F F R' F F U U R U B' U U B F L F L' F F U' F U U L' U L U' L' U' L U U F U R U' R' F' U' F F U' F F D R R B B U B B D' R R U";
    expect(stream(raw)).toHaveLength(64);
    expect(countHtm(stream(raw))).toBe(50);
  });

  it('边界:空流、单步、垃圾记号', () => {
    expect(htmMoves([])).toEqual([]);
    expect(countHtm(stream('R'))).toBe(1);
    expect(countHtm(stream('??? R'))).toBe(1);
    expect(countHtm(stream('R ??? R'))).toBe(2);      // 垃圾也断开
  });
});
