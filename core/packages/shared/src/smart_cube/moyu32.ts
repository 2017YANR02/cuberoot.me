import {
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  readBits,
  type GyroQuaternion,
} from './gan_crypto';

export const MOYU32_SERVICE_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb0';
export const MOYU32_NOTIFY_CHARACTERISTIC_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb1';
export const MOYU32_WRITE_CHARACTERISTIC_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb2';

export const MOYU32_KEY_BASE = Uint8Array.from([
  0x15, 0x77, 0x3a, 0x5c, 0x67, 0x0e, 0x2d, 0x1f,
  0x17, 0x67, 0x2a, 0x13, 0x9b, 0x67, 0x52, 0x57,
]);
export const MOYU32_IV_BASE = Uint8Array.from([
  0x11, 0x23, 0x26, 0x25, 0x86, 0x2a, 0x2c, 0x3b,
  0x55, 0x06, 0x7f, 0x31, 0x7e, 0x67, 0x21, 0x57,
]);

export const MOYU32_SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
export const MOYU32_MESSAGE_INFO = 0xa1;
export const MOYU32_MESSAGE_STATE = 0xa3;
export const MOYU32_MESSAGE_BATTERY = 0xa4;
export const MOYU32_MESSAGE_MOVE = 0xa5;
export const MOYU32_MESSAGE_GYRO = 0xab;
export const MOYU32_MESSAGE_GYRO_SWITCH = 0xac;

export interface Moyu32Move { mv: string; ts: number }
export interface Moyu32DecodeState {
  prevMoveCount: number;
  battery: number | null;
  deviceTime: number;
  badFrames: number;
}

export interface Moyu32Notification {
  moves: Moyu32Move[];
  state: string | null;
  battery: number | null;
  gyro: GyroQuaternion | null;
}

export function matchesMoyu32Name(name?: string | null): boolean {
  return /^WCU_MY3/i.test(name?.trim() ?? '');
}

export function moyu32DefaultMac(name?: string | null): string | null {
  const value = name?.trim() ?? '';
  if (!/^WCU_MY32_[0-9A-F]{4}$/i.test(value)) return null;
  return `CF:30:16:00:${value.slice(9, 11)}:${value.slice(11, 13)}`.toUpperCase();
}

export function createMoyu32DecodeState(): Moyu32DecodeState {
  return { prevMoveCount: -1, battery: null, deviceTime: 0, badFrames: 0 };
}

function validFacelets(value: string): string | null {
  if (value.length !== 54 || !/^[URFDLB]+$/.test(value)) return null;
  return 'URFDLB'.split('').every((face) => value.split(face).length - 1 === 9) ? value : null;
}

function decodeFacelets(frame: Uint8Array): string | null {
  if (frame.length < 20) return null;
  const readOrder = [2, 5, 0, 3, 4, 1];
  const colours = 'FBUDLR';
  let output = '';
  for (const face of readOrder) {
    for (let index = 0; index < 8; index++) {
      const colour = readBits(frame, 8 + face * 24 + index * 3, 3);
      if (colour > 5) return null;
      output += colours[colour];
      if (index === 3) output += colours[face];
    }
  }
  return validFacelets(output);
}

export function decodeMoyu32Quaternion(frame: Uint8Array): GyroQuaternion | null {
  if (frame.length < 17) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const w = view.getInt32(1, true) / 1073741824;
  const x = view.getInt32(5, true) / 1073741824;
  const negZ = view.getInt32(9, true) / 1073741824;
  const y = view.getInt32(13, true) / 1073741824;
  return { w, x, y, z: -negZ };
}

export function createMoyu32Cipher(mac: Uint8Array): {
  decrypt(frame: Uint8Array): Uint8Array;
  encrypt(frame: Uint8Array): Uint8Array;
} {
  const key = expandKey(deriveKeyFromMac(MOYU32_KEY_BASE, mac));
  const iv = deriveKeyFromMac(MOYU32_IV_BASE, mac);
  return {
    decrypt: (frame) => decryptFrame(frame, key, iv),
    encrypt: (frame) => encryptFrame(frame, key, iv),
  };
}

export function createMoyu32Command(opcode: number, ...rest: number[]): Uint8Array {
  const frame = new Uint8Array(20);
  frame[0] = opcode & 0xff;
  rest.forEach((value, index) => { frame[index + 1] = value & 0xff; });
  return frame;
}

export function decodeMoyu32Notification(
  frame: Uint8Array,
  state: Moyu32DecodeState,
): Moyu32Notification {
  const result: Moyu32Notification = { moves: [], state: null, battery: null, gyro: null };
  if (frame.length < 20) return result;
  const type = frame[0];
  if (type === MOYU32_MESSAGE_STATE) {
    if (state.prevMoveCount === -1) {
      state.prevMoveCount = readBits(frame, 152, 8);
      result.state = decodeFacelets(frame);
    }
    state.badFrames = 0;
    return result;
  }
  if (type === MOYU32_MESSAGE_BATTERY) {
    const level = readBits(frame, 8, 8);
    if (level <= 100) { state.battery = level; result.battery = level; }
    state.badFrames = 0;
    return result;
  }
  if (type === MOYU32_MESSAGE_GYRO) {
    result.gyro = decodeMoyu32Quaternion(frame);
    state.badFrames = 0;
    return result;
  }
  if (type !== MOYU32_MESSAGE_MOVE) {
    state.badFrames++;
    return result;
  }
  const moveCount = readBits(frame, 88, 8);
  if (state.prevMoveCount < 0 || moveCount === state.prevMoveCount) return result;
  const moves: string[] = [];
  const gaps: number[] = [];
  for (let index = 0; index < 5; index++) {
    const code = readBits(frame, 96 + index * 5, 5);
    if (code >= 12) { state.badFrames++; return result; }
    moves[index] = 'FBUDLR'[code >> 1] + (code & 1 ? "'" : '');
    gaps[index] = readBits(frame, 8 + index * 16, 16);
  }
  state.badFrames = 0;
  const count = Math.min(5, (moveCount - state.prevMoveCount) & 0xff);
  state.prevMoveCount = moveCount;
  for (let index = count - 1; index >= 0; index--) {
    state.deviceTime += gaps[index];
    result.moves.push({ mv: moves[index], ts: state.deviceTime });
  }
  return result;
}
