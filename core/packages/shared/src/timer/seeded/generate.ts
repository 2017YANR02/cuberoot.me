/** Worker-only engine. Hosts share algorithms and only supply worker scheduling. */
import { generateSeededCstimerScramble } from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import { generateGearTimerScramble } from '@cuberoot/puzzle-solvers/gear';
import { generateIvyTimerScramble } from '@cuberoot/puzzle-solvers/ivy';
import { generatePyraminxDuoScramble } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { generateNativePuzzleScramble, isNativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { rngFor } from './seeded_rng';
import * as nx from './nxnxn';
import * as bld from './bld';
import { generateTimedWcaScramble, isTimedWcaEvent } from './wca';
import { formatTimerCompoundScramble, TIMER_COMPOUND_SCRAMBLE_CHILDREN } from '../compound-scramble';
import { generateTimerTrainerScramble, isTimerTrainerEvent, generateTimerDrillScramble } from '../trainer-scramble';
import { applyColorNeutral, isCnEligible } from '../color-neutral';
import { SCRAMBLE_222_TYPE_CATALOG } from '../scramble-222';
import { timerScrambleAllowsEmptySlot, type TimerScrambleRequest } from '../scramble-runtime';
import type { TimerSeedTicket } from '../sync-seed';
import type { EventId } from '../types';
import { generateTimerTrainingStateScramble, isTimerTrainingStateEvent } from '../training-state-scramble';
import { applySequence, parseMoves, solvedCubie } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { generateRouxTrainingCandidate, trainingScrambleFromState } from '../training-state-engine';
import { normalizeWcaScramble } from '../../normalize_wca_scramble';

function deterministicTrainingNotation(scramble: string): string {
  const normalized = normalizeWcaScramble(scramble);
  if (!normalized) throw new Error('Invalid seeded training notation');
  const state = applySequence(solvedCubie(), parseMoves(normalized));
  // Upstream may choose different equivalent text as its search caches warm.
  // Take the first bounded solution, without wall-clock-dependent optimization.
  return trainingScrambleFromState(state);
}

export interface TimerSeedRequest extends TimerScrambleRequest {
  ticket: TimerSeedTicket;
  drill?: Parameters<typeof generateTimerDrillScramble>[0] | null;
}
export interface TimerSeedResult { scramble: string; caseId: string | null }

/** Worker entry point for generators whose random-state search is asynchronous. */
export async function generateSeededTimerScrambleAsync(request: TimerSeedRequest): Promise<TimerSeedResult> {
  if (request.event !== 'baby_fto' || request.drill) return generateSeededTimerScramble(request);

  const [{ experimentalDeriveScrambleForEvent }, { setSearchDebug }] = await Promise.all([
    import('cubing/scramble'), import('cubing/search'),
  ]);
  // cubing 0.63.3 requires an explicit opt-in for the deterministic Twips API.
  setSearchDebug({ allowDerivedScrambles: true });
  const seed = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(request.ticket.seed)));
  // Twips v0.11.3 seeds have a protocol byte, a derivation level and 30 seed bytes.
  // https://github.com/cubing/twips/blob/v0.11.3/src/lib/scramble/derive_scramble_for_event.rs
  seed[0] = 0x67;
  seed[1] = 0;
  const hexSeed = Array.from(seed, byte => byte.toString(16).padStart(2, '0')).join('');
  const event = request.event;
  // The API expects eight ASCII salt levels, with the subevent at level seven.
  // Keep the versioned practice domain and UTF-8 seed encoding stable. Revision
  // only invalidates pending requests; resetting a seed must replay its sequence.
  const salts = ['cuberoot-timer-v1', 'scrambles', event, 'r1', 'g1', `a${request.ticket.index + 1}`, event, 'sub1'];
  const scramble = (await experimentalDeriveScrambleForEvent(hexSeed, salts, event)).toString();
  if (!scramble.trim()) throw new Error('Empty seeded scramble');
  return { scramble, caseId: null };
}

export function generateSeededTimerScramble(request: TimerSeedRequest): TimerSeedResult {
  const { event, ticket } = request;
  const random = rngFor(ticket.seed, ticket.index);
  let caseId: string | null = null;
  const cstimer = (key: string, length = 0) => generateSeededCstimerScramble(key, length,
    JSON.stringify([ticket.seed, ticket.index, key]));
  const generate = (id: EventId): string => {
    if (isTimedWcaEvent(id) && !(id === '222' && event === '222' && request.scramble222Type && request.scramble222Type !== 'full')) {
      return generateTimedWcaScramble(id, random, request.scramble222Mode);
    }
    if (isNativePuzzleId(id)) return generateNativePuzzleScramble(id, random);
    if (id === 'lse' || id === 'l10p') return generateTimerTrainingStateScramble(id, () =>
      generateRouxTrainingCandidate(id === 'lse' ? 'roux-lse' : 'roux-l10p', random));
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
      case '333fm': case '333mr': case 'sphere': case 'cross': return nx.scramble333(random);
      case '333ni': return bld.scramble333Bld(random);
      case 'gear': return generateGearTimerScramble(random);
      case 'ivy': return generateIvyTimerScramble(random);
      case 'pyraminx_duo': return generatePyraminxDuoScramble(random);
      case 'fto': return cstimer('ftoso');
      case 'redi': return cstimer('redim', 8);
      case 'kilominx': return cstimer('klmso');
      case 'mpyram': return cstimer('mpyrso');
      case 'r3': case 'r4': case 'r5': case '333mbld': case '666bld': case '777bld': case 'magic': case 'mmagic':
        return formatTimerCompoundScramble(id, TIMER_COMPOUND_SCRAMBLE_CHILDREN[id].map(generate), random);
      case 'custom': case 'pll-chain': return '';
      default: throw new Error(`Unsupported seeded event: ${id}`);
    }
  };
  const drill = request.drill ? generateTimerDrillScramble(request.drill, random, request.cnMode) : null;
  const scramble = drill ? drill.scramble : generate(event);
  if (!timerScrambleAllowsEmptySlot(event, 'random') && !scramble.trim()) throw new Error('Empty seeded scramble');
  if (drill) caseId = event === request.drill?.type ? drill.targetCase : null;
  return { scramble: !drill && isCnEligible(event) ? applyColorNeutral(scramble, request.cnMode ?? 'none', random) : scramble, caseId };
}
