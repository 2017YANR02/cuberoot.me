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
  | {
      type: 'status';
      phase: SmartCubeRelayStatusPhase;
      brand?: string;
      deviceName?: string;
      hasGyro?: boolean;
      error?: string;
    }
  | { type: 'move'; move: string; deviceTs?: number; relaySeq?: number }
  | { type: 'state'; facelets: string }
  | { type: 'battery'; level: number }
  | {
      type: 'gyro';
      quaternion: { w: number; x: number; y: number; z: number };
      velocity?: { x: number; y: number; z: number };
    };

export type SmartCubeRelayCommand =
  | { type: 'command'; command: 'disconnect' };

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
  if (value.type === 'command') return value.command === 'disconnect';
  if (value.type === 'move') {
    return typeof value.move === 'string'
      && /^[URFDLB](?:2|')?$/.test(value.move)
      && (value.deviceTs === undefined
        || (typeof value.deviceTs === 'number' && Number.isFinite(value.deviceTs)))
      && (value.relaySeq === undefined
        || (Number.isSafeInteger(value.relaySeq) && Number(value.relaySeq) > 0));
  }
  if (value.type === 'state') {
    return typeof value.facelets === 'string' && /^[URFDLB]{54}$/.test(value.facelets);
  }
  if (value.type === 'battery') {
    return Number.isInteger(value.level) && Number(value.level) >= 0 && Number(value.level) <= 100;
  }
  if (value.type === 'status') {
    return ['scanning', 'connecting', 'connected', 'disconnected', 'error'].includes(String(value.phase))
      && (value.brand === undefined || typeof value.brand === 'string')
      && (value.deviceName === undefined || typeof value.deviceName === 'string')
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
