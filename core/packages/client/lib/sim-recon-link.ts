/**
 * Cross-navigation between /sim and /recon/submit.
 *
 * /sim carries state in `?puzzle=&setup=&alg=` (raw moves).
 * /recon/submit carries it in `?event=&scramble=&alg=` (cubedb-url encoded —
 * see lib/cubedb-url). Both helpers below keep the puzzle/event matched so a
 * 3x3 sim hands off to a 3x3 recon and vice versa.
 */

import { encodeUrlAlg } from './cubedb-url';
import { wcaRoundToReconRound } from './recon-attempt-lookup';
import { cleanFtoReconAlgForPlayer } from '@cuberoot/shared/recon-completion';

/** sim puzzleKind (cuber engine) — number for NxN, else a named twisty/square-family/corner-turn/clock puzzle. */
type SimPuzzle = number | 'sq1' | 'sq2' | 'sq4' | 'ivy' | 'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'pyraminx' | 'skewb' | 'megaminx' | 'fto' | 'clock';

/** sim puzzle → recon event id, or null when recon has no matching event.
 *  Accepts PuzzleGeometry explore ids (string) too — they have no recon event. */
export function reconEventForSim(p: SimPuzzle | string): string | null {
  if (p === 'sq1') return 'sq1';
  if (p === 'sq2' || p === 'sq4') return null;
  if (p === 'ivy') return null; // recon has no ivy event yet
  if (p === 'pyraminx') return 'pyra';
  if (p === 'skewb') return 'skewb';
  if (p === 'megaminx') return 'mega';
  if (p === 'fto') return 'fto';
  // 魔表两边同一套 WCA 记号(针脚 token + y2),原样递过去就行。
  if (p === 'clock') return 'clock';
  if (typeof p === 'number' && p >= 2 && p <= 7) return `${p}x${p}`;
  return null; // 1x1, 8x8+, dino, redi, rex, heli, gear — no recon event
}

/** recon event id → sim `puzzle` URL value, or null when sim can't show it. */
export function simPuzzleForReconEvent(ev: string): string | null {
  switch (ev) {
    case '2x2': return '2';
    case '3x3': case 'oh': case '3bld': case 'fmc': case 'mbld': return '3';
    case '4x4': case '4bld': return '4';
    case '5x5': case '5bld': return '5';
    case '6x6': return '6';
    case '7x7': return '7';
    case 'sq1': return 'sq1';
    case 'pyra': return 'pyraminx';
    case 'mega': return 'megaminx';
    case 'skewb': return 'skewb';
    case 'fto': return 'fto';
    case 'clock': return 'clock';
    default: return null; // unknown event — no sim equivalent
  }
}

export interface ReconScrambleSource {
  ci: string; cn: string;
  r?: string; g?: string; n?: number; e?: string; cd?: string; x?: 0 | 1;
}

/** Build the /recon/submit query string from sim state or a sourced scramble. */
export function buildReconSubmitQuery(reconEvent: string, scramble: string, solution: string, options?: {
  practice?: boolean;
  optimal?: boolean;
  competition?: ReconScrambleSource | null;
  sourceEn?: string;
  sourceZh?: string;
}): string {
  const params = new URLSearchParams();
  params.set('event', reconEvent);
  const scr = encodeUrlAlg(scramble.trim());
  const sol = encodeUrlAlg(solution.trim());
  if (scr) params.set(options?.optimal ? 'optimal' : 'scramble', scr);
  if (sol) params.set('alg', sol);
  if (options?.practice) params.set('official', 'practice');
  if (options?.competition) {
    params.set('compWcaId', options.competition.ci);
    params.set('comp', options.competition.cn);
    const source = options.competition;
    const round = source.r ? wcaRoundToReconRound(source.r) : undefined;
    if (round) params.set('round', round);
    if (source.g) params.set('groupId', source.g);
    if (source.n != null && !source.x) params.set('solveNum', String(source.n));
  }
  if (options?.sourceEn) params.set('sourceEn', options.sourceEn);
  if (options?.sourceZh) params.set('sourceZh', options.sourceZh);
  return params.toString();
}

/** Build the /sim query string from recon state (raw moves, sim decodes them).
 *  Without a scramble, anchor the solution at the solved endpoint so the
 *  simulator can still replay a reconstruction backwards from solved. */
export function buildSimQuery(simPuzzle: string, scramble: string, solution: string): string {
  const params = new URLSearchParams();
  const simSolution = simPuzzle === 'fto' ? cleanFtoReconAlgForPlayer(solution) : solution.trim();
  params.set('puzzle', simPuzzle);
  if (scramble.trim()) params.set('setup', scramble.trim());
  if (simSolution) params.set('alg', simSolution);
  if (!scramble.trim() && simSolution) params.set('anchor', 'end');
  return params.toString();
}
