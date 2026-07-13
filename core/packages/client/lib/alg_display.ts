/**
 * 公式给魔友看的形式。
 *
 * 库里存的是**完整公式**:`setup + alg` 精确还原,所以末尾常带一个把顶层转正的收尾 AUF。
 * 那个 U 对魔友没有任何帮助(他自己会转),所以显示和复制时剥掉。
 *
 * 剥掉是安全的:若 `setup + A U^b` 还原,那 A 单独执行后魔方只差一个顶层转 —— 末尾的
 * U^b 必然是纯收尾 AUF,不可能是公式的一部分(它后面没有任何步骤能被它影响)。
 *
 * ⚠ **播放器 / 缩略图 / recon 查表要的是完整公式,别喂它们 displayAlg 的结果** ——
 * 剥了 AUF 的公式跑完停在没还原的魔方上。只有「渲染文本」和「复制到剪贴板」用这个。
 *
 * 纯字符串操作,不过 cubing.js —— 括号、`=` 标记、`·↑↓` 指法记号都要原样保留。
 */

/** 末尾的 U / U2 / U' / U2'(可带括号),`Uw`、`u` 不算(它们不是 AUF) */
const TRAILING_AUF = /[\s(]*\bU(?:2'?|'|)(?![\w'])\s*\)?\s*$/;

export function displayAlg(alg: string): string {
  if (!alg) return '';
  const stripped = alg.replace(TRAILING_AUF, '').trimEnd();
  // 整条公式就是一个 U(理论上不该有)—— 剥空了就别剥。
  return stripped || alg;
}
