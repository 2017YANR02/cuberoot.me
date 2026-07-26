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

/**
 * 多朝向 case(f2l 类的 FR / FL / BL / BR 四个槽)第 `oriIdx` 个朝向的**显示用** setup。
 *
 * 显示路径与校验路径差一个整体转体,别混用:
 *   显示(这里)  `setup y^k`      —— 图与播放器要的是「同一个 case 摆在第 k 个槽」
 *   校验         `y^-k setup y^k` —— 见 alg_validation.ts 的 `setupForCase`(f2l 判据自带 24 朝向容忍)
 *
 * 曾经是 AlgCategoryView 的私有函数,case 详情页因此没用上:详情页把四个朝向的公式全渲染
 * 出来却一律传未调整的 setup,导致 FL/BL/BR 三组的缩略图与动画演的都是**别的** case
 * (拿它校 f2l 全部 622 条只过 164 条 = 只有 FR 那组)。提到这里给两边共用。
 */
const ORI_SUFFIX = ['', 'y', 'y2', "y'"];

export function oriAdjustSetup(setup: string, oriIdx: number): string {
  if (!setup || oriIdx === 0) return setup;
  return `${setup} ${ORI_SUFFIX[oriIdx % 4]}`;
}

/**
 * 槽名的缩写:`Front Right` → `FR`。库里 `ori_names` 存的是全称,而站上到处都拿槽名
 * 当标签(视角切换器、case 卡上的当前朝向、详情页每组公式的小标题),全称一律太长。
 * 认不出来的名字原样返回 —— 别的 set 可能存了别的朝向名。
 */
const ORI_SHORT: Record<string, string> = {
  'Front Right': 'FR', 'Front Left': 'FL', 'Back Left': 'BL', 'Back Right': 'BR',
};

export function shortOriName(name: string): string {
  return ORI_SHORT[name] ?? name;
}
