import { qiyiTimerRoundKeys, encodeQiyiTimerPackets, buildQiyiHelloContent, createQiyiTimerReassembler, parseQiyiTimerFrame, decodeQiyiTimerPayload } from './qiyi';
import { parseGanTimerFrame } from './gan';
import type { ExternalTimerEvent } from './types';
/** A protocol session sees characteristic bytes, never platform GATT objects. */
export interface TimerGattIO {
  subscribe(listener: (value: DataView) => void): Promise<() => Promise<void>>;
  write(value: Uint8Array): Promise<void>;
}
export async function startGanTimer(io: TimerGattIO, emit: (event: ExternalTimerEvent) => void) {
  const unsubscribe = await io.subscribe(value => {
    const event = parseGanTimerFrame(value);
    if (event) emit(event);
  });
  return { cleanup() { void unsubscribe().catch(() => {}); } };
}

export async function startQiyiTimer(io: TimerGattIO, emit: (event: ExternalTimerEvent) => void, ctx?: {mac?: string | null}) {
  const QIYI_CMD_DATA = 0x1003;
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
    const queued = writeChain.then(async () => {
      for (const pkt of packets) {
        if (closed) return;
        const ab = new ArrayBuffer(pkt.length);
        new Uint8Array(ab).set(pkt);
        await io.write(new Uint8Array(ab));
      }
    });
    // Keep later messages usable, but return this message's real outcome to
    // the caller. In particular, a failed hello must not become a false
    // "connected" state with a timer that can never emit notifications.
    writeChain = queued.catch(() => {});
    return queued;
  };

  const onChar = (dv: DataView): void => {
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
      void send((frame.ackSN + 1) >>> 0, frame.sendSN, QIYI_CMD_DATA, [0x00]).catch(() => {});
    }
    emit(decoded.event);
  };

  const unsubscribe = await io.subscribe(onChar);

  // The caller resolves the MAC before connecting. Subscribe before hello so
  // its immediate response cannot be lost.
  const hello = ctx?.mac ? buildQiyiHelloContent(ctx.mac) : null;
  try {
    if (!hello) throw new Error('QiYi timer requires a MAC address');
    await send(1, 0, 1, hello);
  } catch (error) {
    closed = true;
    await unsubscribe().catch(() => {});
    throw error;
  }

  return {
    cleanup(): void {
      if (closed) return;
      closed = true;
      void unsubscribe().catch(() => {});
    },
  };
}
