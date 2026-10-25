/** Solo layout preferences. Gaps participate in flow so long scrambles
 * and enlarged previews never overlap the readout. */
export const DEFAULT_SOLO_LAYOUT = {
  scrambleGap: 16,
  sourceGap: 16,
  timerGap: 20,
  cubeGap: 8,
  sourceScale: 1,
  cubeScale: 1,
};
export type SoloLayout = typeof DEFAULT_SOLO_LAYOUT;

export function normalizeSoloLayout(value: unknown): SoloLayout {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_SOLO_LAYOUT };
  for (const key of Object.keys(result) as (keyof SoloLayout)[]) {
    const candidate = input[key];
    const scale = key.endsWith('Scale');
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      result[key] = Math.min(scale ? 2 : 240, Math.max(scale ? 0.5 : 0, candidate));
    }
  }
  return result;
}
