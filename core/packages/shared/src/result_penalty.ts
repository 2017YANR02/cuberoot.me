// 罚时(+2)标注的合法性校验 —— 全栈共享单一来源。
// 客户端用它 gate 自助 +2 入口;服务器用它在写端点强制(非管理员只能给「自己」标「纯罚时」)。
// 罚时是纯展示:不重算单次/平均/排名(见 result-watch-api 的 recordAttemptPenalty),
// 所以自助标注的影响仅限本人页面的显示,风险有界。

export const PENALTY_STEP_CS = 200;   // 每档 +2 秒 = 200 厘秒
const MAX_PENALTY_STEPS = 8;          // 单次罚时上限档数(对齐 UI maxPenaltySteps 的绝对上界 8 档)
const MAX_ATTEMPTS = 10;              // 一轮 attempts 数上限(WCA 至多 5,留余量)

// 罚时(+2 秒)只对按时间计的项目有意义;FMC(步数)/ MBLD(打包编码)不适用。
export const NO_PENALTY_EVENTS: ReadonlySet<string> = new Set(['333fm', '333mbf', '333mbo']);

/** 单个罚时厘秒值是否合法:非负整数 + 200 的整数倍 + 不超过上限。 */
export function isValidPenaltyCs(v: unknown): v is number {
  return typeof v === 'number'
    && Number.isInteger(v)
    && v >= 0
    && v % PENALTY_STEP_CS === 0
    && v <= MAX_PENALTY_STEPS * PENALTY_STEP_CS;
}

/** attempt_penalties 数组是否合法(非空,长度有界,每项合法)。 */
export function isValidPenaltyArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length >= 1
    && value.length <= MAX_ATTEMPTS
    && value.every(isValidPenaltyCs);
}

/**
 * 一组变更字段是否「纯罚时标注」:非空,且每个字段都是合法的 attempt_penalties。
 * 非管理员的自助写入必须满足此条件(只能标 +2,不能改单次/平均/原始等)。
 */
export function isPenaltyOnlyFields(fields: unknown): boolean {
  if (!Array.isArray(fields) || fields.length === 0) return false;
  return fields.every((f) => {
    if (!f || typeof f !== 'object') return false;
    const ff = f as { field?: unknown; new?: unknown };
    return ff.field === 'attempt_penalties' && isValidPenaltyArray(ff.new);
  });
}

/** 给定单次成绩值(厘秒),最多可标几档 +2:base = 值 − 罚时 仍 > 0,且 ≤ 8 档。 */
export function maxPenaltySteps(eventId: string, value: number): number {
  if (NO_PENALTY_EVENTS.has(eventId) || value <= 0) return 0;
  return Math.min(8, Math.floor((value - 1) / PENALTY_STEP_CS));
}

/** 该单次成绩是否可标罚时(至少能标 1 档 +2)。 */
export function canPenalizeAttempt(eventId: string, value: number): boolean {
  return maxPenaltySteps(eventId, value) >= 1;
}
