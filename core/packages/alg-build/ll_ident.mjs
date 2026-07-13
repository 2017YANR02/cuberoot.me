/**
 * LL case 的**身份三件套**。Phase 0 的地基,phase0_join.mjs / 后续 Phase 都从这里取。
 *
 * ══ key —— case 身份 = LL 态在 (前 AUF × 后 AUF) 下的 16 折轨道 ══════════════════
 *
 * 公式 A 解态 S ⟺ S = A⁻¹。若 A' = U^a·A·U^b 仍解同一个 case,则 S' = U^-b · S · U^-a。
 * ⟹ 轨道 = { U^p · S · U^q : p,q ∈ Z4 }。62208 / 16 = 3888 + 对称不动点 = **3916**。
 *
 * ⚠ **必须 16 折**。只归一后 AUF(4 折)在"组内查空位"够用(只要单射),但跨数据源 join 时
 *   两边的公式可能差一个**前** AUF —— 那改的是 setup 的**左**乘,4 折会把同一个 case 判成两个。
 *   左乘不用在 pattern 上实现:setup 是**字符串**,拼 `U^p <setup> U^q` 就是左乘。
 *
 * 整体转体不用单列:`y = U·Dw'`,而 LL 态 X 与 Dw 可交换(支撑集不交),于是
 *   `y^k · X · y^-k = U^k · X · U^-k` —— **y 共轭本来就在这 16 个里**。
 *
 * 自证(站外公认事实,不是从站上数据反推):站上 pll 21 个 → 21 个 key;zbll 472 → 472;
 * **pll ∪ zbll = 493 == 公认的 ZBLL case 数**。
 *
 * ══ ori —— 朝向类 = OLL ═══════════════════════════════════════════════════════
 *
 * 前 AUF **不改朝向数组**(证:ori_T[i] = ori_S[perm_Uq[i]],Up 的贡献恒为 0 —— U 不拧角不翻棱);
 * 后 AUF 把朝向数组整体**轮换**。⟹ ori = 4 个后 AUF 的朝向指纹取最小。
 *
 * ══ cp —— 角置换类(**在 OLL 框架内**)══════════════════════════════════════════
 *
 * ⚠ 直接在整个 16 折轨道上取角置换的最小值是**错的** —— 那样只剩 3 个双陪集,而 CP 有 6 类。
 *   CP 是**相对 OLL** 定义的:OLL 一旦钉死,AUF 就被钉住了,4 个「相邻换角」才互相区分得开。
 *   做法:先取让朝向最小的那个**后** AUF(把框架钉死),再在 4 个**前** AUF 上取最小。24/4 = **6** 类。
 *   (对称 OLL —— 40 个和 22 个的那几组 —— 朝向的最小值由多个后 AUF 达到,cp 会相应更粗,合理。)
 */
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const ROTS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());
const U_T = ['', 'U', 'U2', "U'"].map(u => (u ? kpuzzle.algToTransformation(u) : kpuzzle.identityTransformation()));

export function f2lHome(p) {
  const d = p.patternData;
  for (let i = 4; i < 8; i++) if (d.CORNERS.pieces[i] !== i || d.CORNERS.orientation[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (d.EDGES.pieces[i] !== i || d.EDGES.orientation[i] !== 0) return false;
  for (let i = 0; i < 6; i++) if (d.CENTERS.pieces[i] !== i) return false;
  return true;
}

/** setup 可能带净旋转 —— 接上把 F2L 转回家的那个旋转,之后的 U 转才是真顶层 */
export function normalize(setup) {
  let p;
  try { p = SOLVED.applyAlg(new Alg(setup)); } catch { return null; }
  for (const r of ROTS) if (f2lHome(r ? p.applyAlg(r) : p)) return r ? `${setup} ${r}` : setup;
  return null;
}

/** @returns {{key, ori, cp} | null} —— null = 这个 setup 压根不是 LL 态 */
export function ident(setup) {
  const n = normalize(setup);
  if (n === null) return null;
  const T = kpuzzle.algToTransformation(new Alg(n));
  const cells = [];
  for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) {
    const d = SOLVED.applyTransformation(U_T[p].applyTransformation(T).applyTransformation(U_T[q])).patternData;
    cells.push({
      p, q,
      key: JSON.stringify([d.CORNERS.pieces.slice(0, 4), d.CORNERS.orientation.slice(0, 4),
        d.EDGES.pieces.slice(0, 4), d.EDGES.orientation.slice(0, 4)]),
      ori: JSON.stringify([d.CORNERS.orientation.slice(0, 4), d.EDGES.orientation.slice(0, 4)]),
      cp: JSON.stringify(d.CORNERS.pieces.slice(0, 4)),
    });
  }
  const ori = cells.map(c => c.ori).sort()[0];
  return {
    key: cells.map(c => c.key).sort()[0],
    ori,
    // 只在"朝向已达最小"的那些 cell 里取角置换最小 —— 框架被 OLL 钉死后才谈 CP
    cp: cells.filter(c => c.ori === ori).map(c => c.cp).sort()[0],
  };
}

export const invert = (m) => new Alg(m).invert().toString();
/** 一条公式解的是哪个 case */
export const identOfAlg = (moves) => { try { return ident(invert(moves)); } catch { return null; } };
/** 一条打乱是哪个 case(DELETE_AUF 剥掉起手 AUF 不影响轨道 —— 前 AUF 本就在轨道里) */
export const identOfScramble = (moves) => { try { return ident(moves); } catch { return null; } };
