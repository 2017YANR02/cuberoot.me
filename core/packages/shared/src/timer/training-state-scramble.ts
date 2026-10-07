import { smartCubeTargetFacelets } from '../smart_cube/cubie';
import { stepSolvedInFrame } from './reconstruct/steps';
import { timerSmartCubeTrainingComplete } from './smart-cube-training';
import { invertAlg } from '../alg_transform';
import { normalizeWcaScramble } from '../normalize_wca_scramble';

/** Reuse the installed csTimer engine; all filtering is shared by random and seeded workers. */
export const TIMER_TRAINING_STATE_KEYS = {
  cll: 'll', ell: 'ell', eocp: 'll', '2gll': '2gll',
  ollcp: 'll', zzll: 'zzll', zbls: 'zbls', lse: 'lse', l10p: 'cmll',
} as const;
export type TimerTrainingStateEvent = keyof typeof TIMER_TRAINING_STATE_KEYS;
export function isTimerTrainingStateEvent(event: string): event is TimerTrainingStateEvent {
  return Object.prototype.hasOwnProperty.call(TIMER_TRAINING_STATE_KEYS, event);
}

export function generateTimerTrainingStateScramble(
  event: TimerTrainingStateEvent,
  generate: (key: string, attempt: number) => string,
): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const raw = generate(TIMER_TRAINING_STATE_KEYS[event], attempt);
    // Upstream Roux providers finish with x/x2/x' to return their blocks to D.
    // Conjugate that regrip into outer turns so the fixed training grip still owns the goal.
    const endingRotation = (event === 'lse' || event === 'l10p') ? raw.match(/(?:^|\s)(x(?:2|')?)\s*$/)?.[1] : undefined;
    const scramble = endingRotation ? normalizeWcaScramble(`${invertAlg(endingRotation)} ${raw}`) : raw;
    if (!scramble) throw new Error(`Invalid training notation: ${event}`);
    const facelets = smartCubeTargetFacelets(scramble);
    if (!facelets) throw new Error(`Invalid training scramble: ${event}`);
    if (stepSolvedInFrame('solved', facelets) || timerSmartCubeTrainingComplete(event, facelets, '')) continue;
    // Match the reference training domains: CLL/OLLCP start before OLL;
    // EOCP also starts before edge orientation, rather than serving an already-finished subgoal.
    if ((event === 'cll' || event === 'ollcp' || event === 'eocp') && stepSolvedInFrame('oll', facelets)) continue;
    if (event === 'eocp' && stepSolvedInFrame('eoll', facelets)) continue;
    return scramble;
  }
  throw new Error(`Training generator could not produce an unfinished case: ${event}`);
}
