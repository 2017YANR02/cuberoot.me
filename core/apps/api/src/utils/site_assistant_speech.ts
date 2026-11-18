import { createHash } from 'node:crypto';

export function speechConfig(env = process.env) {
  if (env.SITE_ASSISTANT_TTS_ENABLED !== '1') return null;
  const key = env.SITE_ASSISTANT_TTS_API_KEY || env.SITE_ASSISTANT_API_KEY;
  const base = env.SITE_ASSISTANT_TTS_BASE_URL;
  if (!key || !base) return null;
  const url = new URL(base);
  if (url.protocol !== 'https:' || !/^ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return null;
  return { key, origin: url.origin, model: env.SITE_ASSISTANT_TTS_MODEL || 'qwen-audio-3.1-tts-flash', voice: env.SITE_ASSISTANT_TTS_VOICE || 'longanhuan_v3.1' };
}
export function speechChunks(text: string): string[] {
  if (!text.trim() || text.length > 30_000) throw new Error('invalid_text');
  return text.match(/[\s\S]{1,500}(?:[。！？.!?\s]|$)|[\s\S]{1,500}/gu) ?? [];
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

/** Bounded private process cache; no text or credentials are written to logs. */
export function createSpeechSynthesizer(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { audio: Buffer; expires: number }>();
  const active = new Set<number>();
  const usage = new Map<number, { day: number; characters: number }>();
  let bytes = 0;
  return async (uid: number, text: string, lang: 'zh' | 'en', signal: AbortSignal) => {
    const config = speechConfig();
    if (!config) throw new Error('speech_unavailable');
    const hash = createHash('sha256').update(JSON.stringify([uid, config.origin, config.model, config.voice, lang, text])).digest('hex');
    for (const [key, item] of cache) if (item.expires <= now()) { bytes -= item.audio.length; cache.delete(key); }
    const hit = cache.get(hash);
    if (hit) return hit.audio;
    const day = Math.floor(now() / 86_400_000);
    for (const [id, item] of usage) if (item.day !== day) usage.delete(id);
    const spent = usage.get(uid)?.characters ?? 0;
    if (spent + text.length > 30_000 || active.has(uid) || active.size >= 4 || usage.size >= 1000 && !usage.has(uid)) throw new Error('speech_limit');
    usage.set(uid, { day, characters: spent + text.length });
    active.add(uid);
    const started = now();
    let success = false;
    try {
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(45_000)]);
      const response = await fetcher(`${config.origin}/api/v1/services/audio/tts/SpeechSynthesizer`, {
        method: 'POST', signal: deadline, redirect: 'error',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, input: { text, voice: config.voice, format: 'mp3', language_hints: [lang] } }),
      });
      const result = JSON.parse((await bounded(response, 64_000)).toString());
      const url = new URL(result.output?.audio?.url);
      // Only provider OSS results, never arbitrary URLs or redirects.
      if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.oss-cn-beijing\.aliyuncs\.com$/.test(url.hostname) || url.port || url.username || url.password) throw new Error('speech_unavailable');
      const audio = await bounded(await fetcher(url, { signal: deadline, redirect: 'error' }), 4 * 1024 * 1024);
      if (!audio.length) throw new Error('speech_unavailable');
      signal.throwIfAborted();
      while (bytes + audio.length > 32 * 1024 * 1024 || cache.size >= 128) {
        const key = cache.keys().next().value!; bytes -= cache.get(key)!.audio.length; cache.delete(key);
      }
      cache.set(hash, { audio, expires: now() + 600_000 }); bytes += audio.length;
      success = true;
      return audio;
    } finally {
      active.delete(uid);
      console.info(JSON.stringify({ event: 'assistant_tts', model: config.model, characters: text.length, durationMs: now() - started, success }));
    }
  };
}
export const synthesizeAssistantSpeech = createSpeechSynthesizer();
