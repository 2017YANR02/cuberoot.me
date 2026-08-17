import {
  decodeGanGyro,
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  toBitReader,
  type GyroSink,
} from './gan_crypto';

export const GAN_V2_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
export const GAN_V2_NOTIFY_CHARACTERISTIC_UUID = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';
export const GAN_V2_WRITE_CHARACTERISTIC_UUID = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';

export const GAN_V2_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
export const GAN_V2_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);
export const AICUBE_V2_KEY_BASE = new Uint8Array([
  0x05, 0x12, 0x02, 0x45, 0x02, 0x01, 0x29, 0x56,
  0x12, 0x78, 0x12, 0x76, 0x81, 0x01, 0x08, 0x03,
]);
export const AICUBE_V2_IV_BASE = new Uint8Array([
  0x01, 0x44, 0x28, 0x06, 0x86, 0x21, 0x22, 0x28,
  0x51, 0x05, 0x08, 0x31, 0x82, 0x02, 0x21, 0x06,
]);

const FACE_ORDER = 'URFDLB';

export interface GanV2DecodeState {
  prevMoveCnt: number;
  prevMoves: string[];
  battery: number | null;
  badFrames: number;
}

export function createGanV2DecodeState(): GanV2DecodeState {
  return {
    prevMoveCnt: -1,
    prevMoves: [],
    battery: null,
    badFrames: 0,
  };
}

export function decodeGanV2Frame(
  frame: Uint8Array,
  state: GanV2DecodeState,
  onGyro?: GyroSink,
): string[] {
  if (frame.length < 16) return [];
  const bit = toBitReader(frame);
  const mode = bit(0, 4);

  if (mode === 1) {
    if (onGyro) {
      const gyro = decodeGanGyro(frame, 4, 68);
      onGyro(gyro.quaternion, gyro.velocity);
    }
    return [];
  }

  if (mode === 2) {
    const moveCnt = bit(4, 12);
    if (state.prevMoveCnt === moveCnt || state.prevMoveCnt === -1) return [];

    const parsed: string[] = [];
    for (let index = 0; index < 7; index++) {
      const encoded = bit(12 + index * 5, 17 + index * 5);
      if (encoded >= 12) {
        state.badFrames++;
        return [];
      }
      parsed[index] = `${FACE_ORDER[encoded >> 1]}${encoded & 1 ? "'" : ''}`;
    }
    state.badFrames = 0;
    state.prevMoves = parsed;

    const moveDiff = Math.min((moveCnt - state.prevMoveCnt) & 0xff, 7);
    const moves: string[] = [];
    for (let index = moveDiff - 1; index >= 0; index--) moves.push(parsed[index]);
    state.prevMoveCnt = moveCnt;
    return moves;
  }

  if (mode === 4) {
    const moveCnt = bit(4, 12);
    if (state.prevMoveCnt === -1) state.prevMoveCnt = moveCnt;
    return [];
  }

  if (mode === 9) {
    const battery = bit(8, 16);
    if (battery <= 100) state.battery = battery;
  }
  return [];
}

export interface GanV2Cipher {
  decrypt(frame: Uint8Array): Uint8Array;
  encrypt(frame: Uint8Array): Uint8Array;
}

export function createGanV2Cipher(
  mac: Uint8Array,
  deviceName = '',
): GanV2Cipher {
  if (mac.length !== 6) throw new RangeError('GAN MAC must contain exactly 6 bytes.');
  const aiCube = /^AiCube/i.test(deviceName);
  const key = expandKey(deriveKeyFromMac(
    aiCube ? AICUBE_V2_KEY_BASE : GAN_V2_KEY_BASE,
    mac,
  ));
  const iv = deriveKeyFromMac(aiCube ? AICUBE_V2_IV_BASE : GAN_V2_IV_BASE, mac);
  return {
    decrypt: (frame) => decryptFrame(frame, key, iv),
    encrypt: (frame) => encryptFrame(frame, key, iv),
  };
}

function command(opcode: number): Uint8Array {
  const frame = new Uint8Array(20);
  frame[0] = opcode;
  return frame;
}

export function createGanV2HardwareInfoCommand(): Uint8Array {
  return command(5);
}

export function createGanV2FaceletsCommand(): Uint8Array {
  return command(4);
}

export function createGanV2BatteryCommand(): Uint8Array {
  return command(9);
}

export function matchesGanV2Name(name: string | undefined): boolean {
  return /^(GAN|MG|AiCube|Gi)/i.test(name ?? '');
}
