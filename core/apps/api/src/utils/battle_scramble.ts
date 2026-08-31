import {
  generateTimerScramble,
  type NetBattleEventId,
} from '@cuberoot/shared/timer';

/**
 * Generate the canonical scramble for an online-battle event on the authority side.
 *
 * Clients choose only the event. Accepting client-authored scramble text lets the first
 * modified client choose a favorable state for everyone else, so room mutations never persist
 * request scramble text. This reuses the same shared timer registry/generators as Web and Mobile.
 */
export async function generateNetBattleScramble(event: NetBattleEventId): Promise<string> {
  const generated = await generateTimerScramble({ event });
  if (!generated.ok || generated.kind !== 'generated' || !generated.scramble.trim()) {
    throw new Error(`battle scramble unavailable: ${event}`);
  }
  return generated.scramble;
}

const inFlightSlots = new Map<string, Promise<string>>();

/** Coalesce concurrent requests for the same room/round/event into one expensive generation. */
export function generateNetBattleScrambleForSlot(
  slot: string,
  event: NetBattleEventId,
): Promise<string> {
  const existing = inFlightSlots.get(slot);
  if (existing) return existing;
  const pending = generateNetBattleScramble(event)
    .finally(() => { if (inFlightSlots.get(slot) === pending) inFlightSlots.delete(slot); });
  inFlightSlots.set(slot, pending);
  return pending;
}
