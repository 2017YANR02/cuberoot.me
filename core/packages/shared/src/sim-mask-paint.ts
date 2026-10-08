/** /sim custom masks: legacy U:0,2;F:3-5 or per-style regular=U:0|dim=F:3-5.
 * Both URL state and sim_masks.sids use this encoding; no geometry lives here. */
export const CUSTOM_TREATMENTS = ['regular', 'dim', 'ignored', 'outline'] as const;
export type CustomTreatment = (typeof CUSTOM_TREATMENTS)[number];
export type PaintedMaskGroup = { treatment: CustomTreatment; sids: string };
export const SIM_MASK_SIDS_RE = /^(?:[URFDLB]:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?:;[URFDLB]:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)*$/;

/** null means a legacy mask or malformed painted data. Each style occurs once. */
export function parsePaintedMask(value: string): PaintedMaskGroup[] | null {
  if (!value.includes('=') || value.length > 24000) return null;
  const groups: PaintedMaskGroup[] = [];
  const seen = new Set<string>();
  for (const part of value.split('|')) {
    const at = part.indexOf('=');
    const treatment = part.slice(0, at) as CustomTreatment;
    const sids = part.slice(at + 1);
    if (at < 0 || !CUSTOM_TREATMENTS.includes(treatment) || seen.has(treatment)
      || !SIM_MASK_SIDS_RE.test(sids)) return null;
    // Bound range expansion for externally supplied URL/API data.
    if ((sids.match(/\d+/g) ?? []).some(index => Number(index) > 4095)) return null;
    seen.add(treatment);
    groups.push({ treatment, sids });
  }
  return groups;
}
