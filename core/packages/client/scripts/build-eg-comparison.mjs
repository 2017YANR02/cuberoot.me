import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { KTransformation } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { _test as pocket } from '@cuberoot/puzzle-solvers/cube222';
import { Face, AllFaces } from '@cuberoot/visualcube';
import { twoByTwoState } from '../app/[lang]/tutorial/lib/2x2-state.ts';

// Offline, small-sample comparison. Distances use the fixed-DBL HTM convention
// shared with the 2×2 solver. No solve tables or browser work are required.
const sampleSize = 512;
const exampleLimit = 96;
const seed = 0x2e6128;
const kpuzzle = await puzzles['2x2x2'].kpuzzle();
const identity = kpuzzle.identityTransformation();
const transform = alg => kpuzzle.algToTransformation(alg);
const corners = transformation => transformation.transformationData.CORNERS;
const names = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
const moves = names.map(transform);

// Cubing.js orders the four U corners in the opposite direction to cube222.
const order = [0, 3, 2, 1, 4, 5, 6, 7];
const toSolverState = ({ permutation, orientationDelta }) => ({
  cp: Int8Array.from(order, slot => order[permutation[slot]]),
  co: Int8Array.from(order, slot => orientationDelta[slot]),
});
for (const [index, name] of names.entries()) {
  assert.deepEqual(toSolverState(corners(moves[index])), pocket.applyScramble(name));
}

function pose({ permutation, orientationDelta }, piece) {
  const slot = permutation.indexOf(piece);
  return slot * 3 + orientationDelta[slot];
}

// Color changes are free relabelings, then a real rotation puts DBL back in the gauge.
// These six orientations put six different colors on D; the first pair is opposite.
const bottomColors = ['', 'x2', 'x', "x'", 'z', "z'"].map(alg => ({
  relabel: transform(alg).invert(), color: twoByTwoState(alg)[Face.D][0],
}));
const regauge = new Map();
const rotations = [{ rotation: identity, alg: '' }];
const rotationMoves = ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"].map(alg => ({ alg, rotation: transform(alg) }));
for (const { rotation, alg } of rotations) {
  const key = pose(corners(rotation), 6);
  if (regauge.has(key)) continue;
  regauge.set(key, { rotation: rotation.invert(), alg: new Alg(alg).invert().toString() });
  for (const move of rotationMoves) rotations.push({ rotation: rotation.applyTransformation(move.rotation), alg: [alg, move.alg].filter(Boolean).join(' ') });
}
assert.equal(regauge.size, 24);

function followShortest(state, measure) {
  const length = measure(state);
  assert(length >= 0, 'Checkpoint state is unreachable');
  const path = [];
  for (let left = length; left > 0; left--) {
    const candidates = moves.map(move => state.applyTransformation(move));
    const next = candidates.findIndex(candidate => measure(candidate) === left - 1);
    assert(next >= 0, 'No move descends the checkpoint distance');
    state = candidates[next];
    path.push(names[next]);
  }
  return { state, length, path };
}

const poseMoves = moves.map(move => {
  const { permutation, orientationDelta } = corners(move);
  return Array.from({ length: 24 }, (_, value) => {
    const slot = permutation.indexOf(Math.floor(value / 3));
    return slot * 3 + (value % 3 + orientationDelta[slot]) % 3;
  });
});

// Each small multi-source BFS keeps only the coordinates relevant to a checkpoint.
// The original transformation supplies the actual state after following the distances.
function checkpoint(radices, project, seeds, next) {
  const encode = values => values.reduce((index, value, i) => index * radices[i] + value, 0);
  const distance = new Int8Array(radices.reduce((size, radix) => size * radix, 1)).fill(-1);
  const queue = new Int32Array(distance.length);
  let end = 0;
  for (const values of seeds) {
    const node = encode(values);
    distance[node] = 0;
    queue[end++] = node;
  }
  const values = Array(radices.length);
  for (let front = 0; front < end; front++) {
    let code = queue[front];
    for (let i = radices.length - 1; i >= 0; i--) {
      values[i] = code % radices[i];
      code = Math.floor(code / radices[i]);
    }
    for (let move = 0; move < moves.length; move++) {
      const node = values.reduce((index, value, i) => index * radices[i] + next(value, i, move), 0);
      if (distance[node] >= 0) continue;
      distance[node] = distance[queue[front]] + 1;
      queue[end++] = node;
    }
  }
  const measure = state => distance[encode(project(corners(state)))];
  return { measure, follow: state => followShortest(state, measure) };
}

const ordered = [5, 4, 7]; // DLF, DFR, DRB after using DBL as reference.
const arrangements = ordered.flatMap(a => ordered.filter(b => b !== a).map(b => [a, b, ordered.find(c => c !== a && c !== b)]));
const firstBottom = (pieces, targets = [pieces]) => checkpoint(
  pieces.map(() => 24),
  state => pieces.map(piece => pose(state, piece)),
  targets.map(slots => slots.map(slot => slot * 3)),
  (value, _index, move) => poseMoves[move][value],
);
const pair = firstBottom(ordered.slice(0, 1));
const three = firstBottom(ordered.slice(0, 2));
const layer = firstBottom(ordered);
const face = firstBottom(ordered, arrangements);

const orientationIndex = ori => ori.slice(0, 6).reduce((index, twist) => index * 3 + twist, 0);
const orientationMoves = moves.map(move => {
  const { permutation, orientationDelta } = corners(move);
  return Uint16Array.from({ length: 729 }, (_, code) => {
    const ori = new Uint8Array(8);
    let sum = 0;
    for (let i = 5; i >= 0; i--) {
      ori[i] = code % 3;
      sum += ori[i];
      code = Math.floor(code / 3);
    }
    ori[7] = (3 - sum % 3) % 3;
    return orientationIndex(permutation.map((slot, i) => (ori[slot] + orientationDelta[i]) % 3));
  });
});

function orientTop(targets) {
  return checkpoint([8, 8, 8, 729],
    state => [...ordered.map(piece => state.permutation.indexOf(piece)), orientationIndex(state.orientationDelta)],
    targets.map(slots => [...slots, 0]),
    (value, index, move) => index === 3 ? orientationMoves[move][value] : Math.floor(poseMoves[move][value * 3] / 3),
  );
}
const orientOverLayer = orientTop([ordered]);
const orientOverFace = orientTop(arrangements);

function runStages(state, stages) {
  let length = 0;
  const path = [];
  for (const stage of stages) {
    const result = stage.follow(state);
    state = result.state;
    length += result.length;
    path.push(...result.path);
  }
  return { state, length, path };
}

const finishCache = new Map();
function finish(state) {
  const data = corners(state);
  const key = data.permutation.join('') + data.orientationDelta.join('');
  if (!finishCache.has(key)) finishCache.set(key, pocket.solveHTMLen(toSolverState(data)));
  return finishCache.get(key);
}

function routes(state) {
  const sequential = runStages(state, [pair, three, layer]);
  const fl = runStages(state, [pair, layer]);
  const singleFace = face.follow(state);
  return Object.fromEntries([
    ['lbl', sequential, orientOverLayer], ['fl', fl, orientOverLayer], ['face', singleFace, orientOverFace],
  ].map(([method, opening, orientation]) => {
    const oriented = orientation.follow(opening.state);
    return [method, {
      one: [opening.length, finish(opening.state), opening.path, [], opening.state],
      two: [opening.length, oriented.length + finish(oriented.state), opening.path, oriented.path, oriented.state],
    }];
  }));
}

let rngState = seed;
const random = () => {
  rngState = (Math.imul(1664525, rngState) + 1013904223) >>> 0;
  return rngState / 2 ** 32;
};
const methods = ['lbl', 'fl', 'face'];
const palettes = [1, 2, 6];
const finishes = ['one', 'two'];
const totals = Object.fromEntries(methods.map(method => [method, Object.fromEntries(finishes.map(mode => [mode, palettes.map(() => [0, 0])]))]));
const cost = ([opening, ending]) => opening + ending;
const shortest = (a, b) => cost(b) < cost(a) || (cost(b) === cost(a) && b[0] < a[0]) ? b : a;
const examples = new Map();

function recordExample(setup, routesByMethod) {
  const paths = [];
  const routeIds = Object.fromEntries(methods.map(method => [method, {}]));
  for (const { best, candidates, holdings, method, mode } of routesByMethod) routeIds[method][mode] = best.map(plan => {
    const [opening, ending, bottomPath, topPath, lastState] = plan;
    const { color, regrip } = holdings[candidates.indexOf(plan)];
    const lastPath = followShortest(lastState, finish).path;
    assert.equal(bottomPath.length, opening);
    assert.equal(topPath.length + lastPath.length, ending);
    const path = [color, regrip, bottomPath.join(' '), topPath.join(' '), lastPath.join(' ')];
    const openState = twoByTwoState([setup, regrip, path[2]].filter(Boolean).join(' '));
    assert(openState[Face.D].every(sticker => sticker === color));
    if (method !== 'face') {
      assert([Face.F, Face.R, Face.B, Face.L].every(face => openState[face][2] === openState[face][3]));
    }
    const solved = twoByTwoState([setup, ...path.slice(1)].filter(Boolean).join(' '));
    assert(AllFaces.every(face => new Set(solved[face]).size === 1));
    const existing = paths.findIndex(candidate => candidate.every((part, index) => part === path[index]));
    return existing >= 0 ? existing : paths.push(path) - 1;
  });
  examples.set(setup, { setup, paths, routeIds });
}

for (let sample = 0; sample < sampleSize; sample++) {
  const state = pocket.randomState(random);
  const scramble = new KTransformation(kpuzzle, { CORNERS: {
    permutation: order.map(slot => order[state.cp[slot]]),
    orientationDelta: order.map(slot => state.co[slot]),
  } });
  const holdings = bottomColors.map(({ relabel, color }) => {
    const relabeled = relabel.applyTransformation(scramble);
    const holding = regauge.get(pose(corners(relabeled), 6));
    const fixed = relabeled.applyTransformation(holding.rotation);
    assert.equal(pose(corners(fixed), 6), 18);
    return { state: fixed, color, regrip: holding.alg };
  });
  const colorStates = holdings.map(holding => holding.state);
  if (sample < 32) {
    assert.equal(Math.min(...colorStates.map(face.measure)), pocket.bottomFaceDist(state));
    assert.equal(Math.min(...colorStates.map(layer.measure)), pocket.firstLayerDist(state));
  }
  const alternatives = colorStates.map(routes);
  const routesByMethod = [];
  for (const method of methods) for (const mode of finishes) {
    const candidates = alternatives.map(alternative => alternative[method][mode]);
    const best = palettes.map(palette => candidates.slice(0, palette).reduce(shortest));
    best.forEach(([opening, ending], index) => {
      totals[method][mode][index][0] += opening;
      totals[method][mode][index][1] += ending;
    });
    routesByMethod.push({ best, candidates, holdings, method, mode });
  }
  if (examples.size < exampleLimit && finish(scramble) >= 4) {
    const setup = new Alg(followShortest(scramble, finish).path.join(' ')).invert().toString();
    assert(scramble.isIdentical(transform(setup)));
    if (!examples.has(setup)) recordExample(setup, routesByMethod);
  }
}

const output = new URL('../app/[lang]/tutorial/2x2-eg/solve-comparison-data.json', import.meta.url);
const json = `${JSON.stringify({ sampleSize, totals }, null, 2)}\n`;
const examplesOutput = new URL('../app/[lang]/tutorial/2x2-eg/solve-comparison-examples.json', import.meta.url);
const examplesJson = `[\n${Array.from(examples.values(), item => `  ${JSON.stringify(item)}`).join(',\n')}\n]\n`;
assert.equal(examples.size, exampleLimit);
if (process.argv.includes('--check')) {
  assert.equal(readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), json);
  assert.equal(readFileSync(examplesOutput, 'utf8').replaceAll('\r\n', '\n'), examplesJson);
} else {
  writeFileSync(output, json);
  writeFileSync(examplesOutput, examplesJson);
}
