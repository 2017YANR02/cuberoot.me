import { readAssistantEvents } from '@cuberoot/shared/site-assistant';
import { apiUrl } from './api-base';
import { authHeaders } from './admin-api';
import { sessionFetch } from './session-fetch';
import { getSpeechPreferences, subscribeSpeechPreferences } from './assistant-speech-preferences';

const invalidAudio = () => new Error('invalid_audio');
function audioBytes(encoded: unknown): Uint8Array<ArrayBuffer> {
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > 6_000_000 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw invalidAudio();
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  if (bytes.length > 4 * 1024 * 1024) throw invalidAudio();
  return bytes;
}
function validTotal(total: unknown): total is number { return Number.isInteger(total) && (total as number) >= 1 && (total as number) <= 200; }

/** Wait for an MSE operation without leaving listeners behind on stop/error. */
function mediaEvent(target: EventTarget, event: string, signal: AbortSignal, action?: () => void) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener('error', failed); signal.removeEventListener('abort', abort); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('playback_failed')); };
    const abort = () => { cleanup(); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    try { action?.(); } catch (error) { cleanup(); reject(error); }
  });
}

export async function playAssistantSpeech(input: { messageId?: string; requestId?: string; answer: string; lang: 'zh' | 'en'; voice?: string }, signal: AbortSignal, onPlaying: () => void) {
  const audio = new Audio();
  const applyRate = () => { audio.playbackRate = getSpeechPreferences().rate; audio.defaultPlaybackRate = audio.playbackRate; audio.preservesPitch = true; };
  applyRate();
  const unsubscribeRate = subscribeSpeechPreferences(applyRate);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const playbackSignal = controller.signal;
  const streaming = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg');
  let url: string | undefined;
  const stop = () => { audio.pause(); audio.removeAttribute('src'); audio.load(); };
  playbackSignal.addEventListener('abort', stop, { once: true });
  const fetchChunk = async (chunk: number) => {
    playbackSignal.throwIfAborted();
    const response = await sessionFetch(apiUrl('/v1/site-assistant/speech'), { method: 'POST', headers: authHeaders(), signal: playbackSignal, body: JSON.stringify({ ...input, chunk, ...(streaming ? { stream: true } : {}) }) });
    if (!response.ok) throw new Error('speech_unavailable');
    return response;
  };
  // Only one next segment is in flight; errors surface at the segment boundary.
  const prepare = (chunk: number) => fetchChunk(chunk).then(value => ({ value, error: null } as const), error => ({ value: null, error } as const));
  try {
    let total = 1;
    let pending = prepare(0);
    for (let chunk = 0; chunk < total; chunk++) {
      const prepared = await pending;
      if (!prepared.value) throw prepared.error;
      const response = prepared.value;
      playbackSignal.throwIfAborted();
      const setTotal = (value: unknown) => {
        if (!validTotal(value) || chunk > 0 && value !== total) throw invalidAudio();
        total = value;
      };
      const prefetch = () => { if (!playbackSignal.aborted && chunk + 1 < total) pending = prepare(chunk + 1); };
      let cleanupPlayback = () => {};
      const ended = new Promise<void>((resolve, reject) => {
        const abort = () => { cleanupPlayback(); reject(playbackSignal.reason ?? new DOMException('Aborted', 'AbortError')); };
        cleanupPlayback = () => { audio.onended = null; audio.onerror = null; playbackSignal.removeEventListener('abort', abort); };
        audio.onended = () => { cleanupPlayback(); resolve(); };
        audio.onerror = () => { cleanupPlayback(); reject(new Error('playback_failed')); };
        playbackSignal.addEventListener('abort', abort, { once: true });
      });
      void ended.catch(() => {});
      const play = async () => {
        await audio.play();
        playbackSignal.throwIfAborted();
        onPlaying();
        playbackSignal.throwIfAborted();
      };
      try {
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          if (!streaming || !response.body) throw invalidAudio();
          const consume = async () => {
            const source = new MediaSource();
            url = URL.createObjectURL(source);
            await mediaEvent(source, 'sourceopen', playbackSignal, () => { audio.src = url!; });
            const buffer = source.addSourceBuffer('audio/mpeg');
            let metadata = false, complete = false, size = 0;
            let playing: Promise<void> | undefined;
            for await (const data of readAssistantEvents(response.body!)) {
              playbackSignal.throwIfAborted();
              const frame = JSON.parse(data);
              if (frame.type === 'meta' && !metadata && !size && frame.mime === 'audio/mpeg') {
                setTotal(frame.total); metadata = true;
              } else if (frame.type === 'audio' && metadata) {
                const bytes = audioBytes(frame.audio);
                size += bytes.length;
                if (size > 4 * 1024 * 1024) throw invalidAudio();
                await mediaEvent(buffer, 'updateend', playbackSignal, () => buffer.appendBuffer(bytes));
                // Keep appending while play() waits for enough decodable frames.
                if (!playing) { playing = play(); void playing.catch(() => controller.abort(new Error('playback_failed'))); }
              } else if (frame.type === 'done' && metadata && size) {
                complete = true; break;
              } else { throw new Error('speech_unavailable'); }
            }
            if (!complete) throw new Error('speech_incomplete');
            playbackSignal.throwIfAborted();
            source.endOfStream();
            await playing;
            // The provider has released its per-user slot before this next call.
            prefetch();
          };
          await Promise.all([consume(), ended]);
        } else {
          const result = await response.json();
          setTotal(result.total);
          const mime = result.mime ?? 'audio/mpeg';
          if (mime !== 'audio/wav' && mime !== 'audio/mpeg') throw invalidAudio();
          const bytes = audioBytes(result.audio);
          playbackSignal.throwIfAborted();
          url = URL.createObjectURL(new Blob([bytes], { type: mime }));
          audio.src = url;
          await Promise.all([play().then(prefetch), ended]);
        }
      } finally { cleanupPlayback(); }
      URL.revokeObjectURL(url!); url = undefined;
    }
  } finally {
    unsubscribeRate();
    signal.removeEventListener('abort', cancel);
    controller.abort(); playbackSignal.removeEventListener('abort', stop); stop();
    if (url) URL.revokeObjectURL(url);
  }
}
