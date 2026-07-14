/**
 * 库里的公式文本 → 引擎(cubing.js)能吃的招式串。**全站唯一一份。**
 *
 * 公式是**人写的**,也是从上游公式库抓来的,所以文本里混着一堆不是招式的东西:
 * 换握记号 `↑↓·`、等价标注 `=`/`*`、FTN 注解块 `[…]`、分组括号 `(…)2'`、
 * 以及**无空格连写**(`MR` = M+R,`U'D'`)。
 *
 * cubing.js 对连写**不报错** —— 它把 `MR` 当成一个叫 `MR` 的 family 收下,直到 apply 才炸;
 * 对记号则当场报 `Unexpected character`。两条路都必须先过 `toMoveString`(剥净 → 展开 →
 * 按 token 重切再拼)。播放器和校验器曾各走各的:播放器走了,校验器没走,于是**数据没错、
 * 校验器却报 611 条语法错**。这个文件就是为了不再有第二份。
 *
 * 记号含义与清洗规范见 `docs/alg-upstream-notation.md`。
 */
import type { AlgPuzzle } from '@cuberoot/shared';
import { toMoveString } from '@cuberoot/shared/alg-notation';
import { toWca as skewbToWca } from '@cuberoot/shared/skewb-notation';
import { canonicalSq1Alg } from '@/lib/sq1-svg';

/** 用 WCA 面/宽/中层/转体记号的魔方 —— 这几种才能走 `toMoveString`。
 *  megaminx(`R++` `D--`)、sq1(`(1,0)/`)是另一套文法,喂进去只会炸。 */
const CUBE_NOTATION = new Set<AlgPuzzle>(['2x2', '3x3', '4x4', '5x5', 'pyraminx', 'skewb']);

/** 严格版:认不出来的记号**抛错**。校验器用 —— 它要把「认不出来」如实报给人看。 */
export function normalizeAlg(puzzle: AlgPuzzle, alg: string): string {
  if (puzzle === 'sq1') return canonicalSq1Alg(alg);
  // skewb 库里存的是 Sarah 记号(`R b' r' R'`)。缩略图一直在转,引擎这边以前没转 —— 448 条
  // 好公式因此被判成语法错 / 没还原。
  if (puzzle === 'skewb') return toMoveString(skewbToWca(alg, 'sarah'));
  if (!CUBE_NOTATION.has(puzzle)) return alg;
  return toMoveString(alg);
}

/** 容错版:抛了就原样退回。播放器用 —— 宁可让 cubing.js 自己去判,也不要白屏。 */
export function normalizeAlgForTwisty(puzzle: AlgPuzzle, alg: string): string {
  try { return normalizeAlg(puzzle, alg); } catch { return alg; }
}
