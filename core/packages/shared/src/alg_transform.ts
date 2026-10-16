import { Alg } from 'cubing/alg';
import { tokenizeMoves } from './alg_notation';

/** Split compact cube moves while retaining groups, comments and other puzzle families. */
export function parseCubeAlg(alg: string): Alg {
  const spaced = alg.replace(/\/\/[^\n]*|[A-Za-z0-9'-]+/g, run => {
    if (run.startsWith('//')) return run;
    const { moves, junk } = tokenizeMoves(run);
    return !junk.length && moves.length > 1 ? moves.map(move => move.raw).join(' ') : run;
  });
  return new Alg(spaced);
}

/** Invert a cubing.js algorithm, returning an empty string for empty or invalid input. */
export function invertAlg(alg: string): string {
  if (!alg) return '';
  try {
    // cubing.js accepts FS as one family; split compact cube moves before parsing.
    // Keep punctuation/group exponents and non-cube families for its own parser.
    return parseCubeAlg(alg).invert().toString();
  } catch {
    return '';
  }
}
