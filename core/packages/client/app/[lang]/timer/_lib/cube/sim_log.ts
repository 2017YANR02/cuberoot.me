/**
 * 怎么把「魔方现在该显示成什么」交给 /sim 引擎 —— 瞬切还是转给你看。
 *
 * 引擎只有两个入口,它们说的是两件不同的事:
 *
 *   - `twister.setup(exp)` —— 丢掉待播队列,复位,整条重新应用。这是**状态跳变**
 *     唯一诚实的答案(拖时间轴、上一步、重新锚定):没人真的转了那些手,凭空补一段
 *     动画是编的。
 *   - `twister.push(exp)`  —— 在当前状态上把这几手转出来。只有当「新日志确实是老
 *     日志接着往下写」时才成立,那时候「变了什么」本来就是一串转动。
 *
 * ## 姿态不是动作
 *
 * 回放面板要把十字转到下面,做法是在动作末尾接一个整体旋转(`viewRotation`,见
 * `orient.ts`;不换记号是因为换名会把颜色也换掉)。于是喂给引擎的那条串长这样:
 *
 *     打乱 + 前 idx 手 + 旋转
 *
 * 天真的「新串以老串开头」判据在这里**永远为假** —— 新的一手插在旋转前面,不是接
 * 在它后面。回放因此每一步都走 setup,一路瞬切,一次动画也放不出来。这不是动画代码
 * 没接上,是判据问的问题不对:该问的是**动作**有没有往下写,姿态是另一根轴。
 *
 * 分开之后还剩一件事要算。屏幕上现在是 `T·ρ`(动作 T,姿态 ρ),目标是 `T·m·ρ`,
 * 而 `push(X)` 给的是 `T·ρ·X`。要它们相等就得
 *
 *     X = ρ⁻¹ · m · ρ
 *
 * 也就是把新的一手**共轭到当前视角下**:魔方已经转过去了,`R` 那一层现在不叫 `R`。
 * 直接 push 原记号会转错层,而且错得看不出来 —— 直到某一步和真实局面对不上。共轭
 * 走 `orient.ts` 那套(`facePermFor` + `conjugateSequence`),不另写一份换名表。
 *
 * ## 姿态自己变了就瞬切
 *
 * 开关陀螺仪会换掉 ρ,那一刻整条显示串都变了,没有「接着往下写」可言 —— 连同「同
 * 一次渲染里既换姿态又多了一手」的情形一起,都退回 setup。上面那条等式只在 ρ 前后
 * 一致时成立,拿新 ρ 去共轭老状态是错的。
 */

import { conjugateSequence, facePermFor } from '../reconstruct/orient';

/** 一次显示更新的两根轴:动作日志,和只影响看的姿态旋转(可以是空串)。 */
export interface SimLogState {
  /** 从复原态起算的动作,空格分隔。 */
  turns: string;
  /** 接在动作末尾的整体旋转;`''` = 不接。 */
  pose: string;
}

export interface SimLogPlan {
  /** `setup` = 整条重放(瞬切);`push` = 在当前状态上动画转 `exp`。 */
  mode: 'setup' | 'push';
  /** 喂给对应入口的记号串。 */
  exp: string;
}

export interface LiveSimCatchUpPlan {
  /** Apply every stale move through this state instantly. */
  mode: 'catch-up';
  setupExp: string;
  /** Animate only this latest move after the instant state catch-up. */
  pushExp: string;
}

export type LiveSimPlan = SimLogPlan | LiveSimCatchUpPlan;

/** At most one active turn plus one pending turn may remain visually behind. */
export const MAX_LIVE_ANIMATION_BACKLOG = 2;

/** `T` 和 `ρ` 拼成实际喂给引擎的那条串。两边都可能是空的。 */
function composed(s: SimLogState): string {
  if (!s.pose) return s.turns;
  return s.turns ? `${s.turns} ${s.pose}` : s.pose;
}

/**
 * 从 `prev` 到 `next` 该怎么驱动引擎。
 *
 * `animate` 关(或者判据不成立)一律 setup —— 默认瞬切,动画是要挣的。
 * 空的 `prev.turns` 也不播:那是首次挂载,整条打乱「播放」一遍不是动画是发呆。
 */
export function planSimUpdate(
  prev: SimLogState,
  next: SimLogState,
  animate: boolean,
): SimLogPlan {
  const full = composed(next);
  if (!animate) return { mode: 'setup', exp: full };
  // 姿态换了 → 屏幕上那条串整个换掉,没有「接着往下写」这回事。
  if (prev.pose !== next.pose) return { mode: 'setup', exp: full };
  if (prev.turns === '') return { mode: 'setup', exp: full };
  if (!next.turns.startsWith(`${prev.turns} `)) return { mode: 'setup', exp: full };

  const appended = next.turns.slice(prev.turns.length).trim();
  if (appended === '') return { mode: 'setup', exp: full };
  if (!next.pose) return { mode: 'push', exp: appended };

  // ρ⁻¹ · m · ρ —— 认不出来的记号整串放弃共轭,退回 setup。押一个猜出来的记号会
  // 转错层,而瞬切只是少一段动画。
  const conj = conjugateSequence(appended, facePermFor(next.pose));
  return conj === null ? { mode: 'setup', exp: full } : { mode: 'push', exp: conj };
}

/**
 * Live mirrors prioritize the physical cube's current state over replaying stale
 * history. A short queue stays fully animated; once active + pending + incoming
 * moves exceed the cap, every old move is applied instantly and only the newest
 * move remains animated. No logical move is dropped.
 */
export function planLiveSimUpdate(
  prev: SimLogState,
  next: SimLogState,
  animate: boolean,
  currentBacklog: number,
): LiveSimPlan {
  const ordinary = planSimUpdate(prev, next, animate);
  if (ordinary.mode !== 'push') return ordinary;

  const incomingCount = ordinary.exp.trim().split(/\s+/).filter(Boolean).length;
  if (currentBacklog + incomingCount <= MAX_LIVE_ANIMATION_BACKLOG) return ordinary;

  const nextTokens = next.turns.trim().split(/\s+/).filter(Boolean);
  if (nextTokens.length === 0) return ordinary;
  const beforeLatest: SimLogState = {
    turns: nextTokens.slice(0, -1).join(' '),
    pose: next.pose,
  };
  const latest = planSimUpdate(beforeLatest, next, true);
  if (latest.mode !== 'push') return { mode: 'setup', exp: composed(next) };

  return {
    mode: 'catch-up',
    setupExp: composed(beforeLatest),
    pushExp: latest.exp,
  };
}
