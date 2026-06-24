/**
 * Generic random-move scramble for cubing.js PuzzleGeometry puzzles (the
 * alpha.twizzle.net/explore set rendered in /sim via `experimentalPuzzleDescription`).
 * These have no WCA/tnoodle scrambler, so we pull the puzzle's OWN move set from its
 * live TwistyPlayer kpuzzle and emit a random, non-trivially-redundant sequence.
 *
 * NOT a competition scramble (no canonical-sequence / commuting-move reduction) — just
 * a good visual shuffle for the simulator. Whole-puzzle rotations (family ends in `v`)
 * are dropped so the scramble actually permutes pieces instead of spinning the view.
 */
const AMOUNTS = ['', '2', "'"] as const;

export async function pgRandomScramble(player: unknown, count = 25): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = player as any;
  const kpuzzle = await p?.experimentalModel?.kpuzzle?.get?.();
  const moves: string[] = Object.keys(kpuzzle?.definition?.moves ?? {});
  const families = moves.filter((m) => !/v$/.test(m)); // drop rotations
  if (!families.length) return '';

  const out: string[] = [];
  let prev = '';
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const fam = families[Math.floor(Math.random() * families.length)];
    if (fam === prev) continue; // avoid immediate same-family repeat
    out.push(fam + AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)]);
    prev = fam;
  }
  return out.join(' ');
}
