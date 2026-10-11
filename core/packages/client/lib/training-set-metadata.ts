import type { AlgPuzzle } from '@cuberoot/shared/alg';

/** Route identities only: importing a directory must not load a question bank or solver. */
export const RECOGNITION_TRAINING_SETS = {
  pll: { zh: 'PLL 识别', en: 'PLL recognition' },
  oll: { zh: 'OLL 识别', en: 'OLL recognition' },
  coll: { zh: 'COLL 识别', en: 'COLL recognition' },
  ell: { zh: 'ELL 识别', en: 'ELL recognition' },
  zbll: { zh: 'ZBLL 识别', en: 'ZBLL recognition' },
  '1lll': { zh: '1LLL 识别', en: '1LLL recognition' },
  'sq1-shape': { zh: 'SQ1 形状命名', en: 'SQ1 shape naming' },
} as const;

export type RecognizeSetId = keyof typeof RECOGNITION_TRAINING_SETS;

export const LSLL_ALG_SET_METADATA = {
  puzzle: '3x3',
  slug: 'lsll',
  meta: { zh: 'LSLL', en: 'LSLL' },
} as const;

export const VIRTUAL_ALG_SET_METADATA = [LSLL_ALG_SET_METADATA] as const satisfies readonly {
  puzzle: AlgPuzzle;
  slug: string;
  meta: { zh: string; en: string };
}[];

export const VIRTUAL_ALG_SET_PARAMS: ReadonlyArray<{ puzzle: string; set: string }> =
  VIRTUAL_ALG_SET_METADATA.map(({ puzzle, slug }) => ({ puzzle, set: slug }));

/** Virtual scopes own separate persisted sessions; normal sets share their set session. */
export function virtualTrainingSessionId(puzzle: string, set: string, scope: string | null, drill: boolean): string {
  if (!VIRTUAL_ALG_SET_METADATA.some(meta => meta.puzzle === puzzle && meta.slug === set)) return set;
  return drill ? `${set}:drill` : scope ? `${set}:${scope}` : set;
}
