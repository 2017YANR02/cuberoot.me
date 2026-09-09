// Offline SVG frames reuse VisualCube's projection, sticker inset, palette and
// move simulation. Only the U slice gets a different camera-space rotation;
// the two lower layers keep their exact original geometry throughout a turn.
import { Axis, renderCubeSVG } from '@cuberoot/visualcube';
import { readFileSync } from 'node:fs';

const { palette: [, , ink] } = JSON.parse(readFileSync(new URL('./parts.json', import.meta.url), 'utf8'));
const tags = Array.from({ length: 54 }, (_, i) => `rb-sticker-${i}`);
const camera = [[Axis.Y, 30], [Axis.X, -30]];
const round = n => Number(n.toFixed(5));
const points = ps => ps.map(p => p.map(round).join(',')).join(' ');
const isUpper = i => i < 9 || ([1, 2, 4, 5].includes(Math.floor(i / 9)) && i % 9 < 3);
const isEdge = i => i === 7 || i === 19; // UF edge: U7 + F1.
const cache = new Map();

function polygons(svg) {
  return [...svg.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"[^>]*\/>/g)]
    .map(([, raw, color]) => ({ points: raw.split(' ').map(pair => pair.split(',').map(Number)), color }));
}

function projected(alg, angle) {
  const key = `${alg}|${angle}`;
  if (cache.has(key)) return cache.get(key);
  const options = { algorithm: alg, viewportRotations: [[Axis.Y, angle], ...camera] };
  // Identifiers come from an unturned canonical cube; the second render paints
  // those same positions using the library's actual forward algorithm state.
  const geometry = polygons(renderCubeSVG({ ...options, algorithm: '', stickerColors: tags }))
    .filter(p => p.color.startsWith('rb-sticker-'));
  const colors = polygons(renderCubeSVG(options)).slice(-geometry.length);
  const result = geometry.map((p, i) => ({ ...p, index: Number(p.color.slice(11)), color: colors[i].color }));
  cache.set(key, result);
  return result;
}

// Recover the full cell corners from VisualCube's documented 0.85 inset.
// This is a backing silhouette, never a second hand-drawn sticker renderer.
function cellCorners(p) {
  const center = p.points[0].map((v, k) => (v + p.points[2][k]) / 2);
  return p.points.map(v => v.map((n, k) => center[k] + (n - center[k]) / .85));
}

function hull(ps) {
  const sorted = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const side = values => {
    const out = [];
    for (const p of values) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...side(sorted), ...side(sorted.reverse())];
}

function layer(ps, hole = []) {
  const outline = hull(ps.flatMap(cellCorners));
  const path = polygon => `M${points(polygon)}Z`;
  const backing = hole.length
    ? `<path d="${path(outline)}${path(hole)}" fill="${ink}" fill-rule="evenodd"/>`
    : `<polygon points="${points(outline)}" fill="${ink}"/>`;
  return backing + ps.map(p => `<polygon points="${points(p.points)}" fill="${p.color}"/>`).join('');
}

/** One frame, in a centered 1.8-unit coordinate system. Angle is U clockwise degrees. */
export function cubeMotionFrame({ alg = '', angle = 0, popOffset = [0, 0] } = {}) {
  if (!Number.isFinite(angle) || !Array.isArray(popOffset) || popOffset.length !== 2 || !popOffset.every(Number.isFinite)) {
    throw new Error('Cube motion needs a finite angle and a two-number piece offset');
  }
  const base = projected(alg, 0).filter(p => !isUpper(p.index));
  const upper = projected(alg, angle).filter(p => isUpper(p.index));
  const detached = popOffset.some(Boolean);
  const edge = upper.filter(p => isEdge(p.index));
  // POP occurs with the layer aligned. The removed edge leaves a real notch in
  // the top slice; the stationary lower layers remain visible below it.
  const moving = detached ? upper.filter(p => !isEdge(p.index)) : upper;
  const hole = detached ? hull(edge.flatMap(cellCorners)) : [];
  const piece = detached ? `<g data-cube-piece="UF" transform="translate(${popOffset.join(' ')})">${layer(edge)}</g>` : '';
  return `<g data-cube-base="fixed">${layer(base)}</g><g data-cube-layer="U" data-turn-angle="${angle}">${layer(moving, hole)}</g>${piece}`;
}

/**
 * Self-contained, CSS-only U / U' / U2 turns. Beats use the parent's 0..100%
 * timeline. A quarter-turn has 12 genuine projected intermediate frames.
 * pop: [launch, apex, return] ejects/reseats the UF edge after the final move.
 * Example: turningCube(a, 120, {alg:'U2', moves:["U'", "U'"], beats:[[18,32],[46,60]]}).
 * @param {Function} a
 * @param {number} size
 * @param {{alg?: string, moves?: string[], beats?: number[][], pop?: number[], popVector?: number[]}} options
 */
export function turningCube(a, size = 108, { alg = '', moves = ['U', "U'"], beats = [[20,36],[55,71]], pop, popVector = [-size * .6, -size * .95] } = {}) {
  if (typeof a !== 'function' || !Number.isFinite(size) || size <= 0 || !Array.isArray(moves) || moves.length !== beats?.length || !moves.length) {
    throw new Error('Turning cube requires an animator, positive size, and one beat per move');
  }
  let end = 0;
  for (const [i, move] of moves.entries()) {
    if (!/^U(?:2|')?$/.test(move)) throw new Error(`Unsupported pet cube move: ${move}; use U, U' or U2`);
    const beat = beats[i];
    if (!Array.isArray(beat) || beat.length !== 2 || !beat.every(Number.isFinite) || beat[0] < end || beat[1] <= beat[0] || beat[1] > 100) {
      throw new Error('Cube turn beats must be ordered non-overlapping intervals within 0..100');
    }
    end = beat[1];
  }
  if (pop && (!Array.isArray(pop) || pop.length !== 3 || !pop.every(Number.isFinite) || pop[0] < end || pop[1] <= pop[0] || pop[2] <= pop[1] || pop[2] > 100)) {
    throw new Error('POP needs three ordered times after the last turn and before 100%');
  }
  if (!Array.isArray(popVector) || popVector.length !== 2 || !popVector.every(Number.isFinite)) throw new Error('POP vector must contain two finite pixel distances');
  const frames = [{ time: 0, alg, angle: 0 }];
  let state = alg;
  moves.forEach((move, i) => {
    const [start, stop] = beats[i];
    const angle = move === 'U2' ? 180 : move === "U'" ? -90 : 90;
    const steps = Math.abs(angle) / 7.5;
    for (let j = 0; j < steps; j++) {
      frames.push({ time: start + (stop - start) * j / steps, alg: state, angle: angle * j / steps });
    }
    state = `${state} ${move}`.trim();
    frames.push({ time: stop, alg: state, angle: 0 });
  });
  if (pop) {
    const [start, apex, stop] = pop;
    for (let j = 0; j <= 24; j++) {
      const time = start + (stop - start) * j / 24;
      const phase = time <= apex ? (time - start) / (apex - start) : (stop - time) / (stop - apex);
      // Snappy launch, short apex, gravity-like return; distances are cube units.
      frames.push({ time, alg: state, angle: 0, popOffset: popVector.map(distance => distance * 1.8 / size * Math.sin(phase * Math.PI / 2)) });
    }
  }
  // Identical boundary times belong to the following frame (e.g. start=0).
  const timeline = [...new Map(frames.map(frame => [round(frame.time), frame])).values()];
  const art = timeline.map((frame, index) => {
    const start = round(frame.time), stop = round(timeline[index + 1]?.time ?? 100);
    if (start === stop) return '';
    const keys = [[0, `visibility:${start === 0 ? 'visible' : 'hidden'};`]];
    if (start > 0) keys.push([start, 'visibility:visible;']);
    if (stop < 100) keys.push([stop, 'visibility:hidden;']);
    keys.push([100, `visibility:${stop === 100 ? 'visible' : 'hidden'};`]);
    return a(cubeMotionFrame(frame), keys, '0px 0px', 'steps(1,end)');
  }).join('');
  return `<g data-turning-cube="U" transform="scale(${size / 1.8})">${art}</g>`;
}
