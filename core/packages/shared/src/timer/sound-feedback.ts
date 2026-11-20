import type { TimerMachineTransition } from './machine';
import type { TimerInspectionVoice } from './sound-settings';

export const TIMER_SOUND_SETTINGS_COPY = {
  test: { zh: '试听', en: 'Test' },
  voiceUnavailable: { zh: '当前设备不支持语音', en: 'Voice unavailable on this device' },
  beepPlaceholder: { zh: '例：5,10,15（逗号分隔）', en: 'e.g. 5,10,15 (comma-separated)' },
};

export const TIMER_INSPECTION_ALERTS_COPY = {
  title: { zh: '额外观察提示', en: 'Extra inspection alerts' },
  helpLabel: { zh: '额外观察提示说明', en: 'About extra inspection alerts' },
  help: {
    zh: '按观察开始后的秒数响铃，留空关闭。独立于节拍器和提示音开关，仍使用上方音量。需在“计时”中开启 WCA 观察。',
    en: 'Beep at elapsed inspection seconds. Leave blank to turn off. Independent of the metronome and sound-effects switch. Uses the volume above. Enable WCA inspection under Timing.',
  },
};

export const TIMER_INSPECTION_VOICE_COPY = {
  none: { zh: '关闭（用提示音）', en: 'Off (beeps)' },
  'en-male': { zh: '英文 男声', en: 'English (male)' },
  'en-female': { zh: '英文 女声', en: 'English (female)' },
  'zh-male': { zh: '中文 男声', en: 'Chinese (male)' },
  'zh-female': { zh: '中文 女声', en: 'Chinese (female)' },
} satisfies Record<TimerInspectionVoice, { en: string; zh: string }>;

export interface TimerAudioNote {
  freq: number;
  ms: number;
  type?: 'sine' | 'sawtooth';
}

export const TIMER_AUDIO_CUES = {
  'inspection-start': [{ freq: 660, ms: 80 }],
  'warn-8': [{ freq: 880, ms: 100 }, { freq: 880, ms: 100 }],
  'warn-12': [{ freq: 990, ms: 120 }, { freq: 990, ms: 120 }, { freq: 990, ms: 120 }],
  start: [{ freq: 440, ms: 50 }],
  stop: [{ freq: 740, ms: 50 }, { freq: 880, ms: 80 }],
  penalty: [{ freq: 220, ms: 200, type: 'sawtooth' }],
} as const satisfies Record<string, readonly TimerAudioNote[]>;

export type TimerAudioCue = keyof typeof TIMER_AUDIO_CUES;
export const TIMER_INSPECTION_VOICE_PHRASES = {
  'inspection-start': { zh: '观察', en: 'inspection' },
  'warn-8': { zh: '8 秒', en: '8 seconds' },
  'warn-12': { zh: '12 秒', en: '12 seconds' },
  start: { zh: '开始', en: 'go' },
} satisfies Partial<Record<TimerAudioCue, { en: string; zh: string }>>;
export type TimerInspectionVoiceCue = keyof typeof TIMER_INSPECTION_VOICE_PHRASES;

export function isTimerInspectionVoiceCue(cue: TimerAudioCue): cue is TimerInspectionVoiceCue {
  return Object.prototype.hasOwnProperty.call(TIMER_INSPECTION_VOICE_PHRASES, cue);
}

export const TIMER_INSPECTION_BEEP: TimerAudioNote = { freq: 1050, ms: 90 };
export const TIMER_AUDIO_NOTE_ATTACK_MS = 5;
export const TIMER_AUDIO_NOTE_GAP_MS = 20;
export const TIMER_AUDIO_NOTE_GAIN = 0.6;

export interface TimerSoundOutput {
  play(cue: TimerAudioCue): void;
  cancelVoice(): void;
  getInspectionBeepAt?(): readonly number[];
  playInspectionBeep?(): void;
}

/** Start and clear warning clocks with the same machine effects on each host. */
export function createTimerSoundFeedback(sound: TimerSoundOutput, clock: { now(): number; isVisible(): boolean }) {
  let inspectionTimer: ReturnType<typeof setInterval> | undefined;
  const clear = () => { clearInterval(inspectionTimer); inspectionTimer = undefined; };
  return {
    onTransition({ effects, state, solve }: TimerMachineTransition) {
      for (const effect of effects) {
        if (effect === 'inspection-started') {
          clear();
          sound.cancelVoice();
          sound.play('inspection-start');
          if (state.trainingStartMode) continue;
          const start = state.inspectionStartedAtMs ?? clock.now();
          const fired = new Set<number>();
          const firedBeeps = new Set<number>();
          inspectionTimer = setInterval(() => {
            const elapsed = clock.now() - start;
            for (const seconds of [8, 12] as const) {
              if (elapsed >= seconds * 1000 && !fired.has(seconds)) {
                fired.add(seconds);
                if (clock.isVisible()) sound.play(seconds === 8 ? 'warn-8' : 'warn-12');
              }
            }
            for (const seconds of sound.getInspectionBeepAt?.() ?? []) {
              if (elapsed >= seconds * 1000 && !firedBeeps.has(seconds)) {
                firedBeeps.add(seconds);
                if (clock.isVisible()) sound.playInspectionBeep?.();
              }
            }
          }, 100);
        } else if (effect === 'run-started') {
          clear(); sound.cancelVoice(); sound.play('start');
        } else if (effect === 'run-stopped') {
          clear(); sound.cancelVoice(); if (solve) sound.play('stop');
        } else if (effect === 'arm-cancelled' || effect === 'reset') {
          clear(); sound.cancelVoice();
        }
      }
    },
    dispose() { clear(); sound.cancelVoice(); },
  };
}
