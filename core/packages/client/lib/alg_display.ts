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
  let stripped = alg;
  while (true) {
    const next = stripped.replace(TRAILING_AUF, '').trimEnd();
    // 整条公式只剩 AUF(理论上不该有)—— 至少留下一步,别剥成空串。
    if (!next || next === stripped) return stripped;
    stripped = next;
  }
}

/**
 * 顶层 case 的观察角度。URL 不直接存 `U'`，避免引号在分享链接里显得含混。
 * `default` 是库里的原始角度，其余三项表示在摆好 case 后再做的 U 层调整。
 */
export const CASE_VIEW_ANGLES = ['default', 'u', 'u2', 'up'] as const;
export type CaseViewAngle = (typeof CASE_VIEW_ANGLES)[number];

const CASE_VIEW_SETUP_AUF: Record<CaseViewAngle, string> = {
  default: '',
  u: 'U',
  u2: 'U2',
  up: "U'",
};

const CASE_VIEW_SOLUTION_AUF: Record<CaseViewAngle, string> = {
  default: '',
  u: "U'",
  u2: 'U2',
  up: 'U',
};

const LEADING_U = /^U(2'?|')?(?:\s+|$)/;
const U_TURNS: Record<string, number> = { U: 1, U2: 2, "U2'": 2, "U'": 3 };
const TURN_U = ['', 'U', 'U2', "U'"] as const;

/** 摆好 case 后补用户选择的 U 层角度。 */
export function caseViewSetup(setup: string, angle: CaseViewAngle): string {
  const auf = CASE_VIEW_SETUP_AUF[angle];
  if (!setup || !auf) return setup;
  return `${setup.trimEnd()} ${auf}`;
}

/**
 * 同一状态转了 U^k 后，解法必须在开头补 U^-k；若原公式也以 U 开头，顺手合并相邻 AUF。
 * 这里只动最开头一个普通 U 层动作，不碰 Uw / u，也不改公式主体与收尾 AUF。
 */
export function caseViewAlg(alg: string, angle: CaseViewAngle): string {
  const prefix = CASE_VIEW_SOLUTION_AUF[angle];
  if (!alg || !prefix) return alg;

  const trimmed = alg.trimStart();
  const match = trimmed.match(LEADING_U);
  const leading = match?.[0]?.trim();
  if (!match || !leading) return `${prefix} ${trimmed}`;

  const rest = trimmed.slice(match[0].length);
  const turns = (U_TURNS[prefix] + U_TURNS[leading]) % 4;
  return [TURN_U[turns], rest].filter(Boolean).join(' ');
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
