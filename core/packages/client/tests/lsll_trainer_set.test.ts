/**
 * LSLL 接进公用训练器的那一层(`lib/lsll/trainer-set`)。
 *
 * 这里只钉训练器真正依赖的契约:
 *  - 范围(`?scope=`)解析 / 反解 / 装出哪一批 case;
 *  - case 的形状 —— 名字能反解回 canonical key、subgroup 是它自己的大类、
 *    贴纸**不是** f2l(否则 `generateScramble` 会往打乱前面塞随机 y,把槽转出 FR);
 *  - 训练器给打乱套的随机首尾 AUF 不会把它换成另一个 case。
 *
 * 最后一条是唯一「靠推理成立」的一环:打乱本体由 `setupForCase` 自带的失安全校验保证
 * (回放一遍对不上就抛),但训练器还会在它首尾各接一个随机 U —— 那一步没人验过。
 * 枚举 16 种接法逐个回放判定,比论证可靠。
 */
import { describe, it, expect } from 'vitest';
import { generateScramble, pairPhaseLocked } from '@/lib/trainer-scramble';
import { caseKey } from '@/lib/trainer-case-key';
import { CATEGORIES, canonicalKey, classify, keyFromString, locateFromScramble, unpackState } from '@/lib/lsll/model';
import { compareAlgGroupLabel } from '@/lib/alg_group_order';
import {
  LSLL_SCOPE_COVERED, loadLsllCases, lsllCaseKeyString, lsllScopeParam,
  lsllSelectHref, parseLsllScope,
} from '@/lib/lsll/trainer-set';
import { applyAlg, extractLsll, solvedCube } from '@/lib/lsll/cube333';

const AUF = ['', 'U', 'U2', "U'"];

describe('?scope= 的解析与反解', () => {
  it('大类 / 大类+翻棱数 / 已收录 三种写法往返', () => {
    expect(parseLsllScope('ap')).toEqual({ category: 'ap', eoBad: null });
    expect(parseLsllScope('ap-eo2')).toEqual({ category: 'ap', eoBad: 2 });
    expect(parseLsllScope(LSLL_SCOPE_COVERED)).toEqual({ category: null, eoBad: null });
    expect(lsllScopeParam('ap', null)).toBe('ap');
    expect(lsllScopeParam('ap', -1)).toBe('ap');       // 大类页「全部」用 -1 表示不筛
    expect(lsllScopeParam('ap', 2)).toBe('ap-eo2');
    expect(lsllScopeParam(null)).toBe(LSLL_SCOPE_COVERED);
  });

  it('认不出的范围退回已收录,不留空场', () => {
    expect(parseLsllScope('zzz')).toEqual({ category: null, eoBad: null });
    expect(parseLsllScope(null)).toEqual({ category: null, eoBad: null });
    // O 是纯顶层(= 1LLL),LSLL 不练它;直链 ?scope=o 也退回已收录
    expect(parseLsllScope('o')).toEqual({ category: null, eoBad: null });
    expect(parseLsllScope('o-eo2')).toEqual({ category: null, eoBad: null });
  });

  it('「选 case」回各自的浏览页', () => {
    expect(lsllSelectHref(null)).toBe('/alg/lsll');
    expect(lsllSelectHref('ap')).toBe('/alg/lsll/ap');
    expect(lsllSelectHref('ap-eo2')).toBe('/alg/lsll/ap?eo=2');
  });
});

describe('装出来的 case', () => {
  it('已收录范围 = zbls 库 305 条去掉 O 组那 3 条 = 302 个,各自挂自己的大类', async () => {
    const cases = await loadLsllCases(LSLL_SCOPE_COVERED);
    expect(cases).toHaveLength(302);
    expect(new Set(cases.map(caseKey)).size).toBe(302);  // 训练进度按 caseKey 存,不能撞
    // O 组(对子已归位)合成出来是纯顶层 = 1LLL,LSLL 不收 —— 41 组而不是 42
    expect(new Set(cases.map(c => c.subgroup)).size).toBe(41);
    expect(cases.some(c => c.subgroup === 'O')).toBe(false);
    // 名字 = `大类字母 base36key`:组名就是那个字母(与 zbls 库同一套),key 要解得回来且已 canonical
    for (const c of cases) {
      const cat = CATEGORIES.find(x => x.letter === c.subgroup);
      expect(cat, c.subgroup).toBeTruthy();
      expect(c.name).toBe(`${c.subgroup} ${lsllCaseKeyString(c)}`);
      const key = keyFromString(lsllCaseKeyString(c));
      expect(key, c.name).not.toBeNull();
      expect(canonicalKey(unpackState(key!))).toBe(key);
      expect(classify(unpackState(key!)).category.letter).toBe(c.subgroup);
    }
  });

  it('已收录那批按全站组名序排:同字母 + 在 - 前', async () => {
    const cases = await loadLsllCases(LSLL_SCOPE_COVERED);
    const groups = [...new Set(cases.map(c => c.subgroup))];
    expect(groups).toEqual([...groups].sort(compareAlgGroupLabel));
    expect(groups.slice(0, 4)).toEqual(['A+', 'A-', 'B+', 'B-']);
  });

  it('大类范围 = 该大类全体;加翻棱数筛出真子集', async () => {
    const all = await loadLsllCases('ap');
    expect(all).toHaveLength(15552);
    expect(all.every(c => c.subgroup === 'A+')).toBe(true);
    expect(all.every(c => c.name.startsWith('A+ '))).toBe(true);

    const eo2 = await loadLsllCases('ap-eo2');
    expect(eo2.length).toBeGreaterThan(0);
    expect(eo2.length).toBeLessThan(all.length);
    const inAll = new Set(all.map(c => c.name));
    expect(eo2.every(c => inAll.has(c.name))).toBe(true);
  });

  it('贴纸不是 f2l —— 否则训练器会给打乱前面加随机 y,把最后一槽转出 FR', async () => {
    const [c] = await loadLsllCases(LSLL_SCOPE_COVERED);
    expect(c.sticker.kind).not.toBe('f2l');
    // 打乱还没现算出来时是空的(store 抽到哪条解哪条),不是拿别的东西凑一条
    expect(c.setup).toBe('');
    expect(generateScramble(c, '3x3', 'inv', { preAuf: true, postAuf: true })).toBe('');
  });
});

describe('出题时对子相位锁死', () => {
  /**
   * 打乱是按展示相位算出来的(`model.pairDisplayTurn`:角在槽正上方 / 棱侧色对齐中心),
   * 尾部再接一个随机 U 就把对子转跑了 —— case 没变,但不是库里那张图。
   * 首部 AUF 不动对子(U 碰不到 DFR / FR),变的是收尾 AUF,照常随机。
   */
  const SETUP = "R U R' U' R U R' U'";   // 槽也拆了的一条,对子有块在顶层

  it('LSLL case 归 pairPhaseLocked 管(f2l 类同理)', async () => {
    const [c] = await loadLsllCases(LSLL_SCOPE_COVERED);
    expect(pairPhaseLocked(c)).toBe(true);
    expect(pairPhaseLocked({ ...c, sticker: { kind: 'f2l', fl: '' } })).toBe(true);
    expect(pairPhaseLocked({ ...c, sticker: { kind: 'raw', tag: 'zbll', attrs: {} } })).toBe(false);
  });

  it('60 次出题:对子恒在同一格,打乱本身仍在变', async () => {
    const [base] = await loadLsllCases(LSLL_SCOPE_COVERED);
    const c = { ...base, setup: SETUP };
    const phases = new Set<string>(), scrambles = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = generateScramble(c, '3x3', 'inv', { preAuf: true, postAuf: true });
      const got = extractLsll(applyAlg(solvedCube(), s));
      expect('broken' in got, `${s} 不再是 LSLL 局面`).toBe(false);
      if ('broken' in got) continue;
      const cpos = got.state.cp.indexOf(4), epos = got.state.ep.indexOf(4);
      phases.add(`${cpos}/${got.state.co[cpos]}/${epos}/${got.state.eo[epos]}`);
      scrambles.add(s);
    }
    expect([...phases]).toHaveLength(1);
    expect(scrambles.size, '首部 AUF 没在随机').toBeGreaterThan(1);
  });

  it('关掉首部 AUF 就是打乱原文,一个字符不加', async () => {
    const [base] = await loadLsllCases(LSLL_SCOPE_COVERED);
    const c = { ...base, setup: SETUP };
    for (let i = 0; i < 20; i++) {
      expect(generateScramble(c, '3x3', 'inv', { preAuf: false, postAuf: true })).toBe(SETUP);
    }
  });
});

describe('训练器给打乱套的随机首尾 AUF 不换 case', () => {
  /**
   * 起手 U^a 与收尾 U^b 都只动顶层(FR 槽的 DFR / FR 两块不在 U 层),得到的仍是 LSLL 局面,
   * 且落在同一条 Z4×Z4 轨道上 —— case 正是按这条轨道定义的。16 种接法逐个回放判定。
   *
   * 取两条打乱:一条纯顶层(Sune 逆,槽已归位),一条把槽也搅了 —— 后者才真正考验
   * 「起手 U 不会把槽块挪走」。
   */
  const SETUPS = [
    "R U2 R' U' R U' R'",           // Sune 逆:LL 内部
    "R U R' U' R U R' U' R U R'",   // 槽也拆了(FR 槽块跑进顶层)
  ];

  for (const setup of SETUPS) {
    it(`\`${setup}\` 的 16 种 AUF 接法都落在同一个 case`, () => {
      const base = locateFromScramble(setup);
      expect(base.ok).toBe(true);
      if (!base.ok) return;
      for (const pre of AUF) {
        for (const post of AUF) {
          const s = [pre, setup, post].filter(Boolean).join(' ');
          const got = extractLsll(applyAlg(solvedCube(), s));
          expect('broken' in got, `${s} 不再是 LSLL 局面`).toBe(false);
          if ('broken' in got) continue;
          expect(canonicalKey(got.state), `${s} 换成了别的 case`).toBe(base.key);
        }
      }
    });
  }
});
