import type { BleDeviceRef, BleRequestOptions, BleTransport } from './smart-cube/transport';
export interface InstalledBlePicker {
  devices: readonly BleDeviceRef[];
  select(id?: string): void;
  cancel(): void;
  scan(): Promise<void>;
}
/** Uses the existing shared device dialog, including on desktop (never nearest-device selection). */
export async function pickInstalledBleDevice(
  transport: BleTransport, options: BleRequestOptions, signal: AbortSignal,
  show: (picker: InstalledBlePicker | null) => void,
): Promise<BleDeviceRef> {
  if (signal.aborted) throw new Error('Bluetooth selection canceled');
  if (!transport.scanDevices) return transport.requestDevice(options);
  const devices = new Map<string, BleDeviceRef>();
  let select: (device: BleDeviceRef) => void = () => {};
  let cancel: () => void = () => {};
  let fail: (error: unknown) => void = () => {};
  let settled = false;
  const selection = new Promise<BleDeviceRef>((resolve, reject) => {
    select = device => { settled = true; resolve(device); };
    fail = error => { settled = true; reject(error); };
    cancel = () => fail(new Error('Bluetooth selection canceled'));
  });
  void selection.catch(() => {});
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 55_000);
  let stop: (() => Promise<void>) | undefined;
  let scanTail = Promise.resolve();
  const update = () => {
    if (!signal.aborted && !settled) show({ devices: [...devices.values()], cancel, scan,
      select: id => { const device = id ? devices.get(id) : undefined; if (device) select(device); } });
  };
  const scan = (): Promise<void> => {
    scanTail = scanTail.then(async () => {
      await stop?.(); stop = undefined;
      if (signal.aborted || settled) return;
      devices.clear(); update();
      stop = await transport.scanDevices!(options, found => {
        for (const device of found) devices.set(device.id, device);
        update();
      });
    }).catch(fail);
    return scanTail;
  };
  try {
    await scan();
    return await selection;
  } finally {
    settled = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    show(null);
    await scanTail;
    await stop?.();
  }
}
