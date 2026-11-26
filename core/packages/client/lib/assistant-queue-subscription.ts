import type { AssistantQueueSnapshot } from '@cuberoot/shared/site-assistant';
import { assistantQueueRequest, watchAssistantQueue } from './assistant-queue';

interface QueueSubscription {
  initialActive: boolean;
  background: boolean;
  isCurrentOwner(): boolean;
  revision(): number | undefined;
  onSnapshot(snapshot: AssistantQueueSnapshot, transport: 'poll' | 'sse'): void;
}

/** Start with a full snapshot. SSE supplies active updates while polling repairs gaps. */
export function subscribeAssistantQueue(id: string, options: QueueSubscription): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stream: AbortController | undefined;
  let active = options.initialActive;
  let connected = false;
  let reconnectAfter = 0;
  let first = true;
  let reading = false;
  let again = false;
  let wakeScheduled = false;

  function schedule(ms: number) {
    clearTimeout(timer);
    wakeScheduled = ms === 35;
    timer = setTimeout(() => { wakeScheduled = false; void poll(); }, ms);
  }

  function wake() {
    if (controller.signal.aborted) return;
    if (reading) again = true;
    else if (!wakeScheduled) schedule(35);
  }

  function apply(snapshot: AssistantQueueSnapshot, transport: 'sse' | 'poll') {
    if (snapshot.revision < (options.revision() ?? -1)) return;
    active = !!snapshot.activeId || (!snapshot.paused && snapshot.messages.some(row => row.state === 'queued'));
    options.onSnapshot(snapshot, transport);
    if (!active) {
      stream?.abort();
      stream = undefined;
      connected = false;
    }
  }

  function listen() {
    if (stream || !active || options.background || Date.now() < reconnectAfter) return;
    const child = new AbortController();
    stream = child;
    void watchAssistantQueue(id, AbortSignal.any([controller.signal, child.signal]), snapshot => {
      if (controller.signal.aborted || child.signal.aborted || !options.isCurrentOwner()) return;
      if (!connected && snapshot && !reading)schedule(10_000);
      connected = true;
      if (snapshot) {first=false;apply(snapshot, 'sse');}
      else wake();
    }).catch(() => {}).finally(() => {
      if (stream !== child) return;
      stream = undefined;
      connected = false;
      reconnectAfter = Date.now() + 5000;
      if (controller.signal.aborted || !options.isCurrentOwner()) return;
      if (first && !reading) {
        // A server or proxy may decline SSE before sending the first snapshot.
        clearTimeout(timer);
        void poll();
      } else wake();
    });
  }

  async function poll() {
    if (reading || controller.signal.aborted) return;
    reading = true;
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
      const data = await assistantQueueRequest(id, '', undefined, signal, undefined, first ? undefined : options.revision());
      first = false;
      if (controller.signal.aborted || !options.isCurrentOwner()) return;
      if (data && 'messages' in data) apply(data, 'poll');
      listen();
    } catch { /* Keep the last confirmed snapshot until reconnect. */ }
    finally {
      reading = false;
      const interval = !active || connected ? 10_000 : options.background ? 5000 : 1000;
      if (!controller.signal.aborted) schedule(again ? 35 : interval);
      again = false;
    }
  }

  if (active && !options.background) {
    // The stream starts with a full snapshot. Keep a bounded fallback for a
    // proxy that accepts the connection but buffers or drops its first frame.
    listen();
    schedule(1000);
  } else void poll();
  return () => {
    controller.abort();
    stream?.abort();
    clearTimeout(timer);
  };
}
