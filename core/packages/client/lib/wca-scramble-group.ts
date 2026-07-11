/**
 * WCA scramble-set `group_id` letters ↔ 0-based index, bijective base-26
 * (Excel-column style): A..Z → 0..25, AA..AZ → 26..51, BA..BZ → 52..77, ...
 * Matches how WCA's own `group_id` overflows past 26 groups in one round
 * (e.g. Asian Champs 2024 333 R1 has groups A..Z then AA..AF). Naively using
 * only the first letter's char code collided "A" and "AA" onto the same
 * index; this keeps them distinct and orders single letters before doubles.
 */
export function groupLetter(idx: number): string {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

export function groupIdxOf(g: string): number {
  const letters = g.toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return 0;
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}
