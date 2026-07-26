import { describe, it, expect, beforeEach } from 'vitest';

// 合练(多套公式集混成一场练)的三条硬约定:
//  1) case key:单集会话逐字节不变(历史进度不能失效),合练才加 set 前缀;
//  2) 进度回写:合练里标的标记 / 打的记忆分,落到**各成员 set 自己的**命名空间,
//     用的还是 set 内原始 key —— 单独进那一套时看到的就是同一份;
//  3) `?sets=` 解析:只认该 puzzle 真实存在的 slug,去重后排序(组合与顺序无关)。

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
const g = globalThis as unknown as { window?: unknown; localStorage?: ReturnType<typeof makeLocalStorage> };
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage();

const { caseKey, splitCaseKey, groupKeysBySet } = await import('@/lib/trainer-case-key');
const { parseMixSets, MIX_SLUG } = await import('@/lib/alg-mix');
const { mixSessionId, roomSetId, useTrainerStore } = await import('@/lib/trainer-store');
const { useTrainerMarks, markStatus } = await import('@/lib/trainer-marks');
const { useAlgSrs } = await import('@/lib/alg-srs-store');
const { ALG_CATALOG } = await import('@cuberoot/shared');

const readLocal = (key: string) => JSON.parse(g.localStorage!.getItem(key) ?? '{}') as Record<string, unknown>;

describe('合练 case key', () => {
  it('单集会话的 key 与历史格式逐字节相同', () => {
    expect(caseKey({ subgroup: 'U', name: 'Ua' })).toBe('U|Ua');
  });

  it('合练里带上来源 set —— 两套里的同名组不再串味', () => {
    const pll = caseKey({ subgroup: 'T', name: 'T', srcSet: 'pll' });
    const zbll = caseKey({ subgroup: 'T', name: 'T', srcSet: 'zbll' });
    expect(pll).toBe('pll:T|T');
    expect(zbll).toBe('zbll:T|T');
    expect(pll).not.toBe(zbll);
  });

  it('拆 key 只认成员表里的前缀,免得把含冒号的 subgroup 拆坏', () => {
    expect(splitCaseKey('zbll:U|Ua', ['pll', 'zbll'])).toEqual({ set: 'zbll', raw: 'U|Ua' });
    expect(splitCaseKey('U|Ua', ['pll', 'zbll'])).toEqual({ set: null, raw: 'U|Ua' });
    // 前缀不是成员 → 当普通 key,不乱拆
    expect(splitCaseKey('weird:x|y', ['pll'])).toEqual({ set: null, raw: 'weird:x|y' });
    // 单集会话(无成员表)一律不拆
    expect(splitCaseKey('zbll:U|Ua', null)).toEqual({ set: null, raw: 'zbll:U|Ua' });
  });

  it('按成员 set 分组', () => {
    const m = groupKeysBySet(['pll:T|T', 'zbll:U|Ua', 'pll:U|Ua'], ['pll', 'zbll']);
    expect(m.get('pll')?.map(x => x.raw)).toEqual(['T|T', 'U|Ua']);
    expect(m.get('zbll')?.map(x => x.raw)).toEqual(['U|Ua']);
  });
});

describe('?sets= 解析与会话 id', () => {
  it('只留真实存在的 slug,去重 + 排序', () => {
    expect(parseMixSets('3x3', 'zbll,pll')).toEqual(['pll', 'zbll']);
    expect(parseMixSets('3x3', 'pll, zbll ,pll')).toEqual(['pll', 'zbll']);
    expect(parseMixSets('3x3', 'pll,nope')).toEqual(['pll']);
    expect(parseMixSets('3x3', '')).toEqual([]);
    expect(parseMixSets(null, 'pll')).toEqual([]);
  });

  it('mix 不是任何真实 set 的 slug(哨兵段不会撞名)', () => {
    for (const sets of Object.values(ALG_CATALOG)) {
      expect(sets.some(s => s.slug === MIX_SLUG)).toBe(false);
    }
  });

  it('成员顺序不影响会话 id —— 「PLL+ZBLL」和「ZBLL+PLL」是同一场', () => {
    expect(mixSessionId(['zbll', 'pll'])).toBe(mixSessionId(['pll', 'zbll']));
    expect(mixSessionId(['pll', 'zbll'])).toBe('mix:pll+zbll');
  });

  it('房间 set id 净化成 [A-Za-z0-9_-] 且不超 48(服务端校验)', () => {
    const ok = /^[A-Za-z0-9_-]{1,48}$/;
    expect(roomSetId('mix:pll+zbll')).toMatch(ok);
    expect(roomSetId('zbll')).toBe('zbll');
    const many = mixSessionId(ALG_CATALOG['3x3'].map(s => s.slug));
    expect(roomSetId(many)).toMatch(ok);
    // 长到要哈希时仍然是稳定映射(建房与加入两边算出同一个)
    expect(roomSetId(many)).toBe(roomSetId(many));
  });
});

describe('合练进度回写各自的 set', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(); });

  it('标记落在成员 set 自己的表里,用的是 set 内原始 key', () => {
    useTrainerMarks.getState().loadMarksMulti('3x3', ['pll', 'zbll']);
    useTrainerMarks.getState().applyMarks(['zbll:U|Ua', 'pll:T|T'], { s: 'mastered' });

    // 各回各家,键不带前缀 ⟹ 单独进 /alg/3x3/zbll 时读到的就是这一条
    expect(readLocal('trainer:marks:3x3/zbll')).toHaveProperty('U|Ua');
    expect(readLocal('trainer:marks:3x3/pll')).toHaveProperty('T|T');
    expect(readLocal('trainer:marks:3x3/zbll')).not.toHaveProperty('pll:T|T');
    // 合练自己那张表(带前缀)供 UI 用
    expect(markStatus(useTrainerMarks.getState().marks, 'zbll:U|Ua')).toBe('mastered');
  });

  it('单独练时标的,合练装载后照样看得见', () => {
    useTrainerMarks.getState().loadMarks('3x3', 'zbll');
    useTrainerMarks.getState().applyMarks(['U|Ua'], { s: 'learning' });

    useTrainerMarks.getState().loadMarksMulti('3x3', ['pll', 'zbll']);
    expect(markStatus(useTrainerMarks.getState().marks, 'zbll:U|Ua')).toBe('learning');
  });

  it('记忆排期同样按成员 set 落地', () => {
    useAlgSrs.getState().loadSrsMulti('3x3', ['pll', 'zbll']);
    useAlgSrs.getState().grade('zbll:U|Ua', 3);

    const recs = readLocal('srs:recs:3x3/zbll') as Record<string, { n: number }>;
    expect(recs['U|Ua']?.n).toBe(1);
    expect(readLocal('srs:recs:3x3/pll')).toEqual({});
    expect(useAlgSrs.getState().recs['zbll:U|Ua']?.n).toBe(1);
  });

  it('单集会话的写入路径不受影响(整表照旧落当前 set)', () => {
    useAlgSrs.getState().loadSrs('3x3', 'pll');
    useAlgSrs.getState().grade('T|T', 3);
    const recs = readLocal('srs:recs:3x3/pll') as Record<string, { n: number }>;
    expect(recs['T|T']?.n).toBe(1);
  });
});

describe('首开合练的默认选择', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(); });

  const mk = (srcSet: string, name: string) => ({
    subgroup: 'T', name, srcSet, standard: "R U R' U'", algs: [], sticker: { kind: 'pll' },
  } as unknown as import('@cuberoot/shared').AlgCase);
  const mixCases = [mk('pll', 'T'), mk('zbll', 'Ua'), mk('zbll', 'Ub')];

  it('头一次进就全选 —— 点「直接开练」不该撞上「尚未选 case」', () => {
    useTrainerStore.getState().loadMixSession('3x3', ['zbll', 'pll'], mixCases);
    expect(useTrainerStore.getState().selected.sort()).toEqual(
      ['pll:T|T', 'zbll:T|Ua', 'zbll:T|Ub'],
    );
  });

  it('开过之后取消到零 = 用户本意,重进不再自动全选', () => {
    useTrainerStore.getState().loadMixSession('3x3', ['pll', 'zbll'], mixCases);
    useTrainerStore.getState().setSelected([]);
    useTrainerStore.getState().loadMixSession('3x3', ['pll', 'zbll'], mixCases);
    expect(useTrainerStore.getState().selected).toEqual([]);
  });

  it('单集会话照旧空选(先经 select 页挑 case)', () => {
    const single = [mk('pll', 'T')].map(c => ({ ...c, srcSet: undefined }));
    useTrainerStore.getState().loadSession('3x3', 'pll', single);
    expect(useTrainerStore.getState().selected).toEqual([]);
  });
});
