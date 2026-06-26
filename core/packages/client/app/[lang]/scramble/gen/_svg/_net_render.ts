/**
 * Generic 2D-net renderer for any puzzle defined as a {@link PuzzleGroup}
 * (lib/puzzle-group) plus a {@link PuzzleNet} geometry. One scramble → one SVG
 * string, synchronously — no cubing.js at render time (it stays out of the
 * scramble-preview path; the group source is self-contained, see _nets/*.ts).
 *
 * A net polygon is a fixed location (orbit, piece-slot, orientation-slot). After
 * a scramble the slot holds piece q = state.pieces[slot] turned by o =
 * state.orient[slot], so the polygon shows that piece's sticker (orient − o):
 *     color = solvedColor[orbit][q][(orient − o) mod ori].
 */
import { applyScramble, type PuzzleGroup } from '@/lib/puzzle-group';

export interface NetFacelet {
  orbit: string;
  /** piece slot index within the orbit */
  piece: number;
  /** which of the piece's oriented stickers this polygon shows (0 … ori−1) */
  orient: number;
  /** SVG points attribute, e.g. "x,y x,y x,y" */
  pts: string;
}

export interface PuzzleNet {
  viewBox: string;
  stroke: string;
  strokeWidth: number;
  /** solvedColor[orbit][piece][orient] = the sticker color shown when solved. */
  solvedColor: Record<string, string[][]>;
  facelets: NetFacelet[];
}

export interface PuzzleNetDef {
  group: PuzzleGroup;
  net: PuzzleNet;
}

export function renderNet(def: PuzzleNetDef, scramble: string): string {
  const { group, net } = def;
  const st = applyScramble(group, scramble);
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${net.viewBox}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<g stroke="${net.stroke}" stroke-width="${net.strokeWidth}" stroke-linejoin="round">`,
  ];
  for (const f of net.facelets) {
    const ori = group.orbits[f.orbit].ori;
    const s = st[f.orbit];
    const q = s.pieces[f.piece];
    const o = s.orient[f.piece];
    const r = ((f.orient - o) % ori + ori) % ori;
    out.push(`<polygon points="${f.pts}" fill="${net.solvedColor[f.orbit][q][r]}"/>`);
  }
  out.push('</g></svg>');
  return out.join('');
}
