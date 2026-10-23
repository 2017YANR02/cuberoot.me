/**
 * Read-only candidate audit. No BFS, state enumeration or distance table.
 * Retains the exact projected generator permutations, colour signatures,
 * Schreier-Sims group orders and conservative visible-state lower bounds.
 * Use node --max-old-space-size=128 --import tsx; each group call is bounded
 * by a 1.5-second VM timeout and permutation degree <= 80.
 * Group algorithm: existing upstream csTimer lib/grouplib.js (unmodified).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createContext, Script } from 'node:vm';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog';

const nativePlans: Record<string, string[]> = {
  superz: ['CENTERS'], cube3dino: ['EDGES'], dogic: ['CENTERS2'], octahedron4: ['CENTERS'],
  dinoskewb: ['EDGES', 'CENTERS'], lattice: ['EDGES', 'EDGES2'], hyperx: ['CENTERS'],
  latticex: ['EDGES'], masterbrilic: ['CORNERS:permutation'], masterftov2: ['C4RNER', 'EDGES'],
  quadx: ['EDGES'], dinoocta: ['C4RNER', 'CENTERS'], fto5: ['EDGES', 'EDGES2'],
  fto6: ['CENTERS', 'EDGES'], eto: ['EDGES'], radiocrystal: ['EDGES:permutation'],
  cube3skewb: ['CENTERS'], heliskewb: ['CENTERS'], comboctahedron: ['EDGES'],
  circoradiolarian: ['C5RNER'], icosababyface: ['CENTERS'], cube2heli: ['CENTERS'],
  cube3heli: ['EDGES'], radiojewel: ['CENTERS4'], radioweb: ['CENTERS4'],
  catscradle: ['CENTERS3'], radiocanon: ['C5RNER'], radiojam: ['CENTERS4'],
};
const jointPlans: Record<string, string[]> = {
  compycube: ['EDGES', 'CORNERS', 'CORNERS2', 'CENTERS'],
  masterskewb: ['EDGES', 'CORNERS', 'CORNERS2'],
  professorskewb: ['EDGES', 'EDGES2'],
  masterpyraminx: ['EDGES', 'EDGES2'], mastertetraminx: ['EDGES', 'EDGES2'],
  professorpyraminx: ['EDGES', 'EDGES2'], professortetraminx: ['EDGES', 'EDGES2'],
  royalpyraminx: ['EDGES', 'EDGES2'], royaltetraminx: ['EDGES', 'EDGES2'],
  emperorpyraminx: ['EDGES', 'EDGES2'], emperortetraminx: ['EDGES', 'EDGES2'],
  masterfto: ['C4RNER', 'EDGES'],
};
const factorial = (n: number) => { let result = 1n; for (let i = 2; i <= n; i++) result *= BigInt(i); return result; };
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const groupPath = fileURLToPath(new URL('../../../../tools/cstimer-scramble/lib/grouplib.js', import.meta.url));
const groupSource = await readFile(groupPath, 'utf8');
const args = process.argv.slice(2);
const output = resolve(args[0] ?? '../../../.local/small-puzzle-distributions-20261023/candidate-audit/second-pass');
const ids = args.slice(1).length ? args.slice(1) : Object.keys(nativePlans);
await mkdir(output, { recursive: true });
await writeFile(join(output, 'audit-source.mts'), await readFile(fileURLToPath(import.meta.url)));
const results: unknown[] = [];
for (const id of ids) {
  const catalog = PG_PUZZLES.find(item => item.id === id);
  assert(catalog, `Unknown catalog ID ${id}`);
  const start = performance.now();
  const pg = getPuzzleGeometryByDesc(catalog.def, { allMoves: true, orientCenters: false, addRotations: false });
  const definition = pg.getKPuzzleDefinition(true);
  const stickers = pg.get3d().stickers;
  const plans = nativePlans[id] ? [nativePlans[id]] : jointPlans[id] ? [jointPlans[id]] : definition.orbits
    .filter(orbit => orbit.numPieces <= 60)
    .map(orbit => [orbit.numPieces * orbit.numOrientations <= 80 ? orbit.orbitName : `${orbit.orbitName}:permutation`]);
  if (id === 'dinoocta') plans.push(definition.orbits.map(orbit => orbit.orbitName));
  const projections: unknown[] = [];
  for (const selected of plans) {
    let degree = 0, colourDivisor = 1n;
    const orbits = selected.map(name => {
      const [orbitName, mode] = name.split(':');
      const spec = definition.orbits.find(orbit => orbit.orbitName === orbitName);
      assert(spec, `${id}: missing ${orbitName}`);
      const orientations = mode === 'permutation' ? 1 : spec.numOrientations;
      const offset = degree;
      degree += spec.numPieces * orientations;
      const colours = Array.from({ length: spec.numPieces }, (_, piece) => {
        const pieceStickers = stickers.filter(sticker => sticker.orbit === orbitName && sticker.ord === piece);
        assert(pieceStickers.length > 0, `${id}/${orbitName}/${piece}: no visible stickers`);
        return Array.from({ length: spec.numOrientations }, (_, ori) => pieceStickers
          .filter(sticker => sticker.ori === ori).map(sticker => sticker.color).sort().join(','));
      });
      const canonical = colours.map(colour => mode === 'permutation' ? [...colour].sort().join('|')
        : colour.map((_, shift) => [...colour.slice(shift), ...colour.slice(0, shift)].join('|')).sort()[0]);
      const multiplicities = new Map<string, number>();
      for (const signature of canonical) multiplicities.set(signature, (multiplicities.get(signature) ?? 0) + 1);
      for (const count of multiplicities.values()) colourDivisor *= factorial(count);
      const invisibleOrientations = colours.map(colour => mode === 'permutation' ? 1 : colour
        .filter((_, shift) => colour.every((value, ori) => value === colour[(ori + shift) % colour.length])).length);
      for (const count of invisibleOrientations) colourDivisor *= BigInt(count);
      return { ...spec, offset, orientations, colours, canonical, invisibleOrientations };
    });
    if (degree > 80) { projections.push({ selected, skipped: 'permutation-degree-cap', degree }); continue; }
    const generators = Object.entries(definition.moves).map(([name, data]) => ({ name,
      permutation: orbits.flatMap(orbit => Array.from({ length: orbit.numPieces * orbit.orientations }, (_, position) => {
        const slot = Math.floor(position / orbit.orientations), ori = position % orbit.orientations;
        return orbit.offset + data[orbit.orbitName].permutation[slot] * orbit.orientations
          + (ori + data[orbit.orbitName].orientationDelta[slot]) % orbit.orientations;
      })),
      changedOrbits: orbits.filter(orbit => data[orbit.orbitName].permutation.some((piece, i) => piece !== i)
        || data[orbit.orbitName].orientationDelta.some(value => value !== 0)).map(orbit => orbit.orbitName),
    }));
    const context = createContext({ mathlib: { rn: () => { throw new Error('Randomness is not permitted in this audit'); } },
      generators: generators.map(item => item.permutation) });
    new Script(groupSource, { filename: groupPath }).runInContext(context, { timeout: 1500 });
    try {
      const order = new Script('new grouplib.SchreierSims(generators).size(true).toString()')
        .runInContext(context, { timeout: 1500 }) as string;
      const rotationsUpperBound = /^[id]/.test(catalog.def) ? 60 : catalog.def.startsWith('t') ? 12 : 24;
      const quotientDivisor = colourDivisor * BigInt(rotationsUpperBound);
      const lowerBound = (BigInt(order) + quotientDivisor - 1n) / quotientDivisor;
      projections.push({ selected, degree, exactLabelledProjectionGroupOrder: order,
        colourStabilizerUpperBound: colourDivisor.toString(), rotationsUpperBound,
        visibleStatesModuloRotationsLowerBound: lowerBound.toString(),
        isFullLabelledModel: orbits.length === definition.orbits.length && orbits.every(orbit => orbit.orientations === orbit.numOrientations),
        orbits, generators });
    } catch (error) { projections.push({ selected, degree, incomplete: String(error), orbits, generators }); }
  }
  const result = { id, native: id in NATIVE_PUZZLES, description: catalog.def,
    options: { allMoves: true, orientCenters: false, addRotations: false },
    generatorOrbitSupport: Object.entries(definition.moves).map(([name, data]) => ({ name,
      changedOrbits: definition.orbits.filter(orbit => data[orbit.orbitName].permutation.some((piece, i) => piece !== i)
        || data[orbit.orbitName].orientationDelta.some(value => value !== 0)).map(orbit => orbit.orbitName) })),
    orbits: definition.orbits, projections, elapsedMs: performance.now() - start,
    maxRssBytes: process.resourceUsage().maxRSS * 1024 };
  await writeFile(join(output, `${id}.json`), `${JSON.stringify(result, null, 2)}\n`);
  results.push(result);
  console.log(JSON.stringify({ id, elapsedMs: result.elapsedMs, projections: projections.map(item => {
    const p = item as Record<string, unknown>;
    return { selected: p.selected, degree: p.degree, order: p.exactLabelledProjectionGroupOrder,
      visibleLowerBound: p.visibleStatesModuloRotationsLowerBound, incomplete: p.incomplete ?? p.skipped };
  }) }));
}
await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(),
  sourceSha256: hash(await readFile(fileURLToPath(import.meta.url))), groupSourcePath: groupPath,
  groupSourceSha256: hash(groupSource), ids, maxRssBytes: process.resourceUsage().maxRSS * 1024,
  noStateEnumeration: true, noDistanceTable: true, groupTimeoutMs: 1500, maxPermutationDegree: 80,
  resultFiles: ids.map(id => `${id}.json`), count: results.length }, null, 2)}\n`);
