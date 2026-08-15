/**
 * Square-1 single-layer shape naming drill. The CS set remains the source of
 * truth: every distinct top-layer name becomes one question, using that case's
 * existing thumbnail data instead of maintaining a second shape table.
 */
import { loadAlg, type AlgCase } from '@cuberoot/shared';
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
    const name = c.name.slice(0, separator).trim();
    if (name && !byName.has(name)) byName.set(name, c);
  }
  return [...byName].map(([name, source]) => ({ name, source }));
}

const firstAlg = (c: AlgCase | undefined): string =>
  c?.algs.flat()[0]?.alg ?? c?.standard ?? '';

let questions: Sq1ShapeQuestion[] = [];
let byName = new Map<string, Sq1ShapeQuestion>();
let buttons: RecognizeButton[] = [];
let inFlight: Promise<void> | null = null;

export function ensureSq1ShapeQuestions(): Promise<void> {
  if (questions.length > 0) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = loadAlg('sq1', 'cs')
    .then((file) => {
      questions = sq1TopLayerQuestions(file.cases);
      byName = new Map(questions.map((question) => [question.name, question]));
      buttons = questions.map(({ name }) => ({ value: name, label: name }));
    })
    .catch(() => { /* Keep an unavailable CS set as an empty quiz. */ })
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
  buttons: () => buttons,
  prompt: { zh: '这是什么形状？', en: 'Which shape is this?' },
  step: ignorePhysicalKey,
};
