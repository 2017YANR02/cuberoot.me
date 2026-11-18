import { createHash } from 'node:crypto';
import { readAssistantEvents } from '@cuberoot/shared/site-assistant';

export function speechConfig(env = process.env) {
  if (env.SITE_ASSISTANT_TTS_ENABLED !== '1') return null;
  const key = env.SITE_ASSISTANT_TTS_API_KEY || env.SITE_ASSISTANT_API_KEY || env.DASHSCOPE_API_KEY;
  const explicitBase = env.SITE_ASSISTANT_TTS_BASE_URL;
  const base = explicitBase || env.SITE_ASSISTANT_BASE_URL || 'https://dashscope.aliyuncs.com';
  if (!key || !base) return null;
  let url: URL;
  try { url = new URL(base); } catch { return null; }
  const validPath = explicitBase ? url.pathname === '/' : ['/', '/compatible-mode/v1', '/compatible-mode/v1/'].includes(url.pathname);
  if (url.protocol !== 'https:' || !(url.hostname === 'dashscope.aliyuncs.com' || /^ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname)) || url.username || url.password || url.port || !validPath || url.search || url.hash) return null;
  const model = env.SITE_ASSISTANT_TTS_MODEL || (url.hostname === 'dashscope.aliyuncs.com' ? 'qwen3-tts-flash' : 'qwen-audio-3.1-tts-flash');
  const qwenTts = /^qwen3-tts-flash(?:-\d{4}-\d{2}-\d{2})?$/.test(model);
  // The standard-host adapter is explicitly for the documented Qwen-TTS protocol.
  if (url.hostname === 'dashscope.aliyuncs.com' && !qwenTts) return null;
  return { key, origin: url.origin, model, qwenTts, voice: env.SITE_ASSISTANT_TTS_VOICE || (qwenTts ? 'Cherry' : 'longanhuan_v3.1') };
}
export function speechAudioType(audio: Buffer): 'audio/wav' | 'audio/mpeg' {
  return audio.toString('ascii', 0, 4) === 'RIFF' && audio.toString('ascii', 8, 12) === 'WAVE' ? 'audio/wav' : 'audio/mpeg';
}
export function speechChunks(text: string): string[] {
  if (!text.trim() || text.length > 30_000) throw new Error('invalid_text');
  const characters = Array.from(text), chunks: string[] = [];
  let offset = 0;
  while (offset < characters.length) {
    // A short opening reduces first-play latency; grow gradually so prefetch
    // can finish during the preceding audio, without a queue of paid requests.
    const limit = chunks.length === 0 ? 80 : chunks.length === 1 ? 160 : 320;
    let end = Math.min(offset + limit, characters.length);
    if (end < characters.length) {
      const minimum = offset + (chunks.length === 0 ? 20 : Math.floor(limit / 2));
      const sentenceEnds: number[] = [], wordEnds: number[] = [];
      for (let i = minimum; i < end; i++) {
        if (/[。！？.!?\n]/u.test(characters[i])) sentenceEnds.push(i + 1);
        if (/[，,；;\s]/u.test(characters[i])) wordEnds.push(i + 1);
      }
      end = (chunks.length === 0 ? sentenceEnds[0] : sentenceEnds.at(-1)) ?? wordEnds.at(-1) ?? end;
    }
    chunks.push(characters.slice(offset, end).join(''));
    offset = end;
  }
  return chunks;
}
async function bounded(response: Response, max: number): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error('speech_unavailable');
  const reader = response.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.length;
      if (size > max) throw new Error('speech_too_large');
      parts.push(item.value);
    }
    return Buffer.concat(parts);
  } finally { await reader.cancel().catch(() => {}); }
}

/** Read inline MP3 frames once, avoiding an extra connection to the OSS URL. */
async function inlineSpeechAudio(response: Response, signal: AbortSignal, onFirstAudio: () => void, onAudio?: (audio: Buffer) => Promise<void>): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error('speech_unavailable');
  const parts: Buffer[] = [];
  let size = 0, complete = false;
  for await (const data of readAssistantEvents(response.body)) {
    signal.throwIfAborted();
    if (data === '[DONE]') break;
    const frame = JSON.parse(data);
    if (frame.code) throw new Error('speech_unavailable');
    const encoded = frame.output?.audio?.data;
    if (encoded) {
      if (typeof encoded !== 'string' || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('invalid_audio');
      const audio = Buffer.from(encoded, 'base64');
      size += audio.length;
      if (size > 4 * 1024 * 1024) throw new Error('speech_too_large');
      if (!parts.length && audio.length) onFirstAudio();
      parts.push(audio);
      if (audio.length) await onAudio?.(audio);
    }
    if (frame.output?.finish_reason === 'stop') { complete = true; break; }
  }
  if (!complete || !size) throw new Error('speech_incomplete');
  return Buffer.concat(parts, size);
}

/** Bounded private process cache; no text or credentials are written to logs. */
export function createSpeechSynthesizer(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { audio: Buffer; expires: number }>();
  const active = new Set<number>();
  const usage = new Map<number, { day: number; characters: number }>();
  let bytes = 0;
  return async (uid: number, text: string, lang: 'zh' | 'en', signal: AbortSignal, onAudio?: (audio: Buffer) => Promise<void>) => {
    signal.throwIfAborted();
    const config = speechConfig();
    if (!config) throw new Error('speech_unavailable');
    const hash = createHash('sha256').update(JSON.stringify([uid, config.origin, config.model, config.voice, lang, text])).digest('hex');
    for (const [key, item] of cache) if (item.expires <= now()) { bytes -= item.audio.length; cache.delete(key); }
    const hit = cache.get(hash);
    if (hit) { await onAudio?.(hit.audio); return hit.audio; }
    const day = Math.floor(now() / 86_400_000);
    for (const [id, item] of usage) if (item.day !== day) usage.delete(id);
    const spent = usage.get(uid)?.characters ?? 0;
    if (spent + text.length > 30_000 || active.has(uid) || active.size >= 4 || usage.size >= 1000 && !usage.has(uid)) throw new Error('speech_limit');
    usage.set(uid, { day, characters: spent + text.length });
    active.add(uid);
    const started = now();
    let success = false;
    let phase = 'synthesis', upstreamStatus: number | undefined, firstAudioMs: number | undefined, failureCode: string | undefined;
    try {
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(45_000)]);
      const response = await fetcher(`${config.origin}${config.qwenTts ? '/api/v1/services/aigc/multimodal-generation/generation' : '/api/v1/services/audio/tts/SpeechSynthesizer'}`, {
        method: 'POST', signal: deadline, redirect: 'error',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', ...(!config.qwenTts ? { 'X-DashScope-SSE': 'enable' } : {}) },
        body: JSON.stringify({ model: config.model, input: config.qwenTts ? { text, voice: config.voice, language_type: lang === 'zh' ? 'Auto' : 'English' } : { text, voice: config.voice, format: 'mp3', language_hints: [lang] } }),
      });
      upstreamStatus = response.status;
      let audio: Buffer;
      if (!config.qwenTts && response.headers.get('content-type')?.includes('text/event-stream')) {
        phase = 'inline-audio';
        audio = await inlineSpeechAudio(response, deadline, () => { firstAudioMs = now() - started; }, onAudio);
      } else {
        const result = JSON.parse((await bounded(response, 64_000)).toString());
        const url = new URL(result.output?.audio?.url);
        // Official responses can contain HTTP OSS links; upgrade before any download.
        if (url.protocol === 'http:') url.protocol = 'https:';
        // Only provider OSS results, never arbitrary URLs or redirects.
        if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.oss-cn-beijing\.aliyuncs\.com$/.test(url.hostname) || url.port || url.username || url.password) throw new Error('speech_unavailable');
        phase = 'audio-download';
        audio = await bounded(await fetcher(url, { signal: deadline, redirect: 'error' }), 4 * 1024 * 1024);
        await onAudio?.(audio);
      }
      if (!audio.length) throw new Error('speech_unavailable');
      signal.throwIfAborted();
      while (bytes + audio.length > 32 * 1024 * 1024 || cache.size >= 128) {
        const key = cache.keys().next().value!; bytes -= cache.get(key)!.audio.length; cache.delete(key);
      }
      cache.set(hash, { audio, expires: now() + 600_000 }); bytes += audio.length;
      success = true;
      return audio;
    } catch (error) {
      const causeCode = (error as { cause?: { code?: unknown } })?.cause?.code;
      failureCode = signal.aborted ? 'cancelled' : typeof causeCode === 'string' && /^[A-Z0-9_]{1,60}$/.test(causeCode) ? causeCode : error instanceof Error && /^(speech_|invalid_audio)/.test(error.message) ? error.message : 'speech_unavailable';
      throw error;
    } finally {
      active.delete(uid);
      console.info(JSON.stringify({ event: 'assistant_tts', model: config.model, characters: text.length, durationMs: now() - started, firstAudioMs, phase, upstreamStatus, failureCode, success }));
    }
  };
}
export const synthesizeAssistantSpeech = createSpeechSynthesizer();
