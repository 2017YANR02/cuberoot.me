import { unfoldedGrid, WCA_COLORS, CUBE_FACE_LETTERS, STROKE_W } from '@cuberoot/shared/cube-unfolded-svg';
import { GanV4CubeConnection, type GanV4CubeCallbacks } from './smart-cube/gan-v4-cube';
import { GanCubeConnection, type GanCubeStatus } from './smart-cube/gan-cube';
import { Moyu32CubeConnection, type Moyu32CubeStatus } from './smart-cube/moyu32-cube';
import { QiyiCubeConnection, type QiyiCubeStatus } from './smart-cube/qiyi-cube';
import { modelForDeviceName } from './smart-cube/models';
import { normalizeMac } from '@cuberoot/shared/timer/external/mac';
import type { BleDeviceRef, BleServiceRef, BleTransport } from './smart-cube/transport';
import { SmartCubeSessionController } from '@cuberoot/shared/smart-cube/session';
import { SmartCubeSoloTimerController } from '@cuberoot/shared/smart-cube/solo-timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { DEFAULT_MAX_CUBE_BACKDATE_MS, initialTimerMachineState, transitionTimer, type TimerMachineAction } from '@cuberoot/shared/timer/machine';
import type { EventId } from '@cuberoot/shared/timer';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';

/** JSON-only watch host boundary. Protocol, clock, state and timing are the iOS implementations. */
export function createWatchCubeBridge() {
  let now = 0, nextId = 0, generation = 0;
  let output: Record<string, unknown>[] = [];
  let connection: GanV4CubeConnection | GanCubeConnection | Moyu32CubeConnection | QiyiCubeConnection | null = null;
  let disconnected: (() => void) | undefined;
  const notifications = new Map<string, (value: DataView) => void>();
  const notificationKey = (service: string, characteristic: string) => service.toLowerCase() + '/' + characteristic.toLowerCase();
  let deviceModel = 'gan-v4';
  const supportsDevice = (name: string) => ['gan-v1', 'gan-v2', 'gan-v3', 'gan-v4', 'moyu32', 'qiyi'].includes(modelForDeviceName(name) ?? '');
  let inspectionSec = 0, enabled = false, connected = false, contextId = '';
  let machine = initialTimerMachineState();
  let resetting = false;
  let quaternion: { w: number; x: number; y: number; z: number } | null = null;
  let reference: Quat | null = null, deviceName = '', startedAt = 0;
  const recording = new SmartCubeAttemptProducer();
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  const emit = (value: Record<string, unknown>) => output.push(value);
  const request = (op: string, data: Record<string, unknown> = {}): Promise<unknown> => {
    const id = ++nextId;
    emit({ kind: 'native', id, op, ...data });
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  const transport: BleTransport = {
    initialize: async () => {}, getMtu: async () => null,
    getServices: async device => await request('getServices', { device }) as BleServiceRef[],
    requestDevice: async () => { throw new Error('Use the native device picker'); },
    connect: async (device, onDisconnect) => { disconnected = onDisconnect; await request('connect', { device }); },
    disconnect: async device => { await request('disconnect', { device }); },
    read: async (device, service, characteristic) => new DataView(Uint8Array.from(await request('read', { device, service, characteristic }) as number[]).buffer),
    write: async (device, service, characteristic, value) => { await request('write', { device, service, characteristic, bytes: Array.from(value) }); },
    subscribe: async (device, service, characteristic, callback) => {
      const key = notificationKey(service, characteristic);
      notifications.set(key, callback);
      await request('subscribe', { device, service, characteristic });
      return async () => { if (notifications.get(key) === callback) notifications.delete(key); await request('unsubscribe', { device, service, characteristic }); };
    },
  };
  const action = (value: TimerMachineAction): boolean => {
    const previous = machine;
    const result = transitionTimer(machine, value, { inspectionSec });
    machine = result.state;
    if (result.effects.includes('inspection-started') || machine.phase === 'ready') reference = quaternion ? { ...quaternion } : null;
    if (result.effects.includes('run-started')) {
      startedAt = machine.startedAtMs ?? now;
      recording.begin(startedAt, connected ? { model: deviceModel, name: deviceName } : undefined,
        reference && quaternion ? { reference, initial: quaternion } : undefined);
    }
    const recorded = result.solve ? recording.finish() : undefined;
    if (machine !== previous) emit({ kind: 'timer', contextId, ...machine,
      nowMs: now, solve: result.solve, effects: result.effects, recording: recorded });
    return result.accepted !== false && machine !== previous;
  };
  const solo = new SmartCubeSoloTimerController({
    armFromCube: () => action({ type: 'arm-from-cube', nowMs: now }),
    autoReadyOnScramble: () => true, canStartAttempt: () => enabled,
    getPhase: () => machine.phase, isTimingEnabled: () => enabled && connected,
    // Corrections require the phone's solver worker; exact scramble matching remains shared.
    solve: async () => null,
    recordMove: ({ move, timestamp }) => { recording.recordMove(move, timestamp); },
    startFromCube: atMs => action({ type: 'start-from-cube', nowMs: now, atMs }),
    stopFromCube: atMs => action({ type: 'stop-from-cube', nowMs: now, atMs }),
    onGuidanceChange: state => emit({ kind: 'guidance', contextId, matched: state.match, hint: state.hint }),
  });
  const session = new SmartCubeSessionController<{ delayed?: boolean; estimatedTime?: boolean; futureHistory?: boolean }>({
    now: () => now,
    onChange: state => emit({ kind: 'state', facelets: state.facelets, lastMove: state.lastMove, solved: state.solved }),
    onMove: event => { if (!resetting) {
      emit({ kind: 'move', move: event.move, facelets: event.facelets, timestamp: event.timestamp });
      // Reuse the solo controller's history guard. A short gap in an already
      // armed attempt is recoverable; old history cannot create a new attempt.
      const historyOnly = event.metadata?.delayed === true && machine.phase !== 'running'
        && (machine.phase === 'idle' || machine.phase === 'stopped'
          || now - event.timestamp > DEFAULT_MAX_CUBE_BACKDATE_MS);
      if (historyOnly) {
        const cancelled = machine.phase !== 'idle' && machine.phase !== 'stopped' && action({ type: 'cancel-arm' });
        if (cancelled) emit({ kind: 'timing-late' });
        solo.move({ ...event, metadata: { ...event.metadata, futureHistory: true } });
        if (event.facelets) solo.syncFacelets(event.facelets);
      } else solo.move(event);
    } },
    onSolved: timestamp => { if (!resetting) solo.solved(timestamp); },
  });
  async function resetCube() {
    if (deviceModel === 'gan-v1' || !connected || !connection || resetting || machine.phase === 'running') return;
    const revision = generation, driver = connection;
    resetting = true;
    action({ type: 'cancel-arm' });
    solo.setRunning(false);
    emit({ kind: 'reset', phase: 'pending' });
    emit({ kind: 'gyro-reset', quaternion });
    // Same session and confirmed hardware calibration used by the iOS hook.
    session.resetState();
    emit({ kind: 'snapshot', facelets: session.getFacelets() });
    try {
      await driver.resetDeviceState();
      if (revision !== generation) return;
      session.resetClock(); session.republish();
      emit({ kind: 'reset', phase: 'success' });
    } catch (error) {
      if (revision === generation) emit({ kind: 'reset', phase: 'failed', message: String(error) });
    } finally {
      if (revision === generation) {
        const facelets = session.getFacelets();
        if (facelets) {
          emit({ kind: 'snapshot', facelets });
          solo.syncFacelets(facelets);
        }
        resetting = false;
      }
    }
  }
  async function disconnect() {
    generation++;
    resetting = false; quaternion = null;
    emit({ kind: 'reset', phase: 'idle' });
    if (connected) {
      action(machine.phase === 'running' ? { type: 'abort-run', nowMs: now } : { type: 'cancel-arm' });
    }
    connected = false; solo.setConnected(false); solo.setRunning(false); session.close();
    recording.reset(); reference = null;
    for (const task of pending.values()) task.reject(new Error('Connection closed'));
    pending.clear(); notifications.clear();
    const old = connection; connection = null;
    await old?.disconnect().catch(() => undefined);
  }
  async function connect(input: { id: string; name: string; manufacturerData?: [number, number[]][]; macAddress?: string }) {
    await disconnect();
    const revision = ++generation;
    const lease = session.open({ publishInitialState: false });
    const current = () => revision === generation && lease.isCurrent();
    const device: BleDeviceRef = { ...input, manufacturerData: new Map(input.manufacturerData?.map(([id, data]) => [id, Uint8Array.from(data)])) };
    deviceName = device.name;
    const model = modelForDeviceName(deviceName);
    if (!supportsDevice(deviceName)) { emit({ kind: 'connection', phase: 'error', message: 'Unsupported smart cube' }); return; }
    deviceModel = model!;
    emit({ kind: 'connection', phase: 'connecting', name: device.name });
    const callbacks: Omit<GanV4CubeCallbacks, 'onMove' | 'onStatus'> & { onVerifiedMac?(mac: string): void; onMove(move: string, timestamp?: number, metadata?: { delayed?: boolean; estimatedTime?: boolean; futureHistory?: boolean }): void; onStatus(status: GanCubeStatus | Moyu32CubeStatus | QiyiCubeStatus): void } = {
      onVerifiedMac: mac => { if (current()) emit({ kind: 'verified-mac', mac }); },
      onNeedMac: async name => {
        const value = await request('needMac', { name, device: device.id });
        return typeof value === 'string' ? normalizeMac(value) : null;
      },
      onDisconnect: () => { if (current()) { void disconnect(); emit({ kind: 'connection', phase: 'idle' }); } },
      onProtocolError: () => { if (current()) { void disconnect(); emit({ kind: 'connection', phase: 'error' }); } },
      onMove: (move, timestamp, metadata) => {
        if (!current()) return;
        const applied = lease.move(move, timestamp, metadata, metadata);
        emit({ kind: 'diagnostic', event: 'clock', now, move, deviceTimestamp: timestamp,
          timestamp: applied?.timestamp, delayed: metadata?.delayed === true,
          estimatedTime: metadata?.estimatedTime === true });
      },
      onGyro: value => { if (current()) {
        quaternion = value; emit({ kind: 'gyro', quaternion });
        if (machine.phase === 'running') recording.recordGyro(value, now - startedAt);
      } },
      onState: facelets => {
        if (current() && lease.adoptFacelets(facelets, now)) {
          connected = true; solo.setConnected(true); if (!resetting) solo.syncFacelets(facelets);
          emit({ kind: 'snapshot', facelets });
          emit({ kind: 'connection', phase: 'connected', name: device.name, canReset: deviceModel !== 'gan-v1' });
        }
      },
      onStatus: status => { if (current()) { deviceModel = status.protocol; emit({ kind: 'status', ...status, canReset: deviceModel !== 'gan-v1' }); } },
      onDiagnostic: event => { if (current()) emit({ kind: 'diagnostic', ...event, now }); },
    };
    const driver = model === 'moyu32' ? new Moyu32CubeConnection(transport, callbacks)
      : model === 'qiyi' ? new QiyiCubeConnection(transport, callbacks)
      : new GanCubeConnection(transport, callbacks);
    connection = driver;
    try { await driver.connect(device); }
    catch (error) { if (current()) { void disconnect(); emit({ kind: 'connection', phase: 'error', message: String(error) }); } }
  }
  return {
    supportsDevice, normalizeMac,
    dispatch(input: Record<string, unknown>) {
      if (typeof input.now === 'number') now = input.now;
      if (input.kind === 'connect') void connect(input.device as Parameters<typeof connect>[0]);
      else if (input.kind === 'disconnect') void disconnect();
      else if (input.kind === 'reset') void resetCube();
      else if (input.kind === 'disconnected') disconnected?.();
      else if (input.kind === 'reply') {
        const id = input.id as number, task = pending.get(id); pending.delete(id);
        if (input.error) task?.reject(new Error(String(input.error))); else task?.resolve(input.value);
      } else if (input.kind === 'notification') {
        const callback = notifications.get(notificationKey(String(input.service ?? ''), String(input.characteristic ?? '')))
          ?? (input.service === undefined && notifications.size === 1 ? notifications.values().next().value : undefined);
        callback?.(new DataView(Uint8Array.from(input.bytes as number[]).buffer));
      }
      else if (input.kind === 'context') {
        inspectionSec = Number(input.inspectionSec) || 0;
        enabled = input.enabled === true;
        const nextId = String(input.id ?? '');
        if (contextId !== nextId) { solo.setRunning(false); recording.reset(); reference = null; machine = initialTimerMachineState(); contextId = nextId; }
        const scramble = String(input.scramble ?? '');
        solo.setContext({ id: String(input.id ?? ''), event: input.event as EventId, scramble,
          targetFacelets: smartCubeTargetFacelets(scramble) });
        const facelets = session.getFacelets(); if (facelets && !resetting) solo.syncFacelets(facelets);
      } else if (input.kind === 'cancel') {
        action({ type: 'cancel-arm' });
      } else if (input.kind === 'tap') {
        if (connected || resetting) return;
        if (machine.phase === 'running') action({ type: 'stop-from-cube', nowMs: now });
        else if (enabled) {
          if ((machine.phase === 'idle' || machine.phase === 'stopped') && inspectionSec > 0) action({ type: 'arm-from-cube', nowMs: now });
          else if (machine.phase === 'inspecting' || machine.phase === 'ready') action({ type: 'start-from-cube', nowMs: now });
          else action({ type: 'start-now', nowMs: now });
        }
        solo.setRunning(machine.phase === 'running');
      }
    },
    scramblePreview(facelets: string) {
      if (!/^[URFDLB]{54}$/.test(facelets)) return 'null';
      const grid = unfoldedGrid(3);
      const cells = CUBE_FACE_LETTERS.flatMap((face, f) => Array.from({ length: 9 }, (_, i) => {
        const color = WCA_COLORS[CUBE_FACE_LETTERS.indexOf(facelets['URFDLB'.indexOf(face) * 9 + i] as typeof face)];
        const rgb = parseInt(color.slice(1), 16);
        return { x: grid.faces[f][0] + i % 3, y: grid.faces[f][1] + Math.floor(i / 3),
          color: [(rgb >> 16 & 255) / 255, (rgb >> 8 & 255) / 255, (rgb & 255) / 255] };
      }));
      return JSON.stringify({ width: grid.width, height: grid.height, stroke: STROKE_W, cells });
    },
    drain() { const result = output; output = []; return JSON.stringify(result); },
  };
}
