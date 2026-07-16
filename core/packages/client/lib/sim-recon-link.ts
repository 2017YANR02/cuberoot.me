/**
 * Cross-navigation between /sim and /recon/submit.
 *
 * /sim carries state in `?puzzle=&setup=&alg=` (raw moves).
 * /recon/submit carries it in `?event=&scramble=&alg=` (cubedb-url encoded —
 * see lib/cubedb-url). Both helpers below keep the puzzle/event matched so a
 * 3x3 sim hands off to a 3x3 recon and vice versa.
 */

import { encodeUrlAlg } from './cubedb-url';

/** sim puzzleKind (cuber engine) — number for NxN, else a named twisty/sq1/ivy/dino/redi/rex/heli/gear. */
type SimPuzzle = number | 'sq1' | 'ivy' | 'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'pyraminx' | 'skewb' | 'megaminx' | 'fto';

/** sim puzzle → recon event id, or null when recon has no matching event.
 *  Accepts PuzzleGeometry explore ids (string) too — they have no recon event. */
export function reconEventForSim(p: SimPuzzle | string): string | null {
  if (p === 'sq1') return 'sq1';
  if (p === 'ivy') return null; // recon has no ivy event yet
  if (p === 'pyraminx') return 'pyra';
  if (p === 'skewb') return 'skewb';
  if (p === 'megaminx') return 'mega';
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
    default: return null; // clock + unknown — no sim equivalent
  }
}

/** Build the /recon/submit query string from sim state. */
export function buildReconSubmitQuery(reconEvent: string, scramble: string, solution: string): string {
  const params = new URLSearchParams();
  params.set('event', reconEvent);
  const scr = encodeUrlAlg(scramble.trim());
  const sol = encodeUrlAlg(solution.trim());
  if (scr) params.set('scramble', scr);
  if (sol) params.set('alg', sol);
  return params.toString();
}

/** Build the /sim query string from recon state (raw moves, sim decodes them). */
export function buildSimQuery(simPuzzle: string, scramble: string, solution: string): string {
  const params = new URLSearchParams();
  params.set('puzzle', simPuzzle);
  if (scramble.trim()) params.set('setup', scramble.trim());
  if (solution.trim()) params.set('alg', solution.trim());
  return params.toString();
}
