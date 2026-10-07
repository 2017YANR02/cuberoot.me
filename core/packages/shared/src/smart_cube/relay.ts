import { EXTERNAL_TIMER_STATE_CODE, type ExternalTimerEvent } from '../timer/external/types';
export const SMART_CUBE_RELAY_PATH = '/v1/smart-cube/relay';
export const SMART_CUBE_RELAY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
export const SMART_CUBE_RELAY_MAX_MESSAGE_BYTES = 4 * 1024;

export type SmartCubeRelayRole = 'source' | 'sink';

export interface SmartCubeRelayHello {
  type: 'hello';
  role: SmartCubeRelayRole;
  token: string;
  lastMoveSeq?: number;
}

export interface SmartCubeRelayReady {
  type: 'ready';
  role: SmartCubeRelayRole;
  lastMoveSeq: number;
}

export type SmartCubeRelayStatusPhase =
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type SmartCubeRelayEvent =
  | { type: 'command-result'; requestId: string; ok: boolean; error?: string }
  | { type: 'timer'; event: ExternalTimerEvent; relaySeq?: number }
  | {
      type: 'status';
      phase: SmartCubeRelayStatusPhase;
      brand?: string;
      deviceName?: string;
      hasGyro?: boolean;
      canResetDevice?: boolean;
      calibrating?: boolean;
      error?: string;
    }
  | {
      type: 'move';
      move: string;
      deviceTs?: number;
      futureHistory?: boolean;
      calibration?: boolean;
      relaySeq?: number;
    }
  | { type: 'state'; facelets: string; calibration?: boolean; relaySeq?: number }
  | { type: 'battery'; level: number }
  | {
      type: 'gyro';
      quaternion: { w: number; x: number; y: number; z: number };
      velocity?: { x: number; y: number; z: number };
    };

export type SmartCubeRelayCommand =
  | { type: 'command'; command: 'disconnect' }
  | { type: 'command'; command: 'reset-device'; requestId: string };

export type SmartCubeRelayPayload = SmartCubeRelayEvent | SmartCubeRelayCommand;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSmartCubeRelayHello(value: unknown): value is SmartCubeRelayHello {
  if (!(isRecord(value)
    && value.type === 'hello'
    && (value.role === 'source' || value.role === 'sink')
    && typeof value.token === 'string'
    && SMART_CUBE_RELAY_TOKEN_PATTERN.test(value.token))) return false;
  if (value.role === 'source') return value.lastMoveSeq === undefined;
  return value.lastMoveSeq === undefined
    || (Number.isSafeInteger(value.lastMoveSeq) && Number(value.lastMoveSeq) >= 0);
}

export function isSmartCubeRelayReady(value: unknown): value is SmartCubeRelayReady {
  return isRecord(value)
    && value.type === 'ready'
    && (value.role === 'source' || value.role === 'sink')
    && Number.isSafeInteger(value.lastMoveSeq)
    && Number(value.lastMoveSeq) >= 0;
}

export function isSmartCubeRelayPayload(value: unknown): value is SmartCubeRelayPayload {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  const validId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(id);
  if (value.type === 'command') return value.command === 'disconnect'
    || (value.command === 'reset-device' && validId(value.requestId));
  if (value.type === 'command-result') return validId(value.requestId) && typeof value.ok === 'boolean'
    && (value.error === undefined || (typeof value.error === 'string' && value.error.length <= 256));
  if (value.type === 'timer') {
    const event = value.event;
    return isRecord(event) && typeof event.state === 'string'
      && Object.hasOwn(EXTERNAL_TIMER_STATE_CODE, event.state)
      && ['solveTime', 'inspectTime'].every(key => event[key] === undefined
        || (Number.isSafeInteger(event[key]) && Number(event[key]) >= 0))
      && (event.state !== 'STOPPED' || event.solveTime !== undefined)
      && (value.relaySeq === undefined || (Number.isSafeInteger(value.relaySeq) && Number(value.relaySeq) > 0));
  }
  if (value.type === 'move') {
    return typeof value.move === 'string'
      && /^[URFDLB](?:2|')?$/.test(value.move)
      && (value.deviceTs === undefined
        || (typeof value.deviceTs === 'number' && Number.isFinite(value.deviceTs)))
      && (value.calibration === undefined || typeof value.calibration === 'boolean')
      && (value.futureHistory === undefined || typeof value.futureHistory === 'boolean')
      && (value.relaySeq === undefined
        || (Number.isSafeInteger(value.relaySeq) && Number(value.relaySeq) > 0));
  }
  if (value.type === 'state') {
    return typeof value.facelets === 'string' && /^[URFDLB]{54}$/.test(value.facelets)
      && (value.calibration === undefined || typeof value.calibration === 'boolean')
      && (value.relaySeq === undefined || (value.calibration === true && Number.isSafeInteger(value.relaySeq) && Number(value.relaySeq) > 0));
  }
  if (value.type === 'battery') {
    return Number.isInteger(value.level) && Number(value.level) >= 0 && Number(value.level) <= 100;
  }
  if (value.type === 'status') {
    return ['scanning', 'connecting', 'connected', 'disconnected', 'error'].includes(String(value.phase))
      && (value.brand === undefined || typeof value.brand === 'string')
      && (value.deviceName === undefined || typeof value.deviceName === 'string')
      && (value.calibrating === undefined || typeof value.calibrating === 'boolean')
      && (value.canResetDevice === undefined || typeof value.canResetDevice === 'boolean')
      && (value.hasGyro === undefined || typeof value.hasGyro === 'boolean')
      && (value.error === undefined || typeof value.error === 'string');
  }
  if (value.type === 'gyro') {
    const quaternion = value.quaternion;
    if (!isRecord(quaternion)) return false;
    if (!['w', 'x', 'y', 'z'].every((axis) =>
      typeof quaternion[axis] === 'number' && Number.isFinite(quaternion[axis]))) return false;
    if (value.velocity === undefined) return true;
    return isRecord(value.velocity)
      && ['x', 'y', 'z'].every((axis) => {
        const coordinate = (value.velocity as Record<string, unknown>)[axis];
        return typeof coordinate === 'number' && Number.isFinite(coordinate);
      });
  }
  return false;
}
