/**
 * Per-language alphabets for the letter-pair grid. Populated by
 * scripts/extract_lang_alphabets.mjs from upstream bestsiteever.net/colpi.
 *
 * Word data lives in PostgreSQL on api.cuberoot.me — fetched via colpi_api.ts.
 */
import alphabetsRaw from './alphabets.json';

const ALPHABETS = alphabetsRaw as Record<string, string[]>;

/** Default = English Latin set (used when language has no entry). */
export const DEFAULT_ALPHABET = ALPHABETS.en ?? [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
];

export function getAlphabet(lang: string): string[] {
  return ALPHABETS[lang] ?? DEFAULT_ALPHABET;
}

/** Backwards compat — code that historically imported `ALPHABET` (English) gets the English set. */
export const ALPHABET = DEFAULT_ALPHABET;

/** First valid pair for a given language (= first char doubled, e.g. 'AA' / 'ああ'). */
export function defaultPairFor(lang: string): string {
  const a = getAlphabet(lang);
  return a[0] + a[0];
}
