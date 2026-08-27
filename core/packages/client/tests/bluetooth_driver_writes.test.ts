import { describe, expect, it, vi } from 'vitest';
import {
  GIIKER_COMMAND_BATTERY,
  GIIKER_DATA_SERVICE_UUID,
  GIIKER_NOTIFY_CHARACTERISTIC_UUID,
  GIIKER_READ_CHARACTERISTIC_UUID,
  GIIKER_RW_SERVICE_UUID,
  GIIKER_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/giiker';
import { giikerDriver } from '@/app/[lang]/timer/_lib/bluetooth/giiker';
import { moyu32Driver } from '@/app/[lang]/timer/_lib/bluetooth/moyu32';
import {
  qiyiDefaultMac,
  qiyiDriver,
} from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import { makeFakeGatt } from '@/tests/_fake_gatt';

const QIYI_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const QIYI_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';

const MOYU32_SERVICE = '0783b03e-7735-b5a0-1760-a305d2795cb0';
const MOYU32_NOTIFY_CHAR = '0783b03e-7735-b5a0-1760-a305d2795cb1';
const MOYU32_COMMAND_CHAR = '0783b03e-7735-b5a0-1760-a305d2795cb2';

describe('smart-cube GATT write compatibility', () => {
  it('marks QiYi as MAC-keyed and derives its documented name fallback', () => {
    expect(qiyiDriver.needsMac).toBe(true);
    expect(qiyiDefaultMac('QY-QYSC-2-A1B2')).toBe('CC:A3:00:00:A1:B2');
    expect(qiyiDefaultMac('XMD-TornadoV4-i-3-01ab')).toBe('CC:A3:00:00:01:AB');
    expect(qiyiDefaultMac('QY-QYSC-invalid')).toBeNull();
  });

  it('uses the resolved QiYi MAC in the hello and the legacy-compatible write first', async () => {
    const first = makeFakeGatt('QY-QYSC-2-A1B2', { [QIYI_SERVICE]: [QIYI_CHAR] });
    const second = makeFakeGatt('QY-QYSC-2-A1B2', { [QIYI_SERVICE]: [QIYI_CHAR] });

    const firstSession = await qiyiDriver.start(first.asServer, () => {}, {
      mac: 'CC:A3:00:00:12:34',
    });
    const secondSession = await qiyiDriver.start(second.asServer, () => {}, {
      mac: 'CC:A3:00:00:56:78',
    });

    expect(first.writes).toHaveLength(1);
    expect(second.writes).toHaveLength(1);
    expect(first.writes[0].kind).toBe('plain');
    expect(second.writes[0].kind).toBe('plain');
    expect(first.writes[0].bytes).not.toEqual(second.writes[0].bytes);

    firstSession.cleanup();
    secondSession.cleanup();
  });

  it('propagates a rejected QiYi hello and rolls back its subscription', async () => {
    const gatt = makeFakeGatt('QY-QYSC-2-A1B2', { [QIYI_SERVICE]: [QIYI_CHAR] });
    const characteristic = gatt.char(QIYI_SERVICE, QIYI_CHAR);
    characteristic.failWrites = true;
    const removeListener = vi.spyOn(characteristic, 'removeEventListener');
    const stopNotifications = vi.spyOn(characteristic, 'stopNotifications');

    await expect(qiyiDriver.start(gatt.asServer, () => {}, {
      mac: 'CC:A3:00:00:A1:B2',
    })).rejects.toThrow('fake write failure');

    expect(removeListener).toHaveBeenCalledWith(
      'characteristicvaluechanged',
      expect.any(Function),
    );
    expect(stopNotifications).toHaveBeenCalledOnce();
    expect(characteristic.notifying).toBe(false);
  });

  it('uses the shared legacy-first writer for Giiker battery requests', async () => {
    const gatt = makeFakeGatt('GiCube', {
      [GIIKER_DATA_SERVICE_UUID]: [GIIKER_NOTIFY_CHARACTERISTIC_UUID],
      [GIIKER_RW_SERVICE_UUID]: [
        GIIKER_READ_CHARACTERISTIC_UUID,
        GIIKER_WRITE_CHARACTERISTIC_UUID,
      ],
    });
    const session = await giikerDriver.start(gatt.asServer, () => {});
    const batteryPromise = session.battery();

    await vi.waitFor(() => expect(gatt.writes).toHaveLength(1));
    gatt.char(GIIKER_RW_SERVICE_UUID, GIIKER_READ_CHARACTERISTIC_UUID).emit([0, 73]);

    await expect(batteryPromise).resolves.toBe(73);
    expect(gatt.writes[0]).toEqual({
      uuid: GIIKER_WRITE_CHARACTERISTIC_UUID,
      kind: 'plain',
      bytes: [GIIKER_COMMAND_BATTERY],
    });
    session.cleanup();
  });

  it('uses the shared legacy-first writer for MoYu32 commands and gyro switching', async () => {
    const gatt = makeFakeGatt('WCU_MY32_A1B2', {
      [MOYU32_SERVICE]: [MOYU32_NOTIFY_CHAR, MOYU32_COMMAND_CHAR],
    });
    const session = await moyu32Driver.start(gatt.asServer, () => {}, {
      mac: 'CF:30:16:00:A1:B2',
    });

    expect(gatt.writes).toHaveLength(3);
    await session.setGyro?.(true);
    expect(gatt.writes).toHaveLength(4);
    expect(gatt.writes.every((write) => write.kind === 'plain')).toBe(true);
    session.cleanup();
  });

});
