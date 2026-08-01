// 左右镜像 + 起手数据的契约 —— 镜像错了不会报错,只会**给左手党一条解错 case 的公式**,
// 所以判据必须是「真魔方状态」级别的,不能只比字符串。
//
// 决定性那条:同一个 case 的任意两条公式,作用在还原态上得到的**状态完全相同**(三循环
// 把别的块都归位了,状态由那个循环唯一决定)。于是
//
//     state( mirrorAlgText(A) )  ==  state( B )      其中 B 是库里 mirrorChichu(K) 的任一条
//
// 一次性验完两件事:公式镜像对不对(mirrorAlgText),以及 case 镜到了哪儿对不对
// (mirrorChichu)。任一处错位,两边状态立刻对不上。状态用 cubing.js 的 KPuzzle 当 oracle。
//
// 另外锁数据形状:后处理(.sync/blddb_postprocess.mjs)必须把每条记录补成定长四位,
// 起手与公式一一对应。少一位、错一位,页面就会把 A 的起手标到 B 头上。

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KPattern } from 'cubing/kpuzzle';
import { flattenAlg, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { patternFromAlg } from '@/lib/cube3';
import {
  BLD3_TYPES,
  BLDDB_TYPES,
  NO_COMMUTATOR,
  THUMB_LABELS,
  hasCommutators,
  isBigbld,
  kindLetters,
  samePiece,
  slotKind,
  mirrorAlgText,
  mirrorChichu,
  mirrorPosition,
  positionsOf,
  thumbLabel,
  thumbTitle,
  variantKeys,
  type BlddbSet,
  type BlddbType,
} from '@/app/[lang]/alg/3bld/_lib/blddb';

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

const SETS = Object.fromEntries(BLDDB_TYPES.map((t) => [t, loadSet(t)])) as Record<BlddbType, BlddbSet | null>;
const AVAILABLE = BLDDB_TYPES.filter((t) => SETS[t] !== null);

// 起手编码的合法字符表 —— 后处理写进来的就这几个,加上算不出来的 `-`。
const FINGER_CHARS = new Set([...Object.keys(THUMB_LABELS), '-']);

describe('位置镜像', () => {
  it('只换面名里的 L / R', () => {
    expect(mirrorPosition('UFR')).toBe('UFL');
    expect(mirrorPosition('UFL')).toBe('UFR');
    expect(mirrorPosition('RUF')).toBe('LUF');
    expect(mirrorPosition('FUR')).toBe('FUL');
    expect(mirrorPosition('UF')).toBe('UF');
    expect(mirrorPosition('RU')).toBe('LU');
    expect(mirrorPosition('FR')).toBe('FL');
    expect(mirrorPosition('DB')).toBe('DB');
  });

  it('是对合', () => {
    for (const p of ['UFR', 'RDB', 'UF', 'BL', 'LDF']) {
      expect(mirrorPosition(mirrorPosition(p))).toBe(p);
    }
  });

  // 镜像后还得落在同一档字母表里,否则下拉里选不到、查询直接失配。
  it('彳亍码镜像后仍是同类贴纸,且是对合', () => {
    const cases: [string, BlddbType][] = [
      ['AEH', 'edge'], ['JDX', 'corner'], ['ACAD', 'parity'],
      ['BEH', 'twists'], ['AC', 'flips'], ['ADK', 'ltct'],
      ['ACE', 'midge'], ['ABC', 'xcenter'], ['ABC', 'tcenter'],
    ];
    for (const [code, type] of cases) {
      const m = mirrorChichu(code, type);
      expect(m).toHaveLength(code.length);
      expect(mirrorChichu(m, type)).toBe(code);
      // 逐位的位置名正好互为镜像
      const before = positionsOf(code, type);
      const after = positionsOf(m, type);
      expect(after).toEqual(before.map(mirrorPosition));
    }
  });

  /**
   * 翼棱是唯一位置名不能直接照镜子的一档:被编码的那片是 `XY + ccw(X,Y)`,而 ccw 是叉积,
   * 镜面反射行列式为 -1,叉积跟着变号 —— 镜过去正好落在**没被编码**的那片上,得取同一块的
   * 另一片(`XYz` ↔ `YXz`)。这条弄反 = 给左手党另一块翼的公式。
   */
  it('翼棱镜像要连手性一起翻', () => {
    const m = mirrorChichu('ABC', 'wing');
    expect(mirrorChichu(m, 'wing')).toBe('ABC');
    const before = positionsOf('ABC', 'wing');
    const after = positionsOf(m, 'wing');
    const partner = (p: string) => p[1] + p[0] + p[2];
    expect(after).toEqual(before.map((p) => partner(mirrorPosition(p))));
    // 实例:UBl 这块翼镜过去是 UBr 那片所在的块,它被编码在 BUr 上。
    expect(positionsOf('E', 'wing')).toEqual(['UBl']);
    expect(positionsOf(mirrorChichu('E', 'wing'), 'wing')).toEqual(['BUr']);
  });

  it('通配位原样穿过', () => {
    expect(mirrorChichu('A*H', 'edge')).toBe(`${mirrorChichu('A', 'edge')}*${mirrorChichu('H', 'edge')}`);
  });

  /**
   * 三循环和翻棱这三套是**全覆盖**的(1008 / 1760 / 66 = 整个 case 空间),而镜像是
   * case 空间上的对合 —— 所以键集合必须严丝合缝地自封闭。破了 = mirrorChichu 把某个
   * case 映到了不存在的编码上,查询会静默落空。
   */
  it.each(AVAILABLE.filter((t) => t === 'corner' || t === 'edge' || t === 'flips'))(
    '%s(全覆盖):每个键的镜像也是键',
    (type) => {
      const set = SETS[type]!;
      const missing: string[] = [];
      for (const k of Object.keys(set)) {
        // 键是代表元,镜像后未必还是代表元 —— 走等价写法去找。
        if (!variantHit(set, mirrorChichu(k, type), type)) missing.push(`${k} → ${mirrorChichu(k, type)}`);
      }
      expect(missing.slice(0, 5)).toEqual([]);
    },
  );

  /**
   * 奇偶 / 翻角 / 奇偶带翻这三套**不覆盖全空间**,而且是按常用缓冲收录的 —— 角缓冲 UFR
   * 镜像过去是 UFL,那不是常用缓冲,所以镜像 case 本来就大面积不在库里(实测奇偶 39%、
   * 奇偶带翻 29% 能对上)。拿「在不在库里」当判据在这三套上没有意义。
   *
   * 改卡**结构合法**:镜像后每一位仍落在该位允许的字母表里,同一段里也不能撞到同一块上。
   * 编码错(比如把角贴纸映到棱上、或把 corner1 映出 U/D 面)在这条上必现。
   */
  it.each(AVAILABLE)('%s:镜像后每一位仍是该位的合法编码', (type) => {
    const set = SETS[type]!;
    const problems: string[] = [];
    for (const k of Object.keys(set)) {
      const m = mirrorChichu(k, type);
      if (m.length !== k.length) { problems.push(`${k} → ${m}: 长度变了`); continue; }
      for (let i = 0; i < m.length; i++) {
        if (!kindLetters(slotKind(type, i), 'chichu').includes(m[i])) {
          problems.push(`${k} → ${m}: 第 ${i + 1} 位 ${m[i]} 不在 ${slotKind(type, i)} 字母表里`);
        }
      }
      // 三循环 / 交换的两位不能落到同一块上,镜像不该把它们撞到一起
      const segs: number[][] = type === 'parity' ? [[0, 1], [2, 3]]
        : type === 'ltct' ? [[0, 1]]
        : [[...m].map((_, i) => i)];
      for (const seg of segs) {
        for (let a = 0; a < seg.length; a++) {
          for (let b = a + 1; b < seg.length; b++) {
            if (samePiece(m[seg[a]], m[seg[b]], slotKind(type, seg[a]))) {
              problems.push(`${k} → ${m}: 第 ${a + 1}/${b + 1} 位撞块`);
            }
          }
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});

/** 在库里找这个写法对应的 case(等价写法都试一遍)。 */
function variantHit(set: BlddbSet, code: string, type: BlddbType): string | null {
  for (const key of variantKeys(code, type)) if (set[key]) return key;
  return null;
}

describe('公式镜像', () => {
  it('换位子的结构原样保留', () => {
    expect(mirrorAlgText('R2:[U,R2 D R2 D\' R2]')).toBe('L2:[U\',L2 D\' L2 D L2]');
    expect(mirrorAlgText('[L E2 L2 E L,U]')).toBe('[R\' E2 R2 E\' R\',U\']');
    expect(mirrorAlgText("S U':[S,R2]")).toBe("S' U:[S',L2]");
  });

  // M 与 x 落在镜面法线上,**不取反** —— 这条是 @cuberoot/shared 注释里写了"犯过两次"的坑。
  it('M 与 x 不取反', () => {
    expect(mirrorAlgText('M U M\' U\'')).toBe('M U\' M\' U');
    expect(mirrorAlgText('x R U R\'')).toBe('x L\' U\' L');
  });

  it('是对合', () => {
    for (const a of ['R U R\' U\'', 'M2 U M2 U2 M2 U M2', 'r U R\' U\' r\' F R F\'', 'S U\' S R2 S\' R2 U S\'']) {
      expect(mirrorAlgText(mirrorAlgText(a))).toBe(a);
    }
  });

  // 高阶记号:`Lw` / `3Lw` / `l` / `m` / `u`。mirrorAlgText 认不出来的片段是**原样退回**的
  // (总比吐一条错公式强),于是"没镜到"是静默的 —— 拿全量数据把这条堵死:切词不许有 junk,
  // 镜两次必须回到原文。
  it.each(AVAILABLE)('%s:库里每条公式都切得动词、镜两次回到原文', (type) => {
    const set = SETS[type]!;
    const bad: string[] = [];
    let n = 0;
    for (const list of Object.values(set)) {
      for (const e of list) {
        for (const a of e[0]) {
          n++;
          if (tokenizeMoves(flattenAlg(a)).junk.length) bad.push(`认不出来:${a}`);
          else if (mirrorAlgText(mirrorAlgText(a)) !== a) bad.push(`不是对合:${a} → ${mirrorAlgText(a)}`);
        }
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

// ── 决定性那条:拿真实魔方状态验「镜像的公式解镜像的 case」──────────────────
//
// 只取不带转体的公式(带 x/y/z 的会把整个状态转过去,状态没法直接比)。

const HAS_ROTATION = /[xyz]/u;

/**
 * 这个类型的 case 说死了哪几轨。
 *
 * 只比说死的那几轨,别比整颗魔方 —— **奇偶带翻(ltct)是 2 角互换 + 1 角翻,角置换是奇的,
 * 公式必然还得顺手换两条棱,而换哪两条各家写法不一样**。拿整体状态去比,同一个 case 的
 * 两条公式本来就对不上,判据会误报。角三循环 / 翻角同理只管角轨(它们本来也不动棱,
 * 但显式写出来省得下次又去猜)。
 */
const ORBITS: Record<string, string[]> = {
  corner: ['CORNERS'],
  twists: ['CORNERS'],
  ltct: ['CORNERS'],
  edge: ['EDGES'],
  flips: ['EDGES'],
  parity: ['CORNERS', 'EDGES'],
};

function sameOrbits(a: KPattern, b: KPattern, orbits: string[]): boolean {
  return orbits.every((o) => JSON.stringify(a.patternData[o]) === JSON.stringify(b.patternData[o]));
}

// 只跑三阶那六套 —— 高阶公式动的是翼棱 / 中心,三阶的 KPuzzle 根本没有那些轨,
// 拿它当 oracle 会把 `3Rw` 这种记号解成别的东西,验出来的是假的。高阶那四套的镜像
// 与等价类是拿上游 bigbldCodeConverter 对全量键比对过的(见 commit 说明)。
describe.each(AVAILABLE.filter((t) => BLD3_TYPES.includes(t)))('%s:镜像后的公式解的正是镜像后的 case', (type) => {
  const set = SETS[type]!;
  // 先挑出「本 case 和它的镜像 case 都有不带转体的公式」的那些,再等距取样 ——
  // 直接对全部键取样的话,奇偶 / 奇偶带翻大半会因为镜像 case 不在库里被跳过,
  // 看着跑了 60 个其实只验到十几个。
  const pairs: [string, string][] = [];
  for (const key of Object.keys(set)) {
    const mirrorKey = variantHit(set, mirrorChichu(key, type), type);
    if (!mirrorKey) continue;
    const a = set[key].flatMap((e) => e[0]).find((x) => !HAS_ROTATION.test(x));
    const b = set[mirrorKey].flatMap((e) => e[0]).find((x) => !HAS_ROTATION.test(x));
    if (a && b) pairs.push([key, mirrorKey]);
  }
  const step = Math.max(1, Math.floor(pairs.length / 60));
  const sample = pairs.filter((_, i) => i % step === 0);

  it(`抽 ${sample.length} 对与库内镜像 case 的真实状态逐个对撞`, async () => {
    const bad: string[] = [];
    for (const [key, mirrorKey] of sample) {
      const alg = set[key].flatMap((e) => e[0]).find((x) => !HAS_ROTATION.test(x))!;
      const other = set[mirrorKey].flatMap((e) => e[0]).find((x) => !HAS_ROTATION.test(x))!;
      const got = await patternFromAlg(mirrorAlgText(alg));
      const want = await patternFromAlg(other);
      if (!sameOrbits(got, want, ORBITS[type])) bad.push(`${key}→${mirrorKey}: mirror(${alg}) ≠ ${other}`);
    }
    // 抽样里必须真的验到东西 —— 全被跳过等于没测。
    expect(sample.length).toBeGreaterThan(20);
    expect(bad.slice(0, 3)).toEqual([]);
  }, 120_000);
});

// ── 后处理写进数据的那两位 ────────────────────────────────────────────────

describe('数据形状(.sync/blddb_postprocess.mjs 的产物)', () => {
  it.each(AVAILABLE)('%s:每条记录定长四位,起手与公式一一对应', (type) => {
    const set = SETS[type]!;
    const problems: string[] = [];
    let entries = 0;
    for (const [key, list] of Object.entries(set)) {
      for (const e of list) {
        entries++;
        if (e.length !== 4) { problems.push(`${key}: 长度 ${e.length}`); continue; }
        // 起手要么整条不给(高阶那四套,上游也只在三阶算),要么与公式一一对应。
        if (e[3].length !== 0 && e[0].length !== e[3].length) {
          problems.push(`${key}: ${e[0].length} 条公式对 ${e[3].length} 个起手`);
        }
        if (isBigbld(type) !== (e[3].length === 0)) {
          problems.push(`${key}: ${type} 的起手列该${isBigbld(type) ? '空' : '有值'}`);
        }
        for (const f of e[3]) {
          if ([...f].some((c) => !FINGER_CHARS.has(c))) problems.push(`${key}: 起手编码 ${f} 不认识`);
        }
        // 换位子那一列只该在带换位子的类型里有内容
        if (!hasCommutators(type) && e[2] !== null) problems.push(`${key}: 这套不该有换位子却有 ${e[2]}`);
      }
    }
    expect(entries).toBeGreaterThan(0);
    expect(problems.slice(0, 5)).toEqual([]);
  });

  it.each(AVAILABLE.filter(hasCommutators))('%s:换位子列非空(写不出来的填 Not found.)', (type) => {
    const set = SETS[type]!;
    const withComm = Object.values(set).flat().filter((e) => (e[2] ?? []).some((c) => c && c !== NO_COMMUTATOR));
    expect(withComm.length).toBeGreaterThan(0);
  });

  it('起手编码翻成文案:重复的只显示一次', () => {
    expect(thumbLabel('h', true)).toBe('中');
    expect(thumbLabel('hH', true)).toBe('中'); // 左右两侧的中立文案相同
    expect(thumbLabel('du', true)).toBe('下 / 上');
    expect(thumbLabel('du', false)).toBe('Down / Up');
    expect(thumbLabel('-', true)).toBeNull();
    expect(thumbLabel(undefined, true)).toBeNull();
    // 短标签跟在公式后面,完整说明挂 title
    expect(thumbTitle('d', true)).toBe('右手拇指朝下');
    expect(thumbTitle('D', false)).toBe('Left thumb down');
  });
});
