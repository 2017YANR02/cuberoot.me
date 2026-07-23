import type { FaceKey } from './types';

export interface ArrowEntryOptions {
  face: FaceKey;
  from: number;
  to: number;
  pass?: number | null;
  scale?: number | null;
  influence?: number | null;
  color?: string;
  /** NxN size — sticker indices are validated against cubeSize². */
  cubeSize: number;
}

/**
 * PHP-visualcube arrow entry, e.g. `U0U2U4-s10-i5-ff0000`.
 * Returns '' when from/to fall outside the face (the page treated that as a no-op).
 */
export function buildArrowEntry(o: ArrowEntryOptions): string {
  const numStickers = o.cubeSize * o.cubeSize;
  if (o.from < 0 || o.from >= numStickers) return '';
  if (o.to < 0 || o.to >= numStickers) return '';
  let entry = `${o.face}${o.from}${o.face}${o.to}`;
  const pass = o.pass ?? null;
  if (pass !== null && pass >= 0 && pass < numStickers) {
    entry += `${o.face}${pass}`;
  }
  if (o.scale !== null && o.scale !== undefined) entry += `-s${o.scale}`;
  if (o.influence !== null && o.influence !== undefined) entry += `-i${o.influence}`;
  if (o.color) {
    const c = o.color.startsWith('#') ? o.color.slice(1) : o.color;
    entry += `-${c}`;
  }
  return entry;
}

/** Comma-join a new entry onto the existing `arw` string. Empty entry = no-op. */
export function appendArrow(existing: string, entry: string): string {
  if (!entry) return existing;
  return existing ? existing + ',' + entry : entry;
}

/**
 * Leading point sequence of one entry, e.g. `U0R2U4-s10-ff0000` → `['U0','R2','U4']`.
 * A cube arrow point is `<face><index>` (face ∈ U R F D L B) — the SAME id space as
 * the mask-core StickerId (see mask-core.ts header), so a net click yields a point
 * verbatim. Suffixes (`-s` scale / `-i` influence / `-color`) live after the first
 * `-` and carry no face+digit run, so cutting there isolates the points.
 */
export function arrowPoints(entry: string): string[] {
  return entry.split('-')[0].match(/[URFDLB]\d+/g) ?? [];
}

/**
 * Toggle-remove any arrow whose leading point sequence is EXACTLY `points`
 * (order-sensitive; suffixes ignored). `['U0','U8']` erases a straight `U0U8` but
 * leaves a curved `U0U8U4` alone — re-drawing the identical arrow erases it, a
 * different shape (even same endpoints) adds a new one. Returns the rewritten
 * string when ≥1 matched (dropped), or null when none matched — the click-to-draw
 * editor then ADDs the arrow instead.
 */
export function removeArrowByPoints(existing: string, points: string[]): string | null {
  if (!existing || points.length < 2) return null;
  let matched = false;
  const kept = existing.split(',').filter((e) => {
    const pts = arrowPoints(e);
    const hit = pts.length === points.length && pts.every((p, i) => p === points[i]);
    if (hit) matched = true;
    return !hit;
  });
  return matched ? kept.join(',') : null;
}
