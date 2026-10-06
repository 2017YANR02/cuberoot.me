import { createRandomScrambleClient } from '@cuberoot/timer-ui/random-scramble';
const randomClient = createRandomScrambleClient();
import { timerSupportsRealWcaScrambles, timerWcaCompetitionScrambleSlotIdentity,
  type EventId, type LocalBattleScramble, type TimerWcaSourceSettings } from '@cuberoot/shared/timer';
import { fetchRealScrambles, realScrambleSourceKey, type RealScramble } from './real-scramble-pool';

/** Uses the same installed WCA provider as Solo. Queues retain official occurrences. */
export function createInstalledBattleScrambleProvider(source: 'wca' | 'random', settings: TimerWcaSourceSettings) {
  const queues = new Map<EventId, RealScramble[]>();
  return async (event: EventId, signal: AbortSignal): Promise<LocalBattleScramble> => {
    if (source === 'wca' && timerSupportsRealWcaScrambles(event)) {
      if (settings.wcaScrambleMode === 'comp' && !settings.wcaComp) throw new Error('WCA source is incomplete');
      const spec = { ...settings, event };
      let queue = queues.get(event);
      if (!queue?.length) {
        queue = await fetchRealScrambles(spec, fetch, signal);
        if (signal.aborted) throw new Error('Cancelled');
        queues.set(event, queue);
      }
      const row = queue.shift();
      if (!row) throw new Error('No WCA scrambles');
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
