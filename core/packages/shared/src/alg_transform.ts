import { Alg } from 'cubing/alg';

/** Invert a cubing.js algorithm, returning an empty string for empty or invalid input. */
export function invertAlg(alg: string): string {
  if (!alg) return '';
  try {
    return new Alg(alg).invert().toString();
  } catch {
    return '';
  }
}
