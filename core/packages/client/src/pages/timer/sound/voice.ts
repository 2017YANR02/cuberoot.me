/**
 * Speech-synthesis voice cues for inspection. Browser TTS only — no external
 * service. If `window.speechSynthesis` is unavailable, callers should fall
 * back to the original beep cues.
 */

import { getSettings } from '../settings';

type VoiceCue = 'warn-8' | 'warn-12' | 'start' | 'inspection-start';

const _last: Partial<Record<VoiceCue, number>> = {};

function phrase(cue: VoiceCue, isZh: boolean): string {
  if (isZh) {
    switch (cue) {
      case 'warn-8':           return '8 秒';
      case 'warn-12':          return '12 秒';
      case 'start':            return '开始';
      case 'inspection-start': return '观察';
    }
  }
  switch (cue) {
    case 'warn-8':           return '8 seconds';
    case 'warn-12':          return '12 seconds';
    case 'start':            return 'go';
    case 'inspection-start': return 'inspection';
  }
}

export function isVoiceAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Cancel any in-flight or queued utterances. Wire to visibilitychange + unmount. */
export function cancelVoice(): void {
  if (!isVoiceAvailable()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cancelVoice();
  });
  window.addEventListener('beforeunload', cancelVoice);
}

// Some browsers (Chrome) return [] from getVoices() until the
// `voiceschanged` event fires. We cache the latest result.
let _voiceCache: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    _voiceCache = window.speechSynthesis.getVoices() || [];
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      _voiceCache = window.speechSynthesis.getVoices() || [];
    });
  } catch { /* ignore */ }
}

const MALE_PATTERNS = ['Male', 'Daniel', 'Alex', 'Microsoft Mark', '云健'];
const FEMALE_PATTERNS = ['Female', 'Samantha', 'Zira', 'Microsoft Zira', '晓晓', '云希'];

function pickVoice(
  variant: 'en-male' | 'en-female' | 'zh-male' | 'zh-female',
): SpeechSynthesisVoice | null {
  if (!isVoiceAvailable()) return null;
  if (_voiceCache.length === 0) {
    try { _voiceCache = window.speechSynthesis.getVoices() || []; } catch { /* ignore */ }
  }
  if (_voiceCache.length === 0) return null;

  const langPrefix = variant.startsWith('zh') ? 'zh' : 'en';
  const isMale = variant.endsWith('male') && !variant.endsWith('female');
  const patterns = isMale ? MALE_PATTERNS : FEMALE_PATTERNS;

  const langMatches = _voiceCache.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
  if (langMatches.length === 0) return null;

  for (const v of langMatches) {
    if (patterns.some(p => v.name.includes(p))) return v;
  }
  return langMatches[0] ?? null;
}

export function speakInspectionCue(cue: VoiceCue, isZh: boolean): boolean {
  if (!isVoiceAvailable()) return false;
  const now = Date.now();
  if (_last[cue] && now - _last[cue]! < 1000) return true;
  _last[cue] = now;
  try {
    const synth = window.speechSynthesis;
    const setting = getSettings().voiceInspection;
    let variant: 'en-male' | 'en-female' | 'zh-male' | 'zh-female';
    if (setting === 'none') {
      // Caller should not have invoked us; fall back to a sensible default.
      variant = isZh ? 'zh-female' : 'en-female';
    } else {
      variant = setting;
    }
    const phraseIsZh = variant.startsWith('zh');
    const u = new SpeechSynthesisUtterance(phrase(cue, phraseIsZh));
    u.lang = phraseIsZh ? 'zh-CN' : 'en-US';
    u.rate = 1.1;
    u.volume = 1;
    const v = pickVoice(variant);
    if (v) u.voice = v;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
