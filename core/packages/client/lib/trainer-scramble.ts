// Ported from packages/client-vite/src/utils/trainerScramble.ts
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';

const AUF = ['', 'U', 'U2', "U'"];
const Y = ['', 'y', 'y2', "y'"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function inverseAlg(alg: string): string {
  return alg
    .split(/\s+/)
    .filter(Boolean)
    .map(m => {
      if (m.endsWith('2')) return m;
      if (m.endsWith("'")) return m.slice(0, -1);
      return m + "'";
    })
    .reverse()
    .join(' ');
}

export function generateScramble(c: AlgCase, puzzle: AlgPuzzle): string {
  const baseAlg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  const base = c.setup && c.setup.trim()
    ? c.setup.trim()
    : inverseAlg(baseAlg);
  if (!base) return '';

  if (puzzle === '3x3') {
    if (c.sticker.kind === 'f2l') {
      const yPre = pick(Y);
      return [yPre, base].filter(Boolean).join(' ');
    }
    const post = pick(AUF);
    return [base, post].filter(Boolean).join(' ').trim();
  }

  if (puzzle === '2x2') {
    const post = pick(AUF);
    return [base, post].filter(Boolean).join(' ').trim();
  }

  return base;
}
