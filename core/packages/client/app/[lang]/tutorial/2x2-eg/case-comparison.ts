import { AllFaces, Face } from '@cuberoot/visualcube';
import { twoByTwoState } from '../lib/2x2-state';
import { EG_RECOGNITION_CASES, egMoves, type EgCase, type EgSet, type EgShape } from './lesson-data';

const turns = ['', 'U', 'U2', "U'"] as const;
const sideFaces = [Face.F, Face.R, Face.L, Face.B] as const;
const topFacelets = [0, 1, 2, 3];
export const upperSideFacelets = sideFaces.flatMap(face => [face * 4, face * 4 + 1]);
const topStickers = [...topFacelets, ...upperSideFacelets];
const oppositeColors = new Set(['RO', 'OR', 'BG', 'GB']);
const sideAnchors = ['same', 'opposite'] as const;

export type EgColorRelation = 'same' | 'adjacent' | 'opposite';
export type StickerPair = readonly [number, number];
export type RecognitionCheck = { kind: 'relation'; pair: StickerPair } | { kind: 'bars' }
  | { kind: 'top-yellows' };
export type RecognitionAnswer = EgColorRelation | number | number[];
type RecognitionVariant = { entry: EgCase; setup: string; turn: typeof turns[number]; stickers: string[]; yellow: number[] };
export type RecognitionExample = RecognitionVariant & { answers: RecognitionAnswer[] };
type RecognitionAnchor = { kind: 'yellow'; facelets: readonly number[] }
  | { kind: 'side'; face: typeof sideFaces[number]; relation: typeof sideAnchors[number]; pair: StickerPair };
export type RecognitionMethod = { anchor: RecognitionAnchor; checks: readonly RecognitionCheck[]; examples: RecognitionExample[] };

function facelets(setup: string) {
  const state = twoByTwoState(setup);
  return AllFaces.flatMap(face => state[face]);
}

function relation(stickers: string[], [a, b]: StickerPair): EgColorRelation {
  if (stickers[a] === stickers[b]) return 'same';
  return oppositeColors.has(stickers[a] + stickers[b]) ? 'opposite' : 'adjacent';
}

function matchingBars(stickers: string[]) {
  return sideFaces.filter(face => relation(stickers, [face * 4, face * 4 + 1]) === 'same')
    .flatMap(face => [face * 4, face * 4 + 1]);
}

export function recognitionKey(answer: RecognitionAnswer) {
  return Array.isArray(answer) ? answer.join(',') : String(answer);
}

function answerFor(check: RecognitionCheck, variant: RecognitionVariant): RecognitionAnswer {
  if (check.kind === 'relation') return relation(variant.stickers, check.pair);
  if (check.kind === 'bars') return matchingBars(variant.stickers).length / 2;
  return topFacelets.filter(index => variant.stickers[index] === 'Y');
}

function* subsets(items: readonly number[], length: number, start = 0, chosen: number[] = []): Generator<number[]> {
  if (length === 0) {
    yield chosen;
    return;
  }
  for (let i = start; i <= items.length - length; i++) {
    yield* subsets(items, length - 1, i + 1, [...chosen, items[i]]);
  }
}

function stickerPairs(stickers: number[]): StickerPair[] {
  return stickers.flatMap((a, index) => stickers.slice(index + 1).map(b => [a, b] as const));
}

function distinguishes(pairs: StickerPair[], readings: RecognitionVariant[]) {
  const owners = new Map<string, string>();
  return readings.every(reading => {
    const pattern = pairs.map(pair => relation(reading.stickers, pair)).join(',');
    const owner = owners.get(pattern);
    owners.set(pattern, reading.entry.id);
    return !owner || owner === reading.entry.id;
  });
}

function orderChecks(pairs: StickerPair[], readings: RecognitionVariant[]): RecognitionCheck[] {
  let ambiguous = readings.flatMap((a, i) => readings.slice(i + 1)
    .filter(b => a.entry.id !== b.entry.id).map(b => [a, b] as const));
  const checks: RecognitionCheck[] = [];
  while (ambiguous.length) {
    let best: StickerPair | undefined;
    let collisions = ambiguous;
    for (const pair of pairs) {
      const remaining = ambiguous.filter(([a, b]) => relation(a.stickers, pair) === relation(b.stickers, pair));
      if (remaining.length < collisions.length) {
        best = pair;
        collisions = remaining;
      }
    }
    if (!best) break;
    checks.push({ kind: 'relation', pair: best });
    ambiguous = collisions;
  }
  return checks;
}

function methodFrom(anchor: RecognitionAnchor, checks: RecognitionCheck[], readings: RecognitionVariant[]): RecognitionMethod {
  return { anchor, checks, examples: readings.map(reading => ({ ...reading, answers: checks.map(check => answerFor(check, reading)) })) };
}

const variantCache = new Map<EgShape, RecognitionVariant[]>();
function variantsFor(shape: EgShape) {
  const cached = variantCache.get(shape);
  if (cached) return cached;
  const variants = EG_RECOGNITION_CASES.filter(entry => entry.shape === shape).flatMap(entry => turns.map(turn => {
    const setup = egMoves(entry.setup, turn);
    const stickers = facelets(setup);
    return { entry, setup, turn, stickers, yellow: topStickers.filter(sticker => stickers[sticker] === 'Y') };
  }));
  variantCache.set(shape, variants);
  return variants;
}

const visibility = (sticker: number) => {
  const face = Math.floor(sticker / 4);
  return face === Face.U ? 0 : face === Face.F ? 1 : face === Face.R ? 2 : 4;
};

function buildGroupRecognition(shape: EgShape) {
  const variants = variantsFor(shape);
  if (shape === 'o') {
    return methodFrom({ kind: 'yellow', facelets: topFacelets }, [{ kind: 'bars' }], variants);
  }

  const yellowLayouts = new Map<string, RecognitionVariant[]>();
  for (const variant of variants) {
    const key = variant.yellow.join(',');
    const group = yellowLayouts.get(key);
    if (group) group.push(variant);
    else yellowLayouts.set(key, [variant]);
  }

  // All four yellow positions define the reference, including the two side yellows
  // in a diagonal case. Read every orientation that shares that reference.
  const layouts = [...yellowLayouts.values()].sort((a, b) => {
    const rank = (variant: RecognitionVariant) => variant.yellow.map(i => topStickers.indexOf(i).toString(16)).join('');
    return rank(a[0]).localeCompare(rank(b[0]));
  });
  const ids = new Set(variants.map(item => item.entry.id));
  for (let size = 2; size <= 8; size++) {
    let best: { pairs: StickerPair[]; readings: RecognitionVariant[]; score: number } | undefined;
    for (const readings of layouts) {
      if (new Set(readings.map(item => item.entry.id)).size !== ids.size) continue;
      for (const stickers of subsets(topStickers.filter(i => !readings[0].yellow.includes(i)), size)) {
        const score = stickers.reduce((sum, sticker) => sum + visibility(sticker), 0);
        if (best && best.score <= score) continue;
        const pairs = stickerPairs(stickers).sort((a, b) =>
          Number(Math.floor(a[0] / 4) !== Math.floor(a[1] / 4)) - Number(Math.floor(b[0] / 4) !== Math.floor(b[1] / 4)));
        if (distinguishes(pairs, readings)) best = { pairs, readings, score };
      }
    }
    if (best) return methodFrom({ kind: 'yellow', facelets: best.readings[0].yellow },
      orderChecks(best.pairs, best.readings), best.readings);
  }
  return null;
}

const recognitionCache = new Map<EgShape, RecognitionMethod | null>();
export function getEgRecognition(shape: EgShape) {
  if (!recognitionCache.has(shape)) recognitionCache.set(shape, buildGroupRecognition(shape));
  return recognitionCache.get(shape) ?? null;
}

export function recognitionExamples(method: RecognitionMethod, set: EgSet) {
  return method.examples.filter(example => example.entry.set === set);
}

export function recognitionFacelets(check: RecognitionCheck, example: RecognitionExample) {
  if (check.kind === 'relation') return check.pair;
  if (check.kind === 'bars') return matchingBars(example.stickers);
  return example.yellow.filter(index => index < 4);
}

// A side-pair reference is useful when it leaves just one top-yellow pattern
// per candidate. Test all U turns that match the proposed reference.
export function alternateEgRecognition(set: EgSet, shape: EgShape, ids: readonly string[]) {
  if (ids.length < 2 || shape === 'o') return null;
  const variants = variantsFor(shape).filter(({ entry }) => entry.set === set && ids.includes(entry.id));
  let best: { method: RecognitionMethod; score: number } | undefined;
  for (const face of sideFaces) {
    const pair = [face * 4, face * 4 + 1] as const;
    for (const colorRelation of sideAnchors) {
      const readings = variants.filter(variant => pair.every(i => !variant.yellow.includes(i))
        && relation(variant.stickers, pair) === colorRelation);
      const byCase = new Map<string, Set<string>>();
      for (const reading of readings) {
        const positions = new Set(byCase.get(reading.entry.id));
        positions.add(recognitionKey(answerFor({ kind: 'top-yellows' }, reading)));
        byCase.set(reading.entry.id, positions);
      }
      if (byCase.size !== ids.length || [...byCase.values()].some(patterns => patterns.size !== 1)
        || new Set([...byCase.values()].flatMap(patterns => [...patterns])).size !== ids.length) continue;
      // Prefer the reference that is already present in the formula starting views.
      const score = readings.filter(reading => reading.turn === '').length;
      if (!best || score > best.score) best = {
        method: methodFrom({ kind: 'side', face, relation: colorRelation, pair }, [{ kind: 'top-yellows' }], readings),
        score,
      };
    }
  }
  return best?.method ?? null;
}

export function compareEgCases(first: EgCase, second: EgCase) {
  if (first.set !== second.set || first.shape !== second.shape || first.id === second.id) return null;
  const method = getEgRecognition(first.shape);
  if (!method) return null;
  const readings = [first, second].map(entry => method.examples.filter(example =>
    example.entry.set === entry.set && example.entry.id === entry.id));
  if (readings.some(items => !items.length)) return null;
  const prefix = (item: RecognitionExample, length: number) => item.answers.slice(0, length).map(recognitionKey).join('/');
  let difference = 0;
  for (; difference < method.checks.length - 1; difference++) {
    const firstKeys = new Set(readings[0].map(item => prefix(item, difference + 1)));
    if (readings[1].every(item => !firstKeys.has(prefix(item, difference + 1)))) break;
  }
  // Show a pair that looks alike through the preceding checks, even when a
  // symmetric yellow pattern gives a case more than one valid appearance.
  const rightByPrefix = new Map(readings[1].map(item => [prefix(item, difference), item]));
  const leftExample = readings[0].find(item => rightByPrefix.has(prefix(item, difference)))!;
  const rightExample = rightByPrefix.get(prefix(leftExample, difference))!;
  return { method, readings, difference, examples: [leftExample, rightExample] };
}
