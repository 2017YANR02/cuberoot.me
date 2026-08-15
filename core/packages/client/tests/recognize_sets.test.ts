// `/recognize/oll` 的题面到底是不是那个 OLL —— 这页以前从来没答对过一次:队列是 PLL 的名字,
// 拿去查 OLL 公式表查不到,`case=` 恒为空,画出来永远是还原态。所以这里锁两件事:
//
//   1. 57 张题面各自等于 /alg 库里那张同名的图(**在整体朝向意义下**)。判据不是我自己算的
//      东西,是 DB 的 setup —— tests/fixtures/oll_db_setups.json 从 /v1/alg/sets/3x3/oll 抓下来,
//      正是 CaseThumb 喂给渲染器的那一串。两边分别模拟成 21 格「黄 / 非黄」再比。
//   2. 随机 AUF 只把这 21 格整体转一下,不换 case。
//
// 模拟走 @cuberoot/visualcube 自己的 CubeData,和线上出图同一套转动语义。
import { DB_RECOGNIZE_SETS } from '@/lib/recognize-db-sets';
import { describe, it, expect } from 'vitest';
import { CubeData, AllFaces, Face, parseAlgorithm } from '@cuberoot/visualcube';
import DB_SETUPS from './fixtures/oll_db_setups.json';
import ollMap from '@cuberoot/shared/data/oll.json';
import { inverseScramble } from '@/lib/scramble-generator';
import { OLL_SET, PLL_SET, ollCaseName, ollCaseNumber, recognizeSetFor } from '@/lib/recognize-sets';
import { keysToCases } from '@/lib/pll-helpers';
import { SQ1_SHAPE_SET, sq1TopLayerQuestions } from '@/lib/recognize-sq1-shapes';
import type { AlgCase } from '@cuberoot/shared';

const typedOll = ollMap as Record<string, { alg: string }>;
const setups = DB_SETUPS as Record<string, string>;

/** 一整个魔方的贴纸色,每格记它出厂在哪个面。 */
function stateAfter(alg: string): Record<number, string[]> {
  const init: Record<number, string[]> = {};
  for (const f of AllFaces) init[f] = Array(9).fill(String(f));
  const cube = new CubeData(3, init);
  for (const turn of parseAlgorithm(alg)) cube.turn(turn);
  return cube.faces;
}

/** 侧面顶排是哪 12 格?转一下 U,变了的那些就是 —— 不用手抄编号表。 */
const RIM: Array<[number, number]> = (() => {
  const solved = stateAfter('');
  const turned = stateAfter('U');
  const rim: Array<[number, number]> = [];
  for (const f of AllFaces) {
    if (f === Face.U || f === Face.D) continue;
    for (let i = 0; i < 9; i++) if (solved[f][i] !== turned[f][i]) rim.push([f, i]);
  }
  return rim;
})();

/** U 面 9 格 + 侧面顶排 12 格,每格只记「是不是顶面色」。OLL 认的就是这 21 位。 */
function topMask(alg: string): boolean[] {
  const after = stateAfter(alg);
  const up = String(Face.U);
  return [
    ...after[Face.U].map((v) => v === up),
    ...RIM.map(([f, i]) => after[f][i] === up),
  ];
}

const AUFS = ['', 'U', 'U2', "U'"];
const Y_ROTS = ['', 'y', 'y2', "y'"];

const eq = (a: boolean[], b: boolean[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 两张题面是不是同一个 OLL —— 允许整体转过。 */
const sameCase = (a: string, b: string) =>
  Y_ROTS.some((r) => eq(topMask(a), topMask(`${b} ${r}`)));

const mine = (n: number) => inverseScramble(typedOll[ollCaseName(n)].alg);

describe('OLL 题面 = /alg 库里那张图', () => {
  it('顶排恰好 12 格', () => {
    expect(RIM).toHaveLength(12);
  });

  it('57 张全部对得上 DB 的 setup', () => {
    const wrong: string[] = [];
    for (let n = 1; n <= 57; n++) {
      if (!sameCase(mine(n), setups[ollCaseName(n)])) wrong.push(ollCaseName(n));
    }
    expect(wrong).toEqual([]);
  });

  it('57 张两两不同 —— 撞了就说明有题永远答不对', () => {
    const seen = new Map<string, string>();
    for (let n = 1; n <= 57; n++) {
      // 取 4 个朝向里字典序最小的那个当规范形。
      const canon = Y_ROTS
        .map((r) => topMask(`${mine(n)} ${r}`).map((b) => (b ? '1' : '0')).join(''))
        .sort()[0];
      expect(seen.get(canon), `${ollCaseName(n)} 与 ${seen.get(canon)} 同形`).toBeUndefined();
      seen.set(canon, ollCaseName(n));
    }
    expect(seen.size).toBe(57);
  });

  it('AUF 只是把这 21 格整体转一下,不换 case', () => {
    for (let n = 1; n <= 57; n++) {
      for (const auf of AUFS) expect(sameCase(`${mine(n)} ${auf}`, mine(n))).toBe(true);
    }
  });

  it('OLL_SET.image 出的就是这串 setup', () => {
    const c = { name: 'OLL 27', rotation: '', dTurn: 'U2', colorShift: 0, crossColor: 'w' };
    const img = OLL_SET.image(c, false);
    expect(img.view).toBe('oll');
    expect(img.hideGreySides).toBe(true);
    expect(img.setup).toBe(`${mine(27)} U2`);
    expect(sameCase(img.setup, setups['OLL 27'])).toBe(true);
  });
});

describe('OLL 编号输入', () => {
  const step = OLL_SET.step;

  it('6..9 开头唯一,当场交卷', () => {
    for (const d of ['6', '7', '8', '9']) {
      expect(step(null, d)).toEqual({ kind: 'answer', answer: `OLL ${d}` });
    }
  });

  it('1..5 开头要么再接一位,要么回车按一位数交', () => {
    expect(step(null, '1')).toEqual({ kind: 'pending', pending: '1' });
    expect(step('1', '2')).toEqual({ kind: 'answer', answer: 'OLL 12' });
    expect(step('5', '7')).toEqual({ kind: 'answer', answer: 'OLL 57' });
    expect(step('3', 'Enter')).toEqual({ kind: 'answer', answer: 'OLL 3' });
  });

  it('越界 / 前导零 / 非数字一律不受理', () => {
    expect(step('5', '8')).toEqual({ kind: 'ignore' });   // 58 > 57
    expect(step('5', '9')).toEqual({ kind: 'ignore' });
    expect(step(null, '0')).toEqual({ kind: 'ignore' });
    expect(step(null, 'a')).toEqual({ kind: 'ignore' });
    expect(step(null, 'Enter')).toEqual({ kind: 'ignore' });
  });

  it('答案就是 DB 的 case 名,和按钮上那个值一致', () => {
    const byValue = new Set(OLL_SET.buttons().map((b) => b.value));
    expect(byValue.size).toBe(57);
    for (let n = 1; n <= 57; n++) expect(byValue.has(ollCaseName(n))).toBe(true);
    expect(OLL_SET.buttons()[0]).toEqual({ value: 'OLL 1', label: 'DH', sub: '1' });
    expect(ollCaseNumber('OLL 27')).toBe(27);
    expect(ollCaseNumber('OLL 58')).toBeNull();
    expect(ollCaseNumber('Aa')).toBeNull();
  });
});

describe('PLL 字母输入没被动过', () => {
  const step = PLL_SET.step;

  it('单字母直接交,双字母要后缀', () => {
    expect(step(null, 'T')).toEqual({ kind: 'answer', answer: 'T' });
    expect(step(null, 'g')).toEqual({ kind: 'pending', pending: 'G' });
    expect(step('G', 'c')).toEqual({ kind: 'answer', answer: 'Gc' });
    expect(step('G', 'z')).toEqual({ kind: 'ignore' });
    expect(step(null, 'q')).toEqual({ kind: 'ignore' });
  });
});

describe('两个集合互不干扰', () => {
  it('各存各的 localStorage key', () => {
    expect(PLL_SET.storageKey).toBe('cuberoot-session-store');
    expect(OLL_SET.storageKey).not.toBe(PLL_SET.storageKey);
  });

  it('一轮的题量:PLL 73(按对称性展开朝向),OLL 57(每 case 一次)', () => {
    expect(PLL_SET.allKeys()).toHaveLength(73);
    expect(OLL_SET.allKeys()).toHaveLength(57);
  });

  it('PLL 用 d 转,OLL 用 U 转', () => {
    expect(PLL_SET.turnOptions).toEqual(['', 'd', 'd2', "d'"]);
    expect(OLL_SET.turnOptions).toEqual(['', 'U', 'U2', "U'"]);
  });

  it('队列里的名字查得到公式 —— 原来这一条就是坏的', () => {
    for (const recog of [PLL_SET, OLL_SET]) {
      const cases = keysToCases(recog.allKeys(), ['w'], recog.includeNoAuf, recog.turnOptions);
      for (const c of cases) {
        expect(recog.solution(c.name), `${recog.id} ${c.name}`).not.toBe('');
        expect(recog.image(c, false).setup.trim()).not.toBe('');
      }
    }
  });

  it('未知 set 落回 PLL,不炸页面', () => {
    expect(recognizeSetFor('pll')).toBe(PLL_SET);
    expect(recognizeSetFor('oll')).toBe(OLL_SET);
    expect(recognizeSetFor('zbll')).toBe(DB_RECOGNIZE_SETS.zbll);
    expect(recognizeSetFor('sq1-shape')).toBe(SQ1_SHAPE_SET);
    expect(recognizeSetFor('vls')).toBe(PLL_SET);
  });
});

describe('Square-1 单层形状命名', () => {
  const algCase = (name: string): AlgCase => ({
    name,
    subgroup: '',
    setup: '',
    sticker: { kind: 'raw', tag: 'sq1', attrs: {} },
    algs: [[]],
  });

  it('只取顶层名称,按 CS 顺序去重,忽略非法与空名称', () => {
    const questions = sq1TopLayerQuestions([
      algCase('Kite / Square'),
      algCase('Kite / Barrel'),
      algCase('Square / Kite'),
      algCase(' / Star'),
      algCase('broken'),
    ]);
    expect(questions.map(({ name }) => name)).toEqual(['Kite', 'Square']);
    expect(questions[0].source.name).toBe('Kite / Square');
  });

  it('使用独立进度、无随机转层,空题库时安全', () => {
    expect(SQ1_SHAPE_SET.storageKey).toBe('cuberoot-session-store-sq1-shape');
    expect(SQ1_SHAPE_SET.turnOptions).toEqual(['']);
    expect(SQ1_SHAPE_SET.includeNoAuf).toBe(true);
    expect(SQ1_SHAPE_SET.allKeys()).toEqual([]);
    expect(SQ1_SHAPE_SET.buttons()).toEqual([]);
  });
});

describe('DB 题库的四套(COLL / ELL / ZBLL / 1LLL)', () => {
  it('题库没拉下来时是空题库,而不是抛异常', () => {
    for (const id of ['coll', 'ell', 'zbll', '1lll'] as const) {
      const recog = DB_RECOGNIZE_SETS[id];
      expect(recog.allKeys()).toEqual([]);
      expect(recog.buttons()).toEqual([]);
      expect(recog.solution('nope')).toBe('');
      expect(recog.image({ name: 'nope', rotation: '', dTurn: '', colorShift: 0, crossColor: 'w' }, false).setup)
        .toBe('');
    }
  });

  it('不随机 AUF —— 这几套的名字带角块换位,拧一下顶层就是另一个 case', () => {
    for (const id of ['coll', 'ell', 'zbll', '1lll'] as const) {
      expect(DB_RECOGNIZE_SETS[id].turnOptions).toEqual(['']);
      expect(DB_RECOGNIZE_SETS[id].includeNoAuf).toBe(true);
    }
  });

  it('大套装答子组,小套装答 case 名', () => {
    expect(DB_RECOGNIZE_SETS.zbll.answerFor).toBeTypeOf('function');
    expect(DB_RECOGNIZE_SETS['1lll'].answerFor).toBeTypeOf('function');
    // 题库还没拉时,answerFor 查不到 case 就原样返回,判定退化成「答 case 名」而不是崩。
    expect(DB_RECOGNIZE_SETS.zbll.answerFor!('ZBLL U 1')).toBe('ZBLL U 1');
  });

  it('1LLL 用编号输入,规则和 OLL 那套一致(题库空时一律不受理)', () => {
    const step = DB_RECOGNIZE_SETS['1lll'].step;
    expect(step(null, '1')).toEqual({ kind: 'pending', pending: '1' });
    expect(step(null, '0')).toEqual({ kind: 'ignore' });
    expect(step('5', '8')).toEqual({ kind: 'ignore' });
    // 编号合法但题库还没到 → 没有这个答案,不受理。
    expect(step(null, '7')).toEqual({ kind: 'ignore' });
  });
});
