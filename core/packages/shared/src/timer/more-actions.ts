import type { EventId } from './types';

/**
 * Stable IDs for every action currently reachable from Web `/timer`'s More
 * menu. Hosts may omit an action only while its real effect is not implemented;
 * they must not replace it with a no-op, a coming-soon toast, or an external
 * Web timer fallback.
 */
export const TIMER_MORE_ACTION_IDS = [
  'more.marks',
  'more.stats-mobile',
  'more.language-mobile',
  'more.drill',
  'more.bld-helper',
  'more.fullscreen',
  'more.manual-entry',
  'more.replay',
  'more.solver',
  'more.bulk',
  'more.print',
  'more.clear-event',
] as const;

export type TimerMoreActionId = (typeof TIMER_MORE_ACTION_IDS)[number];

export type TimerMoreActionEffect =
  | 'navigate-scramble-marks'
  | 'open-full-stats'
  | 'toggle-language'
  | 'open-drill-picker'
  | 'open-speffz-helper'
  | 'toggle-fullscreen'
  | 'open-manual-result-entry'
  | 'prompt-and-import-replay'
  | 'open-general-333-solver'
  | 'open-bulk-scramble-generator'
  | 'print-timer'
  | 'confirm-clear-current-event';

export type TimerMoreActionVisibility =
  | 'always'
  | 'compact-viewport'
  | 'drill-event-without-active-drill'
  | 'speffz-event';

export type TimerMoreActionDisabledWhen = 'never' | 'no-current-event-solves';

export interface TimerMoreActionContract {
  id: TimerMoreActionId;
  effect: TimerMoreActionEffect;
  visibility: TimerMoreActionVisibility;
  disabledWhen: TimerMoreActionDisabledWhen;
  danger: boolean;
}

export interface TimerMoreActionContext {
  /** Web uses `(max-width: 480px)`; Mobile passes its always-compact shell. */
  compactViewport: boolean;
  drillActive: boolean;
  event: EventId;
  fullscreen: boolean;
  solveCount: number;
}

export interface TimerMoreActionState extends TimerMoreActionContract {
  active: boolean;
  disabled: boolean;
  visible: boolean;
}

export interface TimerMoreActionCopy {
  en: string;
  zh: string;
}

export const TIMER_MORE_ACTION_COPY: Readonly<Record<TimerMoreActionId, TimerMoreActionCopy>> = {
  'more.marks': { en: 'Scramble marks', zh: '打乱足迹' },
  'more.stats-mobile': { en: 'Stats', zh: '统计' },
  'more.language-mobile': { en: 'Language: 中文', zh: '语言：EN' },
  'more.drill': { en: 'Drill mode', zh: '专项练习' },
  'more.bld-helper': { en: 'BLD helper', zh: '盲拧助手' },
  'more.fullscreen': { en: 'Fullscreen', zh: '全屏' },
  'more.manual-entry': { en: 'Manual entry', zh: '手动录入' },
  'more.replay': { en: 'Paste replay URL', zh: '粘贴 replay 链接' },
  'more.solver': { en: 'Solver', zh: '通用求解器' },
  'more.bulk': { en: 'Bulk scrambles', zh: '批量打乱' },
  'more.print': { en: 'Print', zh: '打印' },
  'more.clear-event': { en: 'Clear current event', zh: '清空当前项目' },
};

export function timerClearCurrentEventConfirmation(
  eventName: string,
  solveCount: number,
): TimerMoreActionCopy {
  return {
    en: `Clear all ${solveCount} solves of "${eventName}"?`,
    zh: `清空当前项目「${eventName}」的所有 ${solveCount} 次成绩？`,
  };
}

export const TIMER_MORE_ACTION_CONTRACTS: readonly TimerMoreActionContract[] = [
  { id: 'more.marks', effect: 'navigate-scramble-marks', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.stats-mobile', effect: 'open-full-stats', visibility: 'compact-viewport', disabledWhen: 'never', danger: false },
  { id: 'more.language-mobile', effect: 'toggle-language', visibility: 'compact-viewport', disabledWhen: 'never', danger: false },
  { id: 'more.drill', effect: 'open-drill-picker', visibility: 'drill-event-without-active-drill', disabledWhen: 'never', danger: false },
  { id: 'more.bld-helper', effect: 'open-speffz-helper', visibility: 'speffz-event', disabledWhen: 'never', danger: false },
  { id: 'more.fullscreen', effect: 'toggle-fullscreen', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.manual-entry', effect: 'open-manual-result-entry', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.replay', effect: 'prompt-and-import-replay', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.solver', effect: 'open-general-333-solver', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.bulk', effect: 'open-bulk-scramble-generator', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.print', effect: 'print-timer', visibility: 'always', disabledWhen: 'never', danger: false },
  { id: 'more.clear-event', effect: 'confirm-clear-current-event', visibility: 'always', disabledWhen: 'no-current-event-solves', danger: true },
];

const DRILL_EVENT_IDS: ReadonlySet<EventId> = new Set([
  '333',
  '333oh',
  '333fm',
  'oll',
  'pll',
]);

const SPEFFZ_EVENT_IDS: ReadonlySet<EventId> = new Set([
  '333bld',
  '333ni',
  '333mbld',
]);

export function timerEventSupportsDrill(event: EventId): boolean {
  return DRILL_EVENT_IDS.has(event);
}

export function timerEventSupportsSpeffzHelper(event: EventId): boolean {
  return SPEFFZ_EVENT_IDS.has(event);
}

function actionVisible(
  visibility: TimerMoreActionVisibility,
  context: TimerMoreActionContext,
): boolean {
  switch (visibility) {
    case 'always':
      return true;
    case 'compact-viewport':
      return context.compactViewport;
    case 'drill-event-without-active-drill':
      return timerEventSupportsDrill(context.event) && !context.drillActive;
    case 'speffz-event':
      return timerEventSupportsSpeffzHelper(context.event);
  }
}

/** Resolve all twelve contracts without dropping hidden entries. */
export function timerMoreActionStates(
  context: TimerMoreActionContext,
): readonly TimerMoreActionState[] {
  return TIMER_MORE_ACTION_CONTRACTS.map((contract) => ({
    ...contract,
    active: contract.id === 'more.fullscreen' && context.fullscreen,
    disabled: contract.disabledWhen === 'no-current-event-solves'
      && !(Number.isFinite(context.solveCount) && context.solveCount > 0),
    visible: actionVisible(contract.visibility, context),
  }));
}

export function visibleTimerMoreActions(
  context: TimerMoreActionContext,
): readonly TimerMoreActionState[] {
  return timerMoreActionStates(context).filter((action) => action.visible);
}
