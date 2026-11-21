import { timerRoomQrSvg } from '@cuberoot/timer-ui/room-qr';
import {
  createTimerLivePublisher, parseTimerLiveSession, TIMER_LIVE_MAX_BYTES, TIMER_LIVE_PATH, TIMER_LIVE_SHARE_COPY,
  TIMER_LIVE_STALE_MS, timerLiveWatchFragment, type TimerLiveConnection, type TimerLiveSession, type TimerLiveSource,
} from '@cuberoot/shared/timer/live-share';
import { ApiError, requestJson } from './auth';
import { getMiniProgramLocale, localizedWebsitePath, tr } from './i18n';
import { nativeTimerTextBytes } from './native-timer-text';
import { miniProgramApi } from './platform';
import { API_ORIGIN, SITE_ORIGIN } from './runtime-config';

const path = TIMER_LIVE_PATH.slice(3); // Both Mini Program request helpers already include /v1.
const websocket = `${API_ORIGIN.replace(/^https:/, 'wss:')}${path}/socket`;

/** Owns a single publisher. The watching link and host credential never share a field. */
export function createNativeTimerLiveShare(source: TimerLiveSource, onChange: () => void, transport = {
  connect: () => miniProgramApi().connectSocket({ url: websocket }),
  create: () => requestJson<unknown>(path, { method: 'POST', timeoutMs: 10_000 }),
  async revoke(session: TimerLiveSession) {
    try {
      await requestJson(`${path}/${session.id}`, { method: 'DELETE', token: session.token, timeoutMs: 10_000 });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
  },
}) {
  let session: TimerLiveSession | null = null;
  let enabled = false, disposed = false, busy = false, revoking = false, error = false;
  let connection: TimerLiveConnection = 'idle', viewers = 0, retries = 0;
  let socket: WechatMiniprogram.SocketTask | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let publish: ReturnType<typeof setInterval> | undefined, heartbeat: ReturnType<typeof setInterval> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const notify = () => { if (!disposed) onChange(); };
  const watchUrl = () => session
    ? `${SITE_ORIGIN}${localizedWebsitePath('/timer/watch')}#${timerLiveWatchFragment(session)}` : null;
  function disconnect() {
    clearTimeout(retry);
    clearInterval(publish);
    clearInterval(heartbeat);
    const current = socket;
    socket = undefined;
    viewers = 0;
    try { current?.close({ code: 1000 }); } catch { /* the owner is already gone */ }
  }
  function expire() {
    disconnect();
    clearTimeout(expiry);
    session = null;
    revoking = false;
    connection = 'idle';
    notify();
  }
  function reconnect() {
    disconnect();
    if (!enabled || !session || disposed || revoking) return;
    connection = 'disconnected';
    notify();
    retry = setTimeout(connect, Math.min(5000, 500 * 2 ** retries++));
  }
  function connect() {
    if (!enabled || disposed || !session || revoking) return;
    if (session.expiresAt <= Date.now()) { expire(); return; }
    const { id, token } = session;
    connection = 'connecting';
    notify();
    let current: WechatMiniprogram.SocketTask;
    try { current = transport.connect(); } catch { reconnect(); return; }
    socket = current;
    const owns = () => socket === current;
    let opened = false, lastReceived = Date.now();
    const failed = () => { if (owns()) reconnect(); };
    const publisher = createTimerLivePublisher({ source, now: Date.now, send(message) {
      if (!owns() || !opened) return false;
      const data = JSON.stringify(message);
      if (nativeTimerTextBytes(data) > TIMER_LIVE_MAX_BYTES) {
        disconnect(); connection = 'error'; notify(); return false;
      }
      try { current.send({ data, fail: failed }); return owns(); } catch { failed(); return false; }
    } });
    current.onOpen(() => {
      if (!owns()) return;
      opened = true; lastReceived = Date.now();
      try { current.send({ data: JSON.stringify({ type: 'hello', version: 1, role: 'host', id, token }), fail: failed }); }
      catch { failed(); }
    });
    current.onClose(event => {
      if (!owns()) return;
      const code = Number(event.code);
      if (code === 4001) expire();
      else if (code === 1008 || code === 4000 || code === 4003) { disconnect(); connection = 'error'; notify(); }
      else reconnect();
    });
    current.onError(failed);
    current.onMessage(({ data }) => {
      if (!owns() || typeof data !== 'string' || data.length > TIMER_LIVE_MAX_BYTES) return;
      let message: Record<string, unknown>;
      try { message = JSON.parse(data); if (!message || typeof message !== 'object') return; } catch { return; }
      lastReceived = Date.now();
      switch (message.type) {
        case 'ready':
          connection = 'connected'; retries = 0; notify(); break;
        case 'status':
          if (typeof message.viewers === 'number') { viewers = message.viewers; notify(); } break;
      }
      publisher.receive(message);
    });
    publish = setInterval(publisher.flush, 50);
    heartbeat = setInterval(() => {
      if (Date.now() - lastReceived > TIMER_LIVE_STALE_MS) failed();
      else publisher.ping();
    }, 2000);
  }
  return {
    snapshot() {
      const paused = revoking || !enabled;
      return {
        active: Boolean(session), busy, paused,
        status: !session ? '' : tr(paused ? TIMER_LIVE_SHARE_COPY.paused
          : connection === 'connected' ? TIMER_LIVE_SHARE_COPY.watching(viewers)
            : connection === 'error' ? TIMER_LIVE_SHARE_COPY.unavailable : TIMER_LIVE_SHARE_COPY.connecting),
        badge: !session ? '' : tr(paused ? TIMER_LIVE_SHARE_COPY.paused
          : connection === 'connected' ? TIMER_LIVE_SHARE_COPY.watching(viewers) : TIMER_LIVE_SHARE_COPY.disconnected),
        error: error ? tr(revoking ? TIMER_LIVE_SHARE_COPY.revokeError : TIMER_LIVE_SHARE_COPY.error) : '',
      };
    },
    watchUrl,
    qr() {
      const url = watchUrl();
      return url && enabled && !revoking
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(timerRoomQrSvg(url))}`
        : '';
    },
    setEnabled(value: boolean) {
      if (disposed || enabled === value) return;
      enabled = value;
      if (enabled) connect(); else disconnect();
      notify();
    },
    async start() {
      if (busy || session || !enabled || disposed) return;
      busy = true; error = false; notify();
      try {
        const next = parseTimerLiveSession(await transport.create());
        if (!next) throw new Error('Invalid live share session');
        if (disposed) { void transport.revoke(next).catch(() => {}); return; }
        session = next;
        expiry = setTimeout(expire, next.expiresAt - Date.now());
        connect();
      } catch { error = true; }
      finally { busy = false; notify(); }
    },
    async stop() {
      if (!session || busy || disposed) return;
      busy = revoking = true; error = false;
      disconnect(); notify();
      try { await transport.revoke(session); expire(); }
      catch { error = true; }
      finally { busy = false; notify(); }
    },
    dispose() {
      disposed = true;
      disconnect();
      clearTimeout(expiry);
      if (session) void transport.revoke(session).catch(() => {});
      session = null;
    },
  };
}

export function nativeTimerLiveShareCopy(language = getMiniProgramLocale()) {
  const t = TIMER_LIVE_SHARE_COPY;
  return { title: tr(t.title, language), description: tr(t.description, language), create: tr(t.create, language), creating: tr(t.creating, language),
    copy: tr(t.copy, language), copied: tr(t.copied, language), qr: tr(t.qr, language), end: tr(t.end, language), error: tr(t.error, language) };
}
