/** Guard-scheduled small Rust HTR/FR quotient distributions and independent JS proof. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';
import { MOVE_OPS, STM_MOVE_NAMES } from '@cuberoot/puzzle-solvers/stm-cube';
import { assertExact, permutationRank, unrankPermutation } from './exact-coordinate-bfs.mts';
import { projectPattern } from './restricted333-exact-distribution.mts';

export type FmcDistributionEvent = 'htr-dr' | 'fr-htr';
export interface FmcEnumerationOptions { nativeTablePath: string }
type Physical = ReturnType<typeof projectPattern>;
const HALF = ['U2', 'D2', 'L2', 'R2', 'F2', 'B2'];
const DR = ['U', 'U2', "U'", 'D', 'D2', "D'", 'L2', 'R2', 'F2', 'B2'];
const FR = ['L2', 'R2', 'F2', 'B2'];
const RUST_MOVES = ['U', 'U2', "U'", 'D', 'D2', "D'", 'L', 'L2', "L'", 'R', 'R2', "R'", 'F', 'F2', "F'", 'B', 'B2', "B'"];
const ORBITS = [[0, 2, 4, 6], [1, 3, 5, 7], [8, 9, 10, 11]];
const ORBIT_A = new Set(ORBITS[0]);
const FACT12 = 479001600;
const BINARY = fileURLToPath(new URL('../../../../solver/target/release/dist_htr_fr', import.meta.url));
const SOLVER = fileURLToPath(new URL('../../../../solver/', import.meta.url));
const cpEpKey = (cp: ArrayLike<number>, ep: ArrayLike<number>) => permutationRank(cp) * FACT12 + permutationRank(ep);
const inverse = (move: string) => move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`;

/** Read-only build provenance; neither loading a table nor invoking the solver. */
export function inspectFmcNativeBuild() {
  const sourceFiles: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(path.join(SOLVER, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(relative); else if (entry.isFile()) sourceFiles.push(relative);
    }
  };
  visit('src');
  for (const file of ['Cargo.toml', 'Cargo.lock', '.cargo/config.toml', 'build.rs']) if (existsSync(path.join(SOLVER, file))) sourceFiles.push(file);
  const files = sourceFiles.sort().map(file => ({ file, sha256: createHash('sha256').update(readFileSync(path.join(SOLVER, file))).digest('hex') }));
  return { binary: BINARY, binarySha256: createHash('sha256').update(readFileSync(BINARY)).digest('hex'),
    sourceTreeSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
}

const verifierCache = new Map<FmcDistributionEvent, Promise<Awaited<ReturnType<typeof prepareVerifier>>>>();
function verifier(event: FmcDistributionEvent) {
  assertExact(event === 'htr-dr' || event === 'fr-htr', 'unknown FMC exact event');
  let pending = verifierCache.get(event);
  if (!pending) { pending = prepareVerifier(event); verifierCache.set(event, pending); }
  return pending;
}

/** Only bounded 96-corner / 192-target closures, never a full phase BFS. */
async function prepareVerifier(event: FmcDistributionEvent) {
  const puzzle = await puzzles['3x3x3'].kpuzzle(), solved = puzzle.defaultPattern();
  const cornerPatterns = [solved], cornerIds = new Set([0]);
  for (let head = 0; head < cornerPatterns.length; head++) for (const move of HALF) {
    const next = cornerPatterns[head].applyMove(move), rank = permutationRank(projectPattern(next).cp);
    if (cornerIds.has(rank)) continue;
    assertExact(cornerPatterns.length < 96, 'independent HTR corner subgroup exceeds 96');
    cornerIds.add(rank); cornerPatterns.push(next);
  }
  assertExact(cornerPatterns.length === 96, 'independent HTR corner subgroup has wrong order');
  const cornerGroup = cornerPatterns.map(pattern => projectPattern(pattern).cp);
  const cornerCanonical = new Uint16Array(40320).fill(65535), cpBuffer = new Uint8Array(8), product = new Uint8Array(8);
  for (let rank = 0; rank < 40320; rank++) if (cornerCanonical[rank] === 65535) {
    unrankPermutation(rank, cpBuffer);
    for (const h of cornerGroup) {
      for (let slot = 0; slot < 8; slot++) product[slot] = h[cpBuffer[slot]];
      const member = permutationRank(product);
      assertExact(cornerCanonical[member] === 65535, 'independent HTR corner cosets overlap');
      cornerCanonical[member] = rank;
    }
  }
  const frMembers: Physical[] = [];
  if (event === 'fr-htr') {
    const patterns = [solved], keys = new Set([0]);
    for (let head = 0; head < patterns.length; head++) for (const move of FR) {
      const next = patterns[head].applyMove(move), state = projectPattern(next), key = cpEpKey(state.cp, state.ep);
      if (keys.has(key)) continue;
      assertExact(patterns.length < 192, 'independent FR target subgroup exceeds 192');
      keys.add(key); patterns.push(next);
    }
    assertExact(patterns.length === 192, 'independent FR target subgroup has wrong order');
    frMembers.push(...patterns.map(projectPattern));
  }
  const frKeys = new Set(frMembers.map(state => cpEpKey(state.cp, state.ep)));
  // Factor the tiny FR target subgroup by its corner action. Only the group
  // giving the least corner image needs its edge images.
  const frByCorner = new Map<number, { cp: number[]; edges: number[][] }>();
  for (const member of frMembers) {
    const rank = permutationRank(member.cp);
    let group = frByCorner.get(rank);
    if (!group) { group = { cp: member.cp, edges: [] }; frByCorner.set(rank, group); }
    group.edges.push(member.ep);
  }
  const frGroups = [...frByCorner.values()], composedCp = new Uint8Array(8), composedEp = new Uint8Array(12);
  const signature = (cp: ArrayLike<number>, ep: ArrayLike<number>) => {
    if (event === 'htr-dr') {
      let split = 0;
      for (let slot = 0; slot < 8; slot++) if (ORBIT_A.has(ep[slot])) split |= 1 << slot;
      return cornerCanonical[permutationRank(cp)] * 256 + split;
    }
    let bestCorner = Infinity, bestEdges: number[][] | undefined;
    for (const group of frGroups) {
      for (let slot = 0; slot < 8; slot++) composedCp[slot] = group.cp[cp[slot]];
      const rank = permutationRank(composedCp);
      if (rank < bestCorner) { bestCorner = rank; bestEdges = group.edges; }
    }
    assertExact(bestEdges, 'independent FR corner minimum missing');
    let bestEdge = Infinity;
    for (const edges of bestEdges) {
      for (let slot = 0; slot < 12; slot++) composedEp[slot] = edges[ep[slot]];
      bestEdge = Math.min(bestEdge, permutationRank(composedEp));
    }
    return bestCorner * FACT12 + bestEdge;
  };
  const fixedOrientation = (state: Physical) => state.co.every(value => value === 0)
    && state.eo.every(value => value === 0) && state.center.every((piece, slot) => piece === slot);
  const inDr = (state: Physical) => fixedOrientation(state) && state.ep.every((piece, slot) => (piece >= 8) === (slot >= 8));
  const inHtr = (state: Physical) => fixedOrientation(state) && cornerIds.has(permutationRank(state.cp))
    && ORBITS.every(orbit => orbit.every(slot => orbit.includes(state.ep[slot])));
  const isGoal = event === 'htr-dr' ? inHtr : (state: Physical) => fixedOrientation(state) && frKeys.has(cpEpKey(state.cp, state.ep));
  return { puzzle, solved, signature, isGoal, isDomain: event === 'htr-dr' ? inDr : inHtr };
}

function parseAlgorithm(event: FmcDistributionEvent, algorithm: string): string[] {
  const tokens = algorithm.trim().split(/\s+/).filter(Boolean), moves = event === 'htr-dr' ? DR : HALF;
  assertExact(tokens.every(token => moves.includes(token)), 'FMC witness uses a move outside its restricted generators');
  return tokens;
}

/** Independent cubing.js replay, bounded target closure only; no native/table load. */
export async function validateFmcSubgoalWitness(event: FmcDistributionEvent, scramble: string, solution: string,
  expectedDistance?: number) {
  parseAlgorithm(event, scramble);
  const solutionMoves = parseAlgorithm(event, solution), model = await verifier(event);
  if (expectedDistance !== undefined) assertExact(solutionMoves.length === expectedDistance, 'FMC witness cost differs from its bin');
  const source = projectPattern(model.solved.applyAlg(scramble));
  const target = projectPattern(model.solved.applyAlg(`${scramble} ${solution}`));
  assertExact(model.isDomain(source), 'FMC source is outside its conditional domain');
  assertExact(model.isGoal(target), 'FMC witness does not reach its stated subgoal');
  return { canonicalStateKey: `${event}/${model.signature(source.cp, source.ep)}`, moveCost: solutionMoves.length, goalReached: true };
}

export async function enumerateFmcSubgoal(event: FmcDistributionEvent, options: FmcEnumerationOptions) {
  const graphStart = performance.now(), tablePath = path.resolve(options.nativeTablePath);
  assertExact(existsSync(BINARY), 'build solver dist_htr_fr --release --no-default-features before guarded enumeration');
  const provenance = inspectFmcNativeBuild();
  const buildManifest = JSON.parse(readFileSync(`${BINARY}.build.json`, 'utf8')) as ReturnType<typeof inspectFmcNativeBuild> & { command: string };
  assertExact(buildManifest.binarySha256 === provenance.binarySha256 && buildManifest.sourceTreeSha256 === provenance.sourceTreeSha256,
    'native binary/source differs from its recorded build; compile and refresh provenance before running');
  mkdirSync(path.dirname(tablePath), { recursive: true });
  type NativeReport = { nativeElapsedMs: number; histogram: number[]; complete: boolean };
  const receiptPath = `${tablePath}.provenance.json`, reusedNativeTable = existsSync(tablePath);
  let nativeReport: NativeReport;
  if (reusedNativeTable) {
    assertExact(existsSync(receiptPath), 'native output lacks its checksum receipt; preserve it for inspection, never rebuild automatically');
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assertExact(receipt.completed === true && receipt.event === event && receipt.binarySha256 === provenance.binarySha256
      && receipt.sourceTreeSha256 === provenance.sourceTreeSha256, 'native output provenance changed; preserve previous result');
    assertExact(receipt.tableSha256 === createHash('sha256').update(readFileSync(tablePath)).digest('hex'), 'native output checksum mismatch');
    nativeReport = receipt.nativeReport;
  } else {
    assertExact(!existsSync(receiptPath), 'native receipt exists without output; preserve interrupted evidence');
    // The child inherits the worker process group; the external guard monitors
    // and signals the complete group, including this native process.
    const native = spawnSync(BINARY, [event, tablePath], { encoding: 'utf8', maxBuffer: 1024 ** 2, stdio: ['ignore', 'pipe', 'inherit'] });
    assertExact(!native.error && native.status === 0, `native ${event} failed: ${native.error?.message ?? native.signal ?? native.status}`);
    nativeReport = JSON.parse(native.stdout.trim()) as NativeReport;
    assertExact(nativeReport.complete, 'native distribution missing completion marker');
    const temporary = `${receiptPath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify({ event, completed: true, generatedAt: new Date().toISOString(),
      binarySha256: provenance.binarySha256, sourceTreeSha256: provenance.sourceTreeSha256,
      tableSha256: createHash('sha256').update(readFileSync(tablePath)).digest('hex'), nativeReport }, null, 2) + '\n', { flag: 'wx', flush: true });
    renameSync(temporary, receiptPath);
  }
  assertExact(nativeReport.complete, 'native distribution missing completion marker');
  const bytes = readFileSync(tablePath);
  assertExact(bytes.subarray(0, 8).toString() === 'CUBEXD01', 'unexpected native distribution format');
  const total = bytes.readUInt32LE(8), moveCount = bytes.readUInt32LE(12), root = bytes.readUInt32LE(16);
  const weight = bytes.readUInt32LE(20), physicalStateCount = Number(bytes.readBigUInt64LE(24));
  const expectedTotal = event === 'htr-dr' ? 29400 : 3456, expectedWeight = event === 'htr-dr' ? 663552 : 192;
  assertExact(total === expectedTotal && weight === expectedWeight && physicalStateCount === total * weight, 'native quotient weights differ');
  assertExact(moveCount === (event === 'htr-dr' ? 10 : 6) && root < total, 'native quotient header differs');
  assertExact(bytes.length === 32 + moveCount + total + total * moveCount * 4, 'native quotient byte length differs');
  const moveNames = [...bytes.subarray(32, 32 + moveCount)].map(id => RUST_MOVES[id]);
  assertExact(JSON.stringify(moveNames) === JSON.stringify(event === 'htr-dr' ? DR : HALF), 'native generator names differ');
  const distance = bytes.subarray(32 + moveCount, 32 + moveCount + total);
  const transitions = new Uint32Array(total * moveCount), offset = 32 + moveCount + total;
  for (let i = 0; i < transitions.length; i++) transitions[i] = bytes.readUInt32LE(offset + i * 4);
  const operations = moveNames.map(name => MOVE_OPS[STM_MOVE_NAMES.indexOf(name)]);
  const inverseMove = moveNames.map(name => moveNames.indexOf(inverse(name)));
  assertExact(operations.every(Boolean) && inverseMove.every(id => id >= 0), 'public geometric move model missing a generator');
  const parentMove = new Uint8Array(total).fill(255), queue = new Uint32Array(total), representatives = new Uint8Array(total * 20);
  parentMove[root] = 254; queue[0] = root;
  for (let i = 0; i < 8; i++) representatives[root * 20 + i] = i;
  for (let i = 0; i < 12; i++) representatives[root * 20 + 8 + i] = i;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const state = queue[head];
    for (let move = 0; move < moveCount; move++) {
      const next = transitions[state * moveCount + move];
      assertExact(next < total, 'native transition leaves quotient arena');
      if (parentMove[next] !== 255) continue;
      assertExact(tail < total, 'native identity tree exceeds arena');
      parentMove[next] = move; queue[tail++] = next;
      for (let i = 0; i < 8; i++) representatives[next * 20 + i] = representatives[state * 20 + operations[move].cpFrom[i]];
      for (let i = 0; i < 12; i++) representatives[next * 20 + 8 + i] = representatives[state * 20 + 8 + operations[move].epFrom[i]];
    }
  }
  assertExact(tail === total, 'native quotient is not reachable from identity');
  const graphMs = performance.now() - graphStart;
  const verificationStart = performance.now(), model = await verifier(event);
  for (let move = 0; move < moveCount; move++) {
    const oracle = projectPattern(model.solved.applyMove(moveNames[move])), op = operations[move];
    assertExact(oracle.cp.every((piece, i) => piece === op.cpFrom[i]) && oracle.ep.every((piece, i) => piece === op.epFrom[i])
      && oracle.co.every(value => value === 0) && oracle.eo.every(value => value === 0)
      && oracle.center.every((piece, i) => piece === i), 'public geometric generator differs from cubing.js');
  }
  const signatures = new Float64Array(total), seen = new Set<number>(), histogram: number[] = [], samples: number[][] = [];
  for (let state = 0; state < total; state++) {
    const signature = model.signature(representatives.subarray(state * 20, state * 20 + 8), representatives.subarray(state * 20 + 8, state * 20 + 20));
    assertExact(!seen.has(signature), 'native quotient repeats an independent physical coset');
    seen.add(signature); signatures[state] = signature;
    const depth = distance[state]; assertExact(depth !== 255, 'native quotient has unreachable states');
    histogram[depth] = (histogram[depth] ?? 0) + 1;
    const bin = samples[depth] ??= []; if (bin.length < 256) bin.push(state);
  }
  const nextCp = new Uint8Array(8), nextEp = new Uint8Array(12);
  for (let state = 0; state < total; state++) {
    let descending = state === root;
    for (let move = 0; move < moveCount; move++) {
      const next = transitions[state * moveCount + move], op = operations[move];
      assertExact(Math.abs(distance[next] - distance[state]) <= 1, 'native edge violates distance Lipschitz bound');
      assertExact(transitions[next * moveCount + inverseMove[move]] === state, 'native inverse transition differs');
      if (distance[next] + 1 === distance[state]) descending = true;
      for (let i = 0; i < 8; i++) nextCp[i] = representatives[state * 20 + op.cpFrom[i]];
      for (let i = 0; i < 12; i++) nextEp[i] = representatives[state * 20 + 8 + op.epFrom[i]];
      assertExact(model.signature(nextCp, nextEp) === signatures[next], 'native transition disagrees with independent physical coset');
    }
    assertExact(descending, 'native non-goal has no descending edge');
  }
  assertExact(histogram[0] === 1 && distance[root] === 0 && JSON.stringify(histogram) === JSON.stringify(nativeReport.histogram),
    'native and independent histogram/goal accounting differs');
  const verificationMs = performance.now() - verificationStart;
  const scrambleFor = (original: number) => {
    const moves: number[] = []; let state = original;
    while (state !== root) {
      const move = parentMove[state]; assertExact(move < moveCount && moves.length < total, 'invalid native source tree');
      moves.push(move); state = transitions[state * moveCount + inverseMove[move]];
    }
    assertExact(moves.length === distance[original], 'identity coset tree disagrees with exact distance');
    return moves.reverse().map(move => moveNames[move]).join(' ');
  };
  const examplesStart = performance.now(), examples: { distance: number; scramble: string; solution: string }[] = [];
  for (let depth = 0; depth < histogram.length; depth++) {
    const limit = depth === histogram.length - 1 && histogram[depth] <= 256 ? 256 : 12;
    for (const original of samples[depth].slice(0, limit)) {
      let state = original; const solution: string[] = [];
      while (state !== root) {
        const move = moveNames.findIndex((_, i) => distance[transitions[state * moveCount + i]] + 1 === distance[state]);
        assertExact(move >= 0, 'native sample cannot descend');
        solution.push(moveNames[move]); state = transitions[state * moveCount + move];
      }
      const example = { distance: depth, scramble: scrambleFor(original), solution: solution.join(' ') };
      const verified = await validateFmcSubgoalWitness(event, example.scramble, example.solution, depth);
      assertExact(verified.canonicalStateKey === `${event}/${signatures[original]}`, 'independent example replay changes its physical coset');
      examples.push(example);
    }
  }
  const examplesMs = performance.now() - examplesStart;
  function* allStates(start = 0) {
    assertExact(Number.isSafeInteger(start) && start >= 0 && start <= total, 'invalid FMC download resume offset');
    for (let state = start; state < total; state++) yield { depth: distance[state], scramble: scrambleFor(state) };
  }
  const adapterSha256 = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
  const tableSha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    id: event, label: event === 'htr-dr' ? 'DR → HTR' : 'HTR → FR (UD)', stateCount: total, total,
    histogram, godsNumber: histogram.length - 1, goalCount: 1, identityDistance: 0, quotient: true,
    physicalStatesPerCoordinate: weight, physicalStateCount, physicalHistogram: histogram.map(count => count * weight),
    goalDefinition: event === 'htr-dr' ? 'From fixed-UD DR to the half-turn subgroup G3; one coordinate represents one coset of the 663552-state target subgroup.'
      : 'From the half-turn subgroup G3 to fixed-UD FR subgroup H=<L2,R2,F2,B2>; one coordinate represents one coset of this 192-state target.',
    metric: `${event === 'htr-dr' ? DR.join('/') : HALF.join('/')} only; every listed move costs 1 HTM. Conditional stage, not a complete 3x3 solution.`,
    examples, examplesLimitPerDepth: 12, deepestExamplesComplete: histogram.at(-1)! <= 256,
    allStates: { [Symbol.iterator]: () => allStates(), resume: allStates,
      resumeKey: createHash('sha256').update(`${event}/${tableSha256}/${adapterSha256}`).digest('hex') },
    downloadScope: 'Every quotient representative, one per equal-weight target coset; not every physical cube state.',
    estimatedArrayBytes: bytes.byteLength + transitions.byteLength + representatives.byteLength + parentMove.byteLength + queue.byteLength + signatures.byteLength,
    nativeConstructionArrayBudgetBytes: event === 'htr-dr' ? 24 * 1024 ** 2 : 4 * 1024 ** 2,
    denseCoordinateUpperBound: total, timingMs: { graph: graphMs, verification: verificationMs, examples: examplesMs, solve: 0 },
    native: { ...nativeReport, ...provenance, buildCommand: buildManifest.command,
      adapterSha256, tablePath, tableSha256, reusedNativeTable, receiptPath },
    verification: { closed: true, directedEdgesChecked: total * moveCount, independentPhysicalTransitionsChecked: total * moveCount,
      distinctIndependentPhysicalCosets: seen.size, allEdgesDistanceDifferenceAtMostOne: true,
      allNonGoalStatesHaveDescendingEdge: true, independentlyReplayedExamples: examples.length,
      referenceGodNumber: event === 'htr-dr' ? 13 : 11, referenceHistogramAvailable: false, moveNames,
      proof: 'Reused Rust exact table; complete quotient closure; independent physical coset bijection and every generator edge checked; 1-Lipschitz distances and descending edges; cubing.js witness replay; equal-size subgroup cosets give exact physical weights.',
      geometrySource: 'Rust htr_solver.rs / fr_solver.rs; public geometric STM moves; independent cubing.js 3x3 KPuzzle bounded target closures.',
      scope: `All ${total} target cosets, each with ${weight} physical states (${physicalStateCount} total). Complete representative download, no sampling.` },
  };
}

export const enumerateHtrDr = (options: FmcEnumerationOptions) => enumerateFmcSubgoal('htr-dr', options);
export const enumerateFrHtr = (options: FmcEnumerationOptions) => enumerateFmcSubgoal('fr-htr', options);
