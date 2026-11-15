import { cubingHttp } from './cubing_source.js';

interface Subscriber { controller: ReadableStreamDefaultController<Uint8Array>; detach: () => void }
interface Relay {
  abort: AbortController;
  ready: Promise<Response>;
  subscribers: Set<Subscriber>;
  readers: number;
  started: boolean;
}
const relays = new Map<string, Relay>();
const failures = new Map<string, number>();

/** Invalidation is handled once per upstream event, before its bytes reach any viewer. */
function invalidateEvent(slug: string, frame: string): void {
  const type = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
  const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
  if (!data && !type) return; // heartbeats never expire snapshots
  try {
    const message = JSON.parse(data);
    if (!/^(round\.|result\.|results\.|advancement\.)/.test(type || message.type || '')) return;
    const round = (message.payload ?? message).round;
    cubingHttp.invalidate(slug, typeof round?.eventId === 'string' ? round.eventId : undefined,
      Number.isSafeInteger(round?.roundNumber) ? round.roundNumber : undefined);
  } catch {
    if (type && /^(round\.|result\.|results\.|advancement\.)/.test(type)) cubingHttp.invalidate(slug);
  }
}

function release(slug: string, relay: Relay): void {
  if (relay.readers || relay.subscribers.size) return;
  relay.abort.abort();
  if (relays.get(slug) === relay) relays.delete(slug);
}

async function pump(slug: string, relay: Relay, response: Response): Promise<void> {
  const reader = response.body!.getReader();
  const cancelReader = () => { void reader.cancel().catch(() => {}); };
  relay.abort.signal.addEventListener('abort', cancelReader, { once: true });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const broadcast = (frame: string) => {
    invalidateEvent(slug, frame);
    const bytes = encoder.encode(frame + '\n\n');
    for (const sub of [...relay.subscribers]) {
      // Disconnect a stalled consumer instead of accumulating an unlimited SSE backlog.
      if ((sub.controller.desiredSize ?? 0) <= 0) {
        sub.controller.error(new Error('Live stream consumer is too slow'));
        sub.detach();
      } else sub.controller.enqueue(bytes.slice());
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Match both LF and CRLF, including separators split across network chunks.
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index).replaceAll('\r\n', '\n');
        buffer = buffer.slice(boundary.index + boundary[0].length);
        broadcast(frame);
      }
      if (buffer.length > 1024 * 1024) throw new Error('Oversized cubing live event');
    }
  } catch {
    // Closing downstream lets EventSource reconnect; normal polling continues meanwhile.
    if (!relay.abort.signal.aborted) failures.set(slug, Date.now() + 15_000);
  } finally {
    relay.abort.signal.removeEventListener('abort', cancelReader);
    relay.abort.abort();
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    for (const sub of [...relay.subscribers]) { sub.controller.close(); sub.detach(); }
    if (relays.get(slug) === relay) relays.delete(slug);
  }
}

/** One upstream connection per viewed competition, regardless of viewer count. */
export async function openCubingStream(slug: string, signal: AbortSignal): Promise<Response> {
  signal.throwIfAborted();
  for (const [key, until] of failures) if (until <= Date.now()) failures.delete(key);
  while (failures.size > 1000) failures.delete(failures.keys().next().value!);
  if (failures.has(slug) || cubingHttp.retryDelayMs() > 0) throw new Error('Cubing live stream is cooling down');
  let relay = relays.get(slug);
  if (!relay) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15_000);
    const ready = fetch(`https://api.cubing.com/competitions/${encodeURIComponent(slug)}/live/stream`, {
      headers: { accept: 'text/event-stream', 'User-Agent': 'cuberoot.me-server/1.0 (+https://cuberoot.me)' }, signal: abort.signal,
    }).then(async response => {
      if (abort.signal.aborted) {
        await response.body?.cancel();
        abort.signal.throwIfAborted();
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
        cubingHttp.observeThrottle(response);
        await response.body?.cancel();
        throw new Error('Cubing live stream unavailable');
      }
      // Recover any changes missed while there were no viewers or the connection was down.
      cubingHttp.invalidate(slug);
      return response;
    }).finally(() => clearTimeout(timeout));
    relay = { abort, ready, subscribers: new Set(), readers: 0, started: false };
    relays.set(slug, relay);
  }
  const shared = relay;
  shared.readers++;
  let awaiting = true;
  const cancelWaiting = () => {
    if (!awaiting) return;
    awaiting = false;
    shared.readers--;
    release(slug, shared);
  };
  signal.addEventListener('abort', cancelWaiting, { once: true });
  try {
    const response = await shared.ready;
    signal.throwIfAborted();
    let detach = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const sub: Subscriber = { controller, detach: () => {
          signal.removeEventListener('abort', abortSubscriber);
          shared.subscribers.delete(sub);
          release(slug, shared);
        } };
        const abortSubscriber = () => { controller.close(); sub.detach(); };
        shared.subscribers.add(sub);
        signal.addEventListener('abort', abortSubscriber, { once: true });
        detach = sub.detach;
      },
      cancel() { detach(); },
    }, { highWaterMark: 64 });
    // Start after synchronous subscriber setup. Late viewers need no replay: they fetch snapshots.
    if (!shared.started) { shared.started = true; queueMicrotask(() => void pump(slug, shared, response)); }
    return new Response(body, { headers: {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no',
    } });
  } catch (error) {
    if (!signal.aborted) failures.set(slug, Date.now() + 30_000);
    throw error;
  } finally {
    signal.removeEventListener('abort', cancelWaiting);
    if (awaiting) { awaiting = false; shared.readers--; }
    release(slug, shared);
  }
}
