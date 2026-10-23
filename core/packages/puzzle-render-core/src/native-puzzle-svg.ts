/** Complete unfolded nets; geometry, colors and notation come from native cubing.js. */
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { parsePuzzleGeometryAlg, puzzleGeometryKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';

export function nativePuzzleSvgAspect(id: NativePuzzleId): number { return NATIVE_PUZZLES[id].aspect; }

interface Facelet {
  face: string;
  orbit: string;
  piece: number;
  orientation: number;
  points: number[];
}
interface Net {
  facelets: Facelet[];
  colors: Record<string, string[][]>;
  transform: string;
}
export interface PuzzleGeometrySvgSpec {
  id: string;
  description: string;
  aspect?: number;
  visibleFacelets?: number;
}
const cachedNets = new Map<string, Net>();

function puzzleNet(spec: PuzzleGeometrySvgSpec, aspect: number): Net {
  const key = `${spec.description}:${aspect}:${spec.visibleFacelets ?? ''}`;
  const cachedNet = cachedNets.get(key);
  if (cachedNet) return cachedNet;
  const pg = getPuzzleGeometryByDesc(spec.description, { allMoves: true, orientCenters: true, addRotations: true });
  const facelets: Facelet[] = [];
  const colors: Record<string, string[][]> = {};
  const physicalPolygons = new Set<string>();
  // Parse only the trusted native SVG template. User algorithms never enter SVG.
  for (const face of pg.generatesvg().matchAll(/<g><title>([^<]+)<\/title>([\s\S]*?)<\/g>/g)) {
    for (const polygon of face[2].matchAll(/<polygon id="([A-Z0-9_]+)-l(\d+)-o(\d+)"[^>]*style="fill: ([^";]+)"[^>]*points="([^"]+)"/g)) {
      const [, orbit, pieceText, orientationText, color, rawPoints] = polygon;
      const piece = Number(pieceText), orientation = Number(orientationText);
      (colors[orbit] ??= [])[piece] ??= [];
      colors[orbit][piece][orientation] = color;
      const points = rawPoints.trim().split(/[\s,]+/).map(Number);
      // PG represents an oriented mono-color center with three coincident SVG
      // polygons. Keep its complete color lookup, but draw its physical face once.
      const vertices = Array.from({ length: points.length / 2 }, (_, i) => `${points[2 * i]},${points[2 * i + 1]}`).sort();
      const key = `${face[1]}:${vertices.join('|')}`;
      if (physicalPolygons.has(key)) continue;
      physicalPolygons.add(key);
      facelets.push({ face: face[1], orbit, piece, orientation, points });
    }
  }
  if (facelets.length === 0 || (spec.visibleFacelets !== undefined && facelets.length !== spec.visibleFacelets)) {
    throw new Error(`Unexpected ${spec.id} net: ${facelets.length}`);
  }
  const xs = facelets.flatMap((f) => f.points.filter((_, i) => i % 2 === 0));
  const ys = facelets.flatMap((f) => f.points.filter((_, i) => i % 2 === 1));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = 480 * aspect;
  const scale = Math.min((width - 16) / (maxX - minX), 464 / (maxY - minY));
  const x = (width - (maxX - minX) * scale) / 2 - minX * scale;
  const y = (480 - (maxY - minY) * scale) / 2 - minY * scale;
  const net = { facelets, colors, transform: `translate(${x} ${y}) scale(${scale})` };
  cachedNets.set(key, net);
  return net;
}

export function renderNativePuzzleSvg(id: NativePuzzleId, scramble: string): string {
  return renderPuzzleGeometrySvg({ id, ...NATIVE_PUZZLES[id] }, scramble);
}

/** Reuse the exact native PG net and notation path for an existing catalog definition. */
export function renderPuzzleGeometrySvg(spec: PuzzleGeometrySvgSpec, scramble: string): string {
  if (!/^[a-z0-9_-]+$/i.test(spec.id)) throw new Error('Invalid puzzle SVG identifier');
  const aspect = spec.aspect ?? 4 / 3;
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Invalid puzzle SVG aspect ratio');
  const alg = parsePuzzleGeometryAlg(spec.description, scramble);
  const puzzle = puzzleGeometryKPuzzle(spec.description);
  const pattern = puzzle.defaultPattern().applyAlg(alg).patternData;
  const net = puzzleNet(spec, aspect);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${480 * aspect} 480" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${spec.id}">`,
    `<g transform="${net.transform}" stroke="#000000" stroke-width="1.2" stroke-linejoin="round">`];
  for (const f of net.facelets) {
    const orbit = pattern[f.orbit];
    // The repeated orientation colors of an unmarked center are identical.
    const orientationCount = net.colors[f.orbit][orbit.pieces[f.piece]].length;
    const orientation = ((f.orientation - orbit.orientation[f.piece]) % orientationCount + orientationCount) % orientationCount;
    const fill = net.colors[f.orbit][orbit.pieces[f.piece]][orientation];
    out.push(`<polygon data-face="${f.face}" data-piece="${f.orbit}-${f.piece}-${f.orientation}" points="${f.points.join(' ')}" fill="${fill}"/>`);
  }
  out.push('</g></svg>');
  return out.join('');
}
