import { createLegacyCubeSession, type LegacyCubeModel } from '@cuberoot/shared/smart-cube/legacy-session';
import type { GyroSink } from '@cuberoot/shared/smart-cube/gan-crypto';
import type { BleDeviceRef, BleTransport } from './transport';

export interface LegacyCubeStatus {
  protocol: LegacyCubeModel;
  battery: number | null;
  moveCounter: number;
  pendingMoves: number;
  badFrames: number;
  stateReady: boolean;
}
export interface LegacyCubeCallbacks {
  onDisconnect(): void;
  onMove(move: string): void;
  onState?(facelets: string): void;
  onGyro?: GyroSink;
  onStatus?(status: LegacyCubeStatus): void;
}

export class LegacyCubeConnection {
  private deviceId: string | null = null;
  private generation = 0;
  private session: ReturnType<typeof createLegacyCubeSession> | null = null;
  private setupDone = Promise.resolve();
  constructor(private readonly transport: BleTransport, private readonly callbacks: LegacyCubeCallbacks, readonly model: LegacyCubeModel) {}

  connect(device: BleDeviceRef): Promise<void> {
    const task = this.connectDevice(device);
    this.setupDone = task.then(() => undefined, () => undefined);
    return task;
  }
  private async connectDevice(device: BleDeviceRef): Promise<void> {
    this.deviceId = device.id;
    const generation = ++this.generation;
    const current = () => this.generation === generation && this.deviceId === device.id;
    await this.transport.connect(device.id, () => {
      if (!current()) return;
      this.generation++; this.deviceId = null;
      // The owner immediately calls disconnect and retains its cleanup promise.
      this.callbacks.onDisconnect();
    });
    if (!current()) throw new Error('smart cube connection closed');
    const status: LegacyCubeStatus = { protocol: this.model, battery: null, moveCounter: 0, pendingMoves: 0, badFrames: 0, stateReady: false };
    const emit = () => { if (current()) this.callbacks.onStatus?.({ ...status }); };
    const session = createLegacyCubeSession(this.model, {
      read: (service, characteristic) => this.transport.read(device.id, service, characteristic),
      write: (service, characteristic, bytes) => this.transport.write(device.id, service, characteristic, bytes),
      subscribe: (service, characteristic, receive) => this.transport.subscribe(device.id, service, characteristic, receive),
    }, {
      onMove: move => { if (current()) { status.moveCounter++; this.callbacks.onMove(move); emit(); } },
      onState: facelets => { if (current()) { status.stateReady = true; this.callbacks.onState?.(facelets); emit(); } },
      onGyro: quaternion => { if (current()) this.callbacks.onGyro?.(quaternion); },
      onBattery: battery => { status.battery = battery; emit(); },
    });
    this.session = session;
    await session.start();
    if (!current()) { await session.dispose(); throw new Error('smart cube connection closed'); }
    emit();
    void session.battery();
  }
  async requestState(): Promise<void> {
    if (!this.session) throw new Error('smart cube is not connected');
    await this.session.requestState();
  }
  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;
    this.deviceId = null; this.generation++;
    await this.session?.dispose(); this.session = null;
    await this.setupDone;
    if (deviceId) await this.transport.disconnect(deviceId).catch(() => undefined);
  }
}
