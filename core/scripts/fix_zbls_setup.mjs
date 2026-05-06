/**
 * One-shot fix: rewrite ZBLS `setup` fields where the previous AI inverted at
 * token level, leaving `(...)' ` blocks. Real inverse should flatten parens
 * first, then reverse + invert each move.
 *
 * Only entries whose current `setup` contains `)'` are touched; the rest are
 * left as hand-written. Run with: node core/scripts/fix_zbls_setup.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'packages', 'shared', 'data', 'alg_3x3_zbls.json');

function inverseAlg(alg) {
  // Strip parens AND gesture annotations (↓ / ↑) the docx source uses to mark
  // regrip / view-flip — they're documentation, not part of the move sequence.
  return alg
    .replace(/[()↓↑]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((t) => {
      if (t.endsWith("'")) return t.slice(0, -1);
      if (t.endsWith('2')) return t;
      return t + "'";
    })
    .join(' ');
}

const raw = fs.readFileSync(FILE, 'utf-8');
const trailingNewline = raw.endsWith('\n');
const data = JSON.parse(raw);

let fixed = 0;
for (const c of data.cases) {
  if (!c.setup || !c.standard) continue;
  if (!/\)\s*'/.test(c.setup)) continue;
  c.setup = inverseAlg(c.standard);
  fixed++;
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + (trailingNewline ? '\n' : ''), 'utf-8');
console.log(`Fixed ${fixed} / ${data.cases.length} cases.`);
