import {
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  readBits,
} from './gan_crypto';
import { GanMoveSync, type TimedMove } from './gan_move_sync';
import { decodeCubieFacelets } from './cubie';

export const GAN_V3_SERVICE_UUID = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
export const GAN_V3_NOTIFY_CHARACTERISTIC_UUID = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';
export const GAN_V3_WRITE_CHARACTERISTIC_UUID = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';

export const GAN_V3_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
export const GAN_V3_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

const AXIS_LOOKUP = [2, 32, 8, 1, 16, 4];
const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const HISTORY_FACE_ORDER = ['D', 'U', 'B', 'F', 'L', 'R'] as const;
const FACELET_RESYNC_QUIET_MS = 500;

export interface GanV3DecodeState {
  sync: GanMoveSync;
  battery: number | null;
  badFrames: number;
  decodeFacelets?: (frame: Uint8Array) => string | null;
  onState?: (facelets: string) => void;
  prevMoveLocTime: number | null;
  now: () => number;
}

export function createGanV3DecodeState(options: {
  decodeFacelets?: (frame: Uint8Array) => string | null;
  requestHistory?: (startMoveCnt: number, numberOfMoves: number) => void;
  onWedged?: () => void;
  onState?: (facelets: string) => void;
  now?: () => number;
} = {}): GanV3DecodeState {
  return {
    sync: new GanMoveSync({
      requestHistory: options.requestHistory,
      onWedged: options.onWedged,
    }),
    battery: null,
    badFrames: 0,
    decodeFacelets: options.decodeFacelets ?? decodeGanV3Facelets,
    onState: options.onState,
    prevMoveLocTime: null,
    now: options.now ?? (() => Date.now()),
  };
}

export function decodeGanV3Facelets(frame: Uint8Array): string | null {
  const corners: number[] = [];
  for (let index = 0; index < 7; index++) {
    const permutation = readBits(frame, 40 + index * 3, 3);
    const orientation = readBits(frame, 61 + index * 2, 2);
    corners.push((orientation << 3) | permutation);
  }
  const edges: number[] = [];
  for (let index = 0; index < 11; index++) {
    const permutation = readBits(frame, 77 + index * 4, 4);
    const orientation = readBits(frame, 121 + index, 1);
    edges.push((permutation << 1) | orientation);
  }
  return decodeCubieFacelets(corners, edges);
}

export function decodeGanV3Frame(
  frame: Uint8Array,
  state: GanV3DecodeState,
): TimedMove[] {
  if (frame.length < 16) return [];
  if (frame[0] !== 0x55) {
    state.badFrames++;
    return [];
  }
  state.badFrames = 0;
  const mode = frame[1];
  const length = frame[2];
  if (length <= 0) return [];

  if (mode === 2) {
    const moveCounter = (frame[4] << 8) | frame[3];
    if (state.sync.seeded) {
      state.sync.observe(moveCounter);
      if (state.prevMoveLocTime !== null
        && state.now() - state.prevMoveLocTime > FACELET_RESYNC_QUIET_MS) {
        state.sync.requestResync(moveCounter);
      }
      return [];
    }
    const facelets = state.decodeFacelets?.(frame);
    if (state.decodeFacelets && facelets === null) {
      state.badFrames++;
      return [];
    }
    state.sync.seed(moveCounter);
    if (facelets) state.onState?.(facelets);
    return [];
  }

  if (mode === 1) {
    const moveCounter = (frame[8] << 8) | frame[7];
    state.prevMoveLocTime = state.now();
    const power = readBits(frame, 72, 2);
    const axis = AXIS_LOOKUP.indexOf(readBits(frame, 74, 6));
    if (axis === -1 || power >= 2) return [];
    const face = FACE_ORDER[axis];
    const deviceTs = (
      frame[3]
      | (frame[4] << 8)
      | (frame[5] << 16)
      | (frame[6] << 24)
    ) >>> 0;
    return state.sync.push(moveCounter, power === 1 ? `${face}'` : face, deviceTs);
  }

  if (mode === 6) {
    const startMoveCounter = frame[3];
    const numberOfMoves = Math.max(0, (length - 1) * 2);
    const replay: Array<{ cnt: number; mv: string }> = [];
    for (let index = 0; index < numberOfMoves; index++) {
      const axis = readBits(frame, 32 + 4 * index, 3);
      const power = readBits(frame, 35 + 4 * index, 1);
      if (axis < 6) {
        const face = HISTORY_FACE_ORDER[axis];
        replay.push({
          cnt: (startMoveCounter - index) & 0xff,
          mv: power ? `${face}'` : face,
        });
      }
    }
    return state.sync.injectHistory(replay);
  }

  if (mode === 16) {
    const battery = frame[3];
    if (battery <= 100) state.battery = battery;
  }
  return [];
}

export interface GanV3Cipher {
  decrypt(frame: Uint8Array): Uint8Array;
  encrypt(frame: Uint8Array): Uint8Array;
}

export function createGanV3Cipher(mac: Uint8Array): GanV3Cipher {
  if (mac.length !== 6) throw new RangeError('GAN MAC must contain exactly 6 bytes.');
  const key = expandKey(deriveKeyFromMac(GAN_V3_KEY_BASE, mac));
  const iv = deriveKeyFromMac(GAN_V3_IV_BASE, mac);
  return {
    decrypt: (frame) => decryptFrame(frame, key, iv),
    encrypt: (frame) => encryptFrame(frame, key, iv),
  };
}

function command(opcode: number): Uint8Array {
  const frame = new Uint8Array(16);
  frame[0] = 0x68;
  frame[1] = opcode;
  return frame;
}

export function createGanV3HardwareInfoCommand(): Uint8Array {
  return command(4);
}

export function createGanV3FaceletsCommand(): Uint8Array {
  return command(1);
}

export function createGanV3BatteryCommand(): Uint8Array {
  return command(7);
}

export function createGanV3HistoryCommand(
  startMoveCounter: number,
  numberOfMoves: number,
): Uint8Array {
  const frame = command(3);
  frame[2] = startMoveCounter & 0xff;
  frame[4] = numberOfMoves & 0xff;
  return frame;
}

export function matchesGanV3Name(name: string | undefined): boolean {
  return /^(GAN-?(356|i)|Gi[CSBM3]?-)/i.test(name ?? '');
}
