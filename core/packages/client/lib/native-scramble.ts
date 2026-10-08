/** Native non-WCA generators that do not have an upstream csTimer event key. */
export const NATIVE_SCRAMBLE_EVENTS = [
  { id: 'pyraminx_duo', zh: '二重奏魔方', en: 'Pyraminx Duo', textLabel: 'Duo' },
] as const;

export const NATIVE_SCRAMBLE_EVENT_IDS: ReadonlySet<string> = new Set(
  NATIVE_SCRAMBLE_EVENTS.map(({ id }) => id),
);

export const NATIVE_SCRAMBLE_APPEND = NATIVE_SCRAMBLE_EVENTS.map(({ id, textLabel }) => ({
  id,
  iconClass: '',
  textLabel,
}));

export function isNativeScrambleEvent(id: string): boolean {
  return NATIVE_SCRAMBLE_EVENT_IDS.has(id);
}

export function nativeScrambleDisplayName(id: string, isZh: boolean): string | null {
  const event = NATIVE_SCRAMBLE_EVENTS.find((candidate) => candidate.id === id);
  return event ? event[isZh ? 'zh' : 'en'] : null;
}

/** Both generator modes use the same pure generator as the simulator and timer. */
export async function nativeScramble(id: string, rng?: () => number): Promise<string> {
  if (id === 'pyraminx_duo') {
    const { generatePyraminxDuoScramble } = await import('@cuberoot/puzzle-solvers/pyraminx-duo');
    return generatePyraminxDuoScramble(rng);
  }
  throw new Error(`Unsupported native scramble event: ${id}`);
}
