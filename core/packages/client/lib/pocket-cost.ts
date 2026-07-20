/**
 * Pocket Cost — WCA 官方二阶打乱的转动手感代价模型。
 *
 * 忠实移植自 TNoodle 的 `TwoByTwoSolver.computeCost`
 * (tnoodle-lib/scrambles/.../TwoByTwoSolver.java:382-465,GPL,© WCA)。
 * WCA 生成二阶打乱时,会在「恰好 11 步」的全部解里,用这个代价挑最省力的一条 —— 也就是说
 * 赛场二阶打乱本身就是被这套模型优化过的。本文件把该模型独立出来,既给 /scramble/mcc 页当
 * 二阶评分,也给日后二阶打乱生成器复用(同一把尺子选最顺手的等价打乱)。
 *
 * 模型:跟踪右手拇指握位 grip(-1=拇指在底 D,0=在前 F,1=在顶 U),逐步执行、按当前握位
 * 累加每步代价。上游用「读解序倒序 + 取逆」来给打乱串打分,并固定从 grip=0 起手;这里改成
 * 直接对「要执行的招式串」正序做一遍 3 握位状态 DP(等价,且去掉了上游因读越界位引入的
 * 恒定 +cU3 常数)。等价性由 tests/pocket_cost.test.ts 对上游递归逐例对拍锁定。
 */

/** 二阶只用 U R F 三面(固定 DBL 角);记号白名单(顺序仅用于展示)。 */
export const POCKET_KNOWN_MOVES = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"] as const;

// 招式名 → computeCost 的 case 序号。上游 case 体按「被执行的招式」写(= inverseMoveToString[i]),
// 故这里直接把要执行的招式映到对应 case,而不是 moveToString 序(否则会把每招当成它的逆招算)。
const CASE_OF = new Map<string, number>([
  ["U'", 0], ['U2', 1], ['U', 2], ["R'", 3], ['R2', 4], ['R', 5], ["F'", 6], ['F2', 7], ['F', 8],
]);

/** 各步固定代价(上游常量)。cUlow = 从 grip=-1 不换手强做 U 的高代价;cRegrip = 换手惩罚。 */
export const POCKET_COSTS = {
  U: 8, Ulow: 20, U2: 10, U3: 7,
  R: 6, R2: 10, R3: 6,
  F: 10, F2: 30, F3: 19,
  regrip: 20,
} as const;

const INF = Infinity;

/**
 * 从当前握位执行某步的 (新代价增量, 目标握位) 候选。多候选 = 上游 Math.min 的分支。
 * 与 TwoByTwoSolver.computeCost 的 9 个 case 一一对应。
 */
function transitions(code: number, grip: number): Array<[number, number]> {
  const c = POCKET_COSTS;
  switch (code) {
    case 0: return [[c.U3, grip]];                                                    // U'
    case 1: return [[c.U2, grip]];                                                    // U2
    case 2:                                                                            // U
      if (grip === 0) return [[c.U, 0]];
      if (grip === -1) return [[c.regrip + c.U, 0], [c.Ulow, -1]];
      return [[c.regrip + c.U, 0]];
    case 3:                                                                            // R'
      return grip > -1 ? [[c.R3, grip - 1]] : [[c.regrip + c.R3, -1]];
    case 4:                                                                            // R2
      return grip !== 0 ? [[c.R2, -grip]] : [[c.regrip + c.R2, -1], [c.regrip + c.R2, 1]];
    case 5:                                                                            // R
      return grip < 1 ? [[c.R, grip + 1]] : [[c.regrip + c.R, 1]];
    case 6:                                                                            // F'
      return grip !== 0 ? [[c.F3, grip]] : [[c.regrip + c.F3, -1], [c.regrip + c.F3, 1]];
    case 7:                                                                            // F2
      return grip === -1 ? [[c.F2, -1]] : [[c.regrip + c.F2, -1]];
    case 8:                                                                            // F
      return grip === -1 ? [[c.F, -1]] : [[c.regrip + c.F, -1]];
    default: return [];
  }
}

/**
 * 二阶招式串的转动代价(越低越顺手)。
 * @param sequence   空格分隔的招式串,只认 U/R/F 及其 2/′ 变体
 * @param ignoreErrors  true = 跳过非法步;false = 遇到非法步返回 `Unknown move: X`(与 mcc.algSpeed 同约定)
 * @returns 数字代价,或未知步错误串
 */
export function pocketCost(sequence: string, ignoreErrors = false): number | string {
  const codes: number[] = [];
  for (const seg of sequence.split(/\s+/)) {
    if (seg === '') continue;
    const code = CASE_OF.get(seg);
    if (code === undefined) {
      if (ignoreErrors) continue;
      return `Unknown move: ${seg}`;
    }
    codes.push(code);
  }
  if (codes.length === 0) return 0;

  // 3 握位状态前向 DP:dp[grip+1] = 走到此处、以该握位结束的最小代价。起手 grip=0。
  let dp: [number, number, number] = [INF, 0, INF];
  for (const code of codes) {
    const ndp: [number, number, number] = [INF, INF, INF];
    for (let gi = 0; gi < 3; gi++) {
      if (dp[gi] === INF) continue;
      const grip = gi - 1;
      for (const [cost, ng] of transitions(code, grip)) {
        const v = dp[gi] + cost;
        if (v < ndp[ng + 1]) ndp[ng + 1] = v;
      }
    }
    dp = ndp;
  }
  return Math.min(dp[0], dp[1], dp[2]);
}
