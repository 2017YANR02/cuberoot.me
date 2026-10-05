import type { BleDeviceRef } from '../smart-cube/transport';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBluetoothTimer, useStackmat, createStackmatMicSource } from '@cuberoot/timer-ui/external';
import { createExternalTimerBus, type ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import type { InstalledAppHost } from '../platform';
import type { SupportedLanguage } from '../copy';
import { createNativeTimerSource } from '../smart-cube/timer-source';

export function useExternalDevices(host: InstalledAppHost, language: SupportedLanguage, onEvent: (kind: 'smart-timer' | 'stackmat', event: ExternalTimerEvent) => void) {
  const [devices, setDevices] = useState<readonly BleDeviceRef[]>([]);
  const selectDeviceRef = useRef<(id: string) => void>(() => {});
  const [macPrompt, setMacPrompt] = useState<{deviceName: string; suggestedMac?: string} | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);
  const resolveMac = useCallback((value: string | null) => { resolver.current?.(value); resolver.current = null; setMacPrompt(null); }, []);
  useEffect(() => () => { resolver.current?.(null); }, []);
  const timer = useBluetoothTimer(options => {
    if (!host.createBleTransport) return {kind:'unknown', deviceName:'', connected:false, state:'DISCONNECT', lastTimeMs:0, subscribe: createExternalTimerBus().subscribe, connect: async () => { throw new Error('Bluetooth unavailable'); }, disconnect: async () => {}};
    const copy = {
      en: {availableDevices:'Available timers',cancel:'Cancel',noDeviceFound:'No timer found',scanning:'Scanning…'},
      zh: {availableDevices:'可用计时器',cancel:'取消',noDeviceFound:'未找到计时器',scanning:'搜索中…'},
    };
    return createNativeTimerSource(host.createBleTransport(), copy[language], {...options, onDevices: (items, select) => { setDevices(items); selectDeviceRef.current = select; }});
  }, {
    onNeedMac: (deviceName, suggestedMac) => new Promise(resolve => { resolver.current?.(null); resolver.current = resolve; setMacPrompt({deviceName,suggestedMac}); }),
    onEvent: event => onEvent('smart-timer', event),
  });
  const stackmat = useStackmat(host.createStackmatSource ?? createStackmatMicSource, {onEvent: event => onEvent('stackmat', event)});
  const disconnectTimer = useCallback(() => { resolveMac(null); return timer.disconnect(); }, [resolveMac, timer.disconnect]);
  return {devices, selectDevice: (id: string) => selectDeviceRef.current(id), timer: {...timer, disconnect: disconnectTimer}, stackmat, macPrompt, resolveMac};
}
