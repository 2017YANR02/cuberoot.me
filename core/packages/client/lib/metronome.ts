import { createMetronome } from '@cuberoot/timer-ui/metronome';
import { ACCENT_CHOICES, clampBpm, DEFAULT_METRONOME_STATE as DEFAULTS, type MetronomeState } from '@cuberoot/shared/timer';
import { persistItem } from '@/lib/safe-storage';
export { BPM_MIN, BPM_MAX, ACCENT_CHOICES, clampBpm, bpmToTps, tpsToBpm, type MetronomeState } from '@cuberoot/shared/timer';
export type { BeatEvent } from '@cuberoot/timer-ui/metronome';
const KEY = 'cuberoot.metronome.v1';
/**
 * One-shot pickup of the tempo the timer page used to own, so anyone who had
 * tuned it there doesn't get silently reset to 120 the first time the shared
 * metronome loads.
 */
function legacyTimerBpm(): number | null {
  try {
    const raw = localStorage.getItem('cuberoot-timer.settings.v1');
    if (!raw) return null;
    const bpm = (JSON.parse(raw) as { metronomeBpm?: unknown }).metronomeBpm;
    return typeof bpm === 'number' && Number.isFinite(bpm) ? clampBpm(bpm) : null;
  } catch {
    return null;
  }
}

function load(): MetronomeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, bpm: legacyTimerBpm() ?? DEFAULTS.bpm };
    const parsed = JSON.parse(raw) as Partial<MetronomeState>;
    return {
      // `on` is deliberately not restored: a site-wide metronome that starts
      // ticking by itself on page load would be startling, and autoplay policy
      // would block the audio until the first gesture anyway.
      on: false,
      bpm: clampBpm(parsed.bpm ?? DEFAULTS.bpm),
      accent: ACCENT_CHOICES.includes(parsed.accent as 0) ? (parsed.accent as number) : DEFAULTS.accent,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const metronome = createMetronome({
  initial: typeof window === 'undefined' ? DEFAULTS : load(),
  persist: value => { persistItem(KEY, JSON.stringify(value)); },
});
metronome.attach();
export const { getMetronomeState, useMetronome, setMetronome, toggleMetronome,
  setMetronomeHold, isMetronomeSounding, subscribeBeat, tapTempo, resetTapTempo } = metronome;
