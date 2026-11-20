import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR, GAN_TIMER_NAME_PREFIXES, parseGanTimerFrame } from '@cuberoot/shared/timer/external/gan';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_READ_CHAR, QIYI_TIMER_WRITE_CHAR, QIYI_TIMER_NAME_PREFIXES, createQiyiTimerReassembler, parseQiyiTimerFrame, decodeQiyiTimerPayload, encodeQiyiTimerPackets, buildQiyiHelloContent } from '@cuberoot/shared/timer/external/qiyi';
import { qiyiTimerMacFromName } from '@cuberoot/shared/timer/external/qiyi-mac';
import type { ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import { BLUETOOTH_TIMER_DIALOG_COPY } from '@cuberoot/shared/timer/device-contract';
import { matchesGanV3Name } from '@cuberoot/shared/smart-cube/gan-v3';
import { matchesGanV4Name } from '@cuberoot/shared/smart-cube/gan-v4';
import { connectEncryptedBle, extractBleMacFromAdvertisement, normalizeBleMac } from '../smart-cube/encrypted-ble';
import type { BleAbortSignal, MiniProgramBleApi, DiscoveredDevice } from '../smart-cube/ble-api';
import { discoverBleCandidates } from '../smart-cube/discover-driver';
import { tr } from '../i18n';

type NativeBluetoothTimerKind = 'gan-timer' | 'qiyi-timer';

export interface NativeBluetoothTimerCandidate {
  device: DiscoveredDevice;
  driver: NativeBluetoothTimerKind;
  name: string;
}

const timerNamePrefixes = {
  'gan-timer': GAN_TIMER_NAME_PREFIXES,
  'qiyi-timer': QIYI_TIMER_NAME_PREFIXES,
};

function matchingTimerName(device: DiscoveredDevice, kind: NativeBluetoothTimerKind): string | undefined {
  return [device.name, device.localName].find(name =>
    timerNamePrefixes[kind].some(prefix => name?.toLowerCase().startsWith(prefix.toLowerCase())));
}

export function resolveNativeQiyiTimerMac(device: DiscoveredDevice): string | null {
  return extractBleMacFromAdvertisement(device.advertisData, { companyIds: [0x0504], layout: 'first6-reversed' })
    ?? normalizeBleMac(device.deviceId)
    ?? qiyiTimerMacFromName(matchingTimerName(device, 'qiyi-timer'));
}

export function discoverNativeTimers(options: {
  api?: MiniProgramBleApi;
  signal: AbortSignal;
  onUpdate(devices: NativeBluetoothTimerCandidate[]): void;
}) {
  const signal = options.signal;
  return discoverBleCandidates({
    api: options.api,
    signal: {
      get aborted() { return signal.aborted; },
      onAbort(callback) {
        if (signal.aborted) callback();
        else signal.addEventListener('abort', callback, { once: true });
        return () => signal.removeEventListener('abort', callback);
      },
    },
    scanTimeoutMs: 8_500,
    waitForSelection: true,
    classify(device): NativeBluetoothTimerKind | null {
      if (device.connectable === false) return null;
      if (matchingTimerName(device, 'qiyi-timer')) return 'qiyi-timer';
      if ([device.name, device.localName].some(name => matchesGanV3Name(name) || matchesGanV4Name(name))) return null;
      if (matchingTimerName(device, 'gan-timer')) return 'gan-timer';
      return null;
    },
    onUpdate: devices => options.onUpdate(devices.map(({ device, driver }) => ({
      device, driver, name: matchingTimerName(device, driver) ?? device.deviceId,
    }))),
    notFound: tr(BLUETOOTH_TIMER_DIALOG_COPY.notFound),
    scanFailed: tr({ en: 'Unable to search for nearby timers', zh: '无法搜索附近的计时器' }),
  });
}

export async function connectNativeTimer(kind: NativeBluetoothTimerKind, options: {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  mac?: string;
  signal?: BleAbortSignal;
  onEvent(event: ExternalTimerEvent): void;
  onDisconnect(): void;
}) {
  if (kind === 'gan-timer') return connectEncryptedBle({
    ...options, diagnosticLabel: kind, serviceUuid: GAN_TIMER_SERVICE,
    characteristicUuid: GAN_TIMER_STATE_CHAR, readOnly: true,
    matches: device => Boolean(matchingTimerName(device, kind)),
    onFrame(frame) {
      const event = parseGanTimerFrame(new DataView(frame.buffer, frame.byteOffset, frame.byteLength));
      if (event) options.onEvent(event);
    },
  });
  const assembler = createQiyiTimerReassembler();
  let writes = Promise.resolve();
  let protocolReady = false;
  return connectEncryptedBle({
    ...options, diagnosticLabel: kind, serviceUuid: QIYI_TIMER_SERVICE,
    characteristicUuid: QIYI_TIMER_READ_CHAR, writeCharacteristicUuid: QIYI_TIMER_WRITE_CHAR,
    matches: device => Boolean(matchingTimerName(device, kind)),
    resolveMac(device) {
      const value = normalizeBleMac(options.mac) ?? resolveNativeQiyiTimerMac(device);
      return value ? { source: 'timer-address', value } : null;
    },
    readyTimeoutMs: 5000,
    isReadyFrame: () => protocolReady,
    initialFrames(mac) {
      const hello = buildQiyiHelloContent(Array.from(mac, n => n.toString(16).padStart(2, '0')).join(':'));
      if (!hello) throw new Error('QIYI_TIMER_MAC_UNAVAILABLE');
      return encodeQiyiTimerPackets(1, 0, 1, hello);
    },
    onFrame(packet, write) {
      const message = assembler.push(packet);
      const frame = message ? parseQiyiTimerFrame(message) : null;
      if (!frame) return;
      protocolReady = true;
      if (frame.cmd !== 0x1003) return;
      const decoded = decodeQiyiTimerPayload(frame.data);
      if (!decoded) return;
      if (decoded.needsAck) {
        const packets = encodeQiyiTimerPackets((frame.ackSN + 1) >>> 0, frame.sendSN, 0x1003, [0]);
        writes = writes.then(async () => { for (const packet of packets) await write(packet); })
          .catch(() => options.onDisconnect());
      }
      options.onEvent(decoded.event);
    },
  });
}
