/**
 * Square-1 single-layer shape naming drill. The CS set remains the source of
 * truth: every distinct top-layer name becomes one question, using that case's
 * existing thumbnail data instead of maintaining a second shape table.
 */
import { loadAlg, type AlgCase } from '@cuberoot/shared';
import { displaySq1CsName, SQ1_SHAPE_NAMES } from './alg_case_display';
import type { KeyStep, RecognizeButton, RecognizeImage, RecognizeSet } from './recognize-sets';

export const SQ1_SHAPE_RECOGNIZE_ID = 'sq1-shape' as const;
export type Sq1ShapeRecognizeId = typeof SQ1_SHAPE_RECOGNIZE_ID;

interface Sq1ShapeQuestion {
  name: string;
  source: AlgCase;
}

/** `Kite / Square` -> `Kite`; malformed and blank names are not questions. */
export function sq1TopLayerQuestions(cases: AlgCase[]): Sq1ShapeQuestion[] {
  const byName = new Map<string, AlgCase>();
  for (const c of cases) {
    const separator = c.name.indexOf(' / ');
    if (separator < 1) continue;
    const name = displaySq1CsName(c.name.slice(0, separator).trim());
    if (name && !byName.has(name)) byName.set(name, c);
  }
  return [...byName]
    .map(([name, source]) => ({ name, source }))
    .sort((a, b) => {
      const aIndex = SQ1_SHAPE_NAMES.indexOf(a.name as (typeof SQ1_SHAPE_NAMES)[number]);
      const bIndex = SQ1_SHAPE_NAMES.indexOf(b.name as (typeof SQ1_SHAPE_NAMES)[number]);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex)
        - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
}

const firstAlg = (c: AlgCase | undefined): string =>
  c?.algs.flat()[0]?.alg ?? c?.standard ?? '';

let questions: Sq1ShapeQuestion[] = [];
let byName = new Map<string, Sq1ShapeQuestion>();
let buttons: RecognizeButton[] = [];
let inFlight: Promise<void> | null = null;

function seededOrder(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A stable, compact answer set with the correct shape included. */
export function sq1ShapeAnswerChoices(
  allButtons: readonly RecognizeButton[],
  currentName: string,
  count = 6,
): RecognizeButton[] {
  const correct = allButtons.find((button) => button.value === currentName);
  if (!correct || allButtons.length <= count) return [...allButtons];

  const candidates = allButtons
    .filter((button) => button.value !== currentName)
    .map((button) => ({ button, order: seededOrder(`${currentName}\u0000${button.value}`) }))
    .sort((a, b) => a.order - b.order || a.button.value.localeCompare(b.button.value))
    .slice(0, Math.max(0, count - 1))
    .map(({ button }) => button);

  return [correct, ...candidates]
    .map((button) => ({ button, order: seededOrder(`${currentName}\u0001${button.value}`) }))
    .sort((a, b) => a.order - b.order || a.button.value.localeCompare(b.button.value))
    .map(({ button }) => button);
}

export function ensureSq1ShapeQuestions(): Promise<void> {
  if (questions.length > 0) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = loadAlg('sq1', 'cs')
    .then((file) => {
      questions = sq1TopLayerQuestions(file.cases);
      byName = new Map(questions.map((question) => [question.name, question]));
      buttons = questions.map(({ name }) => ({ value: name, label: name }));
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

const ignorePhysicalKey = (): KeyStep => ({ kind: 'ignore' });

export const SQ1_SHAPE_SET: RecognizeSet = {
  id: SQ1_SHAPE_RECOGNIZE_ID,
  storageKey: 'cuberoot-session-store-sq1-shape',
  load: ensureSq1ShapeQuestions,
  allKeys: () => questions.map(({ name }) => `${name}/`),
  turnOptions: [''],
  includeNoAuf: true,
  image: (current): RecognizeImage => {
    const source = byName.get(current.name)?.source;
    return {
      renderer: 'sq1-top-layer',
      setup: source?.setup ?? '',
      view: 'iso',
      size: 220,
      sticker: source?.sticker,
      alg: firstAlg(source),
    };
  },
  label: (name) => name.trim(),
  solution: () => '',
  buttons: (current) => current ? sq1ShapeAnswerChoices(buttons, current.name) : buttons,
  prompt: { zh: '这是什么形状？', en: 'Which shape is this?' },
  step: ignorePhysicalKey,
};
