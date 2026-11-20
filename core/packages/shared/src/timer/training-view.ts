import { consecutiveGoalDays, countSolvesToday } from './goals';
import { roundAttempts, roundProjection, roundResult, type RoundConfig } from './round';
import type { TimerSettingCopy } from './settings-contract';
import { formatEventMs, formatMs } from './stats';
import { formatTargetTime } from './training-settings';
import { effectiveMs, type EventId, type Solve } from './types';

export interface TimerRoundBoundary {
  context: string;
  ids: ReadonlySet<string>;
}

export function startTimerRound(solves: readonly Solve[], context: string): TimerRoundBoundary {
  return { context, ids: new Set(solves.map(solve => solve.id)) };
}

export function timerRoundSolves(solves: Solve[], config: RoundConfig, context: string, boundary: TimerRoundBoundary | null) {
  if (!config.on) return [];
  const size = roundAttempts(config.format);
  return boundary?.context === context
    ? solves.filter(solve => !boundary.ids.has(solve.id)).slice(0, size)
    : solves.slice(-size);
}

type Localize = (copy: TimerSettingCopy) => string;
type RoundTone = 'muted' | 'info' | 'success' | 'warn';

export function timerTargetIndicator(targetMs: number | null, displayMs: number, tr: Localize) {
  if (targetMs === null) return null;
  const delta = targetMs - displayMs;
  return {
    label: `${tr({ zh: '目标', en: 'target' })} ${formatTargetTime(targetMs)}`,
    delta: `${delta >= 0 ? '+' : '-'}${(Math.abs(delta) / 1000).toFixed(2)}s`,
    overshot: delta < 0,
  };
}

export function timerGoalProgress(solves: Solve[], goal: number | null | undefined) {
  const validGoal = typeof goal === 'number' && Number.isFinite(goal) && goal >= 1 ? Math.floor(goal) : null;
  if (validGoal === null || solves.length === 0) return null;
  const count = countSolvesToday(solves);
  const streak = consecutiveGoalDays(solves, validGoal);
  return {
    count, goal: validGoal, reached: count >= validGoal, percent: Math.min(100, count / validGoal * 100),
    label: { zh: '今日目标', en: 'today' },
    title: { zh: `今日完成 ${count} / ${validGoal} 次`, en: `${count} of ${validGoal} solves today` },
    streakLabel: streak >= 2 ? { zh: `${streak} 天连续达标`, en: `${streak} days streak` } : null,
    streakTitle: { zh: '连续每日达成日目标', en: 'Consecutive days hitting the daily goal' },
  };
}

export function localizeTimerGoalProgress(progress: ReturnType<typeof timerGoalProgress>, tr: Localize) {
  return progress && {
    ...progress, label: tr(progress.label), title: tr(progress.title), streakTitle: tr(progress.streakTitle),
    streakLabel: progress.streakLabel ? tr(progress.streakLabel) : '',
  };
}

const roundStatus = {
  idle: { zh: '待开始', en: 'ready' },
  running: { zh: '进行中', en: 'in progress' },
  cut: { zh: '未过关', en: 'cut' },
  done: { zh: '完成', en: 'final' },
};

export function timerRoundProgress(solves: Solve[], config: RoundConfig, targetMs: number | null, event: EventId | undefined,
  precision: 0 | 1 | 2 | 3, tr: Localize) {
  if (!config.on) return null;
  const res = roundResult(solves, config);
  const proj = roundProjection(solves, config, targetMs);
  const fmt = (ms: number | null) => event ? formatEventMs(event, ms, precision) : formatMs(ms, precision);
  const shown = res.complete ? res.official : res.value;
  const hitTarget = targetMs !== null && targetMs > 0 && shown !== null && shown <= targetMs;
  const tone: RoundTone = res.status === 'cut' || (res.complete && (shown === null || !Number.isFinite(shown))) ? 'warn'
    : res.complete && hitTarget ? 'success' : 'info';
  const attemptNumber = Math.min(res.done + 1, res.attempts);
  const target = proj.target;
  const targetLabel = !target ? '' : target.achieved
    ? tr({ zh: `${fmt(target.ms)} 已锁定`, en: `${fmt(target.ms)} secured` })
    : target.impossible ? tr({ zh: `${fmt(target.ms)} 已无望`, en: `${fmt(target.ms)} out of reach` })
      : target.needMs === null ? tr({ zh: `目标 ${fmt(target.ms)}`, en: `target ${fmt(target.ms)}` })
        : res.remaining > 1
          ? tr({ zh: `想破 ${fmt(target.ms)} 需每把 ≤ ${fmt(target.needMs)}`, en: `beat ${fmt(target.ms)}: need ≤ ${fmt(target.needMs)} each` })
          : tr({ zh: `想破 ${fmt(target.ms)} 需 ≤ ${fmt(target.needMs)}`, en: `beat ${fmt(target.ms)}: need ≤ ${fmt(target.needMs)}` });
  const targetTone: RoundTone = target?.achieved ? 'success' : target?.impossible ? 'muted' : 'info';
  return {
    tone, targetTone, targetLabel,
    count: `${res.done}/${res.attempts}`, format: res.format, status: tr(roundStatus[res.status]),
    value: res.complete && res.official === null && res.done > 0 ? '—' : fmt(shown),
    title: tr({ zh: `第 ${attemptNumber} 把 / 共 ${res.attempts} 把`, en: `attempt ${attemptNumber} of ${res.attempts}` }),
    attemptsTitle: tr({
      zh: '本轮每一把，灰色的把数是未过关后不再计入的',
      en: 'Every attempt of the round. Greyed ones no longer count after a missed cutoff',
    }),
    attempts: res.list.map(attempt => ({
      index: attempt.index, state: attempt.state, overLimit: attempt.overLimit,
      value: attempt.state === 'pending' ? '–' : attempt.state === 'dns' ? 'DNS' : attempt.state === 'ineligible'
        ? (attempt.solve ? fmt(effectiveMs(attempt.solve)) : '–') : fmt(attempt.ms),
      title: attempt.state === 'ineligible'
        ? tr({ zh: '未过关，这把不计入', en: 'Cut. This attempt does not count' })
        : attempt.state === 'dns' ? tr({ zh: '累计时限用尽，记为 DNS', en: 'Cumulative limit reached. Recorded as DNS' })
          : attempt.overLimit ? tr({ zh: '超过时限，记为 DNF (WCA A1a4)', en: 'Over the time limit. Recorded as DNF (WCA A1a4)' }) : '',
    })),
    projection: (res.format === 'ao5' || res.format === 'mo3') && res.remaining > 0 && res.done > 0
      ? { best: `BPA ${fmt(proj.bpa)}`, worst: `WPA ${fmt(proj.wpa)}` } : null,
    cutoff: res.cutoffActive && !res.cutoffMade && res.status !== 'cut'
      ? { label: tr({ zh: `过关线 ${fmt(config.cutoffMs)} (前 ${res.cutoffPhase} 把)`, en: `cutoff ${fmt(config.cutoffMs)} (first ${res.cutoffPhase})` }),
        title: tr({ zh: '前几把至少一把严格快于过关线，才能继续 (WCA 9g)', en: 'An early attempt must be strictly better than the cutoff to earn the rest (WCA 9g)' }) } : null,
    budget: config.cumulative && res.budgetMs !== null && !res.complete
      ? { label: tr({ zh: `累计余额 ${fmt(res.budgetMs)}`, en: `cumulative left ${fmt(res.budgetMs)}` }),
        title: tr({ zh: '整轮累计时限剩余额度 (WCA A1a2)', en: 'Cumulative time limit left for the round (WCA A1a2)' }) } : null,
    reset: res.complete ? tr({ zh: '新一轮', en: 'new round' }) : '',
  };
}
