import { statsUrl } from '@/lib/stats-base';
import { VARIANT_STAGES } from '@/lib/scramble-variants';
import { BADGE_FACE_ORDER, CUBE_COLOR_LETTER_FOR_FACE, type CubeColorLetter } from '@/lib/cube-colors';

// Static shard layout from build_comp_steps.ts: stages × W Y R O B G.
// Block shards contain only their own goals, unlike the solver's cumulative menus.
export const COMP_STEP_STAGES = {
  std: VARIANT_STAGES.std,
  daisy: VARIANT_STAGES.daisy,
  first_layer: VARIANT_STAGES.first_layer,
  eo: VARIANT_STAGES.eo,
  pair: VARIANT_STAGES.pair,
  pseudo: VARIANT_STAGES.pseudo,
  pseudo_pair: VARIANT_STAGES.pseudo_pair,
  f2leo: VARIANT_STAGES.f2leo,
  pseudo_f2leo: VARIANT_STAGES.pseudo_f2leo,
  '123': VARIANT_STAGES['123'].slice(0, 2),
  '222': VARIANT_STAGES['222'],
  '223': VARIANT_STAGES['223'].slice(-1),
  '123x2': VARIANT_STAGES['123x2'],
  eoline: VARIANT_STAGES.eoline,
  dr: VARIANT_STAGES.dr,
};
export type CompStepsVariant = keyof typeof COMP_STEP_STAGES;
export const COMP_STEP_COLORS = BADGE_FACE_ORDER.map(face => CUBE_COLOR_LETTER_FOR_FACE[face]);
export type CompStepColor = CubeColorLetter;

export function normScramble(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

// Share requests with the competition analysis; bound memory and refresh on revisit.
const cache = new Map<string, { at: number; promise: Promise<Map<string, number[]> | null> }>();
export function fetchCompSteps(compId: string, variant: CompStepsVariant): Promise<Map<string, number[]> | null> {
  const key = `${variant}:${compId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.promise;
  const dir = variant === 'std' ? 'comp_steps' : `comp_steps_${variant}`;
  const promise = fetch(statsUrl(`/stats/scramble/${dir}/${encodeURIComponent(compId)}.json`))
    .then(async response => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Competition steps: ${response.status}`);
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid competition steps');
      const map = new Map<string, number[]>();
      for (const [scramble, values] of Object.entries(data)) {
        if (!Array.isArray(values)) throw new Error('Invalid competition step row');
        // null / negative sentinels remain unavailable, never coerce them to zero.
        map.set(normScramble(scramble), values.map(value =>
          typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : -1));
      }
      return map;
    });
  cache.set(key, { at: Date.now(), promise });
  if (cache.size > 48) cache.delete(cache.keys().next().value!);
  void promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
  return promise;
}

export function minimumCompSteps(values: readonly number[] | undefined, stageIndex: number, colors: readonly CompStepColor[]): number | null {
  if (!values || !colors.length) return null;
  const selected = colors.map(color => values[stageIndex * 6 + COMP_STEP_COLORS.indexOf(color)]);
  // A subset minimum is only known when every selected bottom has been computed.
  return selected.every(value => Number.isInteger(value) && value >= 0) ? Math.min(...selected) : null;
}
