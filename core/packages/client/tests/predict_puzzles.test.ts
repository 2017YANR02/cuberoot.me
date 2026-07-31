/**
 * /predict 非三阶拼图 —— 出题模型与 `/sim` 引擎的**逐格对拍**。
 *
 * 这页的题目是「这枚贴纸转完落在哪一格」,而复盘动画是把题面那串原样喂给引擎播的。
 * 于是只要模型和引擎对同一个 token 的理解差一点(轴认错、手性反了、`3R` 当成三层宽),
 * 答案就会和眼睛看到的对不上 —— 而且盘面上完全看不出来。所以这里不比对「差不多」,
 * 直接比**贴纸置换**本身:
 *
 *   · NxN —— `Cube.serializeStickering` 的 maskFn 拿到的是每一格上贴纸的**本位身份**
 *     `(cubelet.initial, 本地面)`,经 `buildFaceletMap` 的反查表就是 canonical 下标。
 *     一次 setup 就能读出引擎的整个置换,颜色不参与,四阶两片翼棱也分得开。
 *   · 金字塔 / 斜转 / 枫叶 —— 引擎没有离散状态可读(靠 pivot 四元数),那就读几何:
 *     每张贴纸 mesh 的世界质心在还原帧定义了「格」,转完再算一遍质心、落回哪个格,
 *     那就是置换。canonical ↔ 引擎贴纸的对应,前两者查派生表 `ENGINE_SID_MAP`,
 *     枫叶没有表(18 枚太小没做),现推:法向定面、角轴向定角。
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import PyraCube from '@/app/[lang]/sim/engine/pyra/PyraCube';
import SkewbCube from '@/app/[lang]/sim/engine/skewb/SkewbCube';
import { parsePyraMoves } from '@/app/[lang]/sim/engine/pyra/pyraState';
import { parseSkewbMoves } from '@/app/[lang]/sim/engine/skewb/skewbState';
import { buildFaceletMap, buildReverseFaceletMap } from '@/components/sim-embed/faceletMap';
import { ENGINE_SID_MAP } from '@/lib/puzzle-image/puzzle-mask';
import { getPuzzle, identityPerm, stickerCount, type PredictPuzzle } from '@/app/[lang]/predict/_lib/puzzles';
import { generatePuzzleChallenge, trackOptions } from '@/app/[lang]/predict/_lib/puzzle_challenge';
import { collectStickerMeshes } from '@/app/[lang]/predict/_components/engineSlotMap';
import { expectEvenFrame } from './_predict_frame';

/** mulberry32 —— 确定性 RNG,让每条断言可复现。 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isPermutation = (perm: readonly number[], n: number): boolean =>
  perm.length === n && new Set(perm).size === n && perm.every((v) => v >= 0 && v < n);

// ─── 引擎侧:非 NxN 的几何置换 ────────────────────────────────────────────

/** 贴纸的「身份 + 还原帧世界质心」。质心用几何包围球心过 matrixWorld —— 与
 *  `schematicPoly` 无关,任何拼图都能用(枫叶的贴纸没有 schematicPoly)。 */
interface EngineSticker { key: string; home: THREE.Vector3 }

function centroid(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingSphere();
  const c = mesh.geometry.boundingSphere!.center.clone();
  return c.applyMatrix4(mesh.matrixWorld);
}

/** 转完之后每张贴纸落在哪个「格」(格 = 还原帧质心)。返回 perm[格] = 贴纸下标。 */
function permFromGeometry(
  root: THREE.Object3D, stickers: EngineSticker[], indexOfKey: (k: string) => number,
  meshes: THREE.Mesh[], eps = 1e-3,
): number[] {
  root.updateMatrixWorld(true);
  const perm = new Array<number>(stickers.length).fill(-1);
  meshes.forEach((mesh, i) => {
    const now = centroid(mesh);
    const hits: number[] = [];
    for (let j = 0; j < stickers.length; j++) if (stickers[j].home.distanceTo(now) < eps) hits.push(j);
    expect(hits.length, `贴纸 ${stickers[i].key} 转后的质心匹配到 ${hits.length} 个格`).toBe(1);
    perm[hits[0]] = indexOfKey(stickers[i].key);
  });
  return perm;
}

/** 建一个非 NxN 的引擎拼图,返回「按 canonical 下标排好的贴纸」+ 对应 mesh。 */
function engineStickers(
  cube: THREE.Object3D, keyOf: (m: THREE.Mesh) => string | null, indexOfKey: (k: string) => number,
  total: number,
): { stickers: EngineSticker[]; meshes: THREE.Mesh[] } {
  cube.updateMatrixWorld(true);
  const found: { s: EngineSticker; m: THREE.Mesh }[] = [];
  cube.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.simRole !== 'sticker') return;
    const key = keyOf(mesh);
    if (key === null) return;
    found.push({ s: { key, home: centroid(mesh) }, m: mesh });
  });
  expect(found.length, '引擎贴纸数').toBe(total);
  // 按 canonical 下标排:permFromGeometry 的「格」序就是 canonical 序。
  found.sort((a, b) => indexOfKey(a.s.key) - indexOfKey(b.s.key));
  found.forEach((f, i) => expect(indexOfKey(f.s.key), `第 ${i} 格`).toBe(i));
  return { stickers: found.map((f) => f.s), meshes: found.map((f) => f.m) };
}

/** canonical 下标 → 引擎 stickerKey 的反查(派生表 ENGINE_SID_MAP 的逆)。 */
function keyToIndex(puzzle: PredictPuzzle, table: Record<string, string>): (k: string) => number {
  const map = new Map<string, number>();
  for (const [sid, key] of Object.entries(table)) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(sid);
    if (!m) continue;
    const f = puzzle.faces.indexOf(m[1]);
    if (f < 0) continue;
    map.set(key, f * puzzle.perFace + Number(m[2]));
  }
  return (k) => map.get(k) ?? -1;
}

// ─── 模型自洽 ────────────────────────────────────────────────────────────

const ALL_IDS = ['2', '3', '4', '5', '6', '7', 'pyraminx', 'skewb', 'ivy'] as const;

describe('/predict 拼图模型 —— 自洽', () => {
  for (const id of ALL_IDS) {
    const puzzle = getPuzzle(id);
    const n = stickerCount(puzzle);

    it(`${id}:块表铺满每一枚贴纸且互不重叠`, () => {
      const seen = new Set<number>();
      for (const piece of puzzle.pieces) {
        for (const s of piece) {
          expect(seen.has(s), `贴纸 ${s} 出现在两块里`).toBe(false);
          seen.add(s);
        }
      }
      expect(seen.size).toBe(n);
    });

    it(`${id}:随机公式作用出来的是个置换,且同一块的贴纸不会被拆散`, () => {
      const rnd = seeded(7);
      const perm = puzzle.apply(identityPerm(n), puzzle.randomMoves(20, rnd));
      expect(isPermutation(perm, n)).toBe(true);
      // 块的完整性:一块的几枚贴纸转完仍然贴在同一块上。
      const pieceOf = new Map<number, number>();
      puzzle.pieces.forEach((piece, pi) => piece.forEach((s) => pieceOf.set(s, pi)));
      const slotPiece = new Map<number, number>();
      perm.forEach((home, slot) => slotPiece.set(slot, pieceOf.get(home)!));
      for (const piece of puzzle.pieces) {
        const slots = piece.map((home) => perm.indexOf(home));
        const groups = new Set(slots.map((s) => pieceOf.get(perm[s])!));
        expect(groups.size).toBe(1);
        // 落点也必须整块落在同一块的格位上。
        expect(new Set(slots.map((s) => pieceOf.get(s)!)).size).toBe(1);
      }
    });

    it(`${id}:一步的逆把盘面还原`, () => {
      const rnd = seeded(3);
      const moves = puzzle.randomMoves(8, rnd);
      const inverse = moves.slice().reverse().map(invertToken);
      const perm = puzzle.apply(puzzle.apply(identityPerm(n), moves), inverse);
      expect(perm).toEqual(identityPerm(n));
    });
  }
});

/** 逆一步:撇 ↔ 无撇,`2` 自逆。四种拼图的记号都吃这条规则。 */
function invertToken(token: string): string {
  if (token.endsWith('2')) return token;
  return token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
}

// ─── 引擎对拍 ────────────────────────────────────────────────────────────

/**
 * 引擎的贴纸置换。`serializeStickering` 的 maskFn 每格拿到的是「这一格上那枚贴纸的
 * **本位身份**」`(cubelet.initial, 本地面)` —— 经 `buildFaceletMap` 的反查表就是
 * canonical 下标。回传通道只有 `FaceletMask`(0..5),所以按 6 进制拆四位分四趟读回来
 * (6⁴ = 1296 > 七阶的 294 枚)。每一位都真的落在 0..5 里,断言兜住。
 */
function nxnEnginePerm(cube: Cube, N: number): number[] {
  const reverse = buildReverseFaceletMap(buildFaceletMap(N));
  const digits = [1, 6, 36, 216].map((place) =>
    cube.serializeStickering((initial, face) => {
      const home = reverse.get(`${initial}_${face}`) ?? 0;
      return (Math.floor(home / place) % 6) as 0 | 1 | 2 | 3 | 4 | 5;
    }),
  );
  return Array.from(digits[0], (_, i) =>
    digits[0][i] + digits[1][i] * 6 + digits[2][i] * 36 + digits[3][i] * 216);
}

describe('/predict NxN 模型 ≡ /sim 引擎', () => {
  for (const N of [2, 3, 4, 5, 6, 7]) {
    it(`${N}x${N}:随机公式的贴纸置换逐格相同`, () => {
      const puzzle = getPuzzle(String(N) as '2');
      const n = stickerCount(puzzle);
      const world = new World();
      world.setPuzzle(N);
      const cube = world.cube as Cube;

      const rnd = seeded(11 + N);
      for (let round = 0; round < 3; round++) {
        const moves = puzzle.randomMoves(12, rnd);
        cube.twister.setup(moves.join(' '));
        const enginePerm = nxnEnginePerm(cube, N);
        expect(isPermutation(enginePerm, n)).toBe(true);
        expect(puzzle.apply(identityPerm(n), moves)).toEqual(enginePerm);
      }
    });
  }

  it('宽转与单内层:Rw / 3Rw / 3R 各自的层数与引擎一致', () => {
    const N = 5;
    const puzzle = getPuzzle('5');
    const n = stickerCount(puzzle);
    const world = new World();
    world.setPuzzle(N);
    const cube = world.cube as Cube;

    for (const token of ['R', "R'", 'R2', 'Rw', "Rw'", '3Rw', '3R', 'Uw2', '2L', 'Fw', "3Bw'"]) {
      cube.twister.setup(token);
      expect(puzzle.apply(identityPerm(n), [token]), `token ${token}`).toEqual(nxnEnginePerm(cube, N));
    }
  });
});

describe('/predict 金字塔 / 斜转模型 ≡ /sim 引擎', () => {
  it('金字塔:每个 token 的贴纸置换与引擎一致', () => {
    const puzzle = getPuzzle('pyraminx');
    const n = stickerCount(puzzle);
    const indexOf = keyToIndex(puzzle, ENGINE_SID_MAP.pyraminx);
    for (const token of ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'", 'u', "u'", 'l', 'r', 'b']) {
      const cube = new PyraCube();
      const { stickers, meshes } = engineStickers(
        cube, (m) => (m.userData.stickerKey as string | undefined) ?? null, indexOf, n,
      );
      cube.applyMoveSilent(parsePyraMoves(token)[0]);
      const enginePerm = permFromGeometry(cube, stickers, indexOf, meshes);
      expect(puzzle.apply(identityPerm(n), [token]), `token ${token}`).toEqual(enginePerm);
    }
  });

  it('斜转:每个 token 的贴纸置换与引擎一致', () => {
    const puzzle = getPuzzle('skewb');
    const n = stickerCount(puzzle);
    const indexOf = keyToIndex(puzzle, ENGINE_SID_MAP.skewb);
    for (const token of ['R', "R'", 'U', "U'", 'L', "L'", 'B', "B'"]) {
      const cube = new SkewbCube();
      const { stickers, meshes } = engineStickers(
        cube, (m) => (m.userData.stickerKey as string | undefined) ?? null, indexOf, n,
      );
      cube.applyMoveSilent(parseSkewbMoves(token)[0]);
      const enginePerm = permFromGeometry(cube, stickers, indexOf, meshes);
      expect(puzzle.apply(identityPerm(n), [token]), `token ${token}`).toEqual(enginePerm);
    }
  });

  // 上面两条锁的是「模型的置换 = 引擎的几何置换」,用的是测试自己按 canonical 下标排的
  // mesh。题板画色 / 点击命中走的是 `collectStickerMeshes`,两者必须是同一份排法 ——
  // 差一格,题板就会把高亮画在别的贴纸上,而且盘面看上去照样自洽,肉眼查不出来。
  for (const id of ['pyraminx', 'skewb'] as const) {
    it(`${id}:题板的 collectStickerMeshes 与几何验过的那份排法逐格相同`, () => {
      const puzzle = getPuzzle(id);
      const n = stickerCount(puzzle);
      const indexOf = keyToIndex(puzzle, ENGINE_SID_MAP[id]);
      const cube: THREE.Object3D = id === 'pyraminx' ? new PyraCube() : new SkewbCube();
      const { meshes } = engineStickers(
        cube, (m) => (m.userData.stickerKey as string | undefined) ?? null, indexOf, n,
      );
      expect(collectStickerMeshes(puzzle, cube)).toEqual(meshes);
    });
  }
});

// ─── 题板高亮框 ──────────────────────────────────────────────────────────

describe('/predict 题板高亮框', () => {
  for (const id of ['pyraminx', 'skewb'] as const) {
    it(`${id}:每张贴纸的框都贴在正面、宽度处处相等`, () => {
      const cube: THREE.Object3D = id === 'pyraminx' ? new PyraCube() : new SkewbCube();
      collectStickerMeshes(getPuzzle(id), cube).forEach((mesh, i) => expectEvenFrame(mesh, `${id} 第 ${i} 格`));
    });
  }
});

// ─── 出题引擎 ────────────────────────────────────────────────────────────

describe('/predict 通用出题引擎', () => {
  for (const id of ['2', '4', '5', '6', '7', 'pyraminx', 'skewb', 'ivy'] as const) {
    const puzzle = getPuzzle(id);
    it(`${id}:每一档追踪对象出的题都自洽`, () => {
      for (const track of trackOptions(puzzle)) {
        const rnd = seeded(id.length * 31 + track.length);
        for (let i = 0; i < 12; i++) {
          const c = generatePuzzleChallenge({ puzzle, track, source: 'random', moveCount: 6, random: rnd });
          const n = stickerCount(puzzle);
          expect(c.startColors).toHaveLength(n);
          expect(c.startFacelets).toHaveLength(n);
          expect(c.targets.length).toBe(track === 'pair' ? 2 : 1);
          for (const t of c.targets) {
            // 高亮的那一格,画的必须就是题面念的那个颜色。
            expect(c.startColors[t.startFacelet]).toBe(puzzle.faces[t.colorFace]);
            expect(c.startFacelets[t.startFacelet]).toBe(puzzle.faces[t.colorFace]);
            // 落点由题面公式重算一遍,必须对得上。
            const start = puzzle.apply(identityPerm(n), c.placement);
            const end = puzzle.apply(start, c.moves);
            const home = start[t.startFacelet];
            expect(end.indexOf(home)).toBe(t.answerFacelet);
          }
          if (track === 'pair') {
            expect(c.targets[0].kind).toBe('corner');
            expect(c.targets[1].kind).toBe('edge');
          }
        }
      }
    });
  }
});
