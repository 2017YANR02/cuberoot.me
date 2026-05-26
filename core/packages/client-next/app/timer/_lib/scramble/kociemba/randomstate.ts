/**
 * Uniform random sampling from the ~43 quintillion valid 3x3 cube states.
 *
 * Method:
 *   1. Sample CO ∈ [0, 3^7) uniformly. CO[7] derived to make total ≡ 0 mod 3.
 *   2. Sample EO ∈ [0, 2^11) uniformly. EO[11] derived to make total ≡ 0 mod 2.
 *   3. Sample CP ∈ Sym(8) uniformly (Fisher-Yates).
 *   4. Sample EP ∈ Sym(12) uniformly (Fisher-Yates).
 *   5. Compute parity(CP) and parity(EP); if not equal, fix by swapping two
 *      elements of EP. (The space of valid cubes requires equal parity.)
 *
 * This yields a uniform distribution over the (12!)(8!)(2^11)(3^7) / 12 valid
 * states (the /12 accounts for the 3 sub-constraints: CO sum, EO sum, parity).
 */

import { type CubieCube } from './cube';

function fisherYates(n: number, rng: () => number): number[] {
  const a = new Array<number>(n);
  for (let i = 0; i < n; i++) a[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function permParity(p: readonly number[]): number {
  // Cycle decomposition; parity = (n - num_cycles) mod 2.
  const n = p.length;
  const visited = new Array<boolean>(n).fill(false);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    cycles++;
    let j = i;
    while (!visited[j]) { visited[j] = true; j = p[j]; }
  }
  return (n - cycles) & 1;
}

export function randomCubie(rng: () => number = Math.random): CubieCube {
  // CP, EP
  const cp = fisherYates(8, rng);
  const ep = fisherYates(12, rng);

  // Match parity: if differ, swap ep[0] and ep[1]
  if (permParity(cp) !== permParity(ep)) {
    const t = ep[0]; ep[0] = ep[1]; ep[1] = t;
  }

  // CO (sum ≡ 0 mod 3)
  const co = new Array<number>(8);
  let coSum = 0;
  for (let i = 0; i < 7; i++) {
    co[i] = Math.floor(rng() * 3);
    coSum += co[i];
  }
  co[7] = (3 - (coSum % 3)) % 3;

  // EO (sum ≡ 0 mod 2)
  const eo = new Array<number>(12);
  let eoSum = 0;
  for (let i = 0; i < 11; i++) {
    eo[i] = Math.floor(rng() * 2);
    eoSum ^= eo[i];
  }
  eo[11] = eoSum;

  return { cp, co, ep, eo };
}
