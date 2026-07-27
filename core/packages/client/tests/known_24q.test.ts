/**
 * 「已知 ≥24q」语料的护栏。
 *
 * 上游那份(cube20.org)只给打乱和一列声称的 QTM 距离。这里把能验的全验一遍:
 * 每条打乱自身的 QTM 长度 = 那一列(即「≤」那半的见证)、H 列 = 步数、
 * 以及整份语料的对称性清点 —— 带对称的 3,324 条代表 78,820 个位置这一条,
 * 与上游页面上的数字逐位相同,而它是本机用站内 48 元对称群独立数出来的。
 *
 * 「≥ 24q」那一半验不了:要 QTM 最优求解器,站内只有 HTM 管道。数据层注释里写明了这一点,
 * 这里也不去断言它。
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countQtm } from '@cuberoot/shared/scramble-length';
import { applyAlgExtended } from '@/app/[lang]/scramble/symmetry/_alg';
import { SYM_TYPES, antisymMask, classifyMask, maskToList, symMask } from '@/app/[lang]/scramble/symmetry/_sym_core';
import {
  KNOWN_24Q_CENSUS, KNOWN_24Q_DEEPEST, KNOWN_24Q_TOTAL, KNOWN_24Q_UPSTREAM,
} from '@/app/[lang]/scramble/hardest/_data/known_24q';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** 每行 `<打乱>\t<声称的 QTM 距离>\t<HTM 步数>`。 */
const ROWS = gunzipSync(readFileSync(path.join(FIXTURES, 'known_24q.txt.gz')))
  .toString('utf8').trim().split('\n')
  .map((line) => { const [s, q, h] = line.split('\t'); return { s, q: Number(q), h: Number(h) }; });

/** 稳定子阶 = 保持它的对称元 + 把它映到自己的逆的反对称元。 */
function stabilizerOf(scramble: string): { stab: number; type: string; sym: number } {
  const cube = applyAlgExtended(scramble).cube;
  const sm = symMask(cube);
  const am = antisymMask(cube);
  return {
    stab: maskToList(sm).length + maskToList(am).length,
    type: SYM_TYPES[classifyMask(sm)].name,
    sym: maskToList(sm).length,
  };
}

describe('≥24q 语料:能验的那半', () => {
  it('条数与数据层一致', () => {
    expect(ROWS.length).toBe(KNOWN_24Q_TOTAL);
  });

  it('每条打乱的 QTM 长度都等于它那一列 —— 「≤ 24/25/26 步」逐条有见证', () => {
    for (const r of ROWS) expect(countQtm(r.s), r.s).toBe(r.q);
  });

  it('H 那一列就是打乱的步数', () => {
    for (const r of ROWS) expect(r.s.trim().split(/\s+/).length, r.s).toBe(r.h);
  });

  it('深度分布:3,341 条 24q + 2 条 25q + 1 条 26q', () => {
    const hist: Record<number, number> = {};
    for (const r of ROWS) hist[r.q] = (hist[r.q] ?? 0) + 1;
    expect(hist).toEqual({ 24: 3_341, 25: 2, 26: 1 });
  });
});

describe('≥24q 语料:对称性清点(本机数,不抄)', () => {
  it('三类打乱的条数', () => {
    let sym = 0;
    let antiOnly = 0;
    let plain = 0;
    for (const r of ROWS) {
      const { stab, sym: s } = stabilizerOf(r.s);
      if (s > 1) sym++;
      else if (stab > 1) antiOnly++;
      else plain++;
    }
    // 带对称的那批含 25/26q 三条,减掉才是上游单列的 24q 数字
    expect(sym - 3).toBe(KNOWN_24Q_CENSUS.symmetricScrambles);
    expect(antiOnly).toBe(KNOWN_24Q_CENSUS.antisymmetricOnly);
    expect(plain).toBe(KNOWN_24Q_CENSUS.plain);
    expect(sym + antiOnly + plain).toBe(KNOWN_24Q_TOTAL);
  });

  it('按深度算它们代表多少个位置,三档相加 = 79,819', () => {
    const pos: Record<number, number> = {};
    for (const r of ROWS) {
      const { stab } = stabilizerOf(r.s);
      expect(96 % stab, r.s).toBe(0);
      pos[r.q] = (pos[r.q] ?? 0) + 96 / stab;
    }
    expect(pos[24]).toBe(KNOWN_24Q_CENSUS.positions24);
    expect(pos[25]).toBe(KNOWN_24Q_CENSUS.positions25);
    expect(pos[26]).toBe(KNOWN_24Q_CENSUS.positions26);
    expect(pos[24] + pos[25] + pos[26]).toBe(KNOWN_24Q_CENSUS.positions);
  });

  it('24q 里带对称的那批 = 3,324 条 / 78,820 个位置,与上游页面逐位相同', () => {
    let scrambles = 0;
    let positions = 0;
    for (const r of ROWS) {
      if (r.q !== 24) continue;
      const { stab, sym } = stabilizerOf(r.s);
      if (sym > 1) { scrambles++; positions += 96 / stab; }
    }
    expect(scrambles).toBe(KNOWN_24Q_UPSTREAM.symmetricScrambles);
    expect(positions).toBe(KNOWN_24Q_UPSTREAM.symmetricPositions);
    // 上游今天的总数比本快照大,长出来的全在「无对称」那一类:262 × 48 + 31 × 96
    expect(262 * 48 + 31 * 96).toBe(KNOWN_24Q_UPSTREAM.plainPositions);
    expect(KNOWN_24Q_UPSTREAM.symmetricPositions + KNOWN_24Q_UPSTREAM.plainPositions)
      .toBe(KNOWN_24Q_UPSTREAM.positions24);
  });

  it('比 24q 还深的三条:型、稳定子、代表的位置数逐条复算', () => {
    for (const d of KNOWN_24Q_DEEPEST) {
      const row = ROWS.find((r) => r.s === d.scramble);
      expect(row, d.scramble).toBeDefined();
      expect(row!.q).toBe(d.q);
      const { stab, type } = stabilizerOf(d.scramble);
      expect(type, d.scramble).toBe(d.type);
      expect(stab, d.scramble).toBe(d.stabilizer);
      expect(96 / stab, d.scramble).toBe(d.positions);
    }
    // 唯一那个 26q 位置有三个朝向 —— 上游原话,本机数出来也是 3
    expect(KNOWN_24Q_DEEPEST.filter((d) => d.q === 26)).toHaveLength(1);
    expect(KNOWN_24Q_DEEPEST[0].positions).toBe(3);
  });
});
