export type KilominxNotation = 'cstimer' | 'cubing';

// The two systems name four lower faces differently; turn amounts are identical.
const CSTIMER_TO_CUBING = new Map([
  ['DR', 'FR'],
  ['DL', 'FL'],
  ['DBL', 'DL'],
  ['DBR', 'DR'],
]);
const CUBING_TO_CSTIMER = new Map(
  [...CSTIMER_TO_CUBING].map(([from, to]) => [to, from]),
);

/** Rename outer faces without formatting, expanding or validating the source alg. */
export function convertKilominxAlg(
  text: string,
  from: KilominxNotation,
  to: KilominxNotation,
): string {
  if (from === to) return text;
  const families = from === 'cstimer' ? CSTIMER_TO_CUBING : CUBING_TO_CSTIMER;

  // Match shared alg-notation's // boundary, retaining comments instead of stripping
  // them. Keep unsupported block comments opaque too; the caller owns validation.
  return text.split(/(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))/).map((part, index) => {
    if (index % 2) return part;
    // Group/commutator delimiters bound moves; a multi-letter family is one token.
    // Whole-token matching leaves layer prefixes, w/v suffixes and ++/-- intact.
    return part.replace(/[^\s()[\],:]+/g, token => {
      const move = /^([A-Za-z]+)(\d*'?)$/.exec(token);
      if (!move) return token;
      return (families.get(move[1]) ?? move[1]) + move[2];
    });
  }).join('');
}

export function toCubingKilominx(text: string, notation: KilominxNotation = 'cstimer'): string {
  return convertKilominxAlg(text, notation, 'cubing');
}

export function fromCubingKilominx(text: string, notation: KilominxNotation = 'cstimer'): string {
  return convertKilominxAlg(text, 'cubing', notation);
}
