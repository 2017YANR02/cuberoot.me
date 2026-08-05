/**
 * 从公式反推 case,并交叉校验。
 *
 * 表格只给公式,不给题面。题面是**算出来的**:一条公式的逆作用在还原态上就是它解的那个 case。
 * 于是同一格里的多条备选公式天然构成一组互校 —— 它们必须指向同一个 case,不一致就是表里有错。
 *
 * 状态层全部复用 `lib/pocket-facelet`(24 格 facelet + 角块 cp/co + 24 个整体转体 + 最优解),
 * 记号层全部复用 `@cuberoot/shared/alg-notation`。这里只写「怎么把两者接起来 + 怎么判对错」。
 *
 * 判据(逐条都是外部的,不自证):
 *   ① 自洽:公式作用在自己反推出的 case 上,必须六面各自单色。恒真 —— 挂了就是解析器坏了。
 *   ② 组内一致:同一格的备选公式,pocketCaseKey 必须全同(差整体转体不算差)。
 *   ③ 形状:每套方法对底层有固定要求(CLL 底层全好、EG 底面纯色、LS 三角好),
 *      不满足的报出来 —— 这是抓「公式抄错了但恰好仍是合法状态」的那一层。
 */
import { invertMoveString, tokenizeMoves } from '@cuberoot/shared/alg-notation';

// 值走动态 import:tsx 下 `.mts` **静态** import 客户端 `.ts` 会在链接期报「没有这个导出」
// (CJS 互操作,named export 探测不到);动态 import 拿到的是完整的 25 个具名导出。
// 类型仍走静态 `import type`(会被擦除,不参与链接)。
import type { PocketState } from '../../lib/pocket-facelet.ts';
const {
  solvedPocketState, applyPocketAlg, pocketCaseKey, derivePocketScramble,
  pocketStateToFacelet, POCKET_FACES, POCKET_CORNER_FACELET,
  POCKET_ROTATIONS, rotatePocketState,
} = await import('../../lib/pocket-facelet.ts');
import type { FacePerm } from '../../app/[lang]/timer/_lib/reconstruct/orient.ts';
const { CUBE_FACES, facePermFor, conjugateToken } =
  await import('../../app/[lang]/timer/_lib/reconstruct/orient.ts');
import { expandAlg, type Sanitized } from './notation.mts';
import type { SheetSlot } from './parse.mts';

export interface DerivedAlg extends Sanitized {
  row: number;
  /** 该公式单独反推出的 case key(严格身份口径,仅供排查用)。 */
  caseKey: string;
  /** 折到本格标准题面后可直接执行的六面转;null = 来源公式不属于本格。 */
  alignedAlg: string | null;
  /** 实测:这条公式解不解得掉本格题面 —— 组内互校比的是这个。 */
  solves: boolean;
}

export interface DerivedSlot {
  sheet: string;
  group: string;
  col: number;
  /** 多数派代表公式反推出的 case。 */
  caseKey: string;
  facelet: string;
  state: PocketState;
  /** 打乱串 = 多数派代表公式的逆(站内 setup 字段就是这个口径)。 */
  setup: string;
  algs: DerivedAlg[];
  /** 定下这个 case 的那条公式在表里的行号。 */
  lead: number;
  /** 与本格 case 对不上的备选(表里疑似有错)。 */
  disagree: DerivedAlg[];
  shape: CaseShape;
  /** 与本格 case 一致的公式条数 / 总条数 —— 一格的公式本来就是互校用的。 */
  agree: number;
  total: number;
}

/** case 的底层形状 —— 用来核对它属于哪一类方法,以及抓错抄。 */
export interface CaseShape {
  /** 底面(D)四格同色。 */
  dFaceSolid: boolean;
  /** 底层四个角块**整块**归位(位置 + 朝向)—— CLL / TCLL / PBL 的前提。 */
  dLayerSolved: boolean;
  /** 底层四角都朝下正确(底面纯色)但有换位 —— EG 的前提。 */
  dLayerOriented: boolean;
  /** 底层已归位的角块数(0..4)—— LS 期望 3。 */
  dSolvedCorners: number;
  /** 顶面四格同色(题面本身已定向)。 */
  uFaceSolid: boolean;
}

const solved = solvedPocketState();
const D_SLOTS = [4, 5, 6, 7];

const pocketStateKey = (s: PocketState) => `${s.cp.join('')}|${s.co.join('')}`;

/** 24 个整体朝向各自的一条最短 x/y/z 写法;状态作用仍走站内 pocket 模型。 */
const ORIENTATIONS: { state: PocketState; word: string }[] = (() => {
  const seen = new Set<string>();
  const out: { state: PocketState; word: string }[] = [];
  let frontier = [''];
  while (frontier.length && out.length < 24) {
    const next: string[] = [];
    for (const word of frontier) {
      const state = applyPocketAlg(solved, word);
      const key = pocketStateKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ state, word });
      for (const axis of ['x', 'y', 'z']) next.push([word, axis].filter(Boolean).join(' '));
    }
    frontier = next;
  }
  if (out.length !== 24) throw new Error(`整体朝向只有 ${out.length}/24`);
  return out;
})();

const rotationWord = (rotatedSolved: PocketState): string => {
  const key = pocketStateKey(rotatedSolved);
  const hit = ORIENTATIONS.find((item) => pocketStateKey(item.state) === key);
  if (!hit) throw new Error('整体朝向不在 24 元闭包里');
  return hit.word;
};

// ── 转体折叠 ────────────────────────────────────────────────────────────────
// 表里的公式常带 `y` / `x` / `z`。转体本身不改变 case,但会把「已做好的那层」转到别的面去,
// 于是「预 AUF = 转 U 层」这条判据就失效了。所以先把转体折进面名(`y R` → `B`),
// 折完的公式只剩六面转,做好的层恒在 D、自由层恒在 U。
//
// 折叠自己不写:站内 timer 复盘链路早有一份({@link facePermFor} / {@link conjugateToken}),
// 面置换是把转体作用在复原态 3x3 上读中心色得来的,六张表一张都不用手写。
// 只有 FacePerm 的复合 / 取逆没导出,在这儿补两行。

const composePerm = (a: FacePerm, b: FacePerm): FacePerm =>
  Object.fromEntries(CUBE_FACES.map((f) => [f, b[a[f]]])) as FacePerm;
const invertPerm = (p: FacePerm): FacePerm =>
  Object.fromEntries(CUBE_FACES.map((f) => [p[f], f])) as FacePerm;

/**
 * 转量归一:`R3'` → `R`、`U2'` → `U2`、`R4` → 丢掉。转体照留。
 *
 * `pocket-facelet` 的 token 文法只收 `2` / `'`,表里的 `R3` 和站内 `invertMoveString`
 * 出的 `U2'` 都进不去 —— 不归一就当场抛。
 */
export function normalizeAmounts(alg: string): string {
  const { moves, junk } = tokenizeMoves(alg);
  if (junk.length) throw new DeriveError(`认不出来的片段 ${junk.join(' ')}(${alg})`);
  const out: string[] = [];
  for (const m of moves) {
    const suffix = suffixOf(m.amount);
    if (suffix !== null) out.push(m.family + suffix);
  }
  return out.join(' ');
}

/** 净转量 → 规范后缀;整圈返回 null(该 token 整个丢掉)。 */
function suffixOf(amount: number): string | null {
  const n = ((amount % 4) + 4) % 4;
  return n === 0 ? null : n === 1 ? '' : n === 2 ? '2' : "'";
}

/**
 * 把公式里的整体转体折进面名,输出只含六面转的等价公式。
 *
 * 三层全是站内现成的:切词 {@link tokenizeMoves}(全站唯一 move 文法)、面置换
 * {@link facePermFor}(把转体作用在复原态上读中心色得来,不手写六张表)、换名
 * {@link conjugateToken}(认不出返 null 而不是瞎猜)。这里只补两件它们没给的:
 * FacePerm 的复合 / 取逆,以及**转量归一** —— 表里有 `R3`、站内 `invertMoveString`
 * 出的是 `U2'`,`conjugateToken` 的文法只收单字符后缀,不归一就当场炸。
 *
 * 等价的口径是「差一个整体转体」—— 折掉的那个末态朝向不补回来,因为 case 身份本来就
 * 模掉了 24 个转体({@link pocketCaseKey})。
 */
export function foldRotations(alg: string): string {
  const { moves, junk } = tokenizeMoves(alg);
  if (junk.length) throw new DeriveError(`认不出来的片段 ${junk.join(' ')}(${alg})`);
  let acc: FacePerm = facePermFor('');
  const out: string[] = [];
  for (const m of moves) {
    const suffix = suffixOf(m.amount);
    if (suffix === null) continue;
    const tok = m.family + suffix;
    if (m.kind === 'rotation') { acc = composePerm(acc, facePermFor(tok)); continue; }
    if (m.kind !== 'face') throw new DeriveError(`二阶上没有 ${m.raw} 这种层(${alg})`);
    const c = conjugateToken(tok, invertPerm(acc));
    if (c === null) throw new DeriveError(`换不了名的 token ${tok}(${alg})`);
    out.push(c);
  }
  return out.join(' ');
}

// ── case 身份 ───────────────────────────────────────────────────────────────
// 除了 {@link pocketCaseKey} 已经模掉的 24 个整体转体,还要模掉**预 AUF**:这些公式表
// (以及站内既有的 2x2 数据)的一格 = 一个「转到位之后长这样」的题面,每条备选公式各自
// 带自己的起手 AUF。实测:不模掉的话 783 格得到 783 个互不相同的 key,没有一格自洽;
// 站内自己的 CLL 里也并列着 `y2 L' U' L …` 和 `U2 L' U' L …` 两条 —— 二阶上这俩不等价,
// 差的正是一次预 AUF。
//
// 「自由层是哪一层」不能钉死成 U:公式起手常带 `z2 y` 一类转体,把做好的那层转到别处去了。
// 从状态自己认:**做好的那面** = 同色格最多的那一面(CLL/EG/PBL 是 4 格全同;
// TCLL/LS 是 3 格同 + 1 格异),自由层 = 它的对面。并列最高分时几个候选都试,取最小 ——
// 判据本身与朝向无关,所以这仍是良定义的规范型。

/** 每一面的「本层贴纸」:该面 4 格 + 四个相邻侧面各 2 格,按侧面分好组。 */
const LAYER_BANDS: Record<string, number[][]> = (() => {
  const faceOf = (i: number) => POCKET_FACES[Math.floor(i / 4)];
  const out: Record<string, number[][]> = {};
  for (const f of POCKET_FACES) {
    const touching = POCKET_CORNER_FACELET.filter((tri) => tri.some((i) => faceOf(i) === f));
    const byFace = new Map<string, number[]>();
    for (const tri of touching) {
      for (const i of tri) {
        const g = faceOf(i);
        if (g === f) continue;
        const a = byFace.get(g) ?? [];
        a.push(i);
        byFace.set(g, a);
      }
    }
    out[f] = [...byFace.values()];
  }
  return out;
})();

const same = (facelet: string, idx: number[]) => new Set(idx.map((i) => facelet[i])).size === 1;
const faceIdx = (f: string) => [0, 1, 2, 3].map((k) => POCKET_FACES.indexOf(f as never) * 4 + k);

/** 该面整面同色。 */
const isFaceSolid = (facelet: string, f: string) => same(facelet, faceIdx(f));
/** 该层**整层做好**:本面同色,且四条侧带各自同色(四个角块拼成一个刚体)。 */
const isLayerSolved = (facelet: string, f: string) =>
  isFaceSolid(facelet, f) && LAYER_BANDS[f].every((band) => same(facelet, band));

/** 一面里出现次数最多的那种颜色的格数(4 = 整面同色)。 */
function topColorCount(facelet: string, face: string): number {
  const n = new Map<string, number>();
  for (const i of faceIdx(face)) n.set(facelet[i], (n.get(facelet[i]) ?? 0) + 1);
  return Math.max(...n.values());
}

/**
 * 「这一面做好了多少」的分档打分,越大越确凿:
 *   10 整层做好(本面同色 + 四条侧带各自同色,四个角块拼成刚体)—— CLL / PBL / TCLL 的底层
 *    8 整面同色但层没做好 —— EG(底面朝向对了、位置乱)
 *  2/3 同色格数 —— TCLL 的扭角、LS 的缺角(3 同 1 异)
 *
 * 分档是必须的:光看「整面同色」会在 T#2 这类题面上把 D 和 L 一起判成做好的面
 * (两面都纯色,但只有 D 那层是刚体),于是多模掉一圈本不该模的转,key 就错了。
 *
 * **对 U 层转不变** —— 转顶层碰不到 D 面也碰不到 D 层的侧带。{@link caseKeyOf} 靠这条
 * 才能先按分数定朝向、再模 AUF,两步互不干扰。
 */
export function faceScore(facelet: string, face: string): number {
  if (isLayerSolved(facelet, face)) return 10;
  if (isFaceSolid(facelet, face)) return 8;
  return topColorCount(facelet, face);
}

/** 「做好的那面」的候选:得分最高的那一档,并列全留。 */
export function builtFaceCandidates(facelet: string): string[] {
  const scores = POCKET_FACES.map((f) => faceScore(facelet, f));
  const best = Math.max(...scores);
  return POCKET_FACES.filter((_, i) => scores[i] === best);
}

/** 起手 / 收尾 AUF 的四种可能(站内 `lib/alg_validation.ts` 的 AUF_CANDIDATES,同一套)。 */
export const AUF = ['', 'U', 'U2', "U'"] as const;
const D_AUF = ['', 'D', 'D2', "D'"] as const;

/**
 * 这个题面上「白给」的调整动作:顶层 AUF 恒自由;**底面单色时底层 AUF 也自由**。
 *
 * 后一条不是想当然,是枚举出来的:底层还差邻角交换的态一共 172 类 = 4 × 43,而
 * 底层整好、底层差对角交换各 43 类 —— 多出来的那个 4 正是底层自身的旋转。补上这一维,
 * 172 落回 43,表里 EG-1 与 LEG-1 两张 40 格的表也随之对上同一批 case(它们本来就是
 * 同一批题的右手 / 左手两套公式),80 格配站内 eg1 零歧义;CLL 与 EG-2 一格都不串。
 *
 * 底面不是单色时(TCLL / LS 那些少一个角的题面)转底层会拆掉已经做好的部分,不自由。
 */
function freeTurns(facelet: string): string[] {
  if (!faceSolid(facelet, 'D')) return [...AUF];
  return AUF.flatMap((u) => D_AUF.map((d) => [u, d].filter(Boolean).join(' ')));
}

/**
 * 一条公式反推出的 16 个题面(起手 / 收尾 AUF 各四种)。
 *
 * 魔友拿一条公式解题面的流程是「先 AUF 转到位 → 做公式 → 再 AUF 收尾」,两头都自由:
 *
 *     S · U^p · A · U^t = 还原(模转体)   ⟺   S = U^-t · A⁻¹ · U^-p
 *
 * 数字对得死死的:底层完好的态一共 4!·3³ = **648** 个,站内 CLL **40** 条,
 * 648 / 40 = **16.2** —— 正好是 4 起手 × 4 收尾(差的那 0.2 是 H 那几个对称 case,
 * 自己的 AUF 像跟自己重合)。只模一头会得到 177 个类,站内 40 条只盖得住 154/648。
 *
 * 取逆之后收尾的 U 跑到开头、起手的 U 跑到末尾 —— 方向搞反过一次:只对上 12/40。
 * p、t 各跑满 Z4,取逆后仍跑满 Z4,所以两头各挂四种就行。
 *
 * 折转体是前提:折完的公式只剩六面转,恒在「做好的层在 D、自由层在 U」这个标准框里,
 * `U` 才确实是自由层。
 */
export function caseStatesOfAlg(alg: string): PocketState[] {
  const inv = setupOfAlg(alg);
  const free = freeTurns(pocketStateToFacelet(applyPocketAlg(solved, inv)));
  const out: PocketState[] = [];
  for (const head of free) {
    for (const tail of free) out.push(applyPocketAlg(solved, [head, inv, tail].filter(Boolean).join(' ')));
  }
  return out;
}

/**
 * case **身份**:16 个 AUF 像各取转体规范型,再取最小。
 *
 * 这是**严格**口径,只用来回答「这两格是不是同一格」。别拿它回答「这条公式属不属于这一格」
 * —— 那是 {@link solvesCase} 的活。两者必须分开:二阶上「解掉」= 六面单色而不是回到特定
 * 朝向,于是一条公式实际能解的题面比一个 case 多得多(16 × 24 个),把那些全并成一类的话
 * 784 格会塌成 638 格,把本来不同的 case 并掉。
 */
export function caseKeyOfAlg(alg: string): string {
  return caseStatesOfAlg(alg).map(pocketCaseKey).sort()[0];
}

/**
 * 这条公式解得掉这个题面吗?—— case **归属**判据,纯操作性的,不碰任何规范型。
 *
 * 允许起手 AUF、收尾 AUF,收尾那一下写在公式**后面**(公式带净转体时它自动落在此刻
 * 朝上的那一面);判「解掉」用六面各自单色,不要求回到某个朝向 —— 二阶没中心块。
 */
export function alignAlgToState(state: PocketState, alg: string): string | null {
  const cleanAlg = foldRotations(alg);
  // case 身份模掉了整体朝向,所以归属也必须把同一个物理题面的 24 个朝向都试到。
  // 这层只回答“公式能不能解它”,不参与 caseKey,因此不会把不同格合并。
  const bodies = cleanAlg === normalizeAmounts(alg) ? [cleanAlg] : [cleanAlg, normalizeAmounts(alg)];
  for (const body of bodies) {
    for (const rot of POCKET_ROTATIONS) {
      const oriented = rotatePocketState(state, rot);
      const prefix = rotationWord(rotatePocketState(solved, rot));
      const free = freeTurns(pocketStateToFacelet(oriented));
      for (const pre of free) {
        for (const post of free) {
          const full = normalizeAmounts([prefix, pre, body, post].filter(Boolean).join(' '));
          if (!isSolvedShape(pocketStateToFacelet(applyPocketAlg(state, full)))) continue;
          const folded = foldRotations(full);
          if (!isSolvedShape(pocketStateToFacelet(applyPocketAlg(state, folded)))) {
            throw new DeriveError(`朝向折叠改变了公式含义:${full} → ${folded}`);
          }
          return folded;
        }
      }
    }
  }
  return null;
}

export function solvesCase(state: PocketState, alg: string): boolean {
  return alignAlgToState(state, alg) !== null;
}

/** 题面串的 case 身份 —— 解它的公式就是它的逆。 */
export function caseKeyOfSetup(setup: string): string {
  return caseKeyOfAlg(invertMoveString(setup));
}

/** 状态版:先反推一条到达该状态的打乱,再走 {@link caseKeyOfSetup}。 */
export function caseKeyOf(state: PocketState): string {
  return caseKeyOfSetup(derivePocketScramble(pocketStateToFacelet(state)));
}

/** 公式 → 题面串(站内 `setup` 字段那个口径):折掉转体再取逆,只剩六面转,好画好读。 */
export function setupOfAlg(alg: string): string {
  return invertMoveString(foldRotations(alg));
}

/** 公式 → 它所解的题面(标准框:做好的层在 D)。 */
export function stateOfAlg(alg: string): PocketState {
  return applyPocketAlg(solved, setupOfAlg(alg));
}

/** facelet 的某一面是不是单色。 */
function faceSolid(facelet: string, face: string): boolean {
  const i = POCKET_FACES.indexOf(face as never) * 4;
  return new Set(facelet.slice(i, i + 4)).size === 1;
}

export const isSolvedShape = (facelet: string) => POCKET_FACES.every((f) => faceSolid(facelet, f));

/**
 * 底层形状。二阶没有中心块,「底层」= 反推态里那些**本该在下半**的角位;
 * 由于 case 一律是从还原态倒推来的,坐标系与还原态一致,直接看 4..7 号角位即可。
 */
export function shapeOf(state: PocketState, facelet: string): CaseShape {
  let solvedCorners = 0;
  let oriented = 0;
  for (const s of D_SLOTS) {
    if (state.cp[s] >= 4 && state.co[s] === 0) oriented++;
    if (state.cp[s] === s && state.co[s] === 0) solvedCorners++;
  }
  return {
    dFaceSolid: faceSolid(facelet, 'D'),
    dLayerSolved: solvedCorners === 4,
    dLayerOriented: oriented === 4,
    dSolvedCorners: solvedCorners,
    uFaceSolid: faceSolid(facelet, 'U'),
  };
}

export class DeriveError extends Error {}

/**
 * 一格 → 一个 case。
 *
 * case **由多数派定**,不钦定第一条:表里主推那条自己抄错的情况真实存在(TEG2+
 * Pinwheel-Poser#5 一格里后五条互相一致、只有头一条是异类)。做法是把同格公式按
 * 「互相解不解得掉对方反推的题面」聚类,取最大的一簇;并列时优先含主推那条的簇。
 *
 * 归属判据走 {@link solvesCase} 而不是比 {@link caseKeyOfAlg}:后者是严格身份口径,
 * 对「公式停在被转过的还原态上」(`x2 R2 U2 R' F2 R2` 这类)会误判成另一个 case。
 */
export function deriveSlot(slot: SheetSlot & { sheet: string }, prefer?: (s: CaseShape) => boolean): DerivedSlot {
  if (!slot.algs.length) throw new DeriveError(`${slot.sheet} ${slot.group}#${slot.col}: 空格`);

  const sans: (Sanitized & { row: number })[] = slot.algs.flatMap(({ raw, row }) =>
    expandAlg(raw).map((san) => ({ ...san, row })));
  const states = sans.map((s) => stateOfAlg(s.alg));

  // ① 自洽:每条公式都得解掉自己反推的题面。数学上恒真 —— 挂了说明记号层
  // (sanitize / invert / fold / apply)哪一环不自洽,是给解析器兜底的回归网,不是判据。
  sans.forEach((s, i) => {
    if (!isSolvedShape(pocketStateToFacelet(applyPocketAlg(states[i], foldRotations(s.alg))))) {
      throw new DeriveError(`${slot.sheet} ${slot.group}#${slot.col} r${s.row}: 公式解不掉自己反推的题面(记号层不自洽)`);
    }
  });

  // ② 聚类取多数派。簇 i = 能被第 i 条公式解掉的那些格友。
  // `prefer` 是本表的形状要求(CLL 底层必须整好等):有候选满足就只在它们里面选,
  // 免得多数派把代表挑成一个形状根本不属于本方法的态。
  const caseKeys = sans.map((s) => caseKeyOfAlg(s.alg));
  const members = states.map((st, i) => sans.map((s, j) =>
    caseKeys[i] === caseKeys[j] || solvesCase(st, s.alg)));
  const shapes = states.map((st, i) => shapeOf(st, pocketStateToFacelet(states[i])));
  const pool = prefer && shapes.some(prefer)
    ? sans.map((_, i) => i).filter((i) => prefer(shapes[i]))
    : sans.map((_, i) => i);
  let lead = pool[0];
  for (const i of pool) {
    if (members[i].filter(Boolean).length > members[lead].filter(Boolean).length) lead = i;
  }

  const aligned = sans.map((s) => alignAlgToState(states[lead], s.alg));
  const setup = setupOfAlg(aligned[lead] ?? sans[lead].alg);
  const facelet = pocketStateToFacelet(states[lead]);
  const algs: DerivedAlg[] = sans.map((s, i) => ({
    ...s, caseKey: caseKeys[i], alignedAlg: aligned[i], solves: aligned[i] !== null,
  }));
  return {
    sheet: slot.sheet,
    group: slot.group,
    col: slot.col,
    caseKey: algs[lead].caseKey,
    facelet,
    state: states[lead],
    setup,
    algs,
    lead: sans[lead].row,
    disagree: algs.filter((a) => !a.solves),
    shape: shapes[lead],
    agree: aligned.filter(Boolean).length,
    total: algs.length,
  };
}
