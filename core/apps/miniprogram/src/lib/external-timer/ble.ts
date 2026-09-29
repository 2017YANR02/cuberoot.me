import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR, parseGanTimerFrame } from '@cuberoot/shared/timer/external/gan';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_READ_CHAR, QIYI_TIMER_WRITE_CHAR, createQiyiTimerReassembler, parseQiyiTimerFrame, decodeQiyiTimerPayload, encodeQiyiTimerPackets, buildQiyiHelloContent } from '@cuberoot/shared/timer/external/qiyi';
import { qiyiTimerMacFromName } from '@cuberoot/shared/timer/external/qiyi-mac';
import type { ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import { connectEncryptedBle, extractBleMacFromAdvertisement, normalizeBleMac } from '../smart-cube/encrypted-ble';
import type { BleAbortSignal, MiniProgramBleApi, DiscoveredDevice } from '../smart-cube/ble-api';

export async function connectNativeTimer(kind: 'gan-timer' | 'qiyi-timer', options: {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  signal?: BleAbortSignal;
  onEvent(event: ExternalTimerEvent): void;
  onDisconnect(): void;
}) {
  if (kind === 'gan-timer') return connectEncryptedBle({
    ...options, diagnosticLabel: kind, serviceUuid: GAN_TIMER_SERVICE,
    characteristicUuid: GAN_TIMER_STATE_CHAR, readOnly: true,
    matches: device => /^gan/i.test(device.name || device.localName || ''),
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
    matches: device => /^QY-(Timer|Adapter)/i.test(device.name || device.localName || ''),
    resolveMac(device) {
      const value = extractBleMacFromAdvertisement(device.advertisData, { companyIds: [0x0504], layout: 'first6-reversed' })
        ?? normalizeBleMac(device.deviceId)
        ?? qiyiTimerMacFromName(device.name || device.localName);
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
