import {
  aesEcbDecrypt,
  aesEcbEncrypt,
  expandKey,
  type GyroQuaternion,
} from './gan_crypto';

export const QIYI_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
export const QIYI_CHARACTERISTIC_UUID = '0000fff6-0000-1000-8000-00805f9b34fb';
export const QIYI_WRITE_CHARACTERISTIC_UUID = '0000fff5-0000-1000-8000-00805f9b34fb';
export const QIYI_SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
export const QIYI_OP_HELLO = 0x02;
export const QIYI_OP_STATE = 0x03;
export const QIYI_OP_SYNC = 0x04;

const QIYI_AES_KEY = Uint8Array.from([
  0x57, 0xb1, 0xf9, 0xab, 0xcd, 0x5a, 0xe8, 0xa7,
  0x9c, 0xb9, 0x8c, 0xe7, 0x57, 0x8c, 0x51, 0x08,
]);
const QIYI_AXIS = [4, 1, 3, 0, 2, 5] as const;

export interface QiyiMove { mv: string; ts: number }
export interface QiyiNotification {
  moves: QiyiMove[];
  futureMoves: QiyiMove[];
  state: string | null;
  battery: number | null;
  timestamp: number | null;
  latestTimestamp: number | null;
  opcode: number | null;
  gyro: GyroQuaternion | null;
}

export function matchesQiyiName(name?: string | null): boolean {
  return /^(QY-QYSC|XMD-TornadoV4-i)/i.test(name?.trim() ?? '');
}

export function qiyiDefaultMac(name?: string | null): string | null {
  const match = /^(?:QY-QYSC|XMD-TornadoV4-i)-.-([0-9A-F]{4})$/i.exec(name?.trim() ?? '');
  if (!match) return null;
  return `CC:A3:00:00:${match[1].slice(0, 2)}:${match[1].slice(2)}`.toUpperCase();
}

function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc & 0xffff;
}

function validFacelets(value: string): string | null {
  if (value.length !== 54 || !/^[URFDLB]+$/.test(value)) return null;
  return 'URFDLB'.split('').every((face) => value.split(face).length - 1 === 9) ? value : null;
}

function parseFacelets(msg: Uint8Array): string | null {
  if (msg.length < 34) return null;
  let output = '';
  for (let index = 0; index < 54; index++) {
    const byte = msg[7 + (index >> 1)];
    const nibble = (byte >> ((index & 1) << 2)) & 0xf;
    if (nibble > 5) return null;
    output += 'LRDUFB'[nibble];
  }
  return validFacelets(output);
}

export function createQiyiCipher(): { decrypt(frame: Uint8Array): Uint8Array; encrypt(frame: Uint8Array): Uint8Array } {
  const key = expandKey(QIYI_AES_KEY);
  return {
    decrypt: (frame) => aesEcbDecrypt(frame, key),
    encrypt: (frame) => aesEcbEncrypt(frame, key),
  };
}

export function buildQiyiPacket(content: ReadonlyArray<number>): Uint8Array {
  const length = content.length + 4;
  const frame = new Uint8Array(Math.ceil(length / 16) * 16);
  frame[0] = 0xfe;
  frame[1] = length;
  content.forEach((value, index) => { frame[index + 2] = value & 0xff; });
  const crc = crc16Modbus(frame.subarray(0, content.length + 2));
  frame[content.length + 2] = crc & 0xff;
  frame[content.length + 3] = crc >>> 8;
  return frame;
}

export function createQiyiHelloCommand(mac: Uint8Array): Uint8Array {
  if (mac.length !== 6) throw new Error('QiYi MAC must contain 6 bytes');
  const content = [0x00, 0x6b, 0x01, 0x00, 0x00, 0x22, 0x06, 0x00, 0x02, 0x08, 0x00];
  for (let index = mac.length - 1; index >= 0; index--) content.push(mac[index]);
  return buildQiyiPacket(content);
}

export function createQiyiAckCommand(opcode: number, timestamp: number): Uint8Array {
  return buildQiyiPacket([
    opcode,
    (timestamp >>> 24) & 0xff,
    (timestamp >>> 16) & 0xff,
    (timestamp >>> 8) & 0xff,
    timestamp & 0xff,
  ]);
}

function parseGyro(frame: Uint8Array): GyroQuaternion | null {
  if (frame.length < 16 || frame[0] !== 0xcc || frame[1] !== 0x10
    || crc16Modbus(frame.subarray(0, 14)) !== (frame[14] | (frame[15] << 8))) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const x = view.getInt16(6, false) / 1000;
  const y = view.getInt16(8, false) / 1000;
  const z = view.getInt16(10, false) / 1000;
  const w = view.getInt16(12, false) / 1000;
  const norm = Math.hypot(x, y, z, w);
  return norm > 1e-6 ? { x: x / norm, y: y / norm, z: z / norm, w: w / norm } : null;
}

export function decodeQiyiNotification(
  frame: Uint8Array,
  previousTimestamp: number,
): QiyiNotification {
  const empty: QiyiNotification = {
    moves: [], futureMoves: [], state: null, battery: null, timestamp: null,
    latestTimestamp: null, opcode: null, gyro: null,
  };
  if (frame.length < 16 || frame.length % 16 !== 0) return empty;
  if (frame[0] === 0xcc && frame[1] === 0x10) return { ...empty, gyro: parseGyro(frame) };
  if (frame[0] !== 0xfe || frame[1] < 4 || frame[1] > frame.length) return empty;
  const length = frame[1];
  const msg = frame.subarray(0, length);
  if (crc16Modbus(msg) !== 0 || msg.length < 38) return empty;
  const opcode = msg[2];
  const view = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const timestamp = view.getUint32(3, false);
  const battery = msg[35] <= 100 ? msg[35] : null;
  const result = { ...empty, opcode, timestamp, latestTimestamp: timestamp, battery };
  if (opcode === QIYI_OP_HELLO) {
    if (timestamp < previousTimestamp) {
      return { ...result, battery: null, latestTimestamp: previousTimestamp };
    }
    return { ...result, state: parseFacelets(msg) };
  }
  if (opcode !== QIYI_OP_STATE) return result;
  const candidates: Array<{ code: number; ts: number }> = [{ code: msg[34], ts: timestamp }];
  for (let index = 0; index < 11; index++) {
    const offset = 36 + index * 5;
    if (offset + 5 > msg.length - 2) break;
    candidates.push({ code: msg[offset + 4], ts: view.getUint32(offset, false) });
  }
  candidates.sort((left, right) => left.ts - right.ts);
  const seen = new Set<string>();
  let latestTimestamp = Math.max(previousTimestamp, timestamp);
  for (const candidate of candidates) {
    if (candidate.ts <= previousTimestamp || candidate.code < 1 || candidate.code > 12) continue;
    const key = `${candidate.ts}:${candidate.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latestTimestamp = Math.max(latestTimestamp, candidate.ts);
    const face = 'URFDLB'[QIYI_AXIS[(candidate.code - 1) >> 1]];
    const move = face + (candidate.code & 1 ? "'" : '');
    const target = candidate.ts > timestamp ? result.futureMoves : result.moves;
    target.push({ mv: move, ts: Math.trunc(candidate.ts / 1.6) });
  }
  return {
    ...result,
    latestTimestamp,
    state: timestamp >= previousTimestamp ? parseFacelets(msg) : null,
  };
}
