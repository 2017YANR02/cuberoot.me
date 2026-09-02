import {
  TIMER_MORE_ACTION_COPY,
  visibleTimerMoreActions,
  type TimerMoreActionContext,
  type TimerMoreActionId,
} from '@cuberoot/shared/timer';
import type { TimerMoreMenuItem } from '@cuberoot/timer-ui';

import type { SupportedLanguage } from './copy';

/**
 * Mobile only advertises actions whose native/App-hosted effect is complete.
 * The canonical registry remains larger; missing actions stay explicit parity
 * gaps instead of becoming disabled, no-op, coming-soon, or Web-timer links.
 */
export const MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS = [
  'more.marks',
  'more.stats-mobile',
  'more.language-mobile',
  'more.drill',
  'more.bld-helper',
  'more.fullscreen',
  'more.manual-entry',
  'more.solver',
  'more.bulk',
  'more.print',
  'more.clear-event',
] as const satisfies readonly TimerMoreActionId[];

export type MobileTimerMoreImplementedActionId =
  (typeof MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS)[number];

export type MobileTimerMoreActionHandlers = Readonly<
  Record<MobileTimerMoreImplementedActionId, () => void>
>;

const IMPLEMENTED = new Set<TimerMoreActionId>(MOBILE_TIMER_MORE_IMPLEMENTED_ACTION_IDS);

export function mobileTimerMoreMenuItems(
  context: TimerMoreActionContext,
  language: SupportedLanguage,
  handlers: MobileTimerMoreActionHandlers,
): readonly TimerMoreMenuItem[] {
  return visibleTimerMoreActions(context)
    .filter((action) => IMPLEMENTED.has(action.id))
    .map((action) => ({
      ...action,
      label: TIMER_MORE_ACTION_COPY[action.id][language],
      onSelect: handlers[action.id as MobileTimerMoreImplementedActionId],
    }));
}
