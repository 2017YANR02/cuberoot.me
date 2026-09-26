import {
  buildQiyiPacket,
  createQiyiCipher,
  decodeQiyiNotification,
  matchesQiyiName,
  QIYI_CHARACTERISTIC_UUID,
  QIYI_OP_HELLO,
  QIYI_OP_STATE,
  QIYI_OP_SYNC,
  QIYI_SERVICE_UUID,
  QIYI_SOLVED_STATE,
  qiyiDefaultMac,
} from '@cuberoot/shared/smart-cube/qiyi';
import {
  writeGattValue,
  type CubeDriver,
  type CubeDriverContext,
  type CubeDriverStartResult,
} from './driver';
import type { CubeBrand } from './types';
import { createDeviceStateReset } from './device_reset';
import { QIYI_MAC_ADV, macStringToBytes, normalizeMac } from './mac';

export { qiyiDefaultMac };
/*  Driver implementation                                              */
/* ================================================================== */

export const qiyiDriver: CubeDriver = {
  brand: 'qiyi' satisfies CubeBrand,
  service: QIYI_SERVICE_UUID,
  namePrefixes: ['QY-QYSC', 'XMD-TornadoV4-i'],
  optionalServices: [],
  needsMac: true,
  macAdv: QIYI_MAC_ADV,
  // Gyro capability is detected from valid samples, not the shared QiYi name.

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    return matchesQiyiName(n);
  },

  defaultMac(device: BluetoothDevice): string | null {
    return qiyiDefaultMac(device.name);
  },

  async start(server, onMove, ctx?: CubeDriverContext): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(QIYI_SERVICE_UUID);
    const cubeChar = await service.getCharacteristic(QIYI_CHARACTERISTIC_UUID);

    const cipher = createQiyiCipher();
    const decState: { lastTs: number; battery: number | null } = { lastTs: 0, battery: null };
    let resetting = false;
    let confirmedState: { facelets: string; timestamp: number } | null = null;
    let pendingStates: Uint8Array[] = [];
    let calibration: ReturnType<typeof createDeviceStateReset> | null = null;
    let writeTail: Promise<void> = Promise.resolve();

    /** Send a host->cube ECB packet on the cube characteristic. */
    const send = async (content: ReadonlyArray<number>, beginConfirmation?: () => boolean): Promise<void> => {
      const enc = cipher.encrypt(buildQiyiPacket(content));
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

    const applyState = (parsed: ReturnType<typeof decodeQiyiNotification>) => {
      decState.lastTs = parsed.latestTimestamp ?? decState.lastTs;
      if (parsed.battery !== null) decState.battery = parsed.battery;
      // Moves first, state second. The host fires "the cube is solved" off the
      // move that solved it; handing it the finished state first would make
      // that edge look like it had already happened and swallow the auto-stop.
      for (const mv of parsed.moves) onMove(mv.mv, mv.ts);
      if (parsed.state) ctx?.onState?.(parsed.state);
      for (const mv of parsed.futureMoves) onMove(mv.mv, mv.ts, { futureHistory: true });
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv || dv.byteLength === 0 || (dv.byteLength % 16) !== 0) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const pt = cipher.decrypt(ct);
      const notification = decodeQiyiNotification(pt, decState.lastTs);
      if (notification.gyro) {
        ctx?.onGyro?.(notification.gyro);
        return;
      }
      const msg = pt.subarray(0, pt[1] ?? pt.length);
      if (notification.opcode === QIYI_OP_SYNC) {
        if (calibration?.waiting && notification.state === QIYI_SOLVED_STATE) {
          confirmedState = {
            facelets: notification.state,
            timestamp: notification.timestamp ?? decState.lastTs,
          };
          calibration.observe(notification.state);
        }
        return;
      }
      if (notification.opcode === null) return;

      // Ack opcode + 4 timestamp bytes for state and hello frames, mirroring cstimer.
      if (notification.opcode === QIYI_OP_HELLO || notification.opcode === QIYI_OP_STATE) {
        const timestamp = notification.timestamp;
        if (timestamp !== null) {
          void send(Array.from(pt.subarray(2, 7))).catch(() => {});
        }
      }

      if (resetting) {
        if (pendingStates.length >= 128) calibration?.cancel(new Error('Too many states during calibration'));
        else pendingStates.push(msg.slice());
        return;
      }
      applyState(notification);
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
      resetContent.push('LRDUFB'.indexOf(QIYI_SOLVED_STATE[i]) | ('LRDUFB'.indexOf(QIYI_SOLVED_STATE[i + 1]) << 4));
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
        if (!cleaned) {
          for (const msg of pendingStates) {
            applyState(decodeQiyiNotification(msg, decState.lastTs));
          }
        }
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
