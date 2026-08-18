/** GoCube / Rubik's Connected plaintext Nordic UART protocol. */

export const GOCUBE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const GOCUBE_WRITE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const GOCUBE_NOTIFY_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export const GOCUBE_COMMAND_BATTERY = 0x32;
export const GOCUBE_COMMAND_STATE = 0x33;
export const GOCUBE_STATE_REACK_AFTER_MOVES = 20;

const AXIS_PERM = [5, 2, 0, 3, 1, 4] as const;
const URFDLB = 'URFDLB';
const FACE_PERM = [0, 1, 2, 5, 8, 7, 6, 3] as const;
const FACE_OFFSET = [0, 0, 6, 2, 0, 0] as const;
const GOCUBE_COLOURS = 'BFUDRL';
const QUATERNION_SCALE = 16384;

export interface GoCubeQuaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export type GoCubeNotification =
  | { type: 'moves'; moves: string[] }
  | { type: 'state'; facelets: string }
  | { type: 'orientation'; quaternion: GoCubeQuaternion }
  | { type: 'battery'; level: number };

type BinarySource = ArrayBuffer | ArrayBufferView;

function bytesOf(source: BinarySource): Uint8Array {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

export function matchesGoCubeName(name: string | null | undefined): boolean {
  return /^(GoCube|Rubiks?)/i.test(name?.trim() ?? '');
}

export function createGoCubeCommand(command: number): ArrayBuffer {
  if (!Number.isInteger(command) || command < 0 || command > 0xff) {
    throw new RangeError('GoCube command must be one byte.');
  }
  return Uint8Array.of(command).buffer;
}

function parseFacelets(payload: Uint8Array): string | null {
  if (payload.byteLength < 54) return null;

  const facelets = new Array<string>(54);
  const counts = new Array<number>(6).fill(0);
  for (let face = 0; face < 6; face++) {
    const axis = AXIS_PERM[face] * 9;
    const offset = FACE_OFFSET[face];
    const centre = payload[face * 9];
    if (centre === undefined || centre > 5) return null;
    facelets[axis + 4] = GOCUBE_COLOURS.charAt(centre);
    counts[centre]++;

    for (let index = 0; index < 8; index++) {
      const colour = payload[face * 9 + index + 1];
      if (colour === undefined || colour > 5) return null;
      facelets[axis + FACE_PERM[(index + offset) % 8]] = GOCUBE_COLOURS.charAt(colour);
      counts[colour]++;
    }
  }

  const result = facelets.join('');
  return result.length === 54 && counts.every((count) => count === 9) ? result : null;
}

function parseQuaternion(payload: Uint8Array): GoCubeQuaternion | null {
  if (payload.byteLength < 7) return null;

  let text = '';
  for (const byte of payload) text += String.fromCharCode(byte);
  const parts = text.split('#');
  if (parts.length !== 4 || parts.some((part) => !/^-?\d+$/.test(part))) return null;

  const values = parts.map(Number);
  if (values.some((value) => !Number.isSafeInteger(value))) return null;
  const [x, y, z, w] = values;
  return {
    w: w / QUATERNION_SCALE,
    x: x / QUATERNION_SCALE,
    y: y / QUATERNION_SCALE,
    z: z / QUATERNION_SCALE,
  };
}

export function parseGoCubeNotification(source: BinarySource): GoCubeNotification | null {
  const bytes = bytesOf(source);
  const length = bytes.byteLength;
  if (length < 6
    || bytes[0] !== 0x2a
    || bytes[1] !== length - 2
    || bytes[length - 2] !== 0x0d
    || bytes[length - 1] !== 0x0a) {
    return null;
  }

  const opcode = bytes[2];
  const payload = bytes.subarray(3, length - 3);
  if (opcode === 0x01) {
    const moves: string[] = [];
    for (let index = 0; index + 1 < payload.byteLength; index += 2) {
      const encoded = payload[index];
      if (encoded === undefined) continue;
      const axis = AXIS_PERM[(encoded >> 1) & 0x07];
      if (axis === undefined) continue;
      const face = URFDLB.charAt(axis);
      moves.push((encoded & 1) === 1 ? `${face}'` : face);
    }
    return moves.length > 0 ? { type: 'moves', moves } : null;
  }

  if (opcode === 0x02) {
    const facelets = parseFacelets(payload);
    return facelets ? { type: 'state', facelets } : null;
  }

  if (opcode === 0x03) {
    const quaternion = parseQuaternion(payload);
    return quaternion ? { type: 'orientation', quaternion } : null;
  }

  if (opcode === 0x05) {
    const level = payload[0];
    return level !== undefined && level <= 100 ? { type: 'battery', level } : null;
  }

  return null;
}
