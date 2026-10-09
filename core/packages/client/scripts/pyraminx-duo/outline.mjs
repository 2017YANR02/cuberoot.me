/**
 * Pyraminx Duo single-face design review, before implementing the 3D engine.
 *
 * The inventor's photograph and the QiYi product photographs establish the topology:
 * a concentric, same-facing centre triangle and three concave six-sided corner patches.
 * Each outer edge midpoint connects to the matching centre-triangle edge midpoint.
 * Sources:
 *   https://oskarvandeventer.nl/meffert.html
 *   https://www.jaapsch.net/puzzles/pyraduo.htm
 *   https://cubinglab.com/products/qiyi-pyraminx-duo
 *
 * CENTRAL_RATIO = 0.4 is a proposed visual proportion, not a manufacturer measurement.
 * This drawing does not establish the internal cut surfaces or collision-free animation.
 * Diagnostic colours follow .agents/skills/sim-add-puzzle/SKILL.md.
 * Run from core: node packages/client/scripts/pyraminx-duo/outline.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const output = resolve(CORE, '.tmp/png/pyraminx-duo-outline.svg');
const CENTRAL_RATIO = 0.4;
const HEIGHT = Math.sqrt(3) / 2;
const vertices = [[0.5, 0], [0, HEIGHT], [1, HEIGHT]];
const centroid = [0.5, HEIGHT * 2 / 3];
const central = vertices.map(([x, y]) => [
  centroid[0] + (x - centroid[0]) * CENTRAL_RATIO,
  centroid[1] + (y - centroid[1]) * CENTRAL_RATIO,
]);
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const [A, B, C] = vertices;
const [a, b, c] = central;
const Mab = midpoint(A, B), Mac = midpoint(A, C), Mbc = midpoint(B, C);
const mab = midpoint(a, b), mac = midpoint(a, c), mbc = midpoint(b, c);
const corners = [
  [A, Mab, mab, a, mac, Mac],
  [B, Mbc, mbc, b, mab, Mab],
  [C, Mac, mac, c, mbc, Mbc],
];
const radialCuts = [[Mab, mab], [Mac, mac], [Mbc, mbc]];
const fmt = (number) => number.toFixed(3);
const points = (polygon) => polygon.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');

// Round each polygon corner analytically, including its re-entrant corner.
// The common partition below remains the black reference; this is an outline proposal.
function roundedPath(polygon, radius) {
  const entry = [], exit = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], before = polygon[(i + polygon.length - 1) % polygon.length];
    const after = polygon[(i + 1) % polygon.length];
    const backLength = Math.hypot(before[0] - p[0], before[1] - p[1]);
    const nextLength = Math.hypot(after[0] - p[0], after[1] - p[1]);
    const distance = Math.min(radius, backLength / 4, nextLength / 4);
    entry.push([p[0] + (before[0] - p[0]) * distance / backLength,
      p[1] + (before[1] - p[1]) * distance / backLength]);
    exit.push([p[0] + (after[0] - p[0]) * distance / nextLength,
      p[1] + (after[1] - p[1]) * distance / nextLength]);
  }
  let path = `M${points([entry[0]])}`;
  for (let i = 0; i < polygon.length; i++) {
    if (i) path += ` L${points([entry[i]])}`;
    path += ` Q${points([polygon[i]])} ${points([exit[i]])}`;
  }
  return path + ' Z';
}

const reference = `
  <polygon points="${points(vertices)}" fill="none"/>
  <polygon points="${points(central)}" fill="none"/>
  ${radialCuts.map(([p, q]) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`).join('\n')}`;
const proposal = `
  <polygon points="${points(vertices)}" fill="none" stroke="#a1aab6" stroke-width="0.004" stroke-dasharray="0.018 0.014" transform="translate(-0.022,-0.025) scale(1.044)"/>
  <g fill="#eff9f3" stroke="#178351" stroke-width="0.009" stroke-linejoin="round">
    ${[...corners, central].map((p) => `<path d="${roundedPath(p, 0.022)}"/>`).join('\n')}
  </g>
  <polygon points="${points(vertices)}" fill="none" stroke="#2e6fda" stroke-width="0.007" stroke-linejoin="round"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="810" viewBox="0 0 1280 810" role="img" aria-labelledby="title description">
<title id="title">Pyraminx Duo — proposed single-face outline</title>
<desc id="description">Reference partition and proposed rounded outline: one same-facing central triangle, three concave six-sided corner patches. Green is proposed, blue is fixed exterior, black is reference, grey dashes mark the envelope. Awaiting approval before 3D implementation.</desc>
<rect width="1280" height="810" fill="white"/>
<g font-family="DejaVu Sans, Arial, sans-serif" fill="#17212d">
  <text x="58" y="64" font-size="33" font-weight="bold">Pyraminx Duo</text>
  <text x="58" y="99" font-size="19">Single-face geometry review · standard four-colour version</text>
  <rect x="58" y="137" width="558" height="480" rx="18" fill="#f7f8fa"/>
  <rect x="664" y="137" width="558" height="480" rx="18" fill="#f7f8fa"/>
  <text x="86" y="176" font-size="17" font-weight="bold">REFERENCE CUT LAYOUT</text>
  <text x="692" y="176" font-size="17" font-weight="bold">PROPOSED OUTLINE</text>
  <g transform="translate(137,215) scale(400)" stroke="#161d25" stroke-width="0.008" stroke-linejoin="round">${reference}</g>
  <g transform="translate(743,215) scale(400)">${proposal}</g>
  <text x="337" y="330" text-anchor="middle" font-size="18">corner</text>
  <text x="205" y="526" text-anchor="middle" font-size="18">corner</text>
  <text x="469" y="526" text-anchor="middle" font-size="18">corner</text>
  <text x="337" y="455" text-anchor="middle" font-size="17">centre</text>
  <text x="943" y="330" text-anchor="middle" font-size="18">corner</text>
  <text x="811" y="526" text-anchor="middle" font-size="18">corner</text>
  <text x="1075" y="526" text-anchor="middle" font-size="18">corner</text>
  <text x="943" y="455" text-anchor="middle" font-size="17">centre</text>
  <text x="86" y="594" font-size="16">1 centre triangle + 3 concave corner patches</text>
  <text x="692" y="594" font-size="16">Same partition · softly rounded patch corners</text>
  <g font-size="16">
    <path d="M65 655h36" stroke="#161d25" stroke-width="4"/><text x="112" y="661">Reference</text>
    <path d="M288 655h36" stroke="#178351" stroke-width="4"/><text x="335" y="661">Proposal</text>
    <path d="M498 655h36" stroke="#2e6fda" stroke-width="4"/><text x="545" y="661">Fixed exterior</text>
    <path d="M764 655h36" stroke="#a1aab6" stroke-width="3" stroke-dasharray="8 5"/><text x="811" y="661">Constraint envelope</text>
  </g>
  <text x="58" y="710" font-size="17">Proposed centre / outer side ratio: 0.40. This proportion is not a manufacturer measurement.</text>
  <text x="58" y="743" font-size="17">This review fixes the visible partition; internal surfaces and turn clearance still require verification.</text>
  <text x="58" y="780" font-size="15" fill="#535e6e">Reference: Oskar van Deventer and Jaap Scherphuis · no existing Duo engine in this repository</text>
</g>
</svg>`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, svg);
console.log(output);
