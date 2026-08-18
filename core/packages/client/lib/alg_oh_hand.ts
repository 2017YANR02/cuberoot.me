import type { AlgCase, AlgEntry } from '@cuberoot/shared';
import { mirrorAlg } from '@/lib/cube3';
import { normalizeAlg } from '@/lib/alg_normalize';

export const OH_HANDS = ['left', 'right'] as const;
export type OhHand = (typeof OH_HANDS)[number];

function mirrorPartner(c: AlgCase, setCases: readonly AlgCase[]): AlgCase | undefined {
  const mirrorNo = c.meta?.mirror;
  return mirrorNo == null ? undefined : setCases.find(candidate => candidate.meta?.no === mirrorNo);
}

function mirroredOhEntry(entry: AlgEntry): AlgEntry {
  // Finger-trick markup and videos describe the source (left-hand) execution, so the
  // generated right-hand row keeps attribution/metrics but only mirrors plain moves.
  const { algHtml: _algHtml, altId: _altId, ytId: _ytId, gen: _gen, src: _src, setup, ...rest } = entry;
  return {
    ...rest,
    alg: mirrorAlg(normalizeAlg('3x3', entry.alg), 'M'),
    ...(setup ? { setup: mirrorAlg(normalizeAlg('3x3', setup), 'M') } : {}),
  };
}

/** 3x3 PLL OH formulas. Right hand = mirror the paired case's left-hand formulas. */
export function ohAlgsForCase(
  c: AlgCase,
  setCases: readonly AlgCase[],
  orientation: number,
  hand: OhHand,
): AlgEntry[] {
  const source = hand === 'left' ? c : mirrorPartner(c, setCases);
  if (!source) return [];
  const entries = source.algs[orientation] ?? source.algs[0] ?? [];
  const ohEntries = entries.filter(entry => entry.tags?.includes('oh'));
  if (hand === 'left') return ohEntries;

  const mirrored: AlgEntry[] = [];
  for (const entry of ohEntries) {
    try {
      mirrored.push(mirroredOhEntry(entry));
    } catch {
      // An unsupported source formula must not be exposed unchanged as a fake right-hand alg.
    }
  }
  return mirrored;
}

export function hasOhAlgsForHand(c: AlgCase, setCases: readonly AlgCase[], hand: OhHand): boolean {
  const source = hand === 'left' ? c : mirrorPartner(c, setCases);
  if (!source) return false;
  const orientationCount = Math.max(c.algs.length, source.algs.length);
  for (let orientation = 0; orientation < orientationCount; orientation++) {
    if (ohAlgsForCase(c, setCases, orientation, hand).length > 0) return true;
  }
  return false;
}
