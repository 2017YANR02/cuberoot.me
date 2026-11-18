import { apiUrl } from './api-base';
import { authHeaders } from './admin-api';
import { sessionFetch } from './session-fetch';

export async function playAssistantSpeech(input: { messageId?: string; requestId?: string; answer: string; lang: 'zh' | 'en' }, signal: AbortSignal, onPlaying: () => void) {
  const audio = new Audio();
  let url: string | undefined;
  const stop = () => { audio.pause(); audio.removeAttribute('src'); audio.load(); };
  signal.addEventListener('abort', stop, { once: true });
  try {
    let total = 1;
    for (let chunk = 0; chunk < total; chunk++) {
      signal.throwIfAborted();
      const response = await sessionFetch(apiUrl('/v1/site-assistant/speech'), { method: 'POST', headers: authHeaders(), signal, body: JSON.stringify({ ...input, chunk }) });
      if (!response.ok) throw new Error('speech_unavailable');
      const result = await response.json();
      if (typeof result.audio !== 'string' || result.audio.length > 6_000_000 || !Number.isInteger(result.total) || result.total < 1 || result.total > 100) throw new Error('invalid_audio');
      total = result.total;
      signal.throwIfAborted();
      const bytes = Uint8Array.from(atob(result.audio), character => character.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      audio.src = url;
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { audio.onended = null; audio.onerror = null; signal.removeEventListener('abort', abort); };
        const abort = () => { cleanup(); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); reject(new Error('playback_failed')); };
        signal.addEventListener('abort', abort, { once: true });
        audio.play().then(() => { if (!signal.aborted) onPlaying(); }, error => { cleanup(); reject(error); });
      });
      URL.revokeObjectURL(url); url = undefined;
    }
  } finally {
    signal.removeEventListener('abort', stop); stop();
    if (url) URL.revokeObjectURL(url);
  }
}
