import { INSTALLED_BLE_OPEN, decodeInstalledBleRequest, type InstalledBleMessage, type InstalledBleRequest } from '@cuberoot/shared/mobile-embed';
import type { BleDeviceRef, BleRequestOptions, BleTransport } from './smart-cube/transport';

export function installedBleRequestPort(event: MessageEvent, toolsWindow: Window | null | undefined, origin: string): MessagePort | null {
  if (!toolsWindow || event.origin !== origin || event.source !== toolsWindow
    || event.data?.type !== INSTALLED_BLE_OPEN || event.ports.length !== 1) return null;
  return event.ports[0];
}

/** One frame owns one native lease. Drain old native work before another owner enters. */
export class InstalledBleHost {
  private closed = false;
  private tail: Promise<void> = Promise.resolve();
  private device: BleDeviceRef | null = null;
  private subscriptions = new Map<string, () => Promise<void>>();
  private lastId = 0;
  private connectionEpoch = 0;
  private abort = new AbortController();
  constructor(private transport: BleTransport, private send: (message: InstalledBleMessage) => void,
    private pick: (transport: BleTransport, options: BleRequestOptions, signal: AbortSignal) => Promise<BleDeviceRef>
      = (transport, options) => transport.requestDevice(options)) {}
  receive(value: unknown): void {
    const request = decodeInstalledBleRequest(value);
    if (!request || this.closed || request.id <= this.lastId) return;
    this.lastId = request.id;
    this.tail = this.tail.then(async () => {
      if (this.closed) return;
      try {
        const value = await this.run(request);
        if (!this.closed) this.send({ id: request.id, ok: true, value });
      } catch (error) {
        if (!this.closed) this.send({ id: request.id, ok: false, error: error instanceof Error ? error.message : 'Bluetooth operation failed' });
      }
    });
  }
  private async run(r: InstalledBleRequest): Promise<unknown> {
    if (r.op === 'pick') {
      if (this.device) throw new Error('Device already selected');
      await this.transport.initialize();
      if (this.closed) return;
      const device = await this.pick(this.transport, r.options!, this.abort.signal);
      this.device = device; // Retain late picker results so dispose can drain them.
      if (this.closed) return;
      const macAddress = device.macAddress ?? await this.transport.getDeviceMac?.(device.id) ?? undefined;
      return { ...device, macAddress, manufacturerData: [...(device.manufacturerData ?? [])].map(([id, bytes]) => [id, Array.from(bytes)]) };
    }
    const device = this.device;
    if (!device) throw new Error('No selected Bluetooth device');
    const service = r.service!;
    const characteristic = r.characteristic!;
    const key = `${service}/${characteristic}`;
    switch (r.op) {
      case 'connect': {
        const epoch = ++this.connectionEpoch;
        await this.clearSubscriptions();
        if (this.closed) return;
        return this.transport.connect(device.id, () => {
          if (!this.closed && epoch === this.connectionEpoch) this.send({ event: 'disconnected' });
        });
      }
      case 'services': return this.transport.getServices?.(device.id) ?? [];
      case 'read': {
        const value = await this.transport.read(device.id, service, characteristic);
        return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      }
      case 'write': return this.transport.write(device.id, service, characteristic, Uint8Array.from(r.bytes!));
      case 'subscribe': {
        if (this.subscriptions.has(key)) return;
        const stop = await this.transport.subscribe(device.id, service, characteristic, value => {
          if (!this.closed) this.send({ event: 'value', service, characteristic,
            bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) });
        });
        this.subscriptions.set(key, stop);
        return;
      }
      case 'unsubscribe': {
        const stop = this.subscriptions.get(key);
        this.subscriptions.delete(key);
        return stop?.();
      }
      case 'disconnect': return this.disconnect();
    }
  }
  private async clearSubscriptions(): Promise<void> {
    for (const stop of this.subscriptions.values()) await stop().catch(() => {});
    this.subscriptions.clear();
  }
  private async disconnect(): Promise<void> {
    this.connectionEpoch++;
    await this.clearSubscriptions();
    if (this.device) await this.transport.disconnect(this.device.id).catch(() => {});
  }
  dispose(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      this.abort.abort();
      this.send({ event: 'closed' });
      this.tail = this.tail.then(() => this.disconnect());
    }
    return this.tail;
  }
}
