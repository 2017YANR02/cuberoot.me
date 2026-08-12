/**
 * 一张 case 的**打乱**:照着念一遍就摆出这张图的那条转动序列。
 *
 * 每张 case 都该有一条 —— 详情页 / 训练弹窗的图画的就是打乱之后的样子,没有打乱那张图就没法复现。
 * 三档取值,**越靠前越好看,越靠后越保底**:
 *
 *  ① `meta.scramble` —— 站长表里的「逆 case 的公式」。导入时逐条过了 16 折轨道判据
 *     (`alg-build/import_1lll.mjs` 的 `keepScramble`),验不过的**不入库**,所以有就属于这张 case。
 *     但导入判的是前后 AUF 轨道,详情页还要把它对齐到缩略图的确定相位。
 *  ② 逆 case 的首条公式 —— ①缺位时现推。X 的逆态就是「解 X 的逆 case 那条公式打在还原魔方上」
 *     的结果,所以逆 case 的公式天生是 X 的打乱。
 *  ③ `setup` —— 站上那条不变式 `setup + alg == 还原` 的左半边,**恒等于**首条公式的逆,永远对。
 *
 * ── 为什么 ② 还要再印证一次 `meta.inv` ────────────────────────────────────────
 * 这个指针**真的错过**:2026-08-04 查出 8 张 1lll case 的整块 meta 挂到了别人的行上,连带
 * 12 张的 `inv` 指向不是自己的逆态(migration `0102`,始末见 `docs/1lll-sheet-issues.md`
 * §元数据层)。照着错指针取公式,屏幕上写着这个名字、手上打出来是另一个 case,**静默教错**。
 *
 * 0102 之后线上指针已全部与状态对齐(守卫 `alg-build/verify_meta_pointers.mjs`),但这层印证
 * 留着:它是前端唯一能就地做的自查 —— 逆 case 自己那条**已过轨道判据**的打乱,必须正好是本
 * case 的首条公式(互为逆的两张,一张的打乱就是另一张的公式)。对不上就不敢用,退到 ③。
 *
 * 代价是它有假阴性(逆 case 那条打乱缺位时印证不上,现有 19 张),但退到的 ③ 本来就恒成立,
 * 最坏结果只是少一个「逆 case」标、公式是机械求逆的而非人写的 —— 换指针错时不误导,值。
 */
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { deleteAuf, toMoveString } from '@cuberoot/shared/alg-notation';
import { CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { normalizeAlg } from '@/lib/alg_normalize';
import type { ScrambleKind } from '@/lib/trainer-scramble';

export interface CaseScramble {
  text: string;
  /** true = 这条是「逆 case 的公式」(①②),行首要标出来;false = 退到 `setup` 的保底 */
  fromInvCase: boolean;
}

/** 两条公式是不是同一串转动 —— 只比转动本身,起手 AUF / 括号 / 换握记号 / `R2'` 写法都不算数。 */
function sameMoves(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  try {
    const canon = (s: string) => toMoveString(deleteAuf(s)).replace(/2'/g, '2');
    return canon(a) === canon(b);
  } catch {
    // 认不出来的记号(sq1 之类)—— 判不了就当没印证上,退保底,不猜。
    return false;
  }
}

const AUF = ['', 'U', 'U2', "U'"] as const;
const CUBE_SIZE: Partial<Record<AlgPuzzle, number>> = {
  '2x2': 2,
  '3x3': 3,
  '4x4': 4,
  '5x5': 5,
};

/**
 * 与 CaseThumb 相同的 NxN 状态引擎。这里比完整贴纸编号,所以整体转体、中心朝向和 U 层相位
 * 都不会被误当成同一张图。非 NxN / 坏记号返回 null,交给 setup 保底。
 */
function cubeStateKey(puzzle: AlgPuzzle, alg: string): string | null {
  const size = CUBE_SIZE[puzzle];
  if (!size) return null;
  try {
    const cube = new CubeData(size);
    for (const turn of parseAlgorithm(normalizeAlg(puzzle, alg))) cube.turn(turn);
    return JSON.stringify(cube.faces);
  } catch {
    return null;
  }
}

/**
 * 表里的各类打乱只保证属于 case 的前后 AUF 轨道。详情图却是 `setup` 的一个确定相位:
 * 在打乱前后各试四种 U 调整,找到逐贴纸等于 setup 的最短补法。
 */
export function alignScrambleToSetup(
  puzzle: AlgPuzzle,
  scramble: string,
  setup: string | undefined,
): string | null {
  const target = setup?.trim();
  if (!target) return scramble.trim() || null;
  const targetKey = cubeStateKey(puzzle, target);
  if (!targetKey) return null;

  // 先试不补、再试只补一端、最后试两端,避免为了对图加入不必要的 U 转动。
  const pairs = AUF.flatMap(pre => AUF.map(post => ({ pre, post })))
    .sort((a, b) => Number(!!a.pre) + Number(!!a.post) - Number(!!b.pre) - Number(!!b.post));
  for (const { pre, post } of pairs) {
    const candidate = [pre, scramble.trim(), post].filter(Boolean).join(' ');
    if (cubeStateKey(puzzle, candidate) === targetKey) return candidate;
  }
  return null;
}

function preferredScramble(
  caseObj: AlgCase,
  byNo: Map<number, AlgCase>,
  kind: ScrambleKind,
): CaseScramble | null {
  if (kind === 'coep' && caseObj.meta?.coep?.scramble) {
    return { text: caseObj.meta.coep.scramble, fromInvCase: false };
  }
  if (kind === 'stm' || kind === 'sqtm' || kind === 'htm' || kind === 'qtm') {
    const text = caseObj.meta?.optimal?.[kind]?.scramble;
    if (text) return { text, fromInvCase: false };
  }

  const meta = caseObj.meta;
  if (meta?.scramble) return { text: meta.scramble, fromInvCase: true };

  const inv = meta?.inv != null ? byNo.get(meta.inv) : undefined;
  const invAlg = inv?.algs[0]?.[0]?.alg;
  if (invAlg && sameMoves(inv?.meta?.scramble, caseObj.algs[0]?.[0]?.alg)) {
    return { text: deleteAuf(invAlg), fromInvCase: true };
  }

  const setup = caseObj.setup?.trim();
  return setup ? { text: setup, fromInvCase: false } : null;
}

/**
 * @param byNo 同一个 set 里的 `meta.no` → case(关联缩略图用的那份,直接复用)
 */
export function caseScramble(
  caseObj: AlgCase,
  byNo: Map<number, AlgCase>,
  puzzle: AlgPuzzle,
  kind: ScrambleKind = 'inv',
): CaseScramble | null {
  const preferred = preferredScramble(caseObj, byNo, kind);
  if (!preferred) return null;

  const aligned = alignScrambleToSetup(puzzle, preferred.text, caseObj.setup);
  if (aligned) return { ...preferred, text: aligned };

  // 无法可靠比较或这条轨道数据有误时,setup 本身就是缩略图的精确状态。
  const setup = caseObj.setup?.trim();
  return setup ? { text: setup, fromInvCase: false } : preferred;
}
