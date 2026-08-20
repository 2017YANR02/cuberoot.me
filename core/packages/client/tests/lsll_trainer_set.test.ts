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
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { generateScramble } from '@/lib/trainer-scramble';
import { caseKey } from '@/lib/trainer-case-key';
import { virtualAlgSet } from '@/lib/alg-virtual-sets';
import {
  CATEGORIES, canonicalKey, classify, composeState, keyFromString, keyToString,
  locateFromScramble, unpackState,
} from '@/lib/lsll/model';
import { compareAlgGroupLabel } from '@/lib/alg_group_order';
import {
  LSLL_SCOPE_COVERED, loadLsllCases, lsllCaseKeyString, lsllScopeParam,
  lsllSelectHref, parseLsllScope, routeVariants,
} from '@/lib/lsll/trainer-set';
import { allZbllCases, solvedZbllKey } from '@/lib/lsll/class3';
import { ZBLS_COVERED_KEYS } from '@/lib/lsll/zbls_overlay';
import { applyAlg, extractLsll, solvedCube } from '@/lib/lsll/cube333';

const AUF = ['', 'U', 'U2', "U'"];

/**
 * 已收录范围装 case 时会问一次 `/v1/alg/lsll/htm`(挑 mid-AUF)。测试里一律拦下来:
 * 放它出去就是拿线上数据当断言依据,断网 / CI 无出网都会红。
 *
 * `htmFor` 返回 undefined = 这个 key 还没回填。默认全都没回填 —— 于是每条路线取
 * `variants[0]`(不插 AUF),正是 2026-07-28 之前的老口径,下面那批老断言原样成立。
 */
function stubHtm(htmFor: (key: number) => number | undefined = () => undefined): () => number[] {
  const asked: number[] = [];
  vi.stubGlobal('fetch', async (input: string) => {
    const keys = new URL(input, 'https://x').searchParams.get('keys')!.split(',');
    const htm: Record<string, number> = {};
    for (const s of keys) {
      const k = keyFromString(s)!;
      asked.push(k);
      const v = htmFor(k);
      if (v !== undefined) htm[s] = v;
    }
    return { ok: true, json: async () => ({ htm }) };
  });
  return () => asked;
}

beforeEach(() => { stubHtm(); });
afterEach(() => vi.unstubAllGlobals());

/**
 * mid-AUF —— 做完 ZBLS、开始 ZBLL 之前插的那下 `U^n`。它不是解法的一部分(识别顶层本来就要
 * 转到位),所以一条两步路线有 ≤4 种走法,落在 ≤4 个**不同的** LSLL case 上,最优步数可以差
 * 好几步。训练器要练最短的那个。
 *
 * 这里钉两层:变体本身的代数性质(与后端无关,纯算),以及「问不到步数时退回哪一个」。
 */
describe('两步路线的 mid-AUF 变体', () => {
  const zbls = (i: number) => unpackState(keyFromString(ZBLS_COVERED_KEYS[i])!);

  it('变体数只由 ZBLL 决定:480 个满 4、10 个塌成 2、4 个塌成 1', () => {
    // 「只由 ZBLL 决定」是条实打实的断言 —— 换几条完全不同的 ZBLS 打乱,直方图必须一模一样
    for (const i of [0, 37, 150, 301]) {
      const hist: Record<number, number> = {};
      for (const z of allZbllCases()) {
        const n = routeVariants(unpackState(z), zbls(i)).length;
        hist[n] = (hist[n] ?? 0) + 1;
      }
      expect(hist, ZBLS_COVERED_KEYS[i]).toEqual({ 1: 4, 2: 10, 4: 480 });
    }
  });

  it('全解顶层那条塌成 1 个 —— 纯 ZBLS,插 AUF 只是换个收尾相位', () => {
    expect(routeVariants(unpackState(solvedZbllKey()), zbls(0))).toHaveLength(1);
  });

  it('下标 0 恒为「不插 AUF」那个', () => {
    for (const z of allZbllCases().slice(0, 40)) {
      const s = unpackState(z);
      expect(routeVariants(s, zbls(7))[0]).toBe(canonicalKey(composeState(s, zbls(7))));
    }
  });

  it('同一条路线的变体第一眼完全一样 —— 换的只是收尾,不是这条路线本身', () => {
    for (const z of allZbllCases().slice(0, 60)) {
      const vs = routeVariants(unpackState(z), zbls(11));
      const look = vs.map((k) => {
        const c = classify(unpackState(k));
        return `${c.category.letter}/${c.eoBad}`;
      });
      expect(new Set(look).size, keyToString(z)).toBe(1);
    }
  });
});

describe('训练器在变体里挑最短的那个', () => {
  /** 每个 case 都换一份新模块 —— `lsllHtmBatch` 的缓存是模块级的,不隔离就串味。 */
  const freshLoad = async () => (await import('@/lib/lsll/trainer-set')).loadLsllCases;

  const keysOf = (cs: AlgCase[]) => cs.map(c => keyFromString(lsllCaseKeyString(c))!);
  const groupsOf = (cs: AlgCase[]) => cs.map(c => c.subgroup).sort();

  it('一个都没回填 = 全走不插 AUF,和接这套逻辑之前一模一样', async () => {
    vi.resetModules();
    const asked = stubHtm();
    const cases = await (await freshLoad())(LSLL_SCOPE_COVERED);
    expect(cases).toHaveLength(302);
    // 问过的 key 里含全部 302 条路线的全部变体,选出来的必是其中之一
    const askedSet = new Set(asked());
    expect(keysOf(cases).every(k => askedSet.has(k))).toBe(true);
  });

  it('步数并列时仍取不插 AUF 那个 —— 定序,免得同一轮每次刷出不同的 case', async () => {
    vi.resetModules();
    stubHtm();
    const base = await (await freshLoad())(LSLL_SCOPE_COVERED);

    vi.unstubAllGlobals();
    vi.resetModules();
    stubHtm(() => 12);
    const tied = await (await freshLoad())(LSLL_SCOPE_COVERED);
    expect(tied.map(c => c.name)).toEqual(base.map(c => c.name));
  });

  it('别的变体更短就换过去,而且换完还是同一批大类', async () => {
    vi.resetModules();
    stubHtm();
    const base = await (await freshLoad())(LSLL_SCOPE_COVERED);
    const baseKeys = new Set(keysOf(base));

    // 把「不插 AUF」那个判成 20 步、其余变体判成 10 步 ⇒ 只要有第二个变体就必须挪窝
    vi.unstubAllGlobals();
    vi.resetModules();
    stubHtm(k => (baseKeys.has(k) ? 20 : 10));
    const best = await (await freshLoad())(LSLL_SCOPE_COVERED);

    expect(best).toHaveLength(302);
    expect(new Set(keysOf(best)).size).toBe(302);          // 进度按 caseKey 存,不能撞
    // 第 1 轮 302 条路线里 4 条只有一个变体(收尾 ZBLL 是那 4 个塌成 1 的),挪不了;其余 298 条全挪
    expect(keysOf(best).filter(k => !baseKeys.has(k))).toHaveLength(298);
    expect(groupsOf(best)).toEqual(groupsOf(base));        // 第一眼没变 ⇒ 大类分布分毫不动
  });

  it('后端不在也照常开场 —— 退回不插 AUF,不是空场', async () => {
    vi.resetModules();
    stubHtm();
    const base = await (await freshLoad())(LSLL_SCOPE_COVERED);

    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    const offline = await (await freshLoad())(LSLL_SCOPE_COVERED);
    expect(offline.map(c => c.name)).toEqual(base.map(c => c.name));
  });
});

describe('?scope= 的解析与反解', () => {
  it('大类 / 大类+翻棱数 / 已收录 三种写法往返', () => {
    // round 见 tests/lsll_rounds.test.ts —— 大类范围不分轮,恒 1
    expect(parseLsllScope('ap')).toEqual({ category: 'ap', eoBad: null, round: 1 });
    expect(parseLsllScope('ap-eo2')).toEqual({ category: 'ap', eoBad: 2, round: 1 });
    expect(parseLsllScope(LSLL_SCOPE_COVERED)).toEqual({ category: null, eoBad: null, round: 1 });
    expect(lsllScopeParam('ap', null)).toBe('ap');
    expect(lsllScopeParam('ap', -1)).toBe('ap');       // 大类页「全部」用 -1 表示不筛
    expect(lsllScopeParam('ap', 2)).toBe('ap-eo2');
    expect(lsllScopeParam(null)).toBe(LSLL_SCOPE_COVERED);
  });

  it('认不出的范围退回已收录,不留空场', () => {
    expect(parseLsllScope('zzz')).toEqual({ category: null, eoBad: null, round: 1 });
    expect(parseLsllScope(null)).toEqual({ category: null, eoBad: null, round: 1 });
    // O 是纯顶层(= 1LLL),LSLL 不练它;直链 ?scope=o 也退回已收录
    expect(parseLsllScope('o')).toEqual({ category: null, eoBad: null, round: 1 });
    expect(parseLsllScope('o-eo2')).toEqual({ category: null, eoBad: null, round: 1 });
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

  it('进度页能从持久化 key 反建 case 并补回公式,坏 key 不混进来', async () => {
    const scramble = "R U R' U' R U R' U'";
    const located = locateFromScramble(scramble);
    expect(located.ok).toBe(true);
    if (!located.ok) return;

    const letter = located.category.letter;
    const storedKey = `${letter}|${letter} ${located.keyStr}`;
    const alg = invertMoveString(scramble).replace(/2'/g, '2');
    let caseRequests = 0;
    vi.stubGlobal('fetch', async (input: string) => {
      const url = new URL(input, 'https://x');
      if (url.pathname.endsWith(`/alg/lsll/case/${located.keyStr}`)) {
        caseRequests++;
        return { ok: true, json: async () => ({ status: 'ok', htm: 8, algs: [alg] }) };
      }
      throw new Error(`unexpected request: ${url.pathname}`);
    });

    const virtual = virtualAlgSet('3x3', 'lsll');
    expect(virtual?.casesFromStoredKeys).toBeTypeOf('function');
    const shells = virtual!.casesFromStoredKeys!([storedKey, storedKey, 'bad']);
    expect(shells.map(caseKey)).toEqual([storedKey]);
    expect(shells[0].setup).toBe('');
    expect(shells[0].algs).toEqual([[]]);
    expect(caseRequests).toBe(0);

    expect(virtual?.loadCasesByKeys).toBeTypeOf('function');
    const cases = await virtual!.loadCasesByKeys!([
      storedKey,
      storedKey,
      'bad',
      `${letter}|wrong 123`,
    ]);

    expect(cases.map(caseKey)).toEqual([storedKey]);
    expect(cases[0].setup).toBe(scramble);
    expect(cases[0].algs[0][0]?.alg).toBe(alg);
    expect(virtual!.caseHref(cases[0])).toBe(`/alg/lsll/case?k=${located.keyStr}`);
    expect(caseRequests).toBe(1);
  });
});

describe('对子相位由 post-AUF 开关决定', () => {
  /**
   * 打乱是按展示相位算出来的(`model.pairDisplayTurn`:角在槽正上方 / 棱侧色对齐中心)。
   * 收尾接一个随机 U 会把对子转离那一格 —— case 不变(同一条 Z4×Z4 轨道,下面那组 16 接法
   * 的测试逐个验过),变的只是呈现相位,而训练器各处的图都是从**实际打乱**渲染的,跟着一起转。
   *
   * 所以两种都是对的,交给开关:开 = 每次朝向不同(要先补 AUF 才能开搞,贴近真解);
   * 关 = 恒定在库里那张图的相位。首部 AUF 不动对子(U 碰不到 DFR / FR),两种情形下都随机。
   */
  const SETUP = "R U R' U' R U R' U'";   // 槽也拆了的一条,对子有块在顶层

  const pairPhase = (s: string): string => {
    const got = extractLsll(applyAlg(solvedCube(), s));
    expect('broken' in got, `${s} 不再是 LSLL 局面`).toBe(false);
    if ('broken' in got) return 'broken';
    const cpos = got.state.cp.indexOf(4), epos = got.state.ep.indexOf(4);
    return `${cpos}/${got.state.co[cpos]}/${epos}/${got.state.eo[epos]}`;
  };

  it('post-AUF 开:60 次出题把对子摆过 4 种相位', async () => {
    const [base] = await loadLsllCases(LSLL_SCOPE_COVERED);
    const c = { ...base, setup: SETUP };
    const phases = new Set<string>();
    for (let i = 0; i < 60; i++) phases.add(pairPhase(generateScramble(c, '3x3', 'inv', { preAuf: true, postAuf: true })));
    // U^0..U^3 各把对子送到一格 —— 60 抽还凑不齐 4 种的概率 ≈ 4·(3/4)^60 ≈ 1e-7
    expect(phases.size).toBe(4);
  });

  it('post-AUF 关:60 次出题对子恒在同一格,打乱本身仍在变', async () => {
    const [base] = await loadLsllCases(LSLL_SCOPE_COVERED);
    const c = { ...base, setup: SETUP };
    const phases = new Set<string>(), scrambles = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = generateScramble(c, '3x3', 'inv', { preAuf: true, postAuf: false });
      phases.add(pairPhase(s));
      scrambles.add(s);
    }
    expect([...phases]).toHaveLength(1);
    expect(scrambles.size, '首部 AUF 没在随机').toBeGreaterThan(1);
  });

  it('两个开关都关就是打乱原文,一个字符不加', async () => {
    const [base] = await loadLsllCases(LSLL_SCOPE_COVERED);
    const c = { ...base, setup: SETUP };
    for (let i = 0; i < 20; i++) {
      expect(generateScramble(c, '3x3', 'inv', { preAuf: false, postAuf: false })).toBe(SETUP);
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
