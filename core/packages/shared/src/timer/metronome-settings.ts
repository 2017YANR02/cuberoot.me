import type { TimerPhase } from './machine';

export const BPM_MIN = 30;
export const BPM_MAX = 1800;

/** Accent every N beats; 0 = every beat identical. 8 ≈ one F2L pair. */
export const ACCENT_CHOICES = [0, 2, 4, 8] as const;

export interface MetronomeState {
  on: boolean;
  bpm: number;
  accent: number;
}

export const DEFAULT_METRONOME_STATE: MetronomeState = { on: false, bpm: 120, accent: 0 };

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_METRONOME_STATE.bpm;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
}

/** Turns per second at a given tempo, one beat per turn. */
export function bpmToTps(bpm: number): number {
  return bpm / 60;
}

export function tpsToBpm(tps: number): number {
  return clampBpm(tps * 60);
}

export const TIMER_METRONOME_COPY = {
  heading: { zh: '节拍器', en: 'Metronome' },
  description: { zh: '仅在观察和计时期间播放；独立于提示音开关。', en: 'Plays during inspection and timing, independently of the sound-effects switch.' },
  tap: { zh: '敲击', en: 'Tap' },
  tapHint: { zh: '连续敲击设定速度', en: 'Tap repeatedly to set tempo' },
};

export function timerMetronomeActive(phase: TimerPhase, enabled: boolean): boolean {
  return enabled && (phase === 'inspecting' || phase === 'running');
}

export function timerMetronomePulse(intervalSeconds: number, accent: boolean) {
  const body = Math.min(0.05, intervalSeconds * 0.55);
  return { body, attack: Math.min(0.003, body * 0.2), frequency: accent ? 1800 : 1200, gain: accent ? 0.5 : 0.32 };
}

export function createTimerTapTempo(now: () => number) {
  let taps: number[] = [];
  return {
    tap() {
      const current = now();
      if (taps.length && current - taps[taps.length - 1] > 3000) taps = [];
      taps.push(current);
      if (taps.length > 4) taps.shift();
      if (taps.length < 2) return null;
      const span = current - taps[0];
      return span > 0 ? clampBpm(60000 / (span / (taps.length - 1))) : null;
    },
    reset() { taps = []; },
  };
}

export function parseInspectionBeepInput(raw: string): number[] {
  const out: number[] = [];
  for (const part of raw.split(/[,，\s]+/).filter(Boolean)) {
    const value = Math.floor(Number(part));
    if (Number.isFinite(value) && value >= 1 && value <= 60 && !out.includes(value)) out.push(value);
  }
  return out.sort((a, b) => a - b);
}

export interface TimerMetronomeSettings {
  metronomeOn: boolean;
  metronomeBpm: number;
  inspectionBeepAt: number[];
}
export function normalizeTimerMetronomeSettings(value: Partial<Record<keyof TimerMetronomeSettings, unknown>> = {}): TimerMetronomeSettings {
  return {
    metronomeOn: value.metronomeOn === true,
    metronomeBpm: clampBpm(typeof value.metronomeBpm === 'number' ? value.metronomeBpm : 120),
    inspectionBeepAt: Array.isArray(value.inspectionBeepAt)
      ? parseInspectionBeepInput(value.inspectionBeepAt.filter(v => typeof v === 'number').join(',')) : [],
  };
}
