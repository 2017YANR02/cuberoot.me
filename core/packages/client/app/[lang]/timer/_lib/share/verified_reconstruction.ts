import type { DecodedReplay } from './decode';

type ReplayIdentity = Pick<DecodedReplay, 'event' | 'scramble' | 'moves' | 'totalMs'>;

/** Stable across legacy and gyro replay URLs because metadata is excluded. */
export function replayFingerprint(replay: ReplayIdentity): string {
  const source = JSON.stringify([
    replay.event,
    replay.scramble,
    Math.round(replay.totalMs),
    replay.moves.map(move => [move.m, Math.round(move.ts)]),
  ]);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
    right ^= right >>> 13;
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
  return `${replay.moves.length}-${hex(left)}${hex(right)}`;
}

const VERIFIED_RECONSTRUCTIONS: Readonly<Record<string, readonly string[]>> = {
  // User-verified 15.214 s solve from 2026-08-06. The gyro merged y + two
  // middle-layer gestures into one noisy interval; the final S direction is
  // not recoverable from that collapsed sensor event, so preserve ground truth.
  '63-dd80c95344f9c7c8': [
    'x2 // insp',
    "B' U' R' F U L2' // W cross",
    "y S' L2 S' // OB",
    "U' z' B L B' L' U' L U // GO",
    "F' L2' F L F' L2' F // GR",
    "L F L2' F' L F L' F' // RB",
    "D F L F' L' F L F' L' D' // OLL(CP)",
    "L' F2 L' E' L2' x S L' U2 L // PLL-U-",
  ],
  // User-verified 15.269 s solve from 2026-08-04.
  '89-eebeb7df9939882b': [
    'z2 // insp',
    "R2' F R D F2 L2 D' // W cross",
    "U' L U' L' S' L S // GR",
    "d' R U R' U R U' R2' U R // BR",
    "U FS' R U' R' S U' F' // OG",
    "U2 y L' U' L U' S L' U L S' // OB/ZBLS",
    "U' R U R' U R U L' U R' U' L // OLL(CP)",
    "M2' U2 M U M2' U M2' U M U2 // PLL-Z",
  ],
};

export function findVerifiedReconstruction(replay: ReplayIdentity): string[] | undefined {
  const lines = VERIFIED_RECONSTRUCTIONS[replayFingerprint(replay)];
  return lines ? [...lines] : undefined;
}
