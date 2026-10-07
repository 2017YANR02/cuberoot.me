import { smartCubeTargetFacelets } from '../smart_cube/cubie';
import { stepSolvedInFrame } from './reconstruct/steps';
import { timerSmartCubeTrainingComplete } from './smart-cube-training';

/** Candidate provider keys; filtering is shared by random and seeded workers. */
export const TIMER_TRAINING_STATE_KEYS = {
  cll: 'll', ell: 'ell', eocp: 'll', '2gll': '2gll',
  ollcp: 'll', zzll: 'zzll', zbls: 'zbls', lse: 'roux-lse', l10p: 'roux-l10p',
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
    const scramble = generate(TIMER_TRAINING_STATE_KEYS[event], attempt);
    // A random state may be solved; redraw instead of surfacing an empty scramble.
    if (!scramble.trim()) continue;
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
