/**
 * QiYi Timer / QiYi Adapter driver.
 *
 * Protocol reference: csTimer `src/js/hardware/qiyitimer.js`. Faithful port;
 * every deviation is called out in a comment.
 *
 * Wire summary
 * ------------
 *   Service:        0000fd50-0000-1000-8000-00805f9b34fb
 *   Write char:     00000001-0000-1001-8001-00805f9b07d0
 *   Read  char:     00000002-0000-1001-8001-00805f9b07d0   (notify)
 *
 * Everything is AES-128-**ECB** with a FIXED key of sixteen 0x77 bytes. Unlike
 * the GAN/MoYu/QiYi *cube* drivers there is no MAC-derived key — the MAC is
 * only a payload field inside the hello message (see `sendHello`).
 *
 * Message layout (plaintext, before block-splitting):
 *
 *   offset  size  field
 *   ------  ----  ---------------------------------------------------------
 *     0      4    sendSN   (big-endian u32)
 *     4      4    ackSN    (big-endian u32)
 *     8      2    cmd      (big-endian u16)
 *    10      2    len      (big-endian u16 — length of `data`)
 *    12    len    data
 *  12+len    2    CRC-16/MODBUS of everything above, appended BIG-endian
 *                 (crc>>8 then crc&0xff)
 *
 * Note the CRC byte order: it is stored big-endian, but MODBUS's self-checking
 * property (residue 0) needs it little-endian, so the verifier feeds the two
 * bytes back SWAPPED — `qiyitimer.js:128` does exactly that.
 *
 * Transport framing (message -> BLE packets):
 *   The message is cut into 16-byte blocks, the last one padded with 0x01, and
 *   each block is ECB-encrypted independently. The first BLE packet is
 *   prefixed with `[0x00, msgLen + 2, 0x40, 0x00]`, every later packet with the
 *   single byte `[i >> 4]` where `i` is the block's byte offset (so 1, 2, 3…).
 *   Receiving is the exact inverse; `msg[1] - 2` recovers the message length.
 *
 * Payloads we care about — only `cmd === 0x1003`:
 *
 *   data[0] = dpId, data[1] = dpType, data[2..3] = dpLen (big-endian)
 *
 *   dpId 1 / dpType 1  — a recorded result. MUST be acknowledged, or the timer
 *                        keeps resending it.
 *       data[8..11]   solveTime   (big-endian u32, ms)
 *       data[12..15]  inspectTime (big-endian u32, ms)
 *
 *   dpId 4 / dpType 4  — a state change. No ack.
 *       data[4]       index into QIYI_TIMER_STATES
 *       data[5..8]    solveTime   (big-endian u32, ms — the live reading)
 */

import { aesEcbDecrypt, aesEcbEncrypt, expandKey, type AesRoundKeys } from './aes128';
import { crc16Modbus } from './crc';
import type { BluetoothTimerDriver, BluetoothTimerStartResult } from './driver';
import { timerMacToBytes } from './mac';
import { QIYI_TIMER_CIC_LIST } from './mac';
import type { ExternalTimerEvent, ExternalTimerState } from './types';

export const QIYI_TIMER_SERVICE = '0000fd50-0000-1000-8000-00805f9b34fb';
const UUID_SUFFIX = '-0000-1001-8001-00805f9b07d0';
export const QIYI_TIMER_WRITE_CHAR = `00000001${UUID_SUFFIX}`;
export const QIYI_TIMER_READ_CHAR = `00000002${UUID_SUFFIX}`;

/** Name prefixes csTimer registers for QiYi timers (qiyitimer.js:241). */
export const QIYI_TIMER_NAME_PREFIXES = ['QY-Timer', 'QY-Adapter'] as const;

/** The one and only key: sixteen 0x77 bytes (`$.aes128(Array(16).fill(0x77))`). */
export const QIYI_TIMER_KEY: Uint8Array = new Uint8Array(16).fill(0x77);

/** State table indexed by `data[4]` of a dpId=4 frame. Order is load-bearing. */
export const QIYI_TIMER_STATES: readonly ExternalTimerState[] = [
  'IDLE',
  'INSPECTION',
  'GET_SET',
  'RUNNING',
  'FINISHED',
  'STOPPED',
  'DISCONNECT',
];

const QIYI_CMD_DATA = 0x1003;
/** sendSN(4) + ackSN(4) + cmd(2) + len(2) */
const HEADER_LEN = 12;
const CRC_LEN = 2;
/** Pad byte csTimer uses to fill the last 16-byte block. */
const PAD_BYTE = 0x01;
/** Max plausible reassembled message; guards a corrupt length byte. */
const MAX_MESSAGE_LEN = 1024;

/** Cached key schedule — the key is a compile-time constant. */
let cachedRoundKeys: AesRoundKeys | null = null;
export function qiyiTimerRoundKeys(): AesRoundKeys {
  cachedRoundKeys ??= expandKey(QIYI_TIMER_KEY);
  return cachedRoundKeys;
}

/* ------------------------------------------------------------------ */
/*  Encode                                                             */
/* ------------------------------------------------------------------ */

/** Build the plaintext message (header + data + CRC), before block-splitting. */
export function buildQiyiTimerMessage(
  sendSN: number,
  ackSN: number,
  cmd: number,
  data: ArrayLike<number>,
): Uint8Array {
  const len = data.length;
  const msg = new Uint8Array(HEADER_LEN + len + CRC_LEN);
  msg[0] = (sendSN >>> 24) & 0xff;
  msg[1] = (sendSN >>> 16) & 0xff;
  msg[2] = (sendSN >>> 8) & 0xff;
  msg[3] = sendSN & 0xff;
  msg[4] = (ackSN >>> 24) & 0xff;
  msg[5] = (ackSN >>> 16) & 0xff;
  msg[6] = (ackSN >>> 8) & 0xff;
  msg[7] = ackSN & 0xff;
  msg[8] = (cmd >>> 8) & 0xff;
  msg[9] = cmd & 0xff;
  msg[10] = (len >>> 8) & 0xff;
  msg[11] = len & 0xff;
  for (let i = 0; i < len; i++) msg[HEADER_LEN + i] = data[i] & 0xff;
  const crc = crc16Modbus(msg.subarray(0, HEADER_LEN + len));
  // Big-endian on the wire — see the header note.
  msg[HEADER_LEN + len] = (crc >>> 8) & 0xff;
  msg[HEADER_LEN + len + 1] = crc & 0xff;
  return msg;
}

/**
 * Encrypt + frame a message into the sequence of BLE packets to write, in
 * order. Each packet must be written as a separate GATT write.
 */
export function encodeQiyiTimerPackets(
  sendSN: number,
  ackSN: number,
  cmd: number,
  data: ArrayLike<number>,
  roundKeys: AesRoundKeys = qiyiTimerRoundKeys(),
): Uint8Array[] {
  const msg = buildQiyiTimerMessage(sendSN, ackSN, cmd, data);
  const packets: Uint8Array[] = [];
  for (let i = 0; i < msg.length; i += 16) {
    const block = new Uint8Array(16).fill(PAD_BYTE);
    block.set(msg.subarray(i, Math.min(i + 16, msg.length)), 0);
    const enc = aesEcbEncrypt(block, roundKeys);
    if (i === 0) {
      const pkt = new Uint8Array(4 + 16);
      // msg.length + 2 is what the receiver subtracts 2 from; the two cancel.
      pkt.set([0x00, (msg.length + 2) & 0xff, 0x40, 0x00], 0);
      pkt.set(enc, 4);
      packets.push(pkt);
    } else {
      const pkt = new Uint8Array(1 + 16);
      pkt[0] = i >> 4;
      pkt.set(enc, 1);
      packets.push(pkt);
    }
  }
  return packets;
}

/** Hello payload: 11 fixed bytes then the 6 MAC bytes in REVERSE order. */
export function buildQiyiHelloContent(mac: string): number[] | null {
  const bytes = timerMacToBytes(mac);
  if (!bytes) return null;
  const content = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90];
  for (let i = 5; i >= 0; i--) content.push(bytes[i]);
  return content;
}

/* ------------------------------------------------------------------ */
/*  Decode                                                             */
/* ------------------------------------------------------------------ */

export interface QiyiTimerReassembler {
  /**
   * Feed one BLE notification. Returns the complete plaintext message once
   * the last fragment arrives, otherwise null (still collecting, or the
   * fragment was out of sequence and the buffer was reset).
   */
  push(packet: Uint8Array): Uint8Array | null;
  reset(): void;
}

/**
 * Inverse of `encodeQiyiTimerPackets`. Stateful: one instance per connection.
 * Mirrors `qiyitimer.js:88-124`, plus length sanity checks csTimer omits.
 */
export function createQiyiTimerReassembler(
  roundKeys: AesRoundKeys = qiyiTimerRoundKeys(),
): QiyiTimerReassembler {
  let waitPkg = 0;
  let payloadLen = 0;
  let payload: number[] = [];

  const reset = (): void => { waitPkg = 0; payload = []; };

  return {
    reset,
    push(packet: Uint8Array): Uint8Array | null {
      if (packet.length === 0) return null;
      if (packet[0] !== waitPkg) {
        // Out of sequence: drop what we have. Only a fresh first fragment
        // (index 0) can restart the assembly.
        reset();
        if (packet[0] !== 0) return null;
      }

      let body: Uint8Array;
      if (packet[0] === 0) {
        if (packet.length < 4) { reset(); return null; }
        payloadLen = packet[1] - 2;
        if (payloadLen < HEADER_LEN + CRC_LEN || payloadLen > MAX_MESSAGE_LEN) {
          reset();
          return null;
        }
        body = packet.subarray(4);
      } else {
        body = packet.subarray(1);
      }

      // Every fragment must carry whole 16-byte blocks; a partial tail means a
      // truncated notification, so throw the whole message away.
      if (body.length === 0 || body.length % 16 !== 0) { reset(); return null; }
      for (let i = 0; i < body.length; i += 16) {
        const plain = aesEcbDecrypt(body.subarray(i, i + 16), roundKeys);
        for (let j = 0; j < 16; j++) payload.push(plain[j]);
      }

      if (payload.length < payloadLen) {
        waitPkg++;
        return null;
      }
      const out = Uint8Array.from(payload.slice(0, payloadLen));
      reset();
      return out;
    },
  };
}

export interface QiyiTimerFrame {
  sendSN: number;
  ackSN: number;
  cmd: number;
  data: Uint8Array;
}

function be32(b: Uint8Array, off: number): number {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

/** Split + CRC-check a reassembled plaintext message. Null when malformed. */
export function parseQiyiTimerFrame(msg: Uint8Array): QiyiTimerFrame | null {
  if (msg.length < HEADER_LEN + CRC_LEN) return null;
  const len = (msg[10] << 8) | msg[11];
  if (msg.length < HEADER_LEN + len + CRC_LEN) return null;

  // MODBUS residue check: header + data + CRC-with-bytes-swapped == 0.
  const check = new Uint8Array(HEADER_LEN + len + CRC_LEN);
  check.set(msg.subarray(0, HEADER_LEN + len), 0);
  check[HEADER_LEN + len] = msg[HEADER_LEN + len + 1];
  check[HEADER_LEN + len + 1] = msg[HEADER_LEN + len];
  if (crc16Modbus(check) !== 0) return null;

  return {
    sendSN: be32(msg, 0),
    ackSN: be32(msg, 4),
    cmd: (msg[8] << 8) | msg[9],
    data: msg.slice(HEADER_LEN, HEADER_LEN + len),
  };
}

export interface QiyiTimerDecoded {
  event: ExternalTimerEvent;
  /** True for result frames: the timer resends until acknowledged. */
  needsAck: boolean;
}

/**
 * Turn a `cmd === 0x1003` payload into an event. Returns null for datapoints
 * we don't handle (csTimer logs "unknown data" for those and moves on).
 */
export function decodeQiyiTimerPayload(data: Uint8Array): QiyiTimerDecoded | null {
  if (data.length < 2) return null;
  const dpId = data[0];
  const dpType = data[1];

  if (dpId === 1 && dpType === 1) {
    if (data.length < 16) return null;
    return {
      event: {
        state: 'STOPPED',
        solveTime: be32(data, 8),
        inspectTime: be32(data, 12),
      },
      needsAck: true,
    };
  }

  if (dpId === 4 && dpType === 4) {
    if (data.length < 9) return null;
    const state = QIYI_TIMER_STATES[data[4]];
    if (state === undefined) return null;
    return { event: { state, solveTime: be32(data, 5) }, needsAck: false };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Driver                                                             */
/* ------------------------------------------------------------------ */

function toUuid128(uuid: string): string {
  return (/^[0-9a-f]{4}$/i.test(uuid) ? `0000${uuid}-0000-1000-8000-00805f9b34fb` : uuid)
    .toLowerCase();
}

async function findCharacteristic(
  service: BluetoothRemoteGATTService,
  uuid: string,
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  const want = toUuid128(uuid);
  try {
    const all = await service.getCharacteristics();
    const hit = all.find((c) => toUuid128(c.uuid) === want);
    if (hit) return hit;
  } catch {
    // Some browsers refuse bulk enumeration; fall through to a direct get.
  }
  try {
    return await service.getCharacteristic(uuid);
  } catch {
    return null;
  }
}

export const qiyiTimerDriver: BluetoothTimerDriver = {
  kind: 'qiyi-timer',
  service: QIYI_TIMER_SERVICE,
  namePrefixes: QIYI_TIMER_NAME_PREFIXES,
  manufacturerDataCics: QIYI_TIMER_CIC_LIST,
  needsMac: true,

  matches(device: BluetoothDevice): boolean {
    return /^QY-(Timer|Adapter)/i.test((device.name ?? '').trim());
  },

  async start(server, emit, ctx): Promise<BluetoothTimerStartResult> {
    const service = await server.getPrimaryService(QIYI_TIMER_SERVICE);
    const writeChar = await findCharacteristic(service, QIYI_TIMER_WRITE_CHAR);
    const readChar = await findCharacteristic(service, QIYI_TIMER_READ_CHAR);
    if (!writeChar || !readChar) {
      throw new Error('QiYi timer: required characteristics not found');
    }

    const roundKeys = qiyiTimerRoundKeys();
    const reassembler = createQiyiTimerReassembler(roundKeys);
    let closed = false;

    /**
     * Writes are serialised: the device reassembles by fragment index, so two
     * interleaved messages would corrupt each other. csTimer chains the same
     * way. We use plain `writeValue` (rather than the explicit
     * with/without-response variants the cube drivers prefer) because that is
     * what csTimer does and it lets the browser pick whichever mode the
     * characteristic actually supports.
     */
    let writeChain: Promise<void> = Promise.resolve();
    const send = (sendSN: number, ackSN: number, cmd: number, data: ArrayLike<number>): Promise<void> => {
      const packets = encodeQiyiTimerPackets(sendSN, ackSN, cmd, data, roundKeys);
      writeChain = writeChain.then(async () => {
        for (const pkt of packets) {
          if (closed) return;
          const ab = new ArrayBuffer(pkt.length);
          new Uint8Array(ab).set(pkt);
          await writeChar.writeValue(ab);
        }
      }).catch(() => {
        // A failed write must not poison the chain for later messages.
      });
      return writeChain;
    };

    const onChar = (ev: Event): void => {
      const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!dv || dv.byteLength === 0) return;
      const packet = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const msg = reassembler.push(packet);
      if (!msg) return;
      const frame = parseQiyiTimerFrame(msg);
      if (!frame || frame.cmd !== QIYI_CMD_DATA) return;
      const decoded = decodeQiyiTimerPayload(frame.data);
      if (!decoded) return;
      if (decoded.needsAck) {
        // csTimer: sendAck(ackSN + 1, sendSN, 0x1003) with a single 0x00 byte.
        void send((frame.ackSN + 1) >>> 0, frame.sendSN, QIYI_CMD_DATA, [0x00]);
      }
      emit(decoded.event);
    };

    readChar.addEventListener('characteristicvaluechanged', onChar);
    await readChar.startNotifications();

    // Hello. Without a matching MAC the timer stays silent, but we still
    // subscribe so a user-supplied MAC can be retried on the open connection.
    const hello = ctx?.mac ? buildQiyiHelloContent(ctx.mac) : null;
    if (hello) {
      try {
        await send(1, 0, 1, hello);
      } catch {
        // Non-fatal: surfaced to the user as "no events arriving".
      }
    }

    return {
      cleanup(): void {
        if (closed) return;
        closed = true;
        readChar.removeEventListener('characteristicvaluechanged', onChar);
        void readChar.stopNotifications().catch(() => {});
      },
    };
  },
};
