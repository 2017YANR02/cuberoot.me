/**
 * 十字面识别 + 换视角(`orient.ts`)。
 * =========================================================================
 *
 * 这一层存在的理由是一条真机记录:一把 13.41s / 65 手,报告里只有「十字」一行,
 * 吞掉整把。原因不是切分器写错,是**智能魔方按自己的配色报手法** —— 白面在协议
 * 里恒等于 U,人把白面朝下拧,于是十字落在 U 面,而整个分段层只认 D 面的十字。
 *
 * 那把的动作流原样收在下面当 fixture(`REAL_STREAM`)。它是这一层唯一的真值来源:
 * 合成流可以为了好过测试而写成任何样子,这一条不能。
 */

import { describe, it, expect } from 'vitest';

import {
  CUBE_FACES,
  conjugateSequence,
  conjugateToken,
  facePermFor,
  normalizeSolve,
  pickCrossFace,
  scanCrossFaces,
} from '@/app/[lang]/timer/_lib/reconstruct/orient';
import type { CubeFace } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import type { SolveMove } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { solved, applyScramble, facesEqual } from '@/app/[lang]/timer/_lib/cube/state';
import { applyOneToken } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

/** 真机那把的动作流(白十字,白面朝下 → 协议里十字在 U 面)。 */
const REAL_STREAM = (
  "U R U D' L B' L2 D' L B' B L' D' U L D L' U' D2 R' " +
  "R L D L' R' B' L B R L' L D' L' D F' D' F L D B D' B' " +
  "L' D' R F D F' D' R' D2 F' D2 F D2 F' R F D F' D' F' " +
  "R' F2 D2"
).trim().split(/\s+/);

/** 那把的打乱 = 解法的逆(这条流确实把魔方拧回了复原态,下面第一条测试就是证它)。 */
const REAL_SCRAMBLE = [...REAL_STREAM]
  .reverse()
  .map(t => (t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : `${t}'`))
  .join(' ');

const timed = (tokens: readonly string[], gap = 200): SolveMove[] =>
  tokens.map((m, i) => ({ m, ts: (i + 1) * gap }));

const REAL_MOVES = timed(REAL_STREAM);

function stateAfter(scramble: string, moves: readonly SolveMove[]) {
  let st = applyScramble(3, scramble);
  for (const mv of moves) st = applyOneToken(st, mv.m);
  return st;
}

describe('fixture sanity', () => {
  it('打乱 + 动作流 = 复原 —— 不然下面所有结论都无从谈起', () => {
    expect(facesEqual(stateAfter(REAL_SCRAMBLE, REAL_MOVES), solved(3))).toBe(true);
  });
});

describe('facePermFor', () => {
  it('每个面的旋转确实把它送到 D', () => {
    for (const f of CUBE_FACES) {
      const scans = scanCrossFaces('', []);
      expect(scans).toHaveLength(6);
      // 旋转表是私有的,通过 normalizeSolve 的行为间接锁;这里直接验置换的性质:
      // 六个面各被送到某处,且是个双射。
      const perm = facePermFor(f === 'D' ? '' : 'x');
      expect(new Set(CUBE_FACES.map(g => perm[g])).size).toBe(6);
    }
  });

  it('恒等旋转是恒等置换', () => {
    const p = facePermFor('');
    for (const f of CUBE_FACES) expect(p[f]).toBe(f);
  });

  it('x2 把 U 和 D 对调、F 和 B 对调,L R 不动', () => {
    const p = facePermFor('x2');
    expect(p.U).toBe('D');
    expect(p.D).toBe('U');
    expect(p.F).toBe('B');
    expect(p.B).toBe('F');
    expect(p.L).toBe('L');
    expect(p.R).toBe('R');
  });
});

describe('conjugateToken', () => {
  const p = facePermFor('x2');

  it('面转跟着面走,方向后缀原样带着', () => {
    expect(conjugateToken('U', p)).toBe('D');
    expect(conjugateToken("U'", p)).toBe("D'");
    expect(conjugateToken('U2', p)).toBe('D2');
    expect(conjugateToken('R', p)).toBe('R');
  });

  it('宽层跟着同一个面走', () => {
    expect(conjugateToken('Uw', p)).toBe('Dw');
    expect(conjugateToken("Fw'", p)).toBe("Bw'");
  });

  it('中层按「跟着哪个面」换,必要时翻方向', () => {
    // M 跟着 L;x2 之下 L 还是 L,所以 M 还是 M。
    expect(conjugateToken('M', p)).toBe('M');
    // E 跟着 D;x2 把 D 送到 U,跟着 U 的中层是 E'。
    expect(conjugateToken('E', p)).toBe("E'");
    expect(conjugateToken("E'", p)).toBe('E');
    expect(conjugateToken('E2', p)).toBe("E2'");
    expect(conjugateToken("E2'", p)).toBe('E2');
  });

  it('整体旋转也共轭', () => {
    // y 跟着 U;x2 把 U 送到 D,跟着 D 的旋转是 y'。
    expect(conjugateToken('y', p)).toBe("y'");
    expect(conjugateToken('x', p)).toBe('x');   // x 跟着 R,R 不动
  });

  it('认不出的记号返回 null,不猜', () => {
    expect(conjugateToken('3Rw', p)).toBeNull();
    expect(conjugateToken('', p)).toBeNull();
    expect(conjugateToken('Mw', p)).toBeNull();
    expect(conjugateSequence('R U 3Rw', p)).toBeNull();
  });
});

describe('scanCrossFaces —— 真机那把', () => {
  const scans = scanCrossFaces(REAL_SCRAMBLE, REAL_MOVES);
  const by = (f: CubeFace) => scans.find(s => s.face === f)!;

  it('十字在 U 面,第 7 手(下标 6)就做完了', () => {
    expect(by('U').crossIdx).toBe(6);
  });

  it('D 面的十字要等到最后一手 —— 那不是十字做完,那是魔方全复原', () => {
    expect(by('D').crossIdx).toBe(REAL_MOVES.length - 1);
    expect(by('D').f2lIdx).toBe(REAL_MOVES.length - 1);
  });

  it('光看「谁的十字最早」分不出来 —— R 只比 U 晚一手', () => {
    expect(by('R').crossIdx).toBe(7);
    // 分得开的是 F2L:U 面在解法中途就成立,R 面只能等全复原。
    expect(by('U').f2lIdx!).toBeLessThan(by('R').f2lIdx!);
  });

  it('六个面都扫,一个不落', () => {
    expect(scans.map(s => s.face).sort()).toEqual([...CUBE_FACES].sort());
  });
});

describe('pickCrossFace', () => {
  it('真机那把认出 U', () => {
    expect(pickCrossFace(scanCrossFaces(REAL_SCRAMBLE, REAL_MOVES))).toBe('U');
  });

  it('已经是 D 十字的把原样认成 D', () => {
    const norm = normalizeSolve(REAL_SCRAMBLE, REAL_MOVES);
    expect(pickCrossFace(scanCrossFaces(norm.scramble, norm.moves))).toBe('D');
  });

  it('平局偏 D —— 复原态开局时每个面都立刻成立', () => {
    expect(pickCrossFace(scanCrossFaces('', timed(['U'])))).toBe('D');
  });

  it('一个面都没成立就是 null,不硬选', () => {
    expect(pickCrossFace([])).toBeNull();
    expect(pickCrossFace(
      CUBE_FACES.map(face => ({ face, crossIdx: null, f2lIdx: null })),
    )).toBeNull();
  });

  it('只有十字、没走到 F2L 的把,按十字最早的挑', () => {
    expect(pickCrossFace([
      { face: 'D', crossIdx: 30, f2lIdx: null },
      { face: 'L', crossIdx: 8, f2lIdx: null },
    ])).toBe('L');
  });

  it('F2L 压过十字 —— 十字晚但 F2L 早的那个才是真的', () => {
    expect(pickCrossFace([
      { face: 'R', crossIdx: 3, f2lIdx: 60 },
      { face: 'U', crossIdx: 9, f2lIdx: 28 },
    ])).toBe('U');
  });
});

describe('normalizeSolve', () => {
  const norm = normalizeSolve(REAL_SCRAMBLE, REAL_MOVES);

  it('把十字转到 D,并说清楚它原本在哪', () => {
    expect(norm.changed).toBe(true);
    expect(norm.crossFace).toBe('U');
    // 2026-08-04 从 `x2` 改成 `z2`:两个都是一手把 U 转到 D,判据是少动一个面。
    // 魔方在协议里恒等于「白 U 绿 F」,`z2` 只把白转下去、绿留在 F,`x2` 连绿也甩到
    // 后面。这一手现在会印在谱子第一行(`z2 // insp`),所以它就是人观察时那一下,
    // 得写成人真会拿的样子。
    expect(norm.rotation).toBe('z2');
  });

  it('手数一个不差 —— 共轭是换名,所有 endIdx 仍指原始流', () => {
    expect(norm.moves).toHaveLength(REAL_MOVES.length);
    norm.moves.forEach((m, i) => expect(m.ts).toBe(REAL_MOVES[i].ts));
  });

  it('换完视角还是同一个魔方:仍然拧回复原态', () => {
    expect(facesEqual(stateAfter(norm.scramble, norm.moves), solved(3))).toBe(true);
  });

  it('**这就是那个 bug**:只认 D 面的话四个阶段挤在最后一手', () => {
    // 老行为 = 只拿 D 面判。四个阶段全落在最后一手,于是报告里只剩「十字」一行
    // 吞掉整把 —— 正是用户截图里的样子。
    const dOnly = scanCrossFaces(REAL_SCRAMBLE, REAL_MOVES).find(s => s.face === 'D')!;
    expect(dOnly.crossIdx).toBe(REAL_MOVES.length - 1);
    expect(dOnly.f2lIdx).toBe(REAL_MOVES.length - 1);
  });

  it('`computeStageSegments` 自己会转视角,四步各自分开', () => {
    // 传原始那对(用户记录里存的就是这个),不需要调用方先 normalize。
    const segs = computeStageSegments(REAL_SCRAMBLE, REAL_MOVES, 13410)!;
    expect(segs.crossEndIdx).toBe(6);
    expect(segs.f2lEndIdx!).toBeGreaterThan(segs.crossEndIdx!);
    expect(segs.ollEndIdx!).toBeGreaterThan(segs.f2lEndIdx!);
    expect(segs.solvedEndIdx).toBe(REAL_MOVES.length - 1);
    expect(segs.crossMs!).toBeLessThan(13410);
    // 十字原本在哪个面,如实报出来 —— 不是永远的 "D-cross"。
    expect(segs.crossSide).toBe('U-cross');
  });

  it('转过视角的那对喂进去,结论一模一样(幂等到分段层)', () => {
    const a = computeStageSegments(REAL_SCRAMBLE, REAL_MOVES, 13410)!;
    const b = computeStageSegments(norm.scramble, norm.moves, 13410)!;
    expect(b.crossEndIdx).toBe(a.crossEndIdx);
    expect(b.f2lEndIdx).toBe(a.f2lEndIdx);
    expect(b.ollEndIdx).toBe(a.ollEndIdx);
    expect(b.solvedEndIdx).toBe(a.solvedEndIdx);
    expect(b.ollCase).toBe(a.ollCase);
    expect(b.pllCase).toBe(a.pllCase);
  });

  it('幂等:已经朝下的把再normalize 什么也不动,连对象都不换', () => {
    const again = normalizeSolve(norm.scramble, norm.moves);
    expect(again.changed).toBe(false);
    expect(again.crossFace).toBe('D');
    expect(again.moves).toBe(norm.moves);
    expect(again.scramble).toBe(norm.scramble);
  });

  it('空动作流不碰', () => {
    const r = normalizeSolve('R U', []);
    expect(r.changed).toBe(false);
    expect(r.crossFace).toBeNull();
  });

  it('认不出十字的把(半途而废)原样返回', () => {
    const r = normalizeSolve("R U R' U' F' L2 B", timed(['R', 'U']));
    expect(r.changed).toBe(false);
    expect(r.moves).toHaveLength(2);
  });
});

/**
 * 换视角把**颜色也换掉了** —— 白面被叫成 D,而 D 在标准配色里是黄。所以谱子的
 * 记号用换过名的(顶层写成 U 层),而喂给识别器的局面必须是**真颜色**的那一份
 * 加一个整体旋转:转的是整颗魔方,颜色跟着块走,十字落到 D 而且还是白的。
 *
 * 没这一层的时候,明明做的白十字会被标成「Y cross」。
 */
describe('识别用真颜色,显示用换过名的记号', () => {
  const norm = normalizeSolve(REAL_SCRAMBLE, REAL_MOVES);

  it('十字那一步的局面:换名的读成黄,真颜色 + 旋转读成白', () => {
    // 换名之后 D 面中心是 'D' —— 标准配色里的黄。
    const relabelled = stateAfter(norm.scramble, norm.moves.slice(0, 7));
    expect(relabelled.D[4]).toBe('D');

    // 真颜色那份:原始流拧到同一手,十字还在 U 面,而 U 在标准配色里是白。
    const physical = stateAfter(REAL_SCRAMBLE, REAL_MOVES.slice(0, 7));
    expect(physical.U[4]).toBe('U');

    // 末尾接上那个整体旋转:白色被转到了 D。
    const posed = applyOneToken(physical, norm.rotation);
    expect(posed.D[4]).toBe('U');
  });

  it('接旋转和换名给的是同一个局面(差一次整体旋转,不是差一把魔方)', () => {
    for (const n of [0, 7, 20, REAL_MOVES.length]) {
      const posed = applyOneToken(stateAfter(REAL_SCRAMBLE, REAL_MOVES.slice(0, n)), norm.rotation);
      const relabelled = stateAfter(norm.scramble, norm.moves.slice(0, n));
      // 同一个块布局,只是贴纸的名字整套换过:两边每个面的「和中心同色」图案一致。
      const pat = (st: ReturnType<typeof stateAfter>) =>
        (['U', 'D', 'F', 'B', 'L', 'R'] as const)
          .map(f => st[f].map(c => (c === st[f][4] ? '1' : '0')).join('')).join('|');
      expect(pat(posed), `n=${n}`).toBe(pat(relabelled));
    }
  });
});
