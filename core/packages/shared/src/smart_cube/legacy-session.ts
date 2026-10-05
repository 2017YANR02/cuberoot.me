import { cubieStateFromFacelets } from './cubie';
import * as giiker from './giiker';
import * as gocube from './gocube';
import * as moyu from './moyu';
import type { GyroQuaternion } from './gan_crypto';

export type LegacyCubeModel = 'giiker' | 'gocube' | 'moyu';
export interface LegacyCubeIO {
  read(service: string, characteristic: string): Promise<DataView>;
  write(service: string, characteristic: string, bytes: Uint8Array): Promise<void>;
  subscribe(service: string, characteristic: string, receive: (value: DataView) => void): Promise<() => Promise<void>>;
}
export interface LegacyCubeCallbacks {
  onMove(move: string): void;
  onState?(facelets: string): void;
  onGyro?(quaternion: GyroQuaternion): void;
  onBattery?(level: number | null): void;
}

/** One protocol session for Web and installed transports; no fabricated device state. */
export function createLegacyCubeSession(model: LegacyCubeModel, io: LegacyCubeIO, callbacks: LegacyCubeCallbacks) {
  let active = true;
  let disposal: Promise<void> | null = null;
  const subscriptions = new Set<Promise<() => Promise<void>>>();
  const stops = new Set<() => Promise<void>>();
  const cancelWaiters = new Set<() => void>();
  let writeTail = Promise.resolve();
  let history: number[] | null = null;
  const moyuState = moyu.createMoyuDecodeState();
  let movesSinceAck = 0;
  let lastBattery: number | null = null;
  let batteryPending: Promise<number | null> | null = null;
  const batteryListeners = new Set<(value: number | null) => void>();
  const check = () => { if (!active) throw new Error('Cube disconnected'); };
  const write = (service: string, characteristic: string, bytes: Uint8Array) => {
    const task = writeTail.then(() => { check(); return io.write(service, characteristic, bytes); });
    writeTail = task.catch(() => undefined);
    return task;
  };
  const subscribeNow = async (service: string, characteristic: string, receive: (value: DataView) => void) => {
    check();
    const stop = await io.subscribe(service, characteristic, value => { if (active) receive(value); });
    if (!active) { await stop().catch(() => undefined); check(); }
    let releasing: Promise<void> | null = null;
    const release = () => releasing ??= Promise.resolve().then(stop)
      .catch(() => undefined).finally(() => { stops.delete(release); });
    stops.add(release);
    return release;
  };
  const subscribe: typeof subscribeNow = (...args) => {
    const task = subscribeNow(...args);
    subscriptions.add(task);
    void task.then(() => subscriptions.delete(task), () => subscriptions.delete(task));
    return task;
  };
  const updateBattery = (level: number | null) => {
    if (!active) return;
    if (level !== null) lastBattery = level;
    callbacks.onBattery?.(lastBattery);
    for (const listener of batteryListeners) listener(lastBattery);
  };
  const receiveGiiker = (value: DataView) => {
    const frame = giiker.parseGiikerFrame(value, history);
    if (!frame) return;
    history = frame.history;
    for (const move of frame.moves) callbacks.onMove(move);
    if (frame.facelets) callbacks.onState?.(frame.facelets);
  };
  const command = (code: number) => write(gocube.GOCUBE_SERVICE_UUID, gocube.GOCUBE_WRITE_CHARACTERISTIC_UUID, new Uint8Array(gocube.createGoCubeCommand(code)));
  const requestState = async () => {
    check();
    if (model === 'giiker') {
      const value = await io.read(giiker.GIIKER_DATA_SERVICE_UUID, giiker.GIIKER_NOTIFY_CHARACTERISTIC_UUID);
      check(); receiveGiiker(value);
    } else if (model === 'gocube') await command(gocube.GOCUBE_COMMAND_STATE);
    // Old MoYu only reports turns. It has no full-state readback command.
  };
  const dispose = (): Promise<void> => {
    if (disposal) return disposal;
    active = false;
    for (const cancel of cancelWaiters) cancel();
    cancelWaiters.clear();
    disposal = (async () => {
      await Promise.allSettled([...subscriptions]);
      await Promise.all([...stops].map(stop => stop()));
    })();
    return disposal;
  };
  const start = async () => {
    try {
      if (model === 'giiker') {
        await subscribe(giiker.GIIKER_DATA_SERVICE_UUID, giiker.GIIKER_NOTIFY_CHARACTERISTIC_UUID, receiveGiiker);
        // Some firmware only permits notifications; a later state notification is still required by the host.
        await requestState().catch(() => undefined);
      } else if (model === 'gocube') {
        await subscribe(gocube.GOCUBE_SERVICE_UUID, gocube.GOCUBE_NOTIFY_CHARACTERISTIC_UUID, value => {
          const frame = gocube.parseGoCubeNotification(value);
          if (!frame) return;
          if (frame.type === 'moves') {
            for (const move of frame.moves) { callbacks.onMove(move); movesSinceAck++; }
            if (movesSinceAck > gocube.GOCUBE_STATE_REACK_AFTER_MOVES) {
              movesSinceAck = 0;
              void command(gocube.GOCUBE_COMMAND_STATE).catch(() => undefined);
            }
          } else if (frame.type === 'state') {
            if (cubieStateFromFacelets(frame.facelets)) callbacks.onState?.(frame.facelets);
          }
          else if (frame.type === 'orientation') callbacks.onGyro?.(frame.quaternion);
          else if (frame.type === 'battery') updateBattery(frame.level);
        });
        await requestState();
      } else {
        await subscribe(moyu.MOYU_SERVICE_UUID, moyu.MOYU_TURN_CHARACTERISTIC_UUID, value => {
          for (const move of moyu.parseMoyuTurnFrame(value, moyuState)) callbacks.onMove(move);
        });
        for (const characteristic of [moyu.MOYU_READ_CHARACTERISTIC_UUID, moyu.MOYU_GYRO_CHARACTERISTIC_UUID]) {
          await subscribe(moyu.MOYU_SERVICE_UUID, characteristic, () => {}).catch(() => undefined);
        }
      }
      check();
    } catch (error) { await dispose(); throw error; }
  };
  const battery = (): Promise<number | null> => {
    if (!active || model === 'moyu') return Promise.resolve(lastBattery);
    if (batteryPending) return batteryPending;
    batteryPending = (async () => {
      let finish!: (value: number | null) => void;
      const response = new Promise<number | null>(resolve => { finish = resolve; });
      const cancel = () => finish(lastBattery);
      cancelWaiters.add(cancel);
      const timer = setTimeout(cancel, 1500);
      let release: (() => Promise<void>) | undefined;
      batteryListeners.add(finish);
      try {
        if (model === 'giiker') {
          release = await subscribe(giiker.GIIKER_RW_SERVICE_UUID, giiker.GIIKER_READ_CHARACTERISTIC_UUID, value => {
            const level = value.byteLength >= 2 ? value.getUint8(1) : null;
            updateBattery(level !== null && level <= 100 ? level : null);
          });
          await write(giiker.GIIKER_RW_SERVICE_UUID, giiker.GIIKER_WRITE_CHARACTERISTIC_UUID, Uint8Array.of(giiker.GIIKER_COMMAND_BATTERY));
        } else await command(gocube.GOCUBE_COMMAND_BATTERY);
        return await response;
      } catch { return lastBattery; }
      finally {
        clearTimeout(timer); cancelWaiters.delete(cancel); batteryListeners.delete(finish);
        await release?.();
      }
    })().finally(() => { batteryPending = null; });
    return batteryPending;
  };
  return { start, dispose, requestState, battery };
}
