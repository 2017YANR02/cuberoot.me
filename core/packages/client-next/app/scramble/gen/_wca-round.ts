/**
 * WCA round / format constants for tnoodle-style scramble sheet generation.
 * Ported from packages/client/src/pages/gen/wca_round.ts (simplified — no FMC
 * locales, no MBLD-specific cube count override; those features are TODOs).
 */

export type WcaFormat = 'a' | 'm' | '5' | '3' | '2' | '1';

export const FORMAT_LABEL: Record<WcaFormat, string> = {
  a: 'Ao5', m: 'Mo3', '5': 'Bo5', '3': 'Bo3', '2': 'Bo2', '1': 'Bo1',
};

export function formatAttempts(f: WcaFormat): number {
  switch (f) {
    case 'a': return 5;
    case 'm': return 3;
    case '5': return 5;
    case '3': return 3;
    case '2': return 2;
    case '1': return 1;
  }
}

export const ALLOWED_FORMATS: Record<string, WcaFormat[]> = {
  '222':    ['a', '3', '2', '1'],
  '333':    ['a', '3', '2', '1'],
  '444':    ['a', '3', '2', '1'],
  '555':    ['a', '3', '2', '1'],
  '666':    ['m', '3', '2', '1'],
  '777':    ['m', '3', '2', '1'],
  '333bf':  ['5', '3', '2', '1'],
  '333fm':  ['m', '2', '1'],
  '333oh':  ['a', '3', '2', '1'],
  '333ft':  ['a', 'm', '3', '2', '1'],
  '333mbf': ['1', '2', '3'],
  '333mbo': ['1', '2', '3'],
  'clock':  ['a', '3', '2', '1'],
  'minx':   ['a', '3', '2', '1'],
  'pyram':  ['a', '3', '2', '1'],
  'skewb':  ['a', '3', '2', '1'],
  'sq1':    ['a', '3', '2', '1'],
  '444bf':  ['3', '2', '1'],
  '555bf':  ['3', '2', '1'],
};
const DEFAULT_FORMATS: WcaFormat[] = ['a', '3', '2', '1'];
export function allowedFormats(event: string): WcaFormat[] {
  return ALLOWED_FORMATS[event] ?? DEFAULT_FORMATS;
}

export const DEFAULT_EXTRA_COUNT = 2;
export const MBLD_DEFAULT_CUBES = 8;

export interface RoundConfig {
  format: WcaFormat;
  scrambleSets: number;
  copies: number;
}
export interface EventConfig {
  event: string;
  rounds: RoundConfig[];
  mbldCubes?: number;
  colors?: Record<string, string>;
}

export function defaultRoundConfig(_event: string): RoundConfig {
  return { format: allowedFormats(_event)[0], scrambleSets: 1, copies: 1 };
}
export function defaultEventConfig(event: string): EventConfig {
  const isMbld = event === '333mbf' || event === '333mbo';
  return {
    event,
    rounds: [defaultRoundConfig(event)],
    mbldCubes: isMbld ? MBLD_DEFAULT_CUBES : undefined,
  };
}

/** Map WCIF format string → our WcaFormat key. */
export function wcifFormatToWcaFormat(f: string): WcaFormat {
  if (f === 'a' || f === 'm' || f === '1' || f === '2' || f === '3' || f === '5') return f;
  return '1';
}
