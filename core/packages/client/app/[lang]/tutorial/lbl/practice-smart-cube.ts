import { invertAlg } from '@cuberoot/shared/alg-transform';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { CORNER_FACELET, EDGE_FACELET, cubieStateFromFacelets, smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { orientCubeFacelets, orientedFaceColors } from '@cuberoot/shared/timer';
import { cubeMove, faceTurnToken } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { practiceCenterAlignment } from './practice-state';

export const PRACTICE_GRIP = 'z2';
const faceColors = orientedFaceColors(PRACTICE_GRIP);

export function smartPracticeSetup(setup: string) {
  const pose = invertAlg(practiceCenterAlignment(setup));
  const orientation = `${PRACTICE_GRIP} ${pose}`.trim();
  const deviceScramble = normalizeWcaScramble(`${PRACTICE_GRIP} ${setup}`);
  const targetFacelets = smartCubeTargetFacelets(setup, PRACTICE_GRIP);
  if (deviceScramble === null || !targetFacelets) throw new Error('Invalid smart-cube practice setup');
  const scramble = normalizeWcaScramble(`${invertAlg(orientation)} ${deviceScramble}`) ?? '';
  return { pose, orientation, scramble, targetFacelets };
}

export function smartPracticeTurns(moves: readonly string[]): string {
  return normalizeWcaScramble(`${PRACTICE_GRIP} ${moves.join(' ')}`) ?? '';
}

/** Map the reported colors to the identity of each sticker in the lesson's center-aligned frame. */
export function smartPracticeStickers(facelets: string): string[] | null {
  const local = Array.from(orientCubeFacelets(facelets, PRACTICE_GRIP),
    face => faceColors[face as keyof typeof faceColors]).join('');
  const state = cubieStateFromFacelets(local);
  if (!state) return null;
  const stickers = Array.from({ length: 54 }, (_, index) => String(index));
  for (const [slot, packed] of state.ca.entries()) {
    for (const [index, id] of CORNER_FACELET[packed & 7].entries()) {
      stickers[CORNER_FACELET[slot][(index + (packed >> 3)) % 3]] = String(id);
    }
  }
  for (const [slot, packed] of state.ea.entries()) {
    for (const [index, id] of EDGE_FACELET[packed >> 1].entries()) {
      stickers[EDGE_FACELET[slot][index ^ (packed & 1)]] = String(id);
    }
  }
  return stickers;
}

export interface SmartPracticeAttempt {
  facelets: string;
  started: boolean;
  /** Null if an authoritative state update jumped over one or more turns. */
  history: string | null;
}

export function observeSmartPractice(
  previous: SmartPracticeAttempt | null,
  facelets: string,
  setup: ReturnType<typeof smartPracticeSetup>,
  move?: string,
): SmartPracticeAttempt {
  if (previous?.facelets === facelets) return previous;
  if (!previous?.started) return { facelets, started: facelets === setup.targetFacelets, history: '' };
  const token = move && faceTurnToken(move);
  const local = token && previous.history !== null && cubeMove(previous.facelets, token) === facelets
    ? normalizeWcaScramble(`${invertAlg(setup.orientation)} ${token}`) : null;
  const history = local ? `${previous.history} ${local}`.trim() : null;
  return { facelets, started: true, history };
}
