export * from '@cuberoot/shared/timer/external/qiyi';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_WRITE_CHAR, QIYI_TIMER_READ_CHAR, QIYI_TIMER_NAME_PREFIXES, qiyiTimerRoundKeys, encodeQiyiTimerPackets, buildQiyiHelloContent, createQiyiTimerReassembler, parseQiyiTimerFrame, decodeQiyiTimerPayload } from '@cuberoot/shared/timer/external/qiyi';
import type { BluetoothTimerDriver, BluetoothTimerStartResult } from './driver';
import { writeGattValue } from '../driver';
import { QIYI_CIC_LIST } from '../mac';
const QIYI_CMD_DATA = 0x1003;
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
  manufacturerDataCics: QIYI_CIC_LIST,
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
      const queued = writeChain.then(async () => {
        for (const pkt of packets) {
          if (closed) return;
          const ab = new ArrayBuffer(pkt.length);
          new Uint8Array(ab).set(pkt);
          await writeGattValue(writeChar, ab);
        }
      });
      // Keep later messages usable, but return this message's real outcome to
      // the caller. In particular, a failed hello must not become a false
      // "connected" state with a timer that can never emit notifications.
      writeChain = queued.catch(() => {});
      return queued;
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
        void send((frame.ackSN + 1) >>> 0, frame.sendSN, QIYI_CMD_DATA, [0x00]).catch(() => {});
      }
      emit(decoded.event);
    };

    readChar.addEventListener('characteristicvaluechanged', onChar);
    await readChar.startNotifications();

    // Hello. Without a matching MAC the timer stays silent, but we still
    // subscribe so a user-supplied MAC can be retried on the open connection.
    const hello = ctx?.mac ? buildQiyiHelloContent(ctx.mac) : null;
    if (hello) {
      await send(1, 0, 1, hello);
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
