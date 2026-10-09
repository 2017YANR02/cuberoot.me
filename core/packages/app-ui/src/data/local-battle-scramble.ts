import { createRandomScrambleClient } from '@cuberoot/timer-ui/random-scramble';
const randomClient = createRandomScrambleClient();
import { timerSupportsRealWcaScrambles, timerWcaCompetitionScrambleSlotIdentity,
  type EventId, type LocalBattleScramble, type TimerWcaSourceSettings } from '@cuberoot/shared/timer';
import { createMobileWcaPool, realSpecToWcaSource, realScrambleSourceKey, wcaRowToReal } from './real-scramble-pool';

/** Uses the same installed WCA provider as Solo. Queues retain official occurrences. */
export function createInstalledBattleScrambleProvider(source: 'wca' | 'random', settings: TimerWcaSourceSettings) {
  const pool = createMobileWcaPool(undefined, undefined, false);
  return async (event: EventId, signal: AbortSignal): Promise<LocalBattleScramble> => {
    if (source === 'wca' && timerSupportsRealWcaScrambles(event)) {
      if (settings.wcaScrambleMode === 'comp' && !settings.wcaComp) throw new Error('WCA source is incomplete');
      const spec = { ...settings, event };
      const received = await pool.nextWcaRow(realSpecToWcaSource(spec), signal);
      if (signal.aborted) throw new Error('Cancelled');
      if (!received) throw new Error('No WCA scrambles');
      const row = wcaRowToReal(received);
      return { scramble: row.scramble,
        source: { kind: 'wca', identity: `${realScrambleSourceKey(spec)}|${timerWcaCompetitionScrambleSlotIdentity(row)}` },
        wca: { ci: row.competitionId, cn: row.competitionName, e: row.eventId, r: row.roundTypeId,
          g: row.groupId, n: row.scrambleNumber, x: row.isExtra ? 1 : 0 } };
    }
    const result = await randomClient.generate({ event }, signal);
    if (!result.ok || result.kind !== 'generated') throw new Error('Scramble generation failed');
    return { scramble: result.scramble, source: { kind: 'random', identity: `random|${event}` } };
  };
}
