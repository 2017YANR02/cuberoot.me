import {
  decodeGanGyro,
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  readBits,
  type GyroSink,
} from './gan_crypto';
import { GanMoveSync, type TimedMove } from './gan_move_sync';
import { decodeCubieFacelets } from './cubie';

export const GAN_V4_SERVICE_UUID = '00000010-0000-fff7-fff6-fff5fff4fff0';
export const GAN_V4_NOTIFY_CHARACTERISTIC_UUID = '0000fff6-0000-1000-8000-00805f9b34fb';
export const GAN_V4_WRITE_CHARACTERISTIC_UUID = '0000fff5-0000-1000-8000-00805f9b34fb';

export const GAN_V4_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
export const GAN_V4_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

const GAN_V4_AXIS_LOOKUP = [2, 32, 8, 1, 16, 4];
const GAN_V4_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const GAN_V4_HISTORY_FACE_ORDER = ['D', 'U', 'B', 'F', 'L', 'R'] as const;
const GAN_V4_KNOWN_MODES = new Set([
  0x01, 0xed, 0xef, 0xd1, 0xec, 0xf5, 0xf6, 0xfa, 0xfc, 0xfd, 0xfe, 0xff,
]);
const FACELET_RESYNC_QUIET_MS = 500;

/** Decode a GAN v4 state snapshot into the timer's canonical URFDLB facelets. */
export function decodeGanV4Facelets(frame: Uint8Array): string | null {
  const corners: number[] = [];
  for (let index = 0; index < 7; index++) {
    const permutation = readBits(frame, 32 + index * 3, 3);
    const orientation = readBits(frame, 53 + index * 2, 2);
    corners.push((orientation << 3) | permutation);
  }

  const edges: number[] = [];
  for (let index = 0; index < 11; index++) {
    const permutation = readBits(frame, 69 + index * 4, 4);
    const orientation = readBits(frame, 113 + index, 1);
    edges.push((permutation << 1) | orientation);
  }

  return decodeCubieFacelets(corners, edges);
}

export interface GanV4DecodeState {
  sync: GanMoveSync;
  battery: number | null;
  badFrames: number;
  decodeFacelets?: (frame: Uint8Array) => string | null;
  onState?: (facelets: string) => void;
  prevMoveLocTime: number | null;
  now: () => number;
}

export function createGanV4DecodeState(options: {
  decodeFacelets?: (frame: Uint8Array) => string | null;
  requestHistory?: (startMoveCnt: number, numberOfMoves: number) => void;
  onWedged?: () => void;
  onState?: (facelets: string) => void;
  now?: () => number;
} = {}): GanV4DecodeState {
  return {
    sync: new GanMoveSync({
      requestHistory: options.requestHistory,
      onWedged: options.onWedged,
    }),
    battery: null,
    badFrames: 0,
    decodeFacelets: options.decodeFacelets ?? decodeGanV4Facelets,
    onState: options.onState,
    prevMoveLocTime: null,
    now: options.now ?? (() => Date.now()),
  };
}

export function decodeGanV4Frame(
  frame: Uint8Array,
  state: GanV4DecodeState,
  onGyro?: GyroSink,
): TimedMove[] {
  if (frame.length < 16) return [];
  const mode = frame[0];
  if (GAN_V4_KNOWN_MODES.has(mode)) state.badFrames = 0;
  else {
    state.badFrames++;
    return [];
  }

  if (mode === 0xec) {
    if (onGyro) {
      const gyro = decodeGanGyro(frame, 16, 80);
      onGyro(gyro.quaternion, gyro.velocity);
    }
    return [];
  }

  if (mode === 0xef) {
    const index = 1 + frame[1];
    if (index < frame.length && frame[index] <= 100) state.battery = frame[index];
    return [];
  }

  if (mode === 0xed) {
    const moveCounter = (frame[3] << 8) | frame[2];
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

  if (mode === 0x01) {
    const moveCounter = (frame[7] << 8) | frame[6];
    state.prevMoveLocTime = state.now();
    const power = readBits(frame, 64, 2);
    const axis = GAN_V4_AXIS_LOOKUP.indexOf(readBits(frame, 66, 6));
    if (axis === -1 || power >= 2) return [];
    const face = GAN_V4_FACE_ORDER[axis];
    const deviceTs = (
      frame[2]
      | (frame[3] << 8)
      | (frame[4] << 16)
      | (frame[5] << 24)
    ) >>> 0;
    return state.sync.push(moveCounter, power === 1 ? `${face}'` : face, deviceTs);
  }

  if (mode === 0xd1) {
    const startMoveCounter = frame[2];
    const numberOfMoves = Math.max(0, (frame[1] - 1) * 2);
    const replay: Array<{ cnt: number; mv: string }> = [];
    for (let index = 0; index < numberOfMoves; index++) {
      const axis = readBits(frame, 24 + 4 * index, 3);
      const power = readBits(frame, 27 + 4 * index, 1);
      if (axis < 6) {
        const face = GAN_V4_HISTORY_FACE_ORDER[axis];
        replay.push({
          cnt: (startMoveCounter - index) & 0xff,
          mv: power ? `${face}'` : face,
        });
      }
    }
    return state.sync.injectHistory(replay);
  }

  return [];
}

export interface GanV4Cipher {
  decrypt(frame: Uint8Array): Uint8Array;
  encrypt(frame: Uint8Array): Uint8Array;
}

export function createGanV4Cipher(mac: Uint8Array): GanV4Cipher {
  if (mac.length !== 6) throw new RangeError('GAN MAC must contain exactly 6 bytes.');
  const key = expandKey(deriveKeyFromMac(GAN_V4_KEY_BASE, mac));
  const iv = deriveKeyFromMac(GAN_V4_IV_BASE, mac);
  return {
    decrypt: (frame) => decryptFrame(frame, key, iv),
    encrypt: (frame) => encryptFrame(frame, key, iv),
  };
}

function command(opcode: number, length: number): Uint8Array {
  const frame = new Uint8Array(20);
  frame[0] = opcode;
  frame[1] = length;
  return frame;
}

export function createGanV4HardwareInfoCommand(): Uint8Array {
  return command(0xdf, 0x03);
}

export function createGanV4FaceletsCommand(): Uint8Array {
  const frame = command(0xdd, 0x04);
  frame[3] = 0xed;
  return frame;
}

export function createGanV4BatteryCommand(): Uint8Array {
  const frame = command(0xdd, 0x04);
  frame[3] = 0xef;
  return frame;
}

export function createGanV4HistoryCommand(
  startMoveCounter: number,
  numberOfMoves: number,
): Uint8Array {
  const frame = command(0xd1, 0x04);
  frame[2] = startMoveCounter & 0xff;
  frame[4] = numberOfMoves & 0xff;
  return frame;
}

export function matchesGanV4Name(name: string | undefined): boolean {
  return /^(GAN-?(?!356)(1[2-9]|Mini)|MG-|AiCube)/i.test(name ?? '');
}

/**
 * WeChat exposes either the manufacturer payload directly or a complete BLE
 * advertisement. GAN stores the MAC in reverse byte order in the last six
 * bytes of a payload that is at most nine bytes long.
 */
export function extractGanV4MacFromAdvertisement(
  advertisement: ArrayBuffer | Uint8Array | undefined,
): Uint8Array | null {
  if (!advertisement) return null;
  const bytes = advertisement instanceof Uint8Array
    ? advertisement
    : new Uint8Array(advertisement);

  const decode = (payload: Uint8Array): Uint8Array | null => {
    if (payload.length < 6) return null;
    const usable = payload.subarray(0, Math.min(payload.length, 9));
    const mac = new Uint8Array(6);
    for (let index = 0; index < mac.length; index++) {
      mac[index] = usable[usable.length - 1 - index];
    }
    return mac.every((part) => part === 0) ? null : mac;
  };

  if (bytes.length >= 6 && bytes.length <= 9) return decode(bytes);

  // Complete AD packet: [length][type][data...]. Manufacturer-specific data
  // uses type 0xff and starts with a two-byte company identifier.
  for (let offset = 0; offset < bytes.length;) {
    const length = bytes[offset];
    if (length === 0) break;
    const end = offset + length + 1;
    if (end > bytes.length) break;
    if (bytes[offset + 1] === 0xff && length >= 9) {
      const payload = bytes.subarray(offset + 4, end);
      const mac = decode(payload);
      if (mac) return mac;
    }
    offset = end;
  }

  return null;
}
