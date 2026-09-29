export type TimerInspectionVoice = 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female';
export interface TimerSoundSettings {
  soundsEnabled: boolean;
  volume: number;
  voiceInspection: TimerInspectionVoice;
}
export function normalizeTimerSoundSettings(value: Partial<Record<keyof TimerSoundSettings, unknown>> = {}): TimerSoundSettings {
  return {
    soundsEnabled: value.soundsEnabled === true,
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : 0.5,
    voiceInspection: value.voiceInspection === 'en-male' || value.voiceInspection === 'en-female'
      || value.voiceInspection === 'zh-male' || value.voiceInspection === 'zh-female' ? value.voiceInspection : 'none',
  };
}
