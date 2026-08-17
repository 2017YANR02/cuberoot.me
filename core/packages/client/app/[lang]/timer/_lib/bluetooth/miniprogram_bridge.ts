import {
  SMART_CUBE_RELAY_PATH,
  isSmartCubeRelayReady,
  isSmartCubeRelayPayload,
  type SmartCubeRelayEvent,
  type SmartCubeRelayHello,
} from '@cuberoot/shared/smart-cube/relay';
import { websocketApiUrl } from '@/lib/api-base';
import {
  loadWeChatJsSdk,
  supportsWeChatMiniProgramNavigation,
  type WeChatMiniProgramApi,
} from '@/lib/wechat-js-sdk';

declare global {
  interface Window {
    __wxjs_environment?: string;
  }
}

export interface MiniProgramCubeBridgeCallbacks {
  onBattery(level: number): void;
  onGyro(
    quaternion: { w: number; x: number; y: number; z: number },
    velocity?: { x: number; y: number; z: number },
  ): void;
  onMove(move: string, deviceTs?: number): void;
  onState(facelets: string): void;
  onStatus(status: Extract<SmartCubeRelayEvent, { type: 'status' }>): void;
}

export interface MiniProgramCubeBridgeConnection {
  readonly brand: string;
  readonly deviceName: string;
  readonly hasGyro: boolean;
  activate(): void;
  disconnect(): void;
}

const CONNECT_TIMEOUT_MS = 45_000;
const RECONNECT_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000] as const;
const REPLAY_TIMEOUT_MS = 5_000;

export function isMiniProgramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return window.__wxjs_environment === 'miniprogram'
    || /miniProgram/i.test(window.navigator.userAgent);
}

function randomRelayToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function connectMiniProgramCubeBridge(
  callbacks: MiniProgramCubeBridgeCallbacks,
): Promise<MiniProgramCubeBridgeConnection> {
  if (!isMiniProgramWebView()) throw new Error('NOT_MINIPROGRAM_WEBVIEW');
  let miniProgram = window.wx && supportsWeChatMiniProgramNavigation(window.wx)
    ? window.wx.miniProgram
    : undefined;
  if (!miniProgram) {
    miniProgram = (
      await loadWeChatJsSdk(supportsWeChatMiniProgramNavigation)
    )?.miniProgram;
  }
  if (!miniProgram) throw new Error('MINIPROGRAM_BRIDGE_UNAVAILABLE');
  const miniProgramApi: WeChatMiniProgramApi = miniProgram;

  const token = randomRelayToken();
  let socket: WebSocket | null = null;
  let active = true;
  let activated = false;
  let settled = false;
  let navigated = false;
  let reconnectAttempt = 0;
  let reconnectTimer: number | null = null;
  let replayTimer: number | null = null;
  let lastMoveSeq = 0;
  let connectedStatus: Extract<SmartCubeRelayEvent, { type: 'status' }> | null = null;
  const pendingEvents: SmartCubeRelayEvent[] = [];
  let finish: (connection: MiniProgramCubeBridgeConnection) => void = () => {};
  let fail: (error: Error) => void = () => {};

  const dispatch = (payload: SmartCubeRelayEvent): void => {
    if (payload.type === 'move') callbacks.onMove(payload.move, payload.deviceTs);
    else if (payload.type === 'state') callbacks.onState(payload.facelets);
    else if (payload.type === 'battery') callbacks.onBattery(payload.level);
    else if (payload.type === 'gyro') callbacks.onGyro(payload.quaternion, payload.velocity);
    else callbacks.onStatus(payload);
  };

  const queueOrDispatch = (payload: SmartCubeRelayEvent): void => {
    if (activated) dispatch(payload);
    else pendingEvents.push(payload);
  };

  const clearRelayTimers = (): void => {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    if (replayTimer !== null) window.clearTimeout(replayTimer);
    reconnectTimer = null;
    replayTimer = null;
  };

  const close = (notifySource: boolean): void => {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    clearRelayTimers();
    const currentSocket = socket;
    socket = null;
    if (notifySource && currentSocket?.readyState === WebSocket.OPEN) {
      try {
        currentSocket.send(JSON.stringify({ type: 'command', command: 'disconnect' }));
      } catch {
        // The relay is already unavailable, so the native source will close itself.
      }
    }
    currentSocket?.close(1000, 'timer bridge closed');
  };

  const connectionPromise = new Promise<MiniProgramCubeBridgeConnection>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });

  const terminateRelay = (): void => {
    if (!active) return;
    close(false);
    queueOrDispatch({ type: 'status', phase: 'disconnected' });
  };

  const scheduleReconnect = (): void => {
    if (!active || !settled || !connectedStatus || reconnectTimer !== null) return;
    if (reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
      terminateRelay();
      return;
    }
    const delay = RECONNECT_DELAYS_MS[reconnectAttempt++];
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      openSocket(true);
    }, delay);
  };

  const handlePayload = (payload: SmartCubeRelayEvent): void => {
    if (payload.type === 'move') {
      if (payload.relaySeq === undefined || payload.relaySeq > lastMoveSeq + 1) {
        terminateRelay();
        return;
      }
      if (payload.relaySeq <= lastMoveSeq) return;
      lastMoveSeq = payload.relaySeq;
    }
    if (payload.type === 'status') {
      if (payload.phase === 'error' && !settled) {
        settled = true;
        close(false);
        fail(new Error(payload.error || 'MINIPROGRAM_CUBE_CONNECT_FAILED'));
        return;
      }
      queueOrDispatch(payload);
      if (payload.phase === 'connected' && !settled) {
        settled = true;
        connectedStatus = payload;
        clearTimeout(timeout);
        finish({
          brand: payload.brand ?? 'unknown',
          deviceName: payload.deviceName ?? '智能魔方',
          hasGyro: payload.hasGyro === true,
          activate: () => {
            if (activated) return;
            activated = true;
            for (const pending of pendingEvents.splice(0)) dispatch(pending);
          },
          disconnect: () => close(true),
        });
      }
      return;
    }
    queueOrDispatch(payload);
  };

  function openSocket(isReconnect: boolean): void {
    if (!active) return;
    const nextSocket = new WebSocket(websocketApiUrl(SMART_CUBE_RELAY_PATH));
    socket = nextSocket;

    nextSocket.addEventListener('open', () => {
      if (!active || socket !== nextSocket) return;
      const hello: SmartCubeRelayHello = {
        type: 'hello', role: 'sink', token, lastMoveSeq,
      };
      try {
        nextSocket.send(JSON.stringify(hello));
      } catch {
        nextSocket.close(1011, 'relay hello failed');
        if (!settled) {
          settled = true;
          close(false);
          fail(new Error('MINIPROGRAM_CUBE_RELAY_UNAVAILABLE'));
        } else {
          scheduleReconnect();
        }
        return;
      }
      if (isReconnect) {
        replayTimer = window.setTimeout(() => {
          replayTimer = null;
          if (socket === nextSocket) {
            nextSocket.close(1012, 'relay replay timeout');
            scheduleReconnect();
          }
        }, REPLAY_TIMEOUT_MS);
      }
    });

    nextSocket.addEventListener('message', (event) => {
      if (!active || socket !== nextSocket || typeof event.data !== 'string') return;
      let payload: unknown;
      try {
        payload = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }
      if (isSmartCubeRelayReady(payload)) {
        if (payload.role !== 'sink' || payload.lastMoveSeq !== lastMoveSeq) {
          terminateRelay();
          return;
        }
        reconnectAttempt = 0;
        if (replayTimer !== null) window.clearTimeout(replayTimer);
        replayTimer = null;
        if (isReconnect || navigated) return;
        navigated = true;
        try {
          miniProgramApi.navigateTo({
            url: `/pages/smart-cube/index?token=${encodeURIComponent(token)}`,
            fail: () => {
              if (settled) return;
              settled = true;
              close(false);
              fail(new Error('MINIPROGRAM_SMART_CUBE_PAGE_UNAVAILABLE'));
            },
          });
        } catch {
          if (settled) return;
          settled = true;
          close(false);
          fail(new Error('MINIPROGRAM_SMART_CUBE_PAGE_UNAVAILABLE'));
        }
        return;
      }
      if (!isSmartCubeRelayPayload(payload) || payload.type === 'command') return;
      handlePayload(payload);
    });

    nextSocket.addEventListener('error', () => {
      if (!active || socket !== nextSocket || settled) return;
      settled = true;
      close(false);
      fail(new Error('MINIPROGRAM_CUBE_RELAY_UNAVAILABLE'));
    });

    nextSocket.addEventListener('close', (event) => {
      if (!active || socket !== nextSocket) return;
      socket = null;
      if (replayTimer !== null) window.clearTimeout(replayTimer);
      replayTimer = null;
      if (!settled) {
        settled = true;
        close(false);
        fail(new Error('MINIPROGRAM_CUBE_RELAY_CLOSED'));
      } else {
        const closeEvent = event as CloseEvent;
        if (closeEvent.reason === 'relay replay unavailable') {
          terminateRelay();
          return;
        }
        scheduleReconnect();
      }
    });
  }

  const timeout = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    close(true);
    fail(new Error('MINIPROGRAM_CUBE_CONNECT_TIMEOUT'));
  }, CONNECT_TIMEOUT_MS);

  openSocket(false);
  return connectionPromise;
}
