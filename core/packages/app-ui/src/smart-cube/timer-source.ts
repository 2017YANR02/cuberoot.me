import { createExternalTimerBus, type ExternalTimerSource, type ExternalTimerEvent, type ExternalTimerKind, type ExternalTimerState } from '@cuberoot/shared/timer/external/types';
import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR, GAN_TIMER_NAME_PREFIXES } from '@cuberoot/shared/timer/external/gan';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_READ_CHAR, QIYI_TIMER_WRITE_CHAR, QIYI_TIMER_NAME_PREFIXES } from '@cuberoot/shared/timer/external/qiyi';
import { startGanTimer, startQiyiTimer } from '@cuberoot/shared/timer/external/session';
import { normalizeMac, macFromPayload, QIYI_MAC_ADV, QIYI_CIC_LIST } from '@cuberoot/shared/timer/external/mac';
import { qiyiTimerMacFromName } from '@cuberoot/shared/timer/external/qiyi-mac';
import type { ExternalTimerSourceOptions } from '@cuberoot/timer-ui/external';
import type { BleTransport, BleDeviceRef, BleDevicePickerLabels, BleRequestOptions } from './transport';

/** Native transport lifecycle; protocol sessions and React controller are shared with Web. */
export function createNativeTimerSource(transport: BleTransport, labels: BleDevicePickerLabels, options: ExternalTimerSourceOptions & { onDevices?: (devices: readonly BleDeviceRef[], select: (id: string) => void) => void }): ExternalTimerSource {
  const bus = createExternalTimerBus();
  let device: BleDeviceRef | null = null;
  let connected = false;
  let connecting = false;
  let generation = 0;
  let state: ExternalTimerState = 'DISCONNECT';
  let kind: ExternalTimerKind = 'unknown';
  let lastTimeMs = 0;
  let cleanup: (() => void) | null = null;
  let pendingScan: Promise<() => Promise<void>> | null = null;
  let cancelPick: (() => void) | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let mac: string | null = null;
  const emit = (event: ExternalTimerEvent) => {
    state = event.state;
    if (event.state === 'STOPPED' && event.solveTime !== undefined) lastTimeMs = event.solveTime;
    bus.emit(event);
  };
  let pendingConnect: Promise<void> | null = null;
  let releaseTail = Promise.resolve();
  const release = () => {
    const id = device?.id;
    const pending = pendingConnect;
    const scan = pendingScan;
    cleanup?.(); cleanup = null;
    connected = false; connecting = false;
    releaseTail = releaseTail.then(async () => {
      if(scan) { const stop = await scan.catch(() => null); await stop?.().catch(() => {}); }
      await pending?.catch(() => {});
      if(id) await transport.disconnect(id).catch(() => {});
    });
    return releaseTail;
  };
  const attach = async (picked: BleDeviceRef, token: number) => {
    const ensure = () => { if (token !== generation) throw new Error('Connection cancelled'); };
    const qiyi = /^QY-(Timer|Adapter)/i.test(picked.name);
    device = picked;
    kind = qiyi ? 'qiyi-timer' : 'gan-timer';
    connecting = true;
    const lost = () => {
      if (token !== generation) return;
      generation++;
      const next = generation;
      void release();
      options.onConnectionLost?.();
      emit({state: 'DISCONNECT'});
      retry = setTimeout(() => { if (generation === next) void attach(picked, next).catch(() => {}); }, 2500);
    };
    try {
      await releaseTail; ensure();
      pendingConnect = transport.connect(picked.id, lost);
      await pendingConnect; ensure();
      const io = {
        subscribe: async (listener: (value: DataView) => void) => {
          const unsubscribe = await transport.subscribe(picked.id, qiyi ? QIYI_TIMER_SERVICE : GAN_TIMER_SERVICE, qiyi ? QIYI_TIMER_READ_CHAR : GAN_TIMER_STATE_CHAR, value => { if (token === generation) listener(value); });
          if (token !== generation) { await unsubscribe(); ensure(); }
          return unsubscribe;
        },
        write: (value: Uint8Array) => { ensure(); return transport.write(picked.id, QIYI_TIMER_SERVICE, QIYI_TIMER_WRITE_CHAR, value); },
      };
      const started = await (qiyi ? startQiyiTimer(io, event => event.state === 'DISCONNECT' ? lost() : emit(event), {mac}) : startGanTimer(io, event => event.state === 'DISCONNECT' ? lost() : emit(event)));
      if (token !== generation) { started.cleanup(); ensure(); }
      cleanup = started.cleanup;
      connected = true; connecting = false;
      if(state === 'DISCONNECT') emit({state: 'IDLE'});
      else bus.emit({state});
    } catch(error) {
      if(token === generation) { generation++; await release(); emit({state: 'DISCONNECT'}); }
      throw error;
    }
  };
  return {
    get connected() { return connected; }, get deviceName() { return device?.name ?? ''; }, get kind() { return kind; }, get state() { return state; }, get lastTimeMs() { return lastTimeMs; },
    subscribe: listener => bus.subscribe(listener),
    async connect() {
      if (connected || connecting) return;
      clearTimeout(retry); const token = ++generation; connecting = true;
      try {
        await releaseTail;
        if(token !== generation) return;
        await transport.initialize();
        if(token !== generation) return;
        const request: BleRequestOptions = {namePrefix: 'GAN', namePrefixes: [...GAN_TIMER_NAME_PREFIXES, ...QIYI_TIMER_NAME_PREFIXES], optionalServices: [GAN_TIMER_SERVICE,QIYI_TIMER_SERVICE], captureManufacturerData: true, pickerLabels: labels};
        let picked: BleDeviceRef | null;
        if (transport.scanDevices && options.onDevices) {
          let sawDevices = false;
          let select: (value: BleDeviceRef | null) => void = () => {};
          const selected = new Promise<BleDeviceRef | null>(resolve => { select = resolve; });
          cancelPick = () => select(null);
          pendingScan = transport.scanDevices(request, devices => { sawDevices = devices.length > 0; if(token === generation) options.onDevices?.(devices, id => { const hit = devices.find(item => item.id === id); if(hit) select(hit); }); });
          const stopScan = await pendingScan;
          if(token !== generation) select(null);
          const emptyScanTimeout = setTimeout(() => { if (!sawDevices) select(null); }, 8500);
          try {
            picked = await selected;
            if (!picked && token === generation) throw new Error(labels.noDeviceFound);
          } finally {
            clearTimeout(emptyScanTimeout);
            cancelPick = null;
            await stopScan();
            pendingScan = null;
            options.onDevices([], () => {});
          }
        } else picked = await transport.requestDevice(request);
        if (!picked) return;
        if (!/^(GAN|QY-(Timer|Adapter))/i.test(picked.name)) throw new Error(labels.noDeviceFound);
        if(token !== generation) return;
        mac = null;
        if (/^QY-(Timer|Adapter)/i.test(picked.name)) {
          mac = normalizeMac(picked.macAddress) ?? normalizeMac(picked.id) ?? normalizeMac(await transport.getDeviceMac?.(picked.id));
          if(token !== generation) return;
          if (!mac) {
            for(const id of QIYI_CIC_LIST) { const data = picked.manufacturerData?.get(id); if(data) mac = macFromPayload(index => data[index], data.length, QIYI_MAC_ADV); if(mac) break; }
          }
          if (!mac) mac = normalizeMac(await options.onNeedMac?.(picked.name, qiyiTimerMacFromName(picked.name) ?? undefined));
          if(token !== generation) return;
          if(!mac) { connecting = false; return; }
        }
        await attach(picked, token);
      } finally { if(token === generation) connecting = false; }
    },
    async disconnect() {
      generation++; cancelPick?.(); clearTimeout(retry); const pending = release(); device = null; kind = 'unknown'; emit({state: 'DISCONNECT'}); await pending;
    },
  };
}
