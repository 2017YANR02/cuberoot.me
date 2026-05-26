// Ported from packages/client/src/utils/pllHelpers.ts
import type { PllCaseInstance } from './scramble-generator';

export const PLL_LETTERS = ['A', 'E', 'F', 'G', 'H', 'J', 'N', 'R', 'T', 'U', 'V', 'Y', 'Z'] as const;

const PLL_LETTER_SET = new Set(PLL_LETTERS);
const SINGLE_LETTER_PLL_SET = new Set(['E', 'F', 'H', 'T', 'V', 'Y', 'Z']);
const TWO_LETTER_PLL_PREFIX_SET = new Set(['A', 'G', 'J', 'N', 'R', 'U']);

export const isPllLetter = (l: string): boolean => PLL_LETTER_SET.has(l as typeof PLL_LETTERS[number]);
export const isSingleLetterPll = (l: string): boolean => SINGLE_LETTER_PLL_SET.has(l);
export const isTwoLetterPllPrefix = (l: string): boolean => TWO_LETTER_PLL_PREFIX_SET.has(l);

export const validPllSuffixes: Record<string, string[]> = {
  A: ['a', 'b'],
  G: ['a', 'b', 'c', 'd'],
  J: ['a', 'b'],
  N: ['a', 'b'],
  R: ['a', 'b'],
  U: ['a', 'b'],
};

export const isHelpKey = (key: string): boolean =>
  new Set(['-', 'F1', '?', 's', 'S', '/']).has(key);

export const allPllCaseNames = new Set([
  'Aa', 'Ab', 'E', 'F', 'Ga', 'Gb', 'Gc', 'Gd',
  'H', 'Ja', 'Jb', 'Na', 'Nb', 'Ra', 'Rb',
  'T', 'Ua', 'Ub', 'V', 'Y', 'Z',
]);

export const D_TURN_OPTIONS = ['', 'd', 'd2', "d'"];
export const COLOR_SHIFTS = [0, 1, 2, 3];

export const CUBE_COLORS = ['white', 'yellow', 'blue', 'green', 'orange', 'red'] as const;
export const DEFAULT_ALLOWED_CROSS_COLORS = ['w'];

export const randomCrossColor = (allowed: string[]): string => {
  const a = allowed.length === 0 ? DEFAULT_ALLOWED_CROSS_COLORS : allowed;
  return randomElement(a);
};

export const randomElement = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const getRotationArray = (pllFirstLetter: string): string[] => {
  switch (pllFirstLetter) {
    case 'H': return [''];
    case 'N':
    case 'E':
    case 'Z': return ['', 'y'];
    default:  return ['', 'y', 'y2', "y'"];
  }
};

export const allPllKeys = (pllMap: Record<string, unknown>): string[] => {
  const plls = Object.keys(pllMap);
  const keys: string[] = [];
  for (const pll of plls) {
    const rots = getRotationArray(pll[0]);
    for (const rot of rots) {
      keys.push(`${pll}/${rot}`);
    }
  }
  return keys;
};

const keyToCase = (
  key: string, dTurn: string, colorShift: number, crossColor: string
): PllCaseInstance => {
  const [name, rot] = key.split('/');
  return { name, rotation: rot, dTurn, colorShift, crossColor };
};

export const caseToKey = (pllCase: PllCaseInstance): string =>
  `${pllCase.name}/${pllCase.rotation}`;

export const keysToCases = (
  keys: string[], allowedCrossColors: string[], includeNoAuf = true
): PllCaseInstance[] => {
  const dTurns = includeNoAuf ? D_TURN_OPTIONS : D_TURN_OPTIONS.slice(1);
  return keys.map((k) =>
    keyToCase(k, randomElement(dTurns), randomElement(COLOR_SHIFTS), randomCrossColor(allowedCrossColors))
  );
};

export interface RecognitionResult {
  pllCase: PllCaseInstance;
  started: string;
  finished: string;
  mistake: string;
}

export const resultTimeMs = (r: RecognitionResult): number =>
  new Date(r.finished).getTime() - new Date(r.started).getTime();

const isBetter = (r1: RecognitionResult, r2: RecognitionResult): boolean => {
  if (!r1.mistake && r2.mistake) return true;
  if (r1.mistake && !r2.mistake) return false;
  return resultTimeMs(r1) < resultTimeMs(r2);
};

export const resultsToEvalResults = (results: RecognitionResult[]): RecognitionResult[] => {
  const keyToWorst: Record<string, RecognitionResult> = {};
  for (const r of results) {
    const key = `${r.pllCase.name}/${r.pllCase.rotation}`;
    if (!keyToWorst[key] || isBetter(keyToWorst[key], r)) {
      keyToWorst[key] = r;
    }
  }
  return Object.values(keyToWorst).sort((a, b) => (isBetter(b, a) ? -1 : 1));
};

export const evalResultsToNewQueue = (
  resultsSorted: RecognitionResult[],
  allowedCrossColors: string[],
  pllMap: Record<string, unknown>
): PllCaseInstance[] => {
  const queue: PllCaseInstance[] = [];

  const addCases = (key: string, numResults: number) => {
    const dTurns = shuffle(
      numResults === 4 ? [...D_TURN_OPTIONS] : [...D_TURN_OPTIONS.slice(1)]
    ).slice(0, numResults);
    const colorShifts = shuffle([...COLOR_SHIFTS]).slice(0, numResults);
    for (let i = 0; i < numResults; i++) {
      queue.push(keyToCase(key, dTurns[i], colorShifts[i], randomCrossColor(allowedCrossColors)));
    }
  };

  const resultKey = (r: RecognitionResult) => `${r.pllCase.name}/${r.pllCase.rotation}`;

  const remainingKeysSet = new Set(allPllKeys(pllMap));
  resultsSorted.forEach((r) => remainingKeysSet.delete(resultKey(r)));

  const top15 = Math.ceil(resultsSorted.length * 0.15);
  const top30 = Math.ceil(resultsSorted.length * 0.3);
  const top50 = Math.ceil(resultsSorted.length * 0.5);
  const top100 = Math.ceil(resultsSorted.length * 1.0);

  resultsSorted.slice(0, top15).forEach((r) => addCases(resultKey(r), 4));
  resultsSorted.slice(top15, top30).forEach((r) => addCases(resultKey(r), 3));
  resultsSorted.slice(top30, top50).forEach((r) => addCases(resultKey(r), 2));
  resultsSorted.slice(top50, top100).forEach((r) => addCases(resultKey(r), 1));
  [...remainingKeysSet].forEach((k) => addCases(k, 1));

  return shuffle(queue);
};
