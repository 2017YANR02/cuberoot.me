import { normalizeMac, macStringToBytes, macFromPayload } from '../timer/external/mac';
import { cubieStateFromFacelets } from './cubie';
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
  historyLost: boolean;
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
  return { historyLost: false, prevMoveCount: -1, battery: null, deviceTime: 0, badFrames: 0 };
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
  if (type === MOYU32_MESSAGE_INFO || type === MOYU32_MESSAGE_GYRO_SWITCH) {
    // Both are valid replies to the connection handshake/control commands.
    // They must not count as bad-key evidence.
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
  const count = (moveCount - state.prevMoveCount) & 0xff;
  if (count > 5) { state.historyLost = true; return result; }
  state.prevMoveCount = moveCount;
  for (let index = count - 1; index >= 0; index--) {
    state.deviceTime += gaps[index];
    result.moves.push({ mv: moves[index], ts: state.deviceTime });
  }
  return result;
}

/** Calibrate the physically solved cube; a write requires a confirmed state reply. */
export function createMoyu32ResetCommand(): Uint8Array {
  return new Uint8Array([0xa2, 0, 0, 0, 0x24, 0x92, 0x49, 0x49, 0x24, 0x92, 0x6d, 0xb6, 0xdb, 0x92, 0x49, 0x24, 0xb6, 0xdb, 0x6d, 0]);
}

/** csTimer manufacturer layout; company ID is separate from the payload. */
export const MOYU32_MANUFACTURER_IDS = Array.from({ length: 256 }, (_, i) => i << 8);
export function moyu32Mac(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const mac = normalizeMac(value);
  return mac && mac !== '00:00:00:00:00:00' && mac !== 'FF:FF:FF:FF:FF:FF' ? mac : null;
}
export function moyu32AdvertisementMac(payload: Uint8Array): string | null {
  return moyu32Mac(macFromPayload(i => payload[i], payload.length, { layout: 'last6-reversed' }));
}
export function moyu32ManufacturerMac(data?: ReadonlyMap<number, Uint8Array>): string | null {
  // Bound WCU accounts can change the company ID. The model has already been identified.
  for (const payload of data?.values() ?? []) {
    const mac = moyu32AdvertisementMac(payload);
    if (mac) return mac;
  }
  return null;
}
/** Finite hints from poliva/smartcube-web-bluetooth; never trusted without a state reply. */
export function moyu32MacCandidates(name?: string | null): string[] {
  const match = /^WCU_MY(32|33)_([0-9a-f]{2})([0-9a-f]{2})$/i.exec(name?.trim() ?? '');
  if (!match) return [];
  return (match[1] === '33' ? ['02', '01', '00'] : ['00', '01', '02'])
    .map(part => ('CF:30:16:' + part + ':' + match[2] + ':' + match[3]).toUpperCase());
}
export interface Moyu32AddressIO {
  write(frame: Uint8Array): Promise<void>;
  subscribe(receive: (frame: Uint8Array) => void): Promise<() => Promise<void>>;
  current(): boolean;
}
const verifiedAddresses = new Map<string, string>();
/** Platform-neutral handshake. No turns or state callbacks escape a candidate probe. */
export async function resolveMoyu32Address(options: {
  id: string;
  name: string;
  hints?: (string | null | undefined)[];
  io: Moyu32AddressIO;
  requestMac?: () => Promise<string | null>;
  onVerified?: (mac: string) => void;
  onRejected?: (mac: string) => void;
  timeoutMs?: number;
}): Promise<string> {
  const { io } = options;
  const check = () => { if (!io.current()) throw new Error('Smart cube connection closed'); };
  const candidates = [...new Set([
    ...(options.hints ?? []), verifiedAddresses.get(options.id), ...moyu32MacCandidates(options.name),
  ].map(moyu32Mac).filter((mac): mac is string => mac !== null))];
  let receive: ((frame: Uint8Array) => void) | undefined;
  check();
  const stop = await io.subscribe(frame => receive?.(frame));
  const probe = async (mac: string): Promise<boolean> => {
    check();
    const cipher = createMoyu32Cipher(macStringToBytes(mac));
    let finish: (valid: boolean) => void = () => {};
    const result = new Promise<boolean>(resolve => { finish = resolve; });
    let interrupt: (error: Error) => void = () => {};
    const interrupted = new Promise<never>((_resolve, reject) => { interrupt = reject; });
    const timer = setTimeout(() => {
      finish(false); interrupt(new Error('MoYu32 address probe timed out'));
    }, options.timeoutMs ?? 2000);
    let retry: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setTimeout> | undefined;
    const pollCurrent = () => {
      if (!io.current()) { finish(false); interrupt(new Error('Smart cube connection closed')); }
      else poll = setTimeout(pollCurrent, 50);
    };
    pollCurrent();
    receive = raw => {
      if (!io.current() || raw.length !== 20) return;
      try {
        const plain = cipher.decrypt(raw);
        if (plain[0] !== MOYU32_MESSAGE_STATE) return;
        const state = decodeMoyu32Notification(plain, createMoyu32DecodeState()).state;
        // Colour counts alone do not prove a legal cube (orientation/parity included).
        if (state && cubieStateFromFacelets(state)) finish(true);
      } catch { /* wrong key / truncated notification */ }
    };
    let writeInFlight: Promise<void> | null = null;
    const request = async () => {
      check();
      const operation = io.write(cipher.encrypt(createMoyu32Command(MOYU32_MESSAGE_STATE)));
      writeInFlight = operation;
      try { await operation; }
      finally { if (writeInFlight === operation) writeInFlight = null; }
    };
    try {
      // Even a valid reply must wait for the host's write acknowledgement before
      // removing the subscription or issuing another command on the same link.
      await Promise.race([request(), interrupted]);
      retry = setTimeout(() => { void request().catch(() => finish(false)); }, 650);
      const valid = await result;
      if (writeInFlight) await Promise.race([writeInFlight, interrupted]);
      check();
      return valid;
    } finally {
      clearTimeout(timer);
      if (poll !== undefined) clearTimeout(poll);
      if (retry !== undefined) clearTimeout(retry);
      receive = undefined;
    }
  };
  try {
    for (const mac of candidates) {
      if (await probe(mac)) {
        verifiedAddresses.set(options.id, mac); options.onVerified?.(mac); return mac;
      }
      if (verifiedAddresses.get(options.id) === mac) verifiedAddresses.delete(options.id);
      options.onRejected?.(mac);
    }
    verifiedAddresses.delete(options.id);
    check();
    const manual = moyu32Mac(await options.requestMac?.());
    check();
    if (manual && await probe(manual)) {
      verifiedAddresses.set(options.id, manual); options.onVerified?.(manual); return manual;
    }
    throw new Error('MoYu32 MAC unavailable or invalid; wake the cube and check its address');
  } finally { receive = undefined; await stop(); }
}
