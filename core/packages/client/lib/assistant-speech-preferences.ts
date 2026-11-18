import { apiUrl } from './api-base';
import { authHeaders } from './admin-api';
import { sessionFetch } from './session-fetch';

export const speechRates = [0.75, 1, 1.25, 1.5, 2] as const;
type Preferences = { voice: string; rate: number };
export type SpeechVoiceOptions = { defaultVoice: string; voices: { id: string; name: { zh: string; en: string } }[] };
const key = 'assistant-speech-preferences-v1';
const defaults: Preferences = { voice: '', rate: 1 };
let snapshot = defaults, loaded = false;
const listeners = new Set<() => void>();
function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    const voice = typeof value?.voice === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(value.voice) ? value.voice : '';
    const rate = speechRates.includes(value?.rate) ? value.rate as number : 1;
    if (snapshot.voice !== voice || snapshot.rate !== rate) snapshot = { voice, rate };
  } catch { /* Private browsing or malformed storage retains usable defaults. */ }
}
export function getSpeechPreferences() {
  if (!loaded && typeof window !== 'undefined') { loaded = true; readStorage(); }
  return snapshot;
}
export const getServerSpeechPreferences = () => defaults;
export function setSpeechPreferences(update: Partial<Preferences>) {
  const current = getSpeechPreferences();
  const voice = update.voice ?? current.voice, rate = update.rate ?? current.rate;
  if (voice && !/^[a-zA-Z0-9_.-]{1,100}$/.test(voice) || !speechRates.some(value => value === rate)) return;
  if (voice === current.voice && rate === current.rate) return;
  snapshot = { voice, rate };
  try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch { /* In-memory settings still work. */ }
  listeners.forEach(notify => notify());
}
function onStorage(event: StorageEvent) {
  if (event.key !== key && event.key !== null) return;
  readStorage(); listeners.forEach(notify => notify());
}
export function subscribeSpeechPreferences(notify: () => void) {
  if (!listeners.size) window.addEventListener('storage', onStorage);
  listeners.add(notify);
  return () => { listeners.delete(notify); if (!listeners.size) window.removeEventListener('storage', onStorage); };
}
let options: SpeechVoiceOptions | undefined, expires = 0, pending: Promise<SpeechVoiceOptions> | undefined;
/** Deduplicate menus from multiple answers; never cache credentials or failures. */
export function loadSpeechVoices(): Promise<SpeechVoiceOptions> {
  if (options && Date.now() < expires) return Promise.resolve(options);
  if (pending) return pending;
  pending = (async () => {
    const response = await sessionFetch(apiUrl('/v1/site-assistant/speech/options'), { headers: authHeaders(), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('speech_unavailable');
    const value = await response.json();
    if (typeof value.defaultVoice !== 'string' || !Array.isArray(value.voices) || !value.voices.length || value.voices.length > 20 || !value.voices.every((voice: SpeechVoiceOptions['voices'][number]) => typeof voice?.id === 'string' && typeof voice.name?.zh === 'string' && typeof voice.name?.en === 'string')) throw new Error('invalid_voices');
    options = value; expires = Date.now() + 60_000;
    return value as SpeechVoiceOptions;
  })().finally(() => { pending = undefined; });
  return pending;
}
