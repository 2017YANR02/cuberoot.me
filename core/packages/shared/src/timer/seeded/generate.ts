/** Worker-only engine. Hosts share algorithms and only supply worker scheduling. */
import { generateSeededCstimerScramble } from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import { generateGearTimerScramble } from '@cuberoot/puzzle-solvers/gear';
import { generateIvyTimerScramble } from '@cuberoot/puzzle-solvers/ivy';
import { rngFor } from './seeded_rng';
import * as nx from './nxnxn';
import * as other from './others';
import * as bld from './bld';
import { formatTimerCompoundScramble, TIMER_COMPOUND_SCRAMBLE_CHILDREN } from '../compound-scramble';
import { generateTimerTrainerScramble, isTimerTrainerEvent, generateTimerDrillScramble } from '../trainer-scramble';
import { applyColorNeutral, isCnEligible } from '../color-neutral';
import { SCRAMBLE_222_TYPE_CATALOG } from '../scramble-222';
import type { TimerScrambleRequest } from '../scramble-runtime';
import type { TimerSeedTicket } from '../sync-seed';
import type { EventId } from '../types';
import { generateTimerTrainingStateScramble, isTimerTrainingStateEvent } from '../training-state-scramble';
import { applySequence, formatMoves, parseMoves, solvedCubie } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { buildMoveTables } from '@cuberoot/puzzle-solvers/kociemba/movetables';
import { buildPruneTables } from '@cuberoot/puzzle-solvers/kociemba/prune';
import { scrambleFromState } from '@cuberoot/puzzle-solvers/kociemba/search';
import { normalizeWcaScramble } from '../../normalize_wca_scramble';

let trainingTables: { move: ReturnType<typeof buildMoveTables>; prune: ReturnType<typeof buildPruneTables> } | null = null;
function deterministicTrainingNotation(scramble: string): string {
  if (!trainingTables) {
    const move = buildMoveTables();
    trainingTables = { move, prune: buildPruneTables(move) };
  }
  const normalized = normalizeWcaScramble(scramble);
  if (!normalized) throw new Error('Invalid seeded training notation');
  const state = applySequence(solvedCubie(), parseMoves(normalized));
  // Upstream may choose different equivalent text as its search caches warm.
  // Take the first bounded solution, without wall-clock-dependent optimization.
  const moves = formatMoves(scrambleFromState(state, trainingTables.move, trainingTables.prune,
    { maxTotalLen: 30, targetLen: 30 }));
  // These upstream providers use outer turns followed by an optional x regrip.
  // Normalization preserves the device-frame state but drops that display grip.
  const regrip = scramble.match(/(?:^|\s)(x(?:2|')?)\s*$/)?.[1];
  return regrip ? `${moves} ${regrip}` : moves;
}

export interface TimerSeedRequest extends TimerScrambleRequest {
  ticket: TimerSeedTicket;
  drill?: Parameters<typeof generateTimerDrillScramble>[0] | null;
}
export interface TimerSeedResult { scramble: string; caseId: string | null }
export function generateSeededTimerScramble(request: TimerSeedRequest): TimerSeedResult {
  const { event, ticket } = request;
  const random = rngFor(ticket.seed, ticket.index);
  let caseId: string | null = null;
  const cstimer = (key: string, length = 0) => generateSeededCstimerScramble(key, length,
    JSON.stringify([ticket.seed, ticket.index, key]));
  const generate = (id: EventId): string => {
    if (isTimerTrainingStateEvent(id)) return deterministicTrainingNotation(generateTimerTrainingStateScramble(id, (key, attempt) =>
      generateSeededCstimerScramble(key, 0, JSON.stringify([ticket.seed, ticket.index, id, attempt]))));
    if (isTimerTrainerEvent(id)) {
      const result = generateTimerTrainerScramble(id, { random, caseIds: request.trainerCaseIds });
      caseId = result.caseId;
      return result.scramble;
    }
    switch (id) {
      case '222': {
        if (event === '222' && request.scramble222Type && request.scramble222Type !== 'full') {
          const spec = SCRAMBLE_222_TYPE_CATALOG.find(item => item.id === request.scramble222Type);
          if (spec && 'cstimer' in spec) return cstimer(spec.cstimer.key, 'length' in spec.cstimer ? spec.cstimer.length : 0);
        }
        return nx.scramble222(random, request.scramble222Mode);
      }
      case '333': case '333oh': case '333fm': case '333mr': case 'cross': case 'f2l': return nx.scramble333(random);
      case '444': return nx.scramble444(random);
      case '555': return nx.scramble555(random);
      case '666': return nx.scramble666(random);
      case '777': return nx.scramble777(random);
      case '333bld': case '333ni': return bld.scramble333Bld(random);
      case '444bld': return bld.scramble444Bld(random);
      case '555bld': return bld.scramble555Bld(random);
      case 'pyra': return other.scramblePyra(random);
      case 'skewb': return other.scrambleSkewb(random);
      case 'sq1': return other.scrambleSq1(random);
      case 'mega': return other.scrambleMega(random);
      case 'clock': return other.scrambleClock(random);
      case 'gear': return generateGearTimerScramble(random);
      case 'ivy': return generateIvyTimerScramble(random);
      case 'fto': return cstimer('ftoso');
      case 'redi': return cstimer('redim', 8);
      case 'kilominx': return cstimer('klmso');
      case 'mpyram': return cstimer('mpyrso');
      case 'r3': case 'r4': case 'r5': case '333mbld': case '666bld': case '777bld': case 'magic': case 'mmagic':
        return formatTimerCompoundScramble(id, TIMER_COMPOUND_SCRAMBLE_CHILDREN[id].map(generate), random);
      case 'custom': return '';
      default: throw new Error(`Unsupported seeded event: ${id}`);
    }
  };
  const drill = request.drill ? generateTimerDrillScramble(request.drill, random) : null;
  const scramble = drill ? drill.scramble : generate(event);
  if (event !== 'custom' && !scramble.trim()) throw new Error('Empty seeded scramble');
  if (drill) caseId = event === request.drill?.type ? drill.targetCase : null;
  return { scramble: !drill && isCnEligible(event) ? applyColorNeutral(scramble, request.cnMode ?? 'none', random) : scramble, caseId };
}
