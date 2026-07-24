/**
 * Synthetic BLE frame builders for the smart-cube parity harness.
 *
 * Every frame is built as PLAINTEXT here, then encrypted with **csTimer's own
 * crypto**, executed inside the csTimer vm sandbox:
 *   - GAN v2: csTimer's `KEYS` + `getKeyV2()` + `encode()` are sliced out of
 *     `hardware/gancube.js` by brace matching and eval'd — so the ciphertext
 *     carries zero assumptions from our TypeScript port.
 *   - QiYi:   csTimer's `KEYS` + `crc16modbus()` are sliced out of
 *     `hardware/qiyicube.js` and driven through csTimer's `$.aes128`.
 *
 * The plaintext LAYOUTS below are read off csTimer's own parsers
 * (`parseV2Data`, `parseCubeData`) — i.e. they are the inverse of the code
 * under test on the csTimer side, never a copy of our driver.
 */

import type { CstimerSandbox } from './_cstimer_sandbox';
import { extractFunction, extractVarDecl } from './_cstimer_sandbox';

/* ================================================================== */
/*  Bit packing (csTimer reads frames as a big-endian bit string)      */
/* ================================================================== */

export type BitWrite = [startBit: number, lenBits: number, value: number];

/** Pack big-endian bit fields into `totalBytes` bytes. */
export function packBits(totalBytes: number, writes: BitWrite[]): number[] {
  const bits = new Uint8Array(totalBytes * 8);
  for (const [start, len, value] of writes) {
    for (let i = 0; i < len; i++) {
      bits[start + i] = (value >>> (len - 1 - i)) & 1;
    }
  }
  const out: number[] = [];
  for (let b = 0; b < totalBytes; b++) {
    let v = 0;
    for (let i = 0; i < 8; i++) v = (v << 1) | bits[b * 8 + i];
    out.push(v);
  }
  return out;
}

/* ================================================================== */
/*  GAN v2                                                             */
/* ================================================================== */

export const GAN_V2_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
export const GAN_V2_READ = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';
export const GAN_V2_WRITE = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';

export interface GanCrypto {
  /** Encrypt a 20-byte plaintext frame with csTimer's `encode()`. */
  encrypt(plain: number[]): number[];
  /** The derived `[key, iv]` csTimer computed for this MAC. */
  keyIv(): { key: number[]; iv: number[] };
  /** Re-key for a different MAC (used for wrong-key frames). */
  rekey(mac: string, ver?: number): void;
}

/**
 * Install csTimer's real GAN key derivation + frame encoder in the sandbox.
 * `ver` is csTimer's `getKeyV2(value, ver)` selector: 0 = normal, 1 = AiCube.
 */
export function installGanCrypto(sb: CstimerSandbox, mac: string, ver = 0): GanCrypto {
  const src = sb.source('hardware/gancube.js');
  sb.run(`
    var __ganCrypto = (function() {
      var decoder = null;
      ${extractVarDecl(src, 'KEYS')}
      ${extractFunction(src, 'getKeyV2')}
      ${extractFunction(src, 'encode')}
      var lastKeyIv = null;
      return {
        rekey: function(macStr, ver) {
          var value = [];
          for (var i = 0; i < 6; i++) value.push(parseInt(macStr.slice(i * 3, i * 3 + 2), 16));
          lastKeyIv = getKeyV2(value, ver);
          decoder = $.aes128(lastKeyIv[0]);
          decoder.iv = lastKeyIv[1];
        },
        keyIv: function() { return { key: lastKeyIv[0].slice(), iv: lastKeyIv[1].slice() }; },
        encode: function(arr) { return encode(arr.slice()); }
      };
    })();
  `);
  const api: GanCrypto = {
    encrypt(plain) {
      sb.run(`__ganPlain = ${JSON.stringify(plain)};`);
      return Array.from(sb.run<ArrayLike<number>>('__ganCrypto.encode(__ganPlain)'), (n) => Number(n) & 0xff);
    },
    keyIv() {
      const r = sb.run<{ key: ArrayLike<number>; iv: ArrayLike<number> }>('__ganCrypto.keyIv()');
      return { key: Array.from(r.key, Number), iv: Array.from(r.iv, Number) };
    },
    rekey(m, v = ver) {
      sb.run(`__ganCrypto.rekey(${JSON.stringify(m)}, ${v});`);
    },
  };
  api.rekey(mac, ver);
  return api;
}

/**
 * GAN v2 mode-2 (move) frame — 20 bytes / 160 bits, from `parseV2Data`:
 *   bit  0..3    mode = 2
 *   bit  4..11   8-bit move counter
 *   bit 12+5i    5-bit move code, i = 0..6, `window[0]` is the NEWEST move
 *                (code = faceIndexIntoURFDLB << 1 | direction)
 *   bit 47+16i   16-bit inter-move time offset, i = 0..6 (fills to bit 159)
 */
export function ganV2MoveFrame(moveCnt: number, window: number[], timeOffs?: number[]): number[] {
  const w: BitWrite[] = [[0, 4, 2], [4, 8, moveCnt & 0xff]];
  for (let i = 0; i < 7; i++) w.push([12 + i * 5, 5, (window[i] ?? 0) & 0x1f]);
  for (let i = 0; i < 7; i++) w.push([47 + i * 16, 16, (timeOffs?.[i] ?? 100) & 0xffff]);
  return packBits(20, w);
}

/**
 * GAN v2 mode-4 (facelets) frame. csTimer rebuilds a `CubieCube` from it and
 * REJECTS the frame unless `verify() == 0`, so `ca` / `ea` must be a real cube
 * state. Corner 7 and edge 11 are omitted — csTimer derives them by checksum.
 *   bit  0..3    mode = 4
 *   bit  4..11   move counter (seeds `prevMoveCnt`)
 *   bit 12+3i    3-bit corner permutation, i = 0..6
 *   bit 33+2i    2-bit corner orientation, i = 0..6
 *   bit 47+4i    4-bit edge permutation,  i = 0..10
 *   bit 91+i     1-bit edge orientation,  i = 0..10
 */
export function ganV2FaceletFrame(moveCnt: number, ca: number[], ea: number[]): number[] {
  const w: BitWrite[] = [[0, 4, 4], [4, 8, moveCnt & 0xff]];
  for (let i = 0; i < 7; i++) w.push([12 + i * 3, 3, ca[i] & 7]);
  for (let i = 0; i < 7; i++) w.push([33 + i * 2, 2, (ca[i] >> 3) & 3]);
  for (let i = 0; i < 11; i++) w.push([47 + i * 4, 4, (ea[i] >> 1) & 0xf]);
  for (let i = 0; i < 11; i++) w.push([91 + i, 1, ea[i] & 1]);
  return packBits(20, w);
}

/** GAN v2 mode-9 (battery) frame: bits 8..15 hold the percentage. */
export function ganV2BatteryFrame(pct: number): number[] {
  return packBits(20, [[0, 4, 9], [8, 8, pct & 0xff]]);
}

/** GAN v2 mode-1 (gyro) frame — both sides must ignore it entirely. */
export function ganV2GyroFrame(filler = 0x5a): number[] {
  return packBits(20, [[0, 4, 1], [4, 12, filler & 0xfff], [16, 16, 0x1234]]);
}

/** GAN v2 mode-5 (hardware info) frame — ignored by both sides. */
export function ganV2HardwareFrame(): number[] {
  const w: BitWrite[] = [[0, 4, 5], [8, 8, 1], [16, 8, 2], [24, 8, 3], [32, 8, 4]];
  const name = 'GANiCARR';
  for (let i = 0; i < 8; i++) w.push([40 + i * 8, 8, name.charCodeAt(i)]);
  w.push([104, 1, 1]);
  return packBits(20, w);
}

/**
 * Ask the sandbox's (hand-ported, mathlib-faithful) `CubieCube` for a cube
 * state reached by `moves` from solved. Returns the raw `ca` / `ea` arrays so
 * `ganV2FaceletFrame` can encode a state csTimer will accept.
 */
export function cubieStateAfter(sb: CstimerSandbox, moves: number[]): { ca: number[]; ea: number[] } {
  sb.run(`__stMoves = ${JSON.stringify(moves)};`);
  const r = sb.run<{ ca: ArrayLike<number>; ea: ArrayLike<number> }>(`
    (function() {
      var cur = new mathlib.CubieCube();
      for (var i = 0; i < __stMoves.length; i++) {
        var out = new mathlib.CubieCube();
        mathlib.CubieCube.CubeMult(cur, mathlib.CubieCube.moveCube[__stMoves[i]], out);
        cur = out;
      }
      return { ca: cur.ca.slice(), ea: cur.ea.slice() };
    })()
  `);
  return { ca: Array.from(r.ca, Number), ea: Array.from(r.ea, Number) };
}

/** GAN v2 move code -> WCA notation, per csTimer's `parseV2Data`. */
export function ganV2CodeToMove(code: number): string {
  return 'URFDLB'.charAt(code >> 1) + (code & 1 ? "'" : '');
}

/* ================================================================== */
/*  QiYi                                                               */
/* ================================================================== */

export const QIYI_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
export const QIYI_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';

export interface QiyiCrypto {
  /** CRC-append, zero-pad and AES-ECB a plaintext body (WITHOUT the 2 CRC bytes). */
  build(body: number[]): number[];
  /** ECB-encrypt an already-complete, 16-aligned buffer (for garbage frames). */
  encryptRaw(buf: number[]): number[];
  /** csTimer's own CRC-16/MODBUS. */
  crc(bytes: number[]): number;
}

/** Install csTimer's real QiYi crypto (fixed factory key + CRC) in the sandbox. */
export function installQiyiCrypto(sb: CstimerSandbox): QiyiCrypto {
  const src = sb.source('hardware/qiyicube.js');
  sb.run(`
    var __qyCrypto = (function() {
      ${extractVarDecl(src, 'KEYS')}
      ${extractFunction(src, 'crc16modbus')}
      var aes = $.aes128(JSON.parse(LZString.decompressFromEncodedURIComponent(KEYS[0])));
      function ecb(msg) {
        var enc = [];
        for (var i = 0; i < msg.length; i += 16) {
          var block = msg.slice(i, i + 16);
          aes.encrypt(block);
          for (var j = 0; j < 16; j++) enc[i + j] = block[j];
        }
        return enc;
      }
      return {
        crc: crc16modbus,
        // Mirrors csTimer's sendMessage(): crc over the body, LE-appended,
        // then zero-pad to a 16-byte multiple, then ECB every block.
        build: function(body) {
          var msg = body.slice();
          var crc = crc16modbus(msg);
          msg.push(crc & 0xff, crc >> 8);
          var npad = (16 - msg.length % 16) % 16;
          for (var i = 0; i < npad; i++) msg.push(0);
          return ecb(msg);
        },
        encryptRaw: function(buf) { return ecb(buf.slice()); }
      };
    })();
  `);
  return {
    build(body) {
      sb.run(`__qyBody = ${JSON.stringify(body)};`);
      return Array.from(sb.run<ArrayLike<number>>('__qyCrypto.build(__qyBody)'), (n) => Number(n) & 0xff);
    },
    encryptRaw(buf) {
      sb.run(`__qyRaw = ${JSON.stringify(buf)};`);
      return Array.from(sb.run<ArrayLike<number>>('__qyCrypto.encryptRaw(__qyRaw)'), (n) => Number(n) & 0xff);
    },
    crc(bytes) {
      sb.run(`__qyCrcIn = ${JSON.stringify(bytes)};`);
      return Number(sb.run<number>('__qyCrypto.crc(__qyCrcIn)'));
    },
  };
}

/** Total plaintext frame length we synthesise. Must cover history slot 46..90. */
export const QIYI_FRAME_LEN = 93;

/** Facelet string (URFDLB alphabet, 54 chars) -> 27 nibble-packed bytes. */
export function faceletToNibbles(facelet: string): number[] {
  const out: number[] = [];
  for (let k = 0; k < 27; k++) {
    const lo = 'LRDUFB'.indexOf(facelet[2 * k]);
    const hi = 'LRDUFB'.indexOf(facelet[2 * k + 1]);
    out.push((lo & 0xf) | ((hi & 0xf) << 4));
  }
  return out;
}

export interface QiyiHistorySlot { ts: number; mv: number }

/**
 * QiYi plaintext frame body (91 bytes, CRC appended by `QiyiCrypto.build`).
 * Layout from csTimer's `parseCubeData` / `parseFacelet`:
 *   [0]      0xFE magic
 *   [1]      total length L (= body + 2 CRC bytes)
 *   [2]      opcode: 2 = hello, 3 = state change
 *   [3..6]   big-endian 32-bit device timestamp
 *   [7..33]  27 nibble-packed facelet bytes ("LRDUFB" alphabet)
 *   [34]     current move byte (state frames)
 *   [35]     battery percent
 *   [46..90] nine 5-byte history slots (4 BE ts + 1 move), OLDEST at 46,
 *            NEWEST at 86 — csTimer walks them at `off = 91 - 5*i`.
 */
export function qiyiFrameBody(opts: {
  opcode: number;
  ts: number;
  facelet: string;
  curMove?: number;
  battery?: number;
  /** `history[i]` is the move i+1 steps before the current one. */
  history?: QiyiHistorySlot[];
  len?: number;
}): number[] {
  const len = opts.len ?? QIYI_FRAME_LEN;
  const body = new Array<number>(len - 2).fill(0);
  body[0] = 0xfe;
  body[1] = len;
  body[2] = opts.opcode & 0xff;
  body[3] = (opts.ts >>> 24) & 0xff;
  body[4] = (opts.ts >>> 16) & 0xff;
  body[5] = (opts.ts >>> 8) & 0xff;
  body[6] = opts.ts & 0xff;
  const nib = faceletToNibbles(opts.facelet);
  for (let i = 0; i < 27; i++) body[7 + i] = nib[i];
  body[34] = (opts.curMove ?? 0) & 0xff;
  body[35] = (opts.battery ?? 80) & 0xff;
  for (let i = 1; i <= 9; i++) {
    const slot = opts.history?.[i - 1] ?? { ts: 0, mv: 0 };
    const off = 91 - 5 * i;
    if (off + 4 > body.length) continue;
    body[off] = (slot.ts >>> 24) & 0xff;
    body[off + 1] = (slot.ts >>> 16) & 0xff;
    body[off + 2] = (slot.ts >>> 8) & 0xff;
    body[off + 3] = slot.ts & 0xff;
    body[off + 4] = slot.mv & 0xff;
  }
  return body;
}

/** csTimer's QiYi move-byte decode (`parseCubeData`) — the ORACLE, not our port. */
export function qiyiMoveByteToMove(mv: number): string {
  const axis = [4, 1, 3, 0, 2, 5][(mv - 1) >> 1];
  const power = [0, 2][mv & 1];
  return 'URFDLB'.charAt(axis) + ' 2\''.charAt(power);
}

/** Apply a QiYi move byte to a `CubieCube` in the sandbox; returns the facelet. */
export function qiyiApplyMoves(sb: CstimerSandbox, moveBytes: number[]): string {
  sb.run(`__qyMvs = ${JSON.stringify(moveBytes)};`);
  return String(sb.run<string>(`
    (function() {
      if (typeof __qyCube === 'undefined' || __qyCube === null) __qyCube = new mathlib.CubieCube();
      for (var i = 0; i < __qyMvs.length; i++) {
        var mv = __qyMvs[i];
        var axis = [4, 1, 3, 0, 2, 5][(mv - 1) >> 1];
        var power = [0, 2][mv & 1];
        var m = axis * 3 + power;
        var out = new mathlib.CubieCube();
        mathlib.CubieCube.CubeMult(__qyCube, mathlib.CubieCube.moveCube[m], out);
        __qyCube = out;
      }
      return __qyCube.toFaceCube();
    })()
  `));
}

/** Reset the QiYi facelet tracker to solved. */
export function qiyiResetCube(sb: CstimerSandbox): string {
  return String(sb.run<string>('(__qyCube = new mathlib.CubieCube()).toFaceCube()'));
}

/* ================================================================== */
/*  GoCube / Rubik's Connected (plaintext Nordic UART)                 */
/* ================================================================== */

export const GOCUBE_SUFFIX = '-b5a3-f393-e0a9-e50e24dcca9e';
export const GOCUBE_SERVICE = `6e400001${GOCUBE_SUFFIX}`;
export const GOCUBE_WRITE = `6e400002${GOCUBE_SUFFIX}`;
export const GOCUBE_READ = `6e400003${GOCUBE_SUFFIX}`;

/**
 * GoCube notification frame, from csTimer's `parseData`:
 *   [0]      0x2A magic
 *   [1]      length byte (ignored by csTimer)
 *   [2]      message type (1 = move, 2 = state, 3 = quaternion, 5 = battery)
 *   [3..]    payload — csTimer computes `msgLen = byteLength - 6`
 *   [n-3]    checksum (ignored by csTimer)
 *   [n-2..]  0x0D 0x0A trailer
 */
export function goCubeFrame(msgType: number, payload: number[]): number[] {
  const body = [0x2a, payload.length + 4, msgType & 0xff, ...payload.map((b) => b & 0xff)];
  let sum = 0;
  for (const b of body) sum = (sum + b) & 0xff;
  return [...body, sum, 0x0d, 0x0a];
}

/** GoCube move record: 2 bytes, `[axis<<1 | dir, tick]`. */
export function goCubeMoveFrame(records: Array<{ code: number; tick?: number }>): number[] {
  const payload: number[] = [];
  for (const r of records) payload.push(r.code & 0xff, (r.tick ?? 0) & 0xff);
  return goCubeFrame(1, payload);
}

/** csTimer's GoCube move decode (`parseData`, msgType 1) — the ORACLE. */
export function goCubeCodeToMove(code: number): string {
  const axis = [5, 2, 0, 3, 1, 4][code >> 1];
  const power = [0, 2][code & 1];
  return 'URFDLB'.charAt(axis) + ' 2\''.charAt(power);
}

/* ================================================================== */
/*  MoYu AI (MHC — plaintext)                                          */
/* ================================================================== */

export const MOYU_SUFFIX = '-0000-1000-8000-00805f9b34fb';
export const MOYU_SERVICE = `00001000${MOYU_SUFFIX}`;
export const MOYU_WRITE = `00001001${MOYU_SUFFIX}`;
export const MOYU_READ = `00001002${MOYU_SUFFIX}`;
export const MOYU_TURN = `00001003${MOYU_SUFFIX}`;
export const MOYU_GYRO = `00001004${MOYU_SUFFIX}`;

export interface MoyuTurnRecord { ts: number; face: number; dir: number }

/**
 * MoYu turn-characteristic packet, from csTimer's `parseTurn`:
 *   [0]              n_moves
 *   per move (6 B):  [0,1] ts hi-word (byte-swapped), [2,3] ts lo-word,
 *                    [4] face 0..5, [5] rotation delta in ~36-degree units
 */
export function moyuTurnFrame(records: MoyuTurnRecord[]): number[] {
  const out: number[] = [records.length & 0xff];
  for (const r of records) {
    out.push((r.ts >>> 16) & 0xff, (r.ts >>> 24) & 0xff, r.ts & 0xff, (r.ts >>> 8) & 0xff);
    out.push(r.face & 0xff, r.dir & 0xff);
  }
  return out;
}

/* ================================================================== */
/*  Giiker / Mi Smart Magic Cube (plaintext, optional 0xA7 obfuscation) */
/* ================================================================== */

export const GIIKER_SUFFIX = '-0000-1000-8000-00805f9b34fb';
export const GIIKER_DATA_SERVICE = `0000aadb${GIIKER_SUFFIX}`;
export const GIIKER_NOTIFY = `0000aadc${GIIKER_SUFFIX}`;
export const GIIKER_RW_SERVICE = `0000aaaa${GIIKER_SUFFIX}`;
export const GIIKER_READ = `0000aaab${GIIKER_SUFFIX}`;
export const GIIKER_WRITE = `0000aaac${GIIKER_SUFFIX}`;

export interface GiikerMove { face: number; dir: number }

/**
 * Giiker 20-byte state frame (unobfuscated variant, i.e. `raw[18] != 0xA7`).
 * Nibble layout from csTimer's `parseState`:
 *   valhex[0..7]    corner permutation (1-based)
 *   valhex[8..15]   corner orientation
 *   valhex[16..27]  edge permutation (1-based)
 *   valhex[28..30]  12 edge-orientation bits
 *   valhex[32..39]  four moves, NEWEST first, as (face 1..6, dir 1..)
 */
export function giikerStateFrame(opts: {
  cp?: number[]; co?: number[]; ep?: number[]; eo?: number[]; moves: GiikerMove[];
}): number[] {
  const nib = new Array<number>(40).fill(0);
  const cp = opts.cp ?? [1, 2, 3, 4, 5, 6, 7, 8];
  const co = opts.co ?? [0, 0, 0, 0, 0, 0, 0, 0];
  const ep = opts.ep ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const eo = opts.eo ?? new Array<number>(12).fill(0);
  for (let i = 0; i < 8; i++) nib[i] = cp[i] & 0xf;
  for (let i = 0; i < 8; i++) nib[i + 8] = co[i] & 0xf;
  for (let i = 0; i < 12; i++) nib[i + 16] = ep[i] & 0xf;
  // 12 EO bits packed into 3 nibbles, MSB first (csTimer walks mask 8->1).
  for (let i = 0; i < 3; i++) {
    let v = 0;
    for (let b = 0; b < 4; b++) v |= (eo[i * 4 + b] ? 1 : 0) << (3 - b);
    nib[i + 28] = v;
  }
  for (let i = 0; i < 4; i++) {
    const m = opts.moves[i] ?? { face: 0, dir: 0 };
    nib[32 + i * 2] = m.face & 0xf;
    nib[32 + i * 2 + 1] = m.dir & 0xf;
  }
  const out: number[] = [];
  for (let i = 0; i < 20; i++) out.push(((nib[i * 2] & 0xf) << 4) | (nib[i * 2 + 1] & 0xf));
  return out;
}

/** csTimer's Giiker move decode (`parseState`) — the ORACLE. */
export function giikerMoveToString(m: GiikerMove): string {
  return 'BDLURF'.charAt(m.face - 1) + ' 2\''.charAt((m.dir - 1) % 7);
}
