/** ClockDB simultaneous-wheel notation, in left-hand/right-hand order.
 * Definition/reference: https://clockdb.net/r/171 and ClockDB's notation exporter.
 * Lowercase corners mean that pin is DOWN; / and \ select diagonal pin pairs.
 * Both amounts are viewed from the current front, including the down-pin wheel.
 */
const PIN_MASK: Record<string, number> = {
  UL: 1, UR: 2, DL: 4, DR: 8, U: 3, R: 10, D: 12, L: 5, ALL: 15,
  ul: 14, ur: 13, dl: 11, dr: 7, all: 0, '/': 6, '\\': 9,
};
// cubing.js names the wide family by the corner at the meeting of its two edges.
const MASK_MOVE: Record<number, string> = {
  1: 'UL', 2: 'UR', 4: 'DL', 8: 'DR', 3: 'U', 10: 'R', 12: 'D', 5: 'L',
  15: 'ALL', 7: 'ULw', 11: 'URw', 13: 'DLw', 14: 'DRw', 9: 'MUL', 6: 'MUR',
};
const LEFT_DOWN = new Set(['UR', 'DR', 'R', 'dl', 'ul', '/', 'D']);
const AMOUNT = '(?:\\d+[+-]|[+-]?\\d+)';
const TOKEN = new RegExp(`^(?:([xy]2'?|z(?:2)?'?)|([a-zA-Z]+|[/\\\\])(?:\\(\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*\\)|(${AMOUNT}))?)`);

function amount(text: string): number {
  if (/\d[+-]$/.test(text)) return Number(text.slice(0, -1)) * (text.endsWith('-') ? -1 : 1);
  return Number(text);
}
function wheel(mask: number, turns: number): string {
  turns %= 12;
  if (!turns) return '';
  if (!MASK_MOVE[mask]) throw new Error('No wheel with these pins');
  return `${MASK_MOVE[mask]}${Math.abs(turns)}${turns < 0 ? '-' : '+'}`;
}
function backMask(mask: number): number {
  return ((mask & 1) << 1) | ((mask & 2) >> 1) | ((mask & 4) << 1) | ((mask & 8) >> 1);
}

/** Returns the original invalid text to let the player's normal error UI handle it. */
export function parseClockAlgorithm(text: string): { alg: string; invalid: boolean } {
  const clean = text.replace(/\/\/[^\n]*/g, ' ');
  let rest = clean.trim();
  const out: string[] = [];
  try {
    while (rest) {
      const m = TOKEN.exec(rest);
      if (!m) throw new Error('Unknown clock notation');
      rest = rest.slice(m[0].length).trimStart();
      if (m[1]) { out.push(m[1]); continue; }
      const name = m[2], mask = PIN_MASK[name];
      if (mask === undefined) throw new Error('Unknown clock pins');
      if (m[3] !== undefined) {
        const left = amount(m[3]), right = amount(m[4]);
        const up = LEFT_DOWN.has(name) ? right : left;
        const down = LEFT_DOWN.has(name) ? left : right;
        out.push(wheel(mask, up));
        const back = wheel(backMask(15 ^ mask), -down);
        if (back) out.push(`y2 ${back} y2`);
      } else if (m[5] !== undefined) out.push(wheel(mask, amount(m[5])));
      else if (/^(UL|UR|DL|DR)$/.test(name)) out.push(name);
      else throw new Error('Missing clock amount');
    }
    return { alg: out.filter(Boolean).join(' '), invalid: false };
  } catch { return { alg: clean, invalid: true }; }
}
