/**
 * 一张 case 的**打乱**:照着念一遍就摆出这张图的那条转动序列。
 *
 * 每张 case 都该有一条 —— 详情页 / 训练弹窗的图画的就是打乱之后的样子,没有打乱那张图就没法复现。
 * 三档取值,**越靠前越好看,越靠后越保底**:
 *
 *  ① `meta.scramble` —— 站长表里的「逆 case 的公式」。导入时逐条过了 16 折轨道判据
 *     (`alg-build/import_1lll.mjs` 的 `keepScramble`),验不过的**不入库**,所以有就是真的。
 *  ② 逆 case 的首条公式 —— ①缺位时现推。X 的逆态就是「解 X 的逆 case 那条公式打在还原魔方上」
 *     的结果,所以逆 case 的公式天生是 X 的打乱。
 *  ③ `setup` —— 站上那条不变式 `setup + alg == 还原` 的左半边,**恒等于**首条公式的逆,永远对。
 *
 * ── 为什么 ② 不能直接信 `meta.inv` ────────────────────────────────────────────
 * 站长表的 `Inv` 列不是每条都对:1lll 里有 12 条与公式定出来的态互相矛盾(`Mirror` 列另有 12 条,
 * `CP` 列另有 4 条),照着它取公式会摆出**别的 case** —— 屏幕上写着这个名字,手上打出来是另一个,
 * 静默教错。所以 ② 加一道互相印证:逆 case 自己那条**已过判据**的打乱,必须正好是本 case 的首条
 * 公式(互为逆的两张,一张的打乱就是另一张的公式)。对不上就当这条指针不可信,退到 ③。
 * 实测:该判据在 pll / ell / zbll / 1lll 全 3915 张上**零假阳性**(把 12 条坏指针全挡住了)。
 */
import type { AlgCase } from '@cuberoot/shared';
import { deleteAuf, toMoveString } from '@cuberoot/shared/alg-notation';

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

/**
 * @param byNo 同一个 set 里的 `meta.no` → case(关联缩略图用的那份,直接复用)
 */
export function caseScramble(caseObj: AlgCase, byNo: Map<number, AlgCase>): CaseScramble | null {
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
