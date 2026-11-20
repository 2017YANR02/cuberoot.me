/**
 * Speech-synthesis voice cues for inspection. Browser TTS only — no external
 * service. If `window.speechSynthesis` is unavailable, callers should fall
 * back to the original beep cues.
 */

import type { TimerSoundSettings } from '@cuberoot/shared/timer';
import { TIMER_INSPECTION_VOICE_PHRASES, type TimerInspectionVoiceCue } from '@cuberoot/shared/timer/sound-feedback';

export function createTimerVoice(getSettings: () => TimerSoundSettings) {
  const _last: Partial<Record<TimerInspectionVoiceCue, number>> = {};
  let generation = 0;

  function isVoiceAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.speechSynthesis?.speak === 'function'
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Cancel any in-flight or queued utterances. Wire to visibilitychange + unmount. */
  function cancelVoice(): void {
    generation++;
    for (const cue of Object.keys(_last) as TimerInspectionVoiceCue[]) delete _last[cue];
    if (!isVoiceAvailable()) return;
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }

  let _voiceCache: SpeechSynthesisVoice[] = [];

  const MALE_PATTERNS = ['Male', 'Daniel', 'Alex', 'Microsoft Mark', '云健'];
  const FEMALE_PATTERNS = ['Female', 'Samantha', 'Zira', 'Microsoft Zira', '晓晓', '云希'];

  type VoiceVariant = 'en-male' | 'en-female' | 'zh-male' | 'zh-female';

  function parseVariant(variant: VoiceVariant): { lang: 'en' | 'zh'; gender: 'male' | 'female' } {
    const [lang, gender] = variant.split('-') as ['en' | 'zh', 'male' | 'female'];
    return { lang, gender };
  }

  function pickVoice(variant: VoiceVariant): SpeechSynthesisVoice | null {
    if (!isVoiceAvailable()) return null;
    try { _voiceCache = window.speechSynthesis.getVoices() || []; } catch { /* ignore */ }
    if (_voiceCache.length === 0) return null;

    const { lang, gender } = parseVariant(variant);
    const patterns = gender === 'male' ? MALE_PATTERNS : FEMALE_PATTERNS;

    const langMatches = _voiceCache.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang));
    if (langMatches.length === 0) return null;

    for (const v of langMatches) {
      if (patterns.some(p => v.name.includes(p))) return v;
    }
    return langMatches[0] ?? null;
  }

  function speakInspectionCue(cue: TimerInspectionVoiceCue, isZh: boolean, onUnavailable?: () => void): boolean {
    if (!isVoiceAvailable()) return false;
    const now = Date.now();
    if (_last[cue] && now - _last[cue]! < 1000) return true;
    try {
      const synth = window.speechSynthesis;
      const setting = getSettings().voiceInspection;
      let variant: VoiceVariant;
      if (setting === 'none') {
        // Caller should not have invoked us; fall back to a sensible default.
        variant = isZh ? 'zh-female' : 'en-female';
      } else {
        variant = setting;
      }
      const phraseIsZh = variant.startsWith('zh');
      const u = new SpeechSynthesisUtterance(TIMER_INSPECTION_VOICE_PHRASES[cue][phraseIsZh ? 'zh' : 'en']);
      u.lang = phraseIsZh ? 'zh-CN' : 'en-US';
      u.rate = 1.1;
      u.volume = getSettings().volume;
      const v = pickVoice(variant);
      if (!v) return false;
      u.voice = v;
      const currentGeneration = generation;
      u.onerror = event => {
        if (generation !== currentGeneration || event.error === 'canceled' || event.error === 'interrupted') return;
        delete _last[cue];
        onUnavailable?.();
      };
      synth.speak(u);
      _last[cue] = now;
      return true;
    } catch {
      return false;
    }
  }
  return { isVoiceAvailable, cancelVoice, speakInspectionCue };
}
