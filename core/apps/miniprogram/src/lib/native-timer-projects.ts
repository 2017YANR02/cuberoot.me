import { generateGearTimerScramble } from '@cuberoot/puzzle-solvers/gear';
import { generateIvyTimerScramble } from '@cuberoot/puzzle-solvers/ivy';
import { generateNativePuzzleScramble, isNativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { generatePyraminxDuoScramble } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { formatTimerCompoundScramble, TIMER_COMPOUND_SCRAMBLE_CHILDREN, type TimerCompoundScrambleEventId } from '@cuberoot/shared/timer/compound-scramble';
import { isTimerOrdinaryEvent, TIMER_EVENT_PICKER_GROUPS } from '@cuberoot/shared/timer/event-catalog';
import { generateTimedWcaScramble, isTimedWcaEvent } from '@cuberoot/shared/timer/seeded/wca';
import type { TimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import type { EventId } from '@cuberoot/shared/timer/types';
import { tr } from './i18n';

export type NativeTimerEvent = EventId;
export const isNativeTimerEvent = isTimerOrdinaryEvent;

export function nativeTimerProjectGroups() {
  return TIMER_EVENT_PICKER_GROUPS.map(group => ({
    id: group.id,
    name: tr({ en: group.nameEn, zh: group.nameZh }),
    items: group.items.flatMap(item => {
      const { id } = item;
      if (!isNativeTimerEvent(id)) return [];
      return [{
        id,
        name: tr({ en: item.nameEn, zh: item.nameZh }),
        icon: item.iconClass?.startsWith('event-') ? item.iconClass.slice(6) : item.iconClass ?? null,
        textLabel: item.textLabel ?? id,
      }];
    }),
  })).filter(group => group.items.length > 0);
}

export function nativeTimerEvents() {
  return nativeTimerProjectGroups().flatMap(group => group.items);
}

export function generateNativeTimerScramble(event: NativeTimerEvent, mode: TimerStoreSettings['scramble222Mode']): string {
  if (isTimedWcaEvent(event)) return generateTimedWcaScramble(event, Math.random, mode);
  if (event in TIMER_COMPOUND_SCRAMBLE_CHILDREN) {
    const compound = event as TimerCompoundScrambleEventId;
    const children = TIMER_COMPOUND_SCRAMBLE_CHILDREN[compound].map(child => generateTimedWcaScramble(child, Math.random, mode));
    return formatTimerCompoundScramble(compound, children);
  }
  if (isNativePuzzleId(event)) return generateNativePuzzleScramble(event);
  switch (event) {
    case '333fm': case '333mr': case 'sphere': return generateTimedWcaScramble('333', Math.random, mode);
    case '333ni': return generateTimedWcaScramble('333bld', Math.random, mode);
    case 'gear': return generateGearTimerScramble();
    case 'ivy': return generateIvyTimerScramble();
    case 'pyraminx_duo': return generatePyraminxDuoScramble();
    case 'custom': return '';
    default: throw new Error(`Native scramble Worker is required for ${event}`);
  }
}
