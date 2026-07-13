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
