/** Native generators and practice setups without an upstream csTimer event key. */
import {
  NATIVE_PUZZLES,
  NATIVE_PUZZLE_IDS,
  generateNativePuzzleScramble,
  isNativePuzzleId,
} from '@cuberoot/puzzle-solvers/native-puzzles';

interface NativeScrambleEvent {
  id: string;
  zh: string;
  en: string;
  iconClass?: string;
  textLabel?: string;
  practiceHint?: { zh: string; en: string };
}

export const NATIVE_SCRAMBLE_EVENTS = [
  { id: 'pyraminx_duo', zh: '二重奏魔方', en: 'Pyraminx Duo', textLabel: 'Duo' },
  {
    id: 'magic', zh: '八板', en: "Rubik's Magic", iconClass: 'event-magic',
    practiceHint: {
      zh: 'Forward：矩形三环分离 → L 形三环相连；Backward：反向练习。图示显示起始状态。八板无需随机打乱。',
      en: 'Forward: rectangular unlinked rings → L-shaped linked rings. Backward reverses the practice. The preview shows the starting pattern; Magic needs no random scramble.',
    },
  },
  {
    id: 'mmagic', zh: '十二板', en: 'Master Magic', iconClass: 'event-mmagic',
    practiceHint: {
      zh: 'M Forward：矩形五环相连 → 阶梯形五环分离；M Backward：反向练习。图示显示起始状态。十二板无需随机打乱。',
      en: 'M Forward: rectangular linked rings → staircase unlinked rings. M Backward reverses the practice. The preview shows the starting pattern; Master Magic needs no random scramble.',
    },
  },
  ...NATIVE_PUZZLE_IDS.map((id) => ({
    id,
    zh: NATIVE_PUZZLES[id].zh,
    en: NATIVE_PUZZLES[id].en,
    textLabel: NATIVE_PUZZLES[id].textLabel,
    practiceHint: {
      zh: `练习打乱：${NATIVE_PUZZLES[id].scrambleLength} 步随机转动。`,
      en: `Practice scramble: ${NATIVE_PUZZLES[id].scrambleLength} random moves.`,
    },
  })),
] as const satisfies readonly NativeScrambleEvent[];

export const NATIVE_SCRAMBLE_EVENT_IDS: ReadonlySet<string> = new Set(
  NATIVE_SCRAMBLE_EVENTS.map(({ id }) => id),
);

export const NATIVE_SCRAMBLE_APPEND = NATIVE_SCRAMBLE_EVENTS.map(({ id, iconClass = '', textLabel }: NativeScrambleEvent) => ({
  id,
  iconClass,
  textLabel,
}));

export function isNativeScrambleEvent(id: string): boolean {
  return NATIVE_SCRAMBLE_EVENT_IDS.has(id);
}

export function nativeScrambleDisplayName(id: string, isZh: boolean): string | null {
  const event = NATIVE_SCRAMBLE_EVENTS.find((candidate) => candidate.id === id);
  return event ? event[isZh ? 'zh' : 'en'] : null;
}

export function nativeScramblePracticeHint(id: string | null): NonNullable<NativeScrambleEvent['practiceHint']> | null {
  const event = NATIVE_SCRAMBLE_EVENTS.find((candidate) => candidate.id === id);
  return event && 'practiceHint' in event ? event.practiceHint : null;
}

/** Both generator modes use the same pure generator as the simulator and timer. */
export async function nativeScramble(id: string, rng?: () => number): Promise<string> {
  if (isNativePuzzleId(id)) return generateNativePuzzleScramble(id, rng);
  if (id === 'pyraminx_duo') {
    const { generatePyraminxDuoScramble } = await import('@cuberoot/puzzle-solvers/pyraminx-duo');
    return generatePyraminxDuoScramble(rng);
  }
  if (id === 'magic' || id === 'mmagic') {
    // Magic has no official random scramble. Keep the Timer's existing
    // Forward/Backward practice directions, including Master's M prefix.
    const { formatTimerCompoundScramble } = await import('@cuberoot/shared/timer');
    return formatTimerCompoundScramble(id, [], rng);
  }
  throw new Error(`Unsupported native scramble event: ${id}`);
}
