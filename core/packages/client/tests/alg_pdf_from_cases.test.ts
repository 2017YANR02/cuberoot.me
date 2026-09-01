// `AlgCase[]` → 打印表的换算(lib/alg_pdf/from_cases)。纯数据层,不碰 jsPDF/DOM。
//
// 这里锁的都是「印错了就是条错公式 / 印出来没法用」的规矩:收尾 AUF 剥不剥、
// 一张 case 印几条、多视角怎么摊开、单组不出组标题。
import { describe, it, expect } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import { algSheetFromCases, DEFAULT_MAX_ALGS } from '@/lib/alg_pdf/from_cases';
import { sq1EpNumericCaseName, sq1EpNumericGroupName } from '@/lib/sq1-ep-parity';

function mkCase(over: Partial<AlgCase> & { name: string }): AlgCase {
  return {
    sticker: { kind: 'oll' },
    algs: [[]],
    ...over,
  } as AlgCase;
}

const base = { puzzle: '3x3' as const, set: 'pll', title: 'T', filename: 'f' };

describe('algSheetFromCases', () => {
  it('默认只印前几条公式(库里一张 PLL 挂十几条,全印就是五页纸)', () => {
    const algs = Array.from({ length: 9 }, (_, i) => ({ alg: `R U${i} R'` }));
    const sheet = algSheetFromCases({
      ...base,
      cases: [mkCase({ name: 'Aa', algs: [algs] })],
    });
    expect(sheet.cases[0].algs).toHaveLength(DEFAULT_MAX_ALGS);
    expect(sheet.cases[0].algs[0]).toBe("R U0 R'");
  });

  it('rawAlg 保留收尾 AUF —— 换位子剥了就是条错公式', () => {
    const c = mkCase({ name: 'AD', algs: [[{ alg: "R U R' U" }]] });
    const stripped = algSheetFromCases({ ...base, cases: [c] });
    const raw = algSheetFromCases({ ...base, cases: [c], rawAlg: true });
    expect(stripped.cases[0].algs[0]).toBe("R U R'");
    expect(raw.cases[0].algs[0]).toBe("R U R' U");
  });

  it('allOris:一张 case 摊成每视角一格,计数仍按 case 算', () => {
    const c = mkCase({
      name: 'A+',
      oriNames: ['FR', 'FL'],
      algs: [[{ alg: "R U R'" }], [{ alg: "L' U' L" }]],
    });
    const sheet = algSheetFromCases({ ...base, set: 'f2l', cases: [c], allOris: true, sourcePath: '/x' });
    expect(sheet.cases).toHaveLength(2);
    expect(sheet.cases.map(x => x.sub)).toEqual(['FR', 'FL']);
    expect(sheet.cases[1].algs[0]).toBe("L' U' L");
    expect(sheet.subtitle).toContain('1 case');
  });

  it('只有一个子组就不出组标题(一条横贯标题挂全部 case = 白占一行)', () => {
    const one = [mkCase({ name: 'a', subgroup: 'G' }), mkCase({ name: 'b', subgroup: 'G' })];
    const two = [mkCase({ name: 'a', subgroup: 'G' }), mkCase({ name: 'b', subgroup: 'H' })];
    expect(algSheetFromCases({ ...base, cases: one }).cases.every(c => c.group === undefined)).toBe(true);
    expect(algSheetFromCases({ ...base, cases: two }).cases.map(c => c.group)).toEqual(['G', 'H']);
  });

  it('thumbs / setups 关掉后不带图、不带打乱(纯文字字典)', () => {
    const c = mkCase({ name: 'AD', setup: "R U R'", algs: [[{ alg: 'x' }]] });
    const full = algSheetFromCases({ ...base, cases: [c] });
    const text = algSheetFromCases({ ...base, cases: [c], thumbs: false, setups: false });
    expect(full.cases[0].thumb).toBeTruthy();
    expect(full.cases[0].setup).toBe("R U R'");
    expect(text.cases[0].thumb).toBeUndefined();
    expect(text.cases[0].setup).toBeUndefined();
  });

  it('标签筛选作用在公式上,缩略图仍取未筛选的首条', () => {
    const c = mkCase({
      name: 'Aa',
      algs: [[{ alg: "R U R'" }, { alg: "L U L'", tags: ['oh'] }]],
    });
    const sheet = algSheetFromCases({
      ...base,
      cases: [c],
      algFilter: (a) => !!a.tags?.includes('oh'),
    });
    expect(sheet.cases[0].algs).toEqual(["L U L'"]);
    expect(sheet.cases[0].thumb?.alg).toBe("R U R'");
  });

  it('公式行可由页面覆盖，PDF 缩略图仍使用原 case', () => {
    const c = mkCase({
      name: 'Aa',
      algs: [[{ alg: "R U R'", tags: ['oh'] }]],
    });
    const sheet = algSheetFromCases({
      ...base,
      cases: [c],
      algsFor: () => [{ alg: "L' U' L", tags: ['oh'] }],
    });
    expect(sheet.cases[0].algs).toEqual(["L' U' L"]);
    expect(sheet.cases[0].thumb?.alg).toBe("R U R'");
  });

  it('Square-1 PDF 缩略图跟随网页的黑顶开关', () => {
    const c = mkCase({ name: 'Kite', algs: [[{ alg: '(1,0) / (-1,0)' }]] });
    const black = algSheetFromCases({
      ...base, puzzle: 'sq1', set: 'cs', cases: [c], sq1BlackTop: true,
    });
    const yellow = algSheetFromCases({
      ...base, puzzle: 'sq1', set: 'cs', cases: [c], sq1BlackTop: false,
    });
    expect(black.cases[0].thumb?.sq1BlackTop).toBe(true);
    expect(yellow.cases[0].thumb?.sq1BlackTop).toBe(false);
  });

  it('caseLabel 和 groupLabel 让 Square-1 PDF 完整跟随页面的数字命名', () => {
    const cases = [
      mkCase({ name: 'Adj / H', subgroup: 'Top Adj', algs: [[{ alg: '(1,0) / (-1,0)' }]] }),
      mkCase({ name: 'H / Opp', subgroup: 'Top H', algs: [[{ alg: '(1,0) / (-1,0)' }]] }),
    ];
    const sheet = algSheetFromCases({
      ...base,
      puzzle: 'sq1',
      set: 'ep',
      cases,
      caseLabel: c => sq1EpNumericCaseName(c.name) ?? c.name,
      groupLabel: subgroup => sq1EpNumericGroupName(subgroup) ?? subgroup,
    });
    expect(sheet.cases.map(item => item.name)).toEqual(['2.+', '+.1']);
    expect(sheet.cases.map(item => item.group)).toEqual(['2.*', '+.*']);
    expect(cases.map(item => item.name)).toEqual(['Adj / H', 'H / Opp']);
  });

  it('Square-1 EP PDF 先保留无特 / 有特分节，再保留组标题', () => {
    const cases = [
      mkCase({ name: 'Solved / H', subgroup: 'Top Solved' }),
      mkCase({ name: 'Opp & Solved', subgroup: 'Top Opp' }),
    ];
    const sheet = algSheetFromCases({
      ...base,
      puzzle: 'sq1',
      set: 'ep',
      cases,
      sectionOf: c => c.name.includes('&') ? '有特' : '无特',
    });
    expect(sheet.cases.map(item => ({ section: item.section, group: item.group }))).toEqual([
      { section: '无特', group: 'Top Solved' },
      { section: '有特', group: 'Top Opp' },
    ]);
  });

  it('PDF 缩略图跟随网页的识别简化开关', () => {
    const c = mkCase({ name: 'T', algs: [[{ alg: "R U R'" }]] });
    const plain = algSheetFromCases({ ...base, cases: [c] });
    const simplified = algSheetFromCases({ ...base, cases: [c], simplifyRecognition: true });
    expect(plain.cases[0].thumb?.simplifyRecognition).toBeUndefined();
    expect(simplified.cases[0].thumb?.simplifyRecognition).toBe(true);
  });

  it('PDF 缩略图跟随网页选择的魔方拿法', () => {
    const c = mkCase({ name: 'T', algs: [[{ alg: "R U R'" }]] });
    const sheet = algSheetFromCases({ ...base, cases: [c], orientation: '' });
    expect(sheet.cases[0].thumb?.orientation).toBe('');
  });

  it('PDF 的图、打乱和公式跟随网页观察角度', () => {
    const c = mkCase({
      name: 'T',
      setup: "R U R'",
      algs: [[{ alg: "U R U R' U" }]],
    });
    const sheet = algSheetFromCases({ ...base, cases: [c], viewAngle: 'u' });
    expect(sheet.cases[0].setup).toBe("R U R' U");
    expect(sheet.cases[0].thumb?.setup).toBe("R U R' U");
    expect(sheet.cases[0].thumb?.alg).toBe("R U R' U");
    expect(sheet.cases[0].algs).toEqual(["R U R'"]);
  });
});
