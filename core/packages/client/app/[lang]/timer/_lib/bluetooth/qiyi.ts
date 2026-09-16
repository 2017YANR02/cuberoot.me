import { createDeviceStateReset } from './device_reset';
/**
 * QiYi Smart Cube driver — covers QY-QYSC (Smart Cube) and XMD-TornadoV4-i.
 *
 * Protocol reference: cstimer's `src/js/hardware/qiyicube.js`. This file is a
 * faithful TypeScript port of that battle-tested implementation; comments
 * call out the two places we deviate (MAC discovery and pure-ECB self-AES).
 *
 * Wire summary
 * ------------
 *   Service:       0000fff0-0000-1000-8000-00805f9b34fb
 *   Char (notify): 0000fff6-0000-1000-8000-00805f9b34fb     (also write)
 *
 * Both reads and writes go through fff6. Frames are AES-128-**ECB** (NOT
 * CBC, no IV) on each 16-byte block, with a single fixed factory key. The
 * MAC address only matters because the cube's hello payload contains the
 * MAC, so the cube can verify the host already knows it.
 *
 * Plain-frame layout (after ECB-decrypting all blocks):
 *   [0]    magic 0xFE
 *   [1]    total length L (frame is L bytes; remainder is zero pad)
 *   [2]    opcode: 0x02 = hello (initial), 0x03 = state change
 *   [3..6] big-endian 32-bit timestamp (1.6 us per tick — see cstimer)
 *   [7..33]  27 bytes of facelet nibbles (54 stickers, "LRDUFB" alphabet)
 *   [34]   current move (state opcode only)
 *   [35]   battery percent (state opcode only; also at this offset in hello)
 *   [36..90] history-move slots; current + up to 11 history entries can be read
 *           at offsets 36 + 5*i for i = 0..10, each (4 ts, 1 mv)
 *   [L-2..L-1] CRC-16/MODBUS (little-endian) over msg[0..L-2]
 *
 * Move-byte encoding (1..12):
 *   axis = [4,1,3,0,2,5][(mv-1) >> 1]   -> URFDLB index
 *   power = [0, 2][mv & 1]              -> 0 = CW, 2 = CCW (no doubles)
 */

import {
  writeGattValue,
  type CubeDriver,
  type CubeDriverContext,
  type CubeDriverStartResult,
  type TimedMove,
  type GyroQuaternion,
} from './driver';
import type { CubeBrand } from './types';
import { crc16Modbus } from './crc';
import { aesEcbDecrypt, aesEcbEncrypt, expandKey } from './gan_crypto';
import { QIYI_MAC_ADV, macStringToBytes, normalizeMac } from './mac';
import { fromFaceletString } from '../cube/state';

const QIYI_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
/** fff6 is full-duplex: notifications come in, hello/ack go out on the same. */
const QIYI_CUBE_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';

/**
 * Single fixed AES-128-ECB key shared by all QiYi smart cubes. Lifted from
 * cstimer (KEYS[0], LZ-decompressed). Public, ships in their PWA bundle.
 */
const QIYI_AES_KEY = new Uint8Array([
  0x57, 0xb1, 0xf9, 0xab, 0xcd, 0x5a, 0xe8, 0xa7,
  0x9c, 0xb9, 0x8c, 0xe7, 0x57, 0x8c, 0x51, 0x08,
]);

/** WCA face notation indexed by the URFDLB axis. */
const URFDLB = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
/** mv-byte (1..12) → URFDLB axis index, per cstimer. */
const QIYI_AXIS_LUT: ReadonlyArray<number> = [4, 1, 3, 0, 2, 5];

const QIYI_MAGIC = 0xfe;
const OP_HELLO = 0x02;
const OP_STATE = 0x03;
const OP_SYNC = 0x04;
const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** DCTimer-BLE QiyiCubeProtocol: independent CC 10 gyro frame, CRC over
 *  bytes 0..13, signed big-endian ax/ay/az/aw at 6/8/10/12, scaled by 1000.
 *  Preserve QiYi axes; the shared orientation table uses identity for them. */
function parseQiyiQuaternion(frame: Uint8Array): GyroQuaternion | null {
  if (frame.length < 16 || frame[0] !== 0xcc || frame[1] !== 0x10) return null;
  if (crc16Modbus(frame.subarray(0, 14)) !== (frame[14] | (frame[15] << 8))) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const x = view.getInt16(6, false) / 1000;
  const y = view.getInt16(8, false) / 1000;
  const z = view.getInt16(10, false) / 1000;
  const w = view.getInt16(12, false) / 1000;
  const norm = Math.hypot(x, y, z, w);
  if (!Number.isFinite(norm) || norm < 1e-6) return null;
  return { x: x / norm, y: y / norm, z: z / norm, w: w / norm };
}

/* ================================================================== */
/*  Frame builders & parser                                            */
/* ================================================================== */

/**
 * Build, CRC-frame, zero-pad, and ECB-encrypt a host->cube message.
 * Mirrors cstimer's `sendMessage`.
 */
function buildPacket(content: ReadonlyArray<number>, w: Uint8Array): Uint8Array {
  // Header (2) + content + CRC (2), then zero-pad to a multiple of 16.
  const headerLen = 2 + content.length + 2;
  const padded = new Uint8Array(Math.ceil(headerLen / 16) * 16);
  padded[0] = QIYI_MAGIC;
  padded[1] = headerLen;
  for (let i = 0; i < content.length; i++) padded[2 + i] = content[i] & 0xff;
  const crc = crc16Modbus(padded.subarray(0, 2 + content.length));
  padded[2 + content.length] = crc & 0xff;
  padded[2 + content.length + 1] = (crc >>> 8) & 0xff;
  return aesEcbEncrypt(padded, w);
}

/**
 * Best-effort MAC parse from `device.name`. cstimer pulls the MAC from BLE
 * advertisement manufacturer data (CIC 0x0504), but Web Bluetooth doesn't
 * surface that to us reliably; the cube name carries the low two bytes.
 *
 * Names look like `QY-QYSC-X-XXXX` or `XMD-TornadoV4-i-X-XXXX`. The official
 * MAC prefix for QiYi Smart Cube is `CC:A3:00:00:` followed by the trailing
 * four hex chars of the device name.
 *
 * Returns a normalized big-endian MAC string or null.
 */
export function qiyiDefaultMac(name: string | null | undefined): string | null {
  if (!name) return null;
  const m = /^(?:QY-QYSC|XMD-TornadoV4-i)-.-([0-9A-F]{4})$/i.exec(name.trim());
  if (!m) return null;
  const tail = m[1].toUpperCase();
  return normalizeMac(`CC:A3:00:00:${tail.slice(0, 2)}:${tail.slice(2, 4)}`);
}

interface DecodeState {
  /** Most recent timestamp (cube's 32-bit counter). Used to dedupe. */
  lastTs: number;
  /** Most recent battery percentage. */
  battery: number | null;
}

/**
 * Decode the 27 facelet bytes (msg[7..33]) into a 54-character facelet string.
 *
 * Two stickers per byte, low nibble first, each nibble indexing the alphabet
 * `LRDUFB` — cstimer's `parseFacelet` (`qiyicube.js:234-241`), verbatim. The
 * resulting string is in the usual `URFDLB` Kociemba position order, so it
 * drops straight into `CubeStateTracker.adoptFacelets`.
 *
 * Returns null when the payload doesn't describe a real cube, which is the
 * signal that the frame was decrypted with the wrong key — the `onState`
 * contract requires drivers to validate before reporting.
 */
function parseQiyiFacelets(msg: Uint8Array): string | null {
  if (msg.length < 34) return null;
  let out = '';
  for (let i = 0; i < 54; i++) {
    const byte = msg[7 + (i >> 1)];
    const nibble = (byte >> ((i % 2) << 2)) & 0xf;
    if (nibble > 5) return null;
    out += 'LRDUFB'.charAt(nibble);
  }
  // Nine of each letter, i.e. a facelet count a cube could actually have.
  // (This does NOT prove solvability — QiYi reports stickers, not pieces, so
  // there is no permutation parity to check the way there is for GAN.)
  return fromFaceletString(out) ? out : null;
}

/** Format a (axis, power) pair into WCA notation. power in {0=CW, 2=CCW}. */
function formatMove(axis: number, power: number): string | null {
  if (axis < 0 || axis >= URFDLB.length) return null;
  if (power === 0) return URFDLB[axis];
  if (power === 2) return `${URFDLB[axis]}'`;
  return null;
}

/**
 * Ticks per millisecond on the QiYi cube clock. cstimer converts with
 * `Math.trunc(ts / 1.6)` (`qiyicube.js:171`), i.e. 0.625 ms per tick.
 */
const QIYI_TICKS_PER_MS = 1.6;

/**
 * Parse a fully-decrypted, length-trimmed, CRC-validated frame.
 * Returns moves in chronological order (oldest first) plus the new lastTs.
 *
 * Every move carries its OWN device timestamp — the live one at msg[3..6] and
 * each history slot at `off..off+3`. That makes QiYi the best-instrumented
 * brand we support: unlike GAN, whose history replies report the turn but not
 * when it happened, a QiYi move recovered from history still knows its own
 * time, so a dropped notification costs us nothing in timing accuracy.
 */
function parseStateMoves(msg: Uint8Array, prevLastTs: number): {
  moves: TimedMove[]; futureMoves: TimedMove[]; lastTs: number;
  battery: number | null; facelets: string | null;
} {
  const empty = { moves: [], futureMoves: [], lastTs: prevLastTs, battery: null, facelets: null };
  if (msg.length < 38 || (msg[2] !== OP_HELLO && msg[2] !== OP_STATE)) return empty;
  const view = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const ts = view.getUint32(3, false);
  if (ts < prevLastTs && msg[2] === OP_HELLO) return empty;
  const battery = msg[35] <= 100 ? msg[35] : null;
  if (msg[2] === OP_HELLO) return { ...empty, lastTs: ts, battery, facelets: parseQiyiFacelets(msg) };

  // DCTimer-BLE scans all eleven slots. Slots may be sparse, duplicated or
  // newer than the facelet snapshot, so reverse-array order is not sufficient.
  const candidates = [{ mv: msg[34], ts }];
  for (let i = 0; i < 11; i++) {
    const off = 36 + 5 * i;
    if (off + 5 > msg.length - 2) break;
    candidates.push({ mv: msg[off + 4], ts: view.getUint32(off, false) });
  }
  candidates.sort((a, b) => a.ts - b.ts);
  const seen = new Set<string>();
  const moves: TimedMove[] = [];
  const futureMoves: TimedMove[] = [];
  let lastTs = Math.max(prevLastTs, ts);
  for (const candidate of candidates) {
    if (candidate.ts <= prevLastTs || candidate.mv < 1 || candidate.mv > 12) continue;
    const key = `${candidate.ts}:${candidate.mv}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const axis = QIYI_AXIS_LUT[(candidate.mv - 1) >> 1];
    const mv = formatMove(axis, (candidate.mv & 1) ? 2 : 0);
    if (!mv) continue;
    (candidate.ts > ts ? futureMoves : moves).push({ mv, ts: Math.trunc(candidate.ts / QIYI_TICKS_PER_MS) });
    lastTs = Math.max(lastTs, candidate.ts);
  }
  // Never rewind a snapshot behind future moves already applied last time.
  return { moves, futureMoves, lastTs, battery, facelets: ts >= prevLastTs ? parseQiyiFacelets(msg) : null };
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const qiyiDriver: CubeDriver = {
  brand: 'qiyi' satisfies CubeBrand,
  service: QIYI_SERVICE,
  namePrefixes: ['QY-QYSC', 'XMD-TornadoV4-i'],
  optionalServices: [],
  needsMac: true,
  macAdv: QIYI_MAC_ADV,
  // Gyro capability is detected from valid samples, not the shared QiYi name.

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    return /^(QY-QYSC|XMD-TornadoV4-i)/i.test(n);
  },

  defaultMac(device: BluetoothDevice): string | null {
    return qiyiDefaultMac(device.name);
  },

  async start(server, onMove, ctx?: CubeDriverContext): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(QIYI_SERVICE);
    const cubeChar = await service.getCharacteristic(QIYI_CUBE_CHAR);

    const w = expandKey(QIYI_AES_KEY);
    const decState: DecodeState = { lastTs: 0, battery: null };
    let resetting = false;
    let confirmedState: { facelets: string; timestamp: number } | null = null;
    let pendingStates: Uint8Array[] = [];
    let calibration: ReturnType<typeof createDeviceStateReset> | null = null;
    let writeTail: Promise<void> = Promise.resolve();

    /** Send a host->cube ECB packet on the cube characteristic. */
    const send = async (content: ReadonlyArray<number>, beginConfirmation?: () => boolean): Promise<void> => {
      const enc = buildPacket(content, w);
      // Allocate a fresh ArrayBuffer to satisfy strict TS BufferSource typing.
      const ab = new ArrayBuffer(enc.length);
      new Uint8Array(ab).set(enc);
      const task = writeTail.then(() => {
        if (beginConfirmation && !beginConfirmation()) return;
        return writeGattValue(cubeChar, ab);
      });
      writeTail = task.catch(() => {});
      await task;
    };

    const applyState = (msg: Uint8Array) => {
      const parsed = parseStateMoves(msg, decState.lastTs);
      decState.lastTs = parsed.lastTs;
      if (parsed.battery !== null) decState.battery = parsed.battery;
      // Moves first, state second. The host fires "the cube is solved" off the
      // move that solved it; handing it the finished state first would make
      // that edge look like it had already happened and swallow the auto-stop.
      for (const mv of parsed.moves) onMove(mv.mv, mv.ts);
      if (parsed.facelets) ctx?.onState?.(parsed.facelets);
      for (const mv of parsed.futureMoves) onMove(mv.mv, mv.ts, { futureHistory: true });
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv || dv.byteLength === 0 || (dv.byteLength % 16) !== 0) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const pt = aesEcbDecrypt(ct, w);
      if (pt[0] === 0xcc && pt[1] === 0x10) {
        const quaternion = parseQiyiQuaternion(pt);
        if (quaternion) ctx?.onGyro?.(quaternion);
        // Gyro frames have neither ACK nor moves, facelets, battery or move clock.
        return;
      }
      if (pt[0] !== QIYI_MAGIC) return;
      const len = pt[1];
      if (len < 4 || len > pt.length) return;
      const msg = pt.subarray(0, len);
      if (crc16Modbus(msg) !== 0) return; // CRC is over msg incl. trailing CRC = 0

      // Ack opcode + 4 ts bytes for state and hello frames, mirroring cstimer.
      const opcode = msg[2];
      if (opcode === OP_SYNC) {
        if (calibration?.waiting && msg.length >= 38) {
          const facelets = parseQiyiFacelets(msg);
          if (facelets === SOLVED_STATE) {
            confirmedState = { facelets, timestamp: new DataView(msg.buffer, msg.byteOffset, msg.byteLength).getUint32(3, false) };
            calibration.observe(facelets);
          }
        }
        return;
      }
      if (opcode === OP_HELLO || opcode === OP_STATE) {
        // Fire-and-forget; failures shouldn't lose moves we already parsed.
        void send(Array.from(msg.subarray(2, 7))).catch(() => {});
      }

      if (resetting) {
        if (pendingStates.length >= 128) calibration?.cancel(new Error('Too many states during calibration'));
        else pendingStates.push(msg.slice());
        return;
      }
      applyState(msg);
    };

    cubeChar.addEventListener('characteristicvaluechanged', onChar);
    try {
      await cubeChar.startNotifications();

      // The connector resolves advertisement / saved / name-derived / manual
      // MAC sources before start(). A missing or malformed address cannot yield
      // a working QiYi session because the cube validates it in this hello.
      const mac = normalizeMac(ctx?.mac);
      if (!mac) throw new Error('QiYi cube: MAC required');
      const macBytes = macStringToBytes(mac);
      const helloContent: number[] = [
        0x00, 0x6b, 0x01, 0x00, 0x00, 0x22, 0x06, 0x00, 0x02, 0x08, 0x00,
      ];
      // cstimer sends MAC bytes in reverse (low byte first).
      for (let i = 5; i >= 0; i--) helloContent.push(macBytes[i]);
      // A rejected hello means the cube cannot stream; propagate the failure so
      // callers do not present a false connected state.
      await send(helloContent);
    } catch (error) {
      cubeChar.removeEventListener('characteristicvaluechanged', onChar);
      try { await cubeChar.stopNotifications(); } catch { /* Best-effort rollback. */ }
      throw error;
    }

    const resetContent = [0x04, 0x17, 0x88, 0x8b, 0x31];
    for (let i = 0; i < 54; i += 2) {
      resetContent.push('LRDUFB'.indexOf(SOLVED_STATE[i]) | ('LRDUFB'.indexOf(SOLVED_STATE[i + 1]) << 4));
    }
    resetContent.push(0, 0);
    calibration = createDeviceStateReset({
      automaticReply: true,
      sendReset: begin => send(resetContent, begin),
      prepareSnapshot() {},
      requestSnapshot: async () => {},
    });
    const resetDeviceState = async () => {
      if (resetting) throw new Error('Device calibration already in progress');
      resetting = true;
      confirmedState = null;
      pendingStates = [];
      try {
        await calibration!.run();
        const snapshot = confirmedState as { facelets: string; timestamp: number } | null;
        if (!snapshot) throw new Error('Missing confirmed cube state');
        decState.lastTs = snapshot.timestamp;
        ctx?.onState?.(snapshot.facelets);
      } finally {
        resetting = false;
        if (!cleaned) for (const msg of pendingStates) applyState(msg);
        pendingStates = [];
      }
    };

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      calibration?.dispose();
      cubeChar.removeEventListener('characteristicvaluechanged', onChar);
      void cubeChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => decState.battery;

    return { battery, cleanup, resetDeviceState };
  },
};
