/**
 * LSLL 的镜像对合 σ —— issue #40 T5 / T6。
 *
 * ## 用哪个镜面
 *
 * 常说的「左右镜」(M 平面,R↔L)单独用**不保 LSLL 定义域**:它把最后一槽从 FR 送到 FL,
 * 出来的状态不是 LSLL 态。补一个 `y'` 把 FL 转回 FR 即可 —— 这个复合逐面算下来是
 *
 *     U → U    D → D    F ↔ R    L ↔ B
 *
 * 也就是过 FR 与 BL 两条棱的那个**对角镜面**(对角镜面 = 该复合的几何名字,不是另一个变换)。
 * 它仍是货真价实的反射,不是「镜像 + 转体」的四不像:`M y M = y'`,故 `(y'M)² = y' y = 1`。
 *
 * 与 §5.1 是同一件事的两种说法:那边说「M 镜像落到伙伴 case 的 FL-view」,把 FL-view 摆回
 * FR-view 要的正是这个 `y'` 共轭。公式库有四个朝向可摆,所以留在 FL-view 讲;LSLL 坐标把槽
 * 钉死在 FR,没得摆,只能把 `y'` 吸收进变换本身。
 *
 * ## 为什么它在 AUF 商上良定义
 *
 * σ 把 `U` 映成 `U'`,所以 σ 把 AUF 群 Z4 共轭到自己 —— 二类 case(模前后 AUF)的
 * 商上因此良定义,`mirrorKey` 与「先取任一 AUF 像再镜像」结果相同(测试锁死)。
 * 这正是 T6 「求解量能减半」那句话的依据:σ 保步数,求解清单 = (583,284 + F) / 2。
 *
 * ## 朝向怎么变(**棱不是「原样照搬」,别想当然**)
 *
 * 角:反射把三枚贴纸的循环序反过来(手性翻转),U/D 那枚留在原位 ⇒ **扭向取负** `co' = -co`。
 *
 * 棱:EO 的记法本身在 F↔R 下**不对称** —— `R` 一枚棱都不翻,它的镜像 `F'` 却翻四枚。
 * 按贴纸槽位逐位推(`EF` / `EDGE_COLORS` 两张表),修正项是
 *
 *     eo' = eo + [这个位置属于 E 层] + [这块本身是 E 层块]   (mod 2)
 *
 * 在 LSLL 的五位坐标里,「E 层」只剩槽位 / 槽棱那一位。锚点:`mirrorAlg('R') === "F'"`,
 * 两边的末态必须逐块相等 —— tests/lsll_mirror.test.ts 拿 500 条随机公式对撞这条性质。
 */
import type { LsllState } from './cube333';
import { canonicalKey, unpackState, displayState, verifyCaseAlg } from './model';

/** 角块位置 / piece 的对合(局部序 URF UFL ULB UBR DFR):UFL ↔ UBR,其余不动。 */
export const MIRROR_CORNER = [0, 3, 2, 1, 4] as const;
/** 棱块位置 / piece 的对合(局部序 UR UF UL UB FR):UR ↔ UF、UL ↔ UB,槽棱不动。 */
export const MIRROR_EDGE = [1, 0, 3, 2, 4] as const;

/** 招式的镜像重写:面互换 + 转向取反(半圈自逆)。 */
const MIRROR_FACE: Record<string, string> = { U: 'U', D: 'D', F: 'R', R: 'F', L: 'B', B: 'L' };

/**
 * 把一条 U/R/F/D/L/B 公式镜像过去(与 σ 作用在状态上同一个变换)。
 * 只认 `cube333.applyAlg` 支持的记号;非法 token 原样抛出。
 */
export function mirrorAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const m = tok.match(/^([URFDLB])(2'?|'|3)?$/);
    if (!m) throw new Error(tok);
    const face = MIRROR_FACE[m[1]];
    const half = m[2] === '2' || m[2] === "2'";
    if (half) return `${face}2`;
    const prime = m[2] === "'" || m[2] === '3';
    return prime ? face : `${face}'`;
  }).join(' ');
}

/** σ 作用在 LSLL 状态上。对合:`mirrorState(mirrorState(s))` 逐字段等于 s。 */
export function mirrorState(s: LsllState): LsllState {
  const cp = Array<number>(5), co = Array<number>(5), ep = Array<number>(5), eo = Array<number>(5);
  for (let i = 0; i < 5; i++) {
    cp[MIRROR_CORNER[i]] = MIRROR_CORNER[s.cp[i]];
    co[MIRROR_CORNER[i]] = (3 - s.co[i]) % 3;
    ep[MIRROR_EDGE[i]] = MIRROR_EDGE[s.ep[i]];
    // 位 4 = 槽位 / 槽棱,即五位坐标里唯一的 E 层成员
    eo[MIRROR_EDGE[i]] = (s.eo[i] + (i === 4 ? 1 : 0) + (s.ep[i] === 4 ? 1 : 0)) % 2;
  }
  return { cp, co, ep, eo };
}

/** case 的镜像 case。输入输出都是 canonical key。 */
export function mirrorKey(key: number): number {
  return canonicalKey(mirrorState(unpackState(key)));
}

/** 自镜像 case(σ 的不动点)—— 它的镜像就是它自己,不存在「另一半」。 */
export function isSelfMirror(key: number): boolean {
  return mirrorKey(key) === key;
}

/**
 * 把「解 case c 的公式」翻成「解 c 的镜像 case 的公式」,**并对齐首 AUF**。
 *
 * 光 `mirrorAlg` 是不够的:σ(U^a · s · U^b) = U^-a · σ(s) · U^-b,而站上两个 case 页
 * 各自显示的是各自等价类里的展示代表元(`model.displayState`),两边 AUF 一般对不上。
 * 所以这里补一个前置 U^a —— 只有 4 种可能,直接拿 `verifyCaseAlg` 试。
 *
 * @param state 本 case 的状态(页面显示的那个代表元)
 * @param alg   解本 case 的公式(只认 U R F D L B)
 * @returns 解镜像 case(其展示代表元)的公式;公式非法或无解时 null
 */
export function mirrorAlgForCase(state: LsllState, alg: string): string | null {
  let body: string;
  try { body = mirrorAlg(alg); } catch { return null; }
  const target = displayState(mirrorState(state));
  for (let a = 0; a < 4; a++) {
    const cand = withLeadingU(body, a);
    if (cand !== null && verifyCaseAlg(target, cand).ok) return cand;
  }
  return null;
}

const U_AMOUNT: Record<string, number> = { U: 1, U2: 2, "U2'": 2, "U'": 3, U3: 3 };
const U_TOKEN = ['', 'U', 'U2', "U'"];

/**
 * 在公式前面加 U^a,并把开头一连串 U 全部并成一个(不留 `U' U2` 这种脏尾巴)。
 * 只动开头的 AUF,公式主体一个字符不碰。
 */
function withLeadingU(alg: string, a: number): string | null {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  let i = 0, sum = a;
  while (i < toks.length && U_AMOUNT[toks[i]] !== undefined) { sum += U_AMOUNT[toks[i]]; i++; }
  const total = sum % 4;
  const out = total ? [U_TOKEN[total], ...toks.slice(i)] : toks.slice(i);
  return out.length ? out.join(' ') : null;
}
