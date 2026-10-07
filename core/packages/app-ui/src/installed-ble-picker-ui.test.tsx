// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerSmartCubeDeviceModal } from '@cuberoot/timer-ui';
import { pickInstalledBleDevice, type InstalledBlePicker } from './installed-ble-picker';
import type { BleTransport } from './smart-cube/transport';
it('renders the shared list and returns the clicked device, with no implicit choice', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  const stop = vi.fn(async () => {}); const selected = vi.fn();
  const transport = { scanDevices: vi.fn(async (_options, update) => {
    update([{ id: 'near', name: 'GAN near', rssi: -10 }, { id: 'wanted', name: 'GAN wanted', rssi: -80 }]); return stop;
  }) } as unknown as BleTransport;
  let promise!: ReturnType<typeof pickInstalledBleDevice>;
  const render = (picker: InstalledBlePicker | null) => root.render(picker ? <TimerSmartCubeDeviceModal
    language="en" availableDevices={picker.devices} snapshot={{ phase: 'idle' }}
    onScan={picker.scan} onConnect={picker.select} onClose={picker.cancel}
  /> : null);
  try {
    await act(async () => { promise = pickInstalledBleDevice(transport, { namePrefix: 'GAN', pickerLabels: { availableDevices: '', cancel: '', noDeviceFound: '', scanning: '' } }, new AbortController().signal, render); void promise.then(selected); });
    expect(selected).not.toHaveBeenCalled();
    const button = document.querySelector<HTMLButtonElement>('[aria-label="Connect GAN wanted"]');
    expect(button).not.toBeNull();
    await act(async () => { button!.click(); await promise; });
    expect((await promise).id).toBe('wanted'); expect(stop).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); element.remove(); }
});
