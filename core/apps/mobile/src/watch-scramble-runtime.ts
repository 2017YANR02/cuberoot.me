import { cubieToFacelet } from '@cuberoot/shared/cube-facelet';
import { smartCubeFixupState, parseHintableSmartCubeScramble } from '@cuberoot/shared/smart-cube/scramble-hint';
import { scramble444RandomMoves } from '@cuberoot/shared/timer/seeded/nxnxn';
import { generateTimerTrainerScramble } from '@cuberoot/shared/timer/trainer-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { correction, generate } from './generated/watch-tnoodle.cjs';

declare const __watchRandomUInt32: () => number;
const random = () => __watchRandomUInt32() / 0x100000000;
let result: unknown = null;

// QuickJS exposes no console. TeaVM's logging runtime looks it up on first use.
if (!('console' in globalThis)) Object.assign(globalThis, { console: { info() {}, log() {}, warn() {}, error() {} } });
Object.assign(globalThis, { WatchScramble: {
  correction(from: string, target: string) {
    const state = smartCubeFixupState(from, target);
    if (!state) return '';
    const moves = correction(cubieToFacelet(state));
    return parseHintableSmartCubeScramble(moves) ? moves : '';
  },
  start(event = '333') {
    if (event === '444') {
      result = { scramble: scramble444RandomMoves(random), source: 'random-moves' };
    } else if (event === 'oll' || event === 'pll') {
      const { scramble, caseId } = generateTimerTrainerScramble(event, { random });
      result = { scramble, caseId, facelets: smartCubeTargetFacelets(scramble), source: 'training' };
    } else {
      const scramble = generate(event === 'cross' ? '333' : event, __watchRandomUInt32(), __watchRandomUInt32());
      result = { scramble, source: 'tnoodle', ...((event === '333' || event === 'cross')
        && { facelets: smartCubeTargetFacelets(scramble) }) };
    }
  },
  result: () => JSON.stringify(result),
} });
