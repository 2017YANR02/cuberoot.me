/**
 * Speech-synthesis voice cues for inspection. Browser TTS only — no external
 * service. If `window.speechSynthesis` is unavailable, callers should fall
 * back to the original beep cues.
 */

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

export function speakInspectionCue(cue: VoiceCue, isZh: boolean): boolean {
  if (!isVoiceAvailable()) return false;
  const now = Date.now();
  if (_last[cue] && now - _last[cue]! < 1000) return true;
  _last[cue] = now;
  try {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(phrase(cue, isZh));
    u.lang = isZh ? 'zh-CN' : 'en-US';
    u.rate = 1.1;
    u.volume = 1;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
