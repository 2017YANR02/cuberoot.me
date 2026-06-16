// Alignment snapping: while moving/resizing, snap the active box's left/centerX/
// right and top/centerY/bottom to the same edges of other shapes (and an
// optional board center). Returns the delta to apply plus the guide lines to
// draw. Threshold is in scene units (UI passes px/zoom).

import type { Bounds } from './types';

export interface SnapResult {
  dx: number;
  dy: number;
  lines: { x: number[]; y: number[] };
}

interface Cand {
  pos: number;
  // the active-box anchor offset (0=left/top, 0.5=center, 1=right/bottom)
}

function edgesX(b: Bounds): number[] {
  return [b.x, b.x + b.width / 2, b.x + b.width];
}
function edgesY(b: Bounds): number[] {
  return [b.y, b.y + b.height / 2, b.y + b.height];
}

// `moving` is the current (already-translated) box. `targets` are the other
// shapes' bounds. `extra` adds standalone snap positions (e.g. board center).
export function computeSnap(
  moving: Bounds,
  targets: Bounds[],
  threshold: number,
  extra?: { x?: number[]; y?: number[] }
): SnapResult {
  const targXs: number[] = [];
  const targYs: number[] = [];
  for (const t of targets) {
    targXs.push(...edgesX(t));
    targYs.push(...edgesY(t));
  }
  if (extra?.x) targXs.push(...extra.x);
  if (extra?.y) targYs.push(...extra.y);

  const movXs = edgesX(moving);
  const movYs = edgesY(moving);

  const best = (mov: number[], targ: number[]): { delta: number; line: number } | null => {
    let bestDelta = Infinity;
    let bestLine = 0;
    for (const m of mov) {
      for (const tp of targ) {
        const d = tp - m;
        if (Math.abs(d) < Math.abs(bestDelta)) {
          bestDelta = d;
          bestLine = tp;
        }
      }
    }
    if (Math.abs(bestDelta) <= threshold) return { delta: bestDelta, line: bestLine };
    return null;
  };

  const bx = best(movXs, targXs);
  const by = best(movYs, targYs);

  const dx = bx ? bx.delta : 0;
  const dy = by ? by.delta : 0;

  // After applying the delta, collect ALL guide lines that line up (within a
  // tight epsilon) so multiple alignments show at once.
  const lines = { x: [] as number[], y: [] as number[] };
  const eps = 0.01;
  if (bx) {
    const snapped = edgesX({ ...moving, x: moving.x + dx });
    for (const tp of targXs) {
      if (snapped.some((m) => Math.abs(m - tp) <= eps) && !lines.x.includes(tp)) {
        lines.x.push(tp);
      }
    }
  }
  if (by) {
    const snapped = edgesY({ ...moving, y: moving.y + dy });
    for (const tp of targYs) {
      if (snapped.some((m) => Math.abs(m - tp) <= eps) && !lines.y.includes(tp)) {
        lines.y.push(tp);
      }
    }
  }

  return { dx, dy, lines };
}

export type { Cand };
