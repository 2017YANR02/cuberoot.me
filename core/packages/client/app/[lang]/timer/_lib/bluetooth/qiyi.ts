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
 *   [36..90] history-move slots; current + up to 9 past entries can be read
 *           by walking offset = 91 - 5*i for i = 1..9, each (4 ts, 1 mv)
 *   [L-2..L-1] CRC-16/MODBUS (little-endian) over msg[0..L-2]
 *
 * Move-byte encoding (1..12):
 *   axis = [4,1,3,0,2,5][(mv-1) >> 1]   -> URFDLB index
 *   power = [0, 2][mv & 1]              -> 0 = CW, 2 = CCW (no doubles)
 */

import type { CubeDriver, CubeDriverContext, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';
import { crc16Modbus } from './crc';
import { aesEcbDecrypt, aesEcbEncrypt, expandKey } from './gan_crypto';
import { QIYI_MAC_ADV } from './mac';
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
 * Returns 6 bytes in big-endian MAC order ([0]=high) or null.
 */
function macFromDeviceName(name: string | undefined): Uint8Array | null {
  if (!name) return null;
  const m = /^(?:QY-QYSC|XMD-TornadoV4-i)-.-([0-9A-F]{4})$/i.exec(name.trim());
  if (!m) return null;
  const tail = m[1].toUpperCase();
  return new Uint8Array([0xcc, 0xa3, 0x00, 0x00,
    parseInt(tail.slice(0, 2), 16),
    parseInt(tail.slice(2, 4), 16)]);
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
 * Parse a fully-decrypted, length-trimmed, CRC-validated frame.
 * Returns moves in chronological order (oldest first) plus the new lastTs.
 */
function parseStateMoves(msg: Uint8Array, prevLastTs: number):
    { moves: string[]; lastTs: number; battery: number | null; facelets: string | null } {
  const opcode = msg[2];
  const ts = ((msg[3] << 24) | (msg[4] << 16) | (msg[5] << 8) | msg[6]) >>> 0;
  if (opcode === OP_HELLO) {
    // Hello carries the cube's own facelets — the state it is in right now,
    // which is very often NOT solved (the user scrambled before connecting).
    // Reporting it is what stops the host from assuming a solved cube.
    const battery = msg.length > 35 ? msg[35] : null;
    return {
      moves: [],
      lastTs: ts,
      battery: battery !== null && battery <= 100 ? battery : null,
      facelets: parseQiyiFacelets(msg),
    };
  }
  if (opcode !== OP_STATE) {
    return { moves: [], lastTs: prevLastTs, battery: null, facelets: null };
  }

  // todoMoves: newest first. Index 0 is the just-happened move.
  const todo: Array<{ mv: number; ts: number }> = [];
  if (msg.length > 34) {
    todo.push({ mv: msg[34], ts });
  }
  // History: walk back through up to 9 historical entries while their
  // timestamps are strictly newer than what we last saw.
  for (let i = 1; i < 10; i++) {
    const off = 91 - 5 * i;
    if (off + 4 >= msg.length) break;
    const hisTs = ((msg[off] << 24) | (msg[off + 1] << 16) | (msg[off + 2] << 8) | msg[off + 3]) >>> 0;
    const hisMv = msg[off + 4];
    if (hisTs <= prevLastTs || hisMv === 0) break;
    todo.push({ mv: hisMv, ts: hisTs });
  }

  // Replay oldest -> newest so the timer sees moves in real order.
  const moves: string[] = [];
  for (let i = todo.length - 1; i >= 0; i--) {
    const mv = todo[i].mv;
    if (mv < 1 || mv > 12) continue;
    const axis = QIYI_AXIS_LUT[(mv - 1) >> 1];
    const power = (mv & 1) !== 0 ? 2 : 0; // cstimer: [0, 2][mv & 1]
    const formatted = formatMove(axis, power);
    if (formatted) moves.push(formatted);
  }

  const battery = msg.length > 35 ? msg[35] : null;
  return {
    moves,
    lastTs: ts,
    battery: battery !== null && battery <= 100 ? battery : null,
    // Every state frame carries the cube's own facelets, taken AFTER the move
    // it reports. cstimer treats this as authoritative whenever it disagrees
    // with the replayed state (`qiyicube.js:210-218`); so do we — reporting it
    // on every frame is what makes a dropped move self-heal on the next turn.
    facelets: parseQiyiFacelets(msg),
  };
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const qiyiDriver: CubeDriver = {
  brand: 'qiyi' satisfies CubeBrand,
  service: QIYI_SERVICE,
  optionalServices: [],
  macAdv: QIYI_MAC_ADV,
  // TODO(gyro): the Tornado V4 does carry an orientation feed, but NOBODY has
  // published its layout — cstimer's `qiyicube.js` decodes only opcodes 0x02
  // (hello) and 0x03 (state change) and has no gyro branch at all, and there
  // is no third-party write-up the way there is for GAN (afedotov) and MoYu32
  // (lukeburong). Guessing a byte layout here would produce a plausible-
  // looking but wrong quaternion that nobody could falsify without hardware,
  // so `hasGyro` stays unset until someone captures real 0xFF6 traffic.

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    return /^(QY-QYSC|XMD-TornadoV4-i)/i.test(n);
  },

  async start(server, onMove, ctx?: CubeDriverContext): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(QIYI_SERVICE);
    const cubeChar = await service.getCharacteristic(QIYI_CUBE_CHAR);

    const w = expandKey(QIYI_AES_KEY);
    const decState: DecodeState = { lastTs: 0, battery: null };

    /** Send a host->cube ECB packet on the cube characteristic. */
    const send = async (content: ReadonlyArray<number>): Promise<void> => {
      const enc = buildPacket(content, w);
      // Allocate a fresh ArrayBuffer to satisfy strict TS BufferSource typing.
      const ab = new ArrayBuffer(enc.length);
      new Uint8Array(ab).set(enc);
      if (cubeChar.writeValueWithResponse) {
        await cubeChar.writeValueWithResponse(ab);
      } else if (cubeChar.writeValueWithoutResponse) {
        await cubeChar.writeValueWithoutResponse(ab);
      } else {
        await cubeChar.writeValue(ab);
      }
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv || dv.byteLength === 0 || (dv.byteLength % 16) !== 0) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const pt = aesEcbDecrypt(ct, w);
      if (pt[0] !== QIYI_MAGIC) return;
      const len = pt[1];
      if (len < 4 || len > pt.length) return;
      const msg = pt.subarray(0, len);
      if (crc16Modbus(msg) !== 0) return; // CRC is over msg incl. trailing CRC = 0

      // Ack opcode + 4 ts bytes for state and hello frames, mirroring cstimer.
      const opcode = msg[2];
      if (opcode === OP_HELLO || opcode === OP_STATE) {
        // Fire-and-forget; failures shouldn't lose moves we already parsed.
        void send(Array.from(msg.subarray(2, 7)));
      }

      const parsed = parseStateMoves(msg, decState.lastTs);
      decState.lastTs = parsed.lastTs;
      if (parsed.battery !== null) decState.battery = parsed.battery;
      // Moves first, state second. The host fires "the cube is solved" off the
      // move that solved it; handing it the finished state first would make
      // that edge look like it had already happened and swallow the auto-stop.
      for (const mv of parsed.moves) onMove(mv);
      if (parsed.facelets) ctx?.onState?.(parsed.facelets);
    };

    cubeChar.addEventListener('characteristicvaluechanged', onChar);
    await cubeChar.startNotifications();

    // Send initial hello. Without a known MAC the cube ignores it, so try a
    // best-effort name-derived MAC; if that fails, we still subscribe and
    // hope a later ack-loop kicks the cube into streaming.
    const mac = macFromDeviceName(server.device.name);
    if (mac) {
      const helloContent: number[] = [
        0x00, 0x6b, 0x01, 0x00, 0x00, 0x22, 0x06, 0x00, 0x02, 0x08, 0x00,
      ];
      // cstimer sends MAC bytes in reverse (low byte first).
      for (let i = 5; i >= 0; i--) helloContent.push(mac[i]);
      try {
        await send(helloContent);
      } catch {
        // Non-fatal — some firmwares stream after subscribe alone.
      }
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      cubeChar.removeEventListener('characteristicvaluechanged', onChar);
      void cubeChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => decState.battery;

    return { battery, cleanup };
  },
};
