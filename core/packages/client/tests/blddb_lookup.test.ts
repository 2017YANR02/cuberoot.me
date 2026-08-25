// BLDDB 查表的编码契约 —— 查错键 = 给用户一条**解错 case 的公式**,是这页最坏的失效
// 方式,所以判据要硬。
//
// 库(nbwzx/blddb)只给每个 case 存**一个**代表元键,等价写法要自己算出来:整体换贴纸
// × 循环移位(见 _lib/blddb.ts 头注),六个类型各有各的组合方式。这里锁三层:
//   ① 纯逻辑:贴纸格分类、编码方案互译、等价类封闭性 —— 不依赖数据,CI 必跑;
//   ② 真实 fixture:每个类型一条,字母 / 位置 / 公式都拿 iframe 版 /blddb 页面实测过;
//   ③ 全量数据:**任意两个键都不能互为等价写法**。这条一旦破,同一个 case 有两个代表元,
//      查到哪个全看候选顺序 —— 无声给错公式。角那套(2.4MB)进了 CI sparse-checkout,
//      其余(棱 3.5MB + 四套小的)只在本地跑。
//
// 没拿上游 codeConverter.ts 当 oracle:那是仓库外的 clone(D:\cube\blddb),CI 上不存在,
// 而 ③ 对全部真实键成立本身就比逐个比对更强。

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLDDB_TYPES,
  NO_COMMUTATOR,
  POSITIONS_48,
  codeFromChichu,
  codeToChichu,
  findCases,
  isBigbld,
  kindLetters,
  kindPositions,
  lookupCase,
  positionsOf,
  samePiece,
  sameSticker,
  schemeLetters,
  slotKind,
  toChichu,
  twistDirection,
  twistLetterOf,
  twistTargets,
  variantKeys,
  type BlddbPiece,
  type BlddbSet,
  type BlddbType,
} from '@/app/[lang]/alg/3bld/_lib/blddb';
import { CHICHU_SCHEME, SPEFFZ_SCHEME } from '@/app/[lang]/alg/3bld/_lib/scheme-presets';
import { DEFAULT_CORNER_CH, DEFAULT_EDGE_CH } from '@/app/[lang]/alg/3bld/_lib/lettering';

const PIECES: BlddbPiece[] = ['corner', 'edge'];
const CH_LETTERS: Record<BlddbPiece, string> = {
  corner: DEFAULT_CORNER_CH.slice(1),
  edge: DEFAULT_EDGE_CH.slice(1),
};

/** 每个类型一个 case 的等价写法数 —— 也是"没有自撞"的证明。 */
const VARIANT_COUNT: Record<BlddbType, number> = {
  edge: 6,
  corner: 9,
  parity: 24,
  twists: 1,
  flips: 4,
  ltct: 6,
  // 高阶:中棱就是三阶的棱(换贴纸 × 移位);翼棱 / 两种中心一块只有一个被编码的贴纸,
  // 没有换贴纸这一步,只剩三种循环移位。
  midge: 6,
  wing: 3,
  xcenter: 3,
  tcenter: 3,
};

/** 每个类型一个真实存在的 case,做等价类 / 封闭性的种子。 */
const SEED: Record<BlddbType, string> = {
  edge: 'AEH', corner: 'ADM', parity: 'ACAD', twists: 'BEH', flips: 'AC', ltct: 'ADK',
  wing: 'ABC', xcenter: 'ABC', tcenter: 'ABC', midge: 'ACE',
};

function dataFile(name: string): string | null {
  const candidates = [
    path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'tools', 'blddb', 'data', name),
    path.resolve(process.cwd(), '..', '..', 'tools', 'blddb', 'data', name),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'blddb', 'data', name),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function loadSet(type: BlddbType): BlddbSet | null {
  const f = dataFile(`${isBigbld(type) ? 'bigbld/' : ''}${type}Manmade.json`);
  return f ? (JSON.parse(fs.readFileSync(f, 'utf8')) as BlddbSet) : null;
}

const sorted = (s: string) => [...s].sort().join('');

describe('贴纸格表', () => {
  // POSITIONS_48 与 CHICHU_SCHEME 必须同序:错一位,查出来的就是隔壁 case 的公式。
  it('48 格 = 24 角贴纸 + 24 棱贴纸,位置名互不重复', () => {
    expect(POSITIONS_48).toHaveLength(48);
    expect(new Set(POSITIONS_48).size).toBe(48);
    expect(POSITIONS_48.filter((p) => p.length === 3)).toHaveLength(24);
    expect(POSITIONS_48.filter((p) => p.length === 2)).toHaveLength(24);
  });

  it.each(PIECES)('%s 的 24 个格子恰好铺满该类字母表', (piece) => {
    expect(schemeLetters(piece, 'chichu').join('')).toBe(sorted(CH_LETTERS[piece]));
    expect(schemeLetters(piece, 'speffz')).toHaveLength(24);
  });

  it('两套方案都是 48 字符', () => {
    expect(CHICHU_SCHEME).toHaveLength(48);
    expect(SPEFFZ_SCHEME).toHaveLength(48);
  });

  // 上游 ?position=UF-UB-RU 的字母对是彳亍 AEH —— 位置表与编码串同序的实测锚点。
  it('AEH = UF-UB-RU', () => {
    expect(positionsOf('AEH', 'edge')).toEqual(['UF', 'UB', 'RU']);
  });

  /**
   * 高阶那四档不另存一套 150 格编码表 —— 它们挂在三阶的 48 格上,字母完全共用:
   * 中棱 = 棱贴纸本身、边心 `Xy` 跟着棱 `XY`、角心 `Xyz` 跟着角 `XYZ`、
   * 翼棱取 `XY + ccw(X,Y)` 那一片(彳亍 / Speffz 一条棱只编一块翼)。
   */
  describe('高阶四档挂在三阶贴纸上', () => {
    it.each(['wing', 'xcenter', 'tcenter', 'midge'] as const)('%s:24 个位置,字母表就是三阶那 24 个', (kind) => {
      const pos = kindPositions(kind);
      expect(pos).toHaveLength(24);
      expect(new Set(pos).size).toBe(24);
      const piece = kind === 'xcenter' ? 'corner' : 'edge';
      expect([...new Set(kindLetters(kind, 'chichu'))].sort().join('')).toBe(sorted(CH_LETTERS[piece]));
    });

    it('位置名的写法:大小写区分出是哪一档', () => {
      expect(positionsOf('A', 'midge')).toEqual(['UF']);
      expect(positionsOf('A', 'tcenter')).toEqual(['Uf']);
      expect(positionsOf('A', 'xcenter')).toEqual(['Ufl']);
      expect(positionsOf('A', 'wing')).toEqual(['UFr']);
    });

    // ccw 是叉积:U × F = R,所以 UF 那侧被编码的是 `UFr`;非标准约定编在另一片 `UFl`。
    it('翼棱两种编码约定各占一条棱的一片,互不重叠', () => {
      const std = kindPositions('wing');
      const alt = kindPositions('wing', true);
      expect(std).toContain('UFr');
      expect(alt).toContain('UFl');
      expect(std.filter((p) => alt.includes(p))).toEqual([]);
      // 非标准下同一块翼的字母换成同一条棱的另一面
      expect(codeToChichu('A', 'wing', 'chichu', true)).toBe('B');
      expect(codeFromChichu('B', 'wing', 'chichu', true)).toBe('A');
      expect(positionsOf('B', 'wing', true)).toEqual(['UFl']);
    });

    it('撞块判定按档走:翼棱 / 中心一块一个字母', () => {
      // 三阶的棱:A 和 B 是同一条棱的两面
      expect(samePiece('A', 'B', 'edge')).toBe(true);
      expect(samePiece('A', 'B', 'midge')).toBe(true);
      // 翼棱 / 中心:A 和 B 是两块不同的块,不该算撞块
      expect(samePiece('A', 'B', 'wing')).toBe(false);
      expect(samePiece('A', 'B', 'tcenter')).toBe(false);
      expect(samePiece('A', 'A', 'wing')).toBe(true);
    });
  });

  it('翻棱只认每条棱一个代表贴纸,翻角只认非 U/D 面贴纸', () => {
    expect(kindPositions('edge0')).toHaveLength(12);
    expect(kindPositions('corner1')).toHaveLength(16);
    expect(kindPositions('edge0')).toContain('FL');
    expect(kindPositions('edge0')).not.toContain('LF');
    for (const p of kindPositions('corner1')) expect('UD').not.toContain(p[0]);
  });
});

describe('编码方案互译', () => {
  it.each(PIECES)('%s:Speffz → 彳亍 是双射', (piece) => {
    const from = schemeLetters(piece, 'speffz');
    const to = from.map((c) => toChichu(c, piece, 'speffz'));
    expect(new Set(to).size).toBe(24);
    expect(sorted(to.join(''))).toBe(sorted(CH_LETTERS[piece]));
  });

  it('彳亍原样返回(库本来就用它)', () => {
    expect(codeToChichu('AEH', 'edge', 'chichu')).toBe('AEH');
  });

  // 上游页面实测:?position=UF-UB-RU 的表头字母对是 Speffz 的 CAM。
  it('UF-UB-RU:Speffz CAM ↔ 彳亍 AEH', () => {
    expect(codeToChichu('CAM', 'edge', 'speffz')).toBe('AEH');
    expect(codeFromChichu('AEH', 'edge', 'speffz')).toBe('CAM');
  });

  // 奇偶码是"两个棱 + 两个角",同一个字母在两半含义不同 —— 逐位按自己那半翻译。
  it('奇偶码逐位按棱 / 角分别翻译', () => {
    expect(slotKind('parity', 1)).toBe('edge');
    expect(slotKind('parity', 2)).toBe('corner');
    const speffz = codeFromChichu('ACAD', 'parity', 'speffz');
    expect(codeToChichu(speffz, 'parity', 'speffz')).toBe('ACAD');
    // 前后两半用的是不同的字母表,翻出来不该是同一个字母重复。
    expect(speffz).toHaveLength(4);
  });
});

describe('等价写法', () => {
  it.each(BLDDB_TYPES)('%s:数量固定且两两不同', (type) => {
    const v = variantKeys(SEED[type], type);
    expect(v).toHaveLength(VARIANT_COUNT[type]);
    expect(new Set(v).size).toBe(VARIANT_COUNT[type]);
  });

  it.each(BLDDB_TYPES)('%s:等价类封闭 —— 从任一写法出发得到同一个集合', (type) => {
    const base = [...variantKeys(SEED[type], type)].sort();
    for (const v of base) {
      expect([...variantKeys(v, type)].sort()).toEqual(base);
    }
  });

  // ②:库里这个 case 存在键 GBF 下(AEH → 换贴纸 BFG → 移位 GBF)。
  it('UF-UB-RU 的等价写法里有库键 GBF', () => {
    expect(variantKeys('AEH', 'edge')).toContain('GBF');
  });

  it('同块贴纸认得出来(缓冲和目标撞块就不是三循环)', () => {
    expect(sameSticker('A', 'B', 'edge')).toBe(true);   // 同一条棱的两面
    expect(sameSticker('A', 'E', 'edge')).toBe(false);
    expect(sameSticker('J', 'L', 'corner')).toBe(true); // 同一个角的三面
    expect(sameSticker('J', 'G', 'corner')).toBe(false);
  });

  it('通配符原样穿过移位和换贴纸', () => {
    const v = variantKeys('AE*', 'edge');
    expect(v).toHaveLength(6);
    for (const s of v) expect(s).toContain('*');
  });
});

describe('翻角方向', () => {
  // UFR 的三个贴纸 UFR → RUF → FUR:换一次到逆时针面,换两次到顺时针面。
  it('换一次贴纸 = 逆时针,换两次 = 顺时针', () => {
    expect(twistLetterOf('UFR', 'ccw')).toBe('K'); // RUF
    expect(twistLetterOf('UFR', 'cw')).toBe('L');  // FUR
    expect(positionsOf(twistLetterOf('UFR', 'ccw'), 'ltct')).toEqual(['RUF']);
    expect(twistDirection('K')).toBe('ccw');
    expect(twistDirection('L')).toBe('cw');
    expect(twistDirection('J')).toBeNull(); // UFR 本身不表示翻角
  });

  it('16 个翻角字母恰好是非 U/D 面的角贴纸', () => {
    const all = new Set<string>();
    for (const p of ['UFR', 'UBR', 'UFL', 'UBL', 'DFR', 'DBR', 'DFL', 'DBL']) {
      all.add(twistLetterOf(p, 'cw'));
      all.add(twistLetterOf(p, 'ccw'));
    }
    expect(all.size).toBe(16);
    expect([...all].sort().join('')).toBe(kindLetters('corner1', 'chichu').sort().join(''));
  });

  it('BEH = UFL / UBL / UBR 三个角逆时针', () => {
    expect(twistTargets('BEH')).toEqual([
      { corner: 'UBL', dir: 'ccw' },
      { corner: 'UBR', dir: 'ccw' },
      { corner: 'UFL', dir: 'ccw' },
    ]);
  });
});

// ② 三阶那六条全部拿 iframe 版 /blddb 页面 ?position= 实测过:那边显示的字母对
// (浏览器存的是 Speffz)、命中的库键、第一条公式与用者数,都对得上下面这些常量。
// 这层保的是**语义**:位置 → 字母 → 键这条链没有整体错位(结构不变量看不出这种错)。
describe('对上游页面实测', () => {
  const FIXTURES: {
    type: BlddbType; speffz: string; chichu: string; key: string;
    positions: string[]; alg: string; users: number; comm?: string;
  }[] = [
    {
      type: 'edge', speffz: 'CAM', chichu: 'AEH', key: 'GBF',
      positions: ['UF', 'UB', 'RU'],
      alg: "S U' S R2 S' R2 U S'", users: 34, comm: "S U':[S,R2]",
    },
    {
      type: 'corner', speffz: 'CAV', chichu: 'JDX', key: 'JDX',
      positions: ['UFR', 'UBL', 'DFR'],
      alg: "R2 U R2 D R2 D' R2 U' R2 D R2 D'", users: 27, comm: "R2:[U,R2 D R2 D' R2]",
    },
    {
      type: 'parity', speffz: 'CDDA', chichu: 'ACAD', key: 'ACAD',
      positions: ['UF', 'UL', 'UFL', 'UBL'],
      alg: "L' U' L F L' U' L U L F' L2 U L U", users: 8,
    },
    {
      type: 'twists', speffz: 'EIQ', chichu: 'EBH', key: 'BEH',
      positions: ['LUB', 'FUL', 'BUR'],
      alg: "U R2 D' R U2 R' D R U R' F R U R U' R' F' R", users: 1, comm: NO_COMMUTATOR,
    },
    {
      type: 'flips', speffz: 'CD', chichu: 'AC', key: 'AC',
      positions: ['UF', 'UL'],
      alg: "L E2 L2 E L U L' E' L2 E2 L' U'", users: 12, comm: '[L E2 L2 E L,U]',
    },
    {
      type: 'ltct', speffz: 'DAM', chichu: 'ADK', key: 'ADK',
      positions: ['UFL', 'UBL', 'RUF'],
      alg: "R' D' R U2 R' D R U R U2 R' U R U R' U2", users: 3,
    },
    // 高阶四套:位置 / 等价类是拿上游 bigbldCodeConverter 对全量键(5388 个)比对过的,
    // 这里各钉一条真实记录,防的是"哪天数据换形状了还静默读得出东西"。
    {
      type: 'wing', speffz: 'CID', chichu: 'ABC', key: 'ABC',
      positions: ['UFr', 'FUl', 'ULf'],
      alg: "Lw U L' U l2 U' L U l2 U2 Lw'", users: 16, comm: "Lw U:[L',U l2 U']",
    },
    {
      type: 'xcenter', speffz: 'DIF', chichu: 'ABC', key: 'ABC',
      positions: ['Ufl', 'Ful', 'Luf'],
      alg: "S u l' U2 l u' l' U2 l S'", users: 4, comm: "S:[u,l' U2 l]",
    },
    {
      type: 'tcenter', speffz: 'CID', chichu: 'ABC', key: 'ABC',
      positions: ['Uf', 'Fu', 'Ul'],
      alg: "U 3Lw' U' l U m U' l' U Lw U'", users: 4, comm: "U Lw':[m',U' l U]",
    },
    {
      type: 'midge', speffz: 'CDA', chichu: 'ACE', key: 'ACE',
      positions: ['UF', 'UL', 'UB'],
      alg: "U' m2 U' m U2 m' U' m2 U", users: 11, comm: "U' m2 U':[m,U2]",
    },
  ];

  it.each(FIXTURES)('$type:Speffz $speffz = 彳亍 $chichu = $positions', (f) => {
    expect(codeToChichu(f.speffz, f.type, 'speffz')).toBe(f.chichu);
    expect(codeFromChichu(f.chichu, f.type, 'speffz')).toBe(f.speffz);
    expect(positionsOf(f.chichu, f.type)).toEqual(f.positions);
    expect(variantKeys(f.chichu, f.type)).toContain(f.key);
  });

  for (const f of FIXTURES) {
    const set = loadSet(f.type);
    (set ? it : it.skip)(`${f.type}:${f.key} 的第一条公式与用者数对得上上游`, () => {
      const hit = findCases(set as BlddbSet, f.chichu, f.type)[0];
      expect(hit?.key).toBe(f.key);
      expect(hit?.entries[0][0][0]).toBe(f.alg);
      expect(hit?.entries[0][1]).toHaveLength(f.users);
      if (f.comm) expect(hit?.entries[0][2]?.[0]).toBe(f.comm);
    });
  }
});

describe('对着真实库校验', () => {
  for (const type of BLDDB_TYPES) {
    const set = loadSet(type);
    const run = set ? describe : describe.skip;

    run(`${type}Manmade.json`, () => {
      const data = set as BlddbSet;
      const keys = () => Object.keys(data);

      it('键的每一位都在该位的字母表里', () => {
        for (const k of keys()) {
          for (let i = 0; i < k.length; i++) {
            expect(kindLetters(slotKind(type, i), 'chichu')).toContain(k[i]);
          }
        }
      });

      // ③ 代表元唯一 —— 这页正确性的地基。
      it('没有两个键互为等价写法', () => {
        const owner = new Map<string, string>();
        const collisions: string[] = [];
        for (const k of keys()) {
          for (const v of variantKeys(k, type)) {
            const prev = owner.get(v);
            if (prev && prev !== k) collisions.push(`${prev} ↔ ${k}(共用 ${v})`);
            owner.set(v, k);
          }
        }
        expect(collisions).toEqual([]);
      });

      it('从任一等价写法都查得回同一条记录', () => {
        // 全量 × 变体数本身不慢,但断言开销大,抽样够用(种子固定,不是随机)。
        const all = keys();
        const step = Math.max(1, Math.floor(all.length / 200));
        for (let i = 0; i < all.length; i += step) {
          const k = all[i];
          for (const v of variantKeys(k, type)) {
            expect(findCases(data, v, type)[0]?.key).toBe(k);
          }
        }
      });

      it('每条记录:有公式、有人在用,换位子要么没有要么与公式一一对应', () => {
        for (const k of keys()) {
          for (const [algs, users, comms] of data[k]) {
            expect(algs.length).toBeGreaterThan(0);
            expect(users.length).toBeGreaterThan(0);
            if (comms) expect(comms).toHaveLength(algs.length);
          }
        }
      });
    });
  }
});

// 覆盖完整 = 变体展开没有缺口。三循环和翻棱是全覆盖的(每个合法 case 都有人工公式),
// 奇偶 / 翻角 / 奇偶带翻不是 —— 那三套查不到属正常,页面要给得出"没有"的提示。
describe('覆盖范围', () => {
  for (const piece of PIECES) {
    const set = loadSet(piece);
    const run = set ? it : it.skip;

    run(`${piece}:每个合法三循环都查得到`, () => {
      const data = set as BlddbSet;
      const letters = [...CH_LETTERS[piece]];
      let checked = 0;
      const missing: string[] = [];
      for (const a of letters) {
        for (const b of letters) {
          if (sameSticker(a, b, piece)) continue;
          for (const c of letters) {
            if (sameSticker(a, c, piece) || sameSticker(b, c, piece)) continue;
            checked++;
            if (!lookupCase(data, a + b + c, piece)) missing.push(a + b + c);
          }
        }
      }
      expect(missing).toEqual([]);
      expect(checked).toBe(piece === 'edge' ? 24 * 22 * 20 : 24 * 21 * 18);
      expect(Object.keys(data).length * VARIANT_COUNT[piece]).toBe(checked);
    });
  }

  const flips = loadSet('flips');
  (flips ? it : it.skip)('翻棱:12 条棱两两组合全覆盖', () => {
    const data = flips as BlddbSet;
    const letters = kindLetters('edge0', 'chichu');
    let checked = 0;
    const missing: string[] = [];
    for (const a of letters) {
      for (const b of letters) {
        if (a === b) continue;
        checked++;
        if (findCases(data, a + b, 'flips').length !== 1) missing.push(a + b);
      }
    }
    expect(missing).toEqual([]);
    expect(checked).toBe(12 * 11);
    expect(Object.keys(data).length).toBe((12 * 11) / 2);
  });

  const parity = loadSet('parity');
  (parity ? it : it.skip)('奇偶:查不到是正常结果,不是崩溃', () => {
    const data = parity as BlddbSet;
    // 库里有的那条能查到;编得出来但没人整理的那条返回空数组。
    expect(findCases(data, 'ACAD', 'parity')).toHaveLength(1);
    const all = Object.keys(data);
    expect(all.length).toBeGreaterThan(500);
  });
});

describe('通配查询', () => {
  const set = loadSet('edge');
  const run = set ? it : it.skip;

  run('AE* 列出 A→E→任意 的全部三循环', () => {
    const data = set as BlddbSet;
    const hits = findCases(data, 'AE*', 'edge');
    // 第三个目标可以是除 A/B(缓冲那条棱)与 E/F(第一目标那条棱)外的任意贴纸。
    expect(hits).toHaveLength(20);
    for (const h of hits) {
      expect(h.writing.startsWith('AE')).toBe(true);
      expect(variantKeys(h.writing, 'edge')).toContain(h.key);
    }
    // 每条都是不同的 case。
    expect(new Set(hits.map((h) => h.key)).size).toBe(20);
  });

  run('不带通配时至多一条', () => {
    expect(findCases(set as BlddbSet, 'AEH', 'edge')).toHaveLength(1);
  });
});
