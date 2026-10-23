/** Shared bounded BFS for a product of two compact puzzle coordinates. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function assertExact(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`exact-coordinate-bfs: ${message}`);
}

export function permutationRank(p: ArrayLike<number>): number {
  let rank = 0;
  for (let i = 0; i < p.length; i++) {
    let smaller = 0;
    for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) smaller++;
    rank = rank * (p.length - i) + smaller;
  }
  return rank;
}

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320] as const;
export function unrankPermutation(rank: number, out: Uint8Array): void {
  assertExact(out.length <= 8, 'permutation coordinate exceeds the supported small factor');
  let available = 2 ** out.length - 1;
  for (let i = 0; i < out.length; i++) {
    const factor = FACTORIAL[out.length - 1 - i];
    let choice = Math.floor(rank / factor);
    rank %= factor;
    for (let piece = 0; piece < out.length; piece++) {
      if ((available & (1 << piece)) === 0) continue;
      if (choice-- !== 0) continue;
      out[i] = piece;
      available ^= 1 << piece;
      break;
    }
  }
}

export function orientationRank(values: ArrayLike<number>, base: number): number {
  let rank = 0;
  for (let i = values.length - 1; i >= 0; i--) rank = rank * base + values[i];
  return rank;
}

export function unrankOrientation(rank: number, base: number, out: Uint8Array): void {
  for (let i = 0; i < out.length; i++) {
    out[i] = rank % base;
    rank = Math.floor(rank / base);
  }
}

type MoveArray = Uint8Array | Uint16Array | Uint32Array | Int32Array;
export interface ProductCoordinateMoves {
  firstCount: number;
  secondCount: number;
  moveCount: number;
  firstMoves: MoveArray;
  secondMoves: MoveArray;
}

export function nextProductCoordinate(model: ProductCoordinateMoves, index: number, move: number): number {
  return model.firstMoves[Math.floor(index / model.secondCount) * model.moveCount + move]
    * model.secondCount + model.secondMoves[(index % model.secondCount) * model.moveCount + move];
}

/** No per-state allocation: fixed uint8 distances and uint32 FIFO, <=128 MiB. */
export function enumerateProductCoordinates(model: ProductCoordinateMoves) {
  const { firstCount, secondCount, moveCount, firstMoves, secondMoves } = model;
  const totalCoordinates = firstCount * secondCount;
  const arrayBytes = totalCoordinates * 5 + firstMoves.byteLength + secondMoves.byteLength;
  assertExact(Number.isSafeInteger(totalCoordinates) && totalCoordinates <= 50_000_000,
    'coordinate arena exceeds the 50-million-state boundary');
  assertExact(arrayBytes <= 128 * 2 ** 20, 'coordinate arrays exceed 128 MiB');
  assertExact(firstMoves.length === firstCount * moveCount
    && secondMoves.length === secondCount * moveCount, 'factor table dimensions disagree');
  for (const target of firstMoves) assertExact(target < firstCount, 'first factor escapes its arena');
  for (const target of secondMoves) assertExact(target < secondCount, 'second factor escapes its arena');
  const unseen = 255;
  const distance = new Uint8Array(totalCoordinates).fill(unseen);
  const queue = new Uint32Array(totalCoordinates);
  const histogram = [1], representatives = [0], samplesByDepth: number[][] = [[0]];
  distance[0] = 0;
  queue[0] = 0;
  let head = 0, total = 1, edgeChecks = 0;
  while (head < total) {
    const state = queue[head++];
    const depth = distance[state];
    const firstOffset = Math.floor(state / secondCount) * moveCount;
    const secondOffset = (state % secondCount) * moveCount;
    let hasPredecessor = state === 0;
    for (let move = 0; move < moveCount; move++) {
      const neighbor = firstMoves[firstOffset + move] * secondCount + secondMoves[secondOffset + move];
      if (distance[neighbor] === unseen) {
        assertExact(depth + 1 < unseen && total < queue.length, 'bounded arena exhausted');
        distance[neighbor] = depth + 1;
        queue[total++] = neighbor;
        if (histogram[depth + 1] === undefined) representatives[depth + 1] = neighbor;
        histogram[depth + 1] = (histogram[depth + 1] ?? 0) + 1;
        const samples = samplesByDepth[depth + 1] ??= [];
        if (samples.length < 256) samples.push(neighbor);
      }
      assertExact(Math.abs(distance[neighbor] - depth) <= 1,
        'edge violates shortest-distance Lipschitz bound');
      if (distance[neighbor] + 1 === depth) hasPredecessor = true;
      edgeChecks++;
    }
    assertExact(hasPredecessor, 'non-root state has no descending distance edge');
  }
  assertExact(head === total && edgeChecks === total * moveCount, 'reachable closure was not exhausted');
  assertExact(histogram.reduce((sum, count) => sum + count, 0) === total, 'histogram omitted reachable states');
  return { distance, histogram, representatives, samplesByDepth, total, edgeChecks,
    arrayBytes: distance.byteLength + queue.byteLength };
}

export interface ExactDistributionExample { distance: number; scramble: string; solution: string }
export interface ResumableExactStates extends Iterable<{ depth: number; scramble: string }> {
  readonly total: number;
  readonly resumeKey: string;
  resume(startRow: number): Iterable<{ depth: number; scramble: string }>;
}

/** Bind resumed rows to the exact table, notation and implementation. */
export function productCoordinateFingerprint(model: ProductCoordinateMoves): string {
  return createHash('sha256').update(readFileSync(new URL(import.meta.url)))
    .update(JSON.stringify([model.firstCount, model.secondCount, model.moveCount]))
    .update(new Uint8Array(model.firstMoves.buffer, model.firstMoves.byteOffset, model.firstMoves.byteLength))
    .update(new Uint8Array(model.secondMoves.buffer, model.secondMoves.byteOffset, model.secondMoves.byteLength))
    .digest('hex');
}

/** Stream one shortest scramble per reachable coordinate from a resident table.
 * No corpus-sized string array, state Map or second BFS is created. */
export function productCoordinateAllStates(model: ProductCoordinateMoves, moveNames: readonly string[],
  graph: { distance: Uint8Array; total: number },
  inverseMove: (move: number) => number): ResumableExactStates {
  assertExact(moveNames.length === model.moveCount, 'download move alphabet size mismatch');
  const inverseNames = moveNames.map((_, move) => moveNames[inverseMove(move)]);
  const resumeKey = createHash('sha256').update(productCoordinateFingerprint(model)).update(graph.distance)
    .update(JSON.stringify([graph.total, inverseNames])).digest('hex');
  function* resume(startRow: number) {
    assertExact(Number.isSafeInteger(startRow) && startRow >= 0 && startRow <= graph.total, 'invalid resume row');
    const path: string[] = [];
    // Dense arenas seek directly. The tipless model has unreachable coordinates;
    // seeking its sparse byte array never reconstructs already-written scrambles.
    let emitted = graph.total === graph.distance.length ? startRow : 0;
    for (let original = emitted; original < graph.distance.length; original++) {
    const depth = graph.distance[original];
    if (depth === 255) continue;
    if (emitted < startRow) { emitted++; continue; }
    let state = original;
    path.length = 0;
    while (graph.distance[state] > 0) {
      let selected = -1;
      for (let move = 0; move < model.moveCount; move++) {
        const next = nextProductCoordinate(model, state, move);
        if (graph.distance[next] + 1 !== graph.distance[state]) continue;
        selected = move; state = next; break;
      }
      assertExact(selected >= 0, 'download state has no descending edge');
      path.push(inverseNames[selected]);
    }
    assertExact(path.length === depth, 'download scramble does not match its bin');
    emitted++;
    yield { depth, scramble: path.reverse().join(' ') };
  }
  assertExact(emitted === graph.total, 'download omitted reachable states');
  }
  return { total: graph.total, resumeKey, resume, [Symbol.iterator]: () => resume(0) };
}

export function productCoordinateExamples(model: ProductCoordinateMoves, moveNames: readonly string[],
  graph: Pick<ReturnType<typeof enumerateProductCoordinates>, 'distance' | 'histogram' | 'samplesByDepth'>,
  inverseMove: (move: number) => number, examplesLimitPerDepth = 12): ExactDistributionExample[] {
  const examples: ExactDistributionExample[] = [];
  for (let depth = 0; depth < graph.samplesByDepth.length; depth++) {
    const limit = depth === graph.histogram.length - 1 && graph.histogram[depth] <= 256
      ? 256 : examplesLimitPerDepth;
    for (const originalState of graph.samplesByDepth[depth].slice(0, limit)) {
    let state = originalState;
    const solutionMoves: number[] = [];
    while (graph.distance[state] > 0) {
      let descending = -1;
      for (let move = 0; move < model.moveCount; move++) {
        const neighbor = nextProductCoordinate(model, state, move);
        if (graph.distance[neighbor] + 1 !== graph.distance[state]) continue;
        descending = move;
        state = neighbor;
        break;
      }
      assertExact(descending >= 0, 'sample cannot descend to solved');
      solutionMoves.push(descending);
    }
    assertExact(solutionMoves.length === depth, 'sample solution length does not match its bin');
    examples.push({ distance: depth,
      solution: solutionMoves.map(move => moveNames[move]).join(' '),
      scramble: solutionMoves.slice().reverse().map(move => moveNames[inverseMove(move)]).join(' '),
    });
    }
  }
  return examples;
}
