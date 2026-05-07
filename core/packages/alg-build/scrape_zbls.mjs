/**
 * Scrape D:/cube/CubeRoot/3x3/ZBLS.docx → JSON of ZBLS cases
 * with subgroup (A+/A-/B+/B-/.../T/S/F), name (EO/Line/...), setup, algs[+algHtml].
 *
 * Layout the docx uses (every section):
 *   row 0: section header colspan=4, e.g. "A+ A- [8,16]" or "F[2,2]"
 *   then repeating 3-row blocks of 4 cells each:
 *     label-row: col 1 = "EO,3,3,3" (named), col 2 = "" (unnamed mirror),
 *                col 3 = "Line,5,5,5" (named), col 4 = "" (unnamed mirror)
 *     setup-row: 4 cells, green text in docx (mammoth output: plain <p>)
 *     alg-row:   4 cells, primary alg in <strong>, alternatives in plain <p>
 *
 * Columns 1,3 → +; columns 2,4 → -.
 * For F/T/S (singular subgroups), no +/- split — all 4 cols same subgroup.
 * Chinese descriptive rows (like "横黄远槽, f流") between sections — ignored.
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { docxToTablesHtml } from './docx_tables.mjs';

// Custom docx parser preserves underline subtypes (single → <u>, wave → <u class="wavy">),
// which mammoth flattens. Bold / italic / strikethrough / sub / sup also pass through.
const html = docxToTablesHtml('D:/cube/CubeRoot/3x3/ZBLS.docx');
const $ = cheerio.load(html, null, false);

const SAFE_INLINE = new Set(['u','s','strike','del','em','i','strong','b','sub','sup']);
const TAG_NORMALIZE = { i: 'em', b: 'strong', strike: 's', del: 's' };

// Letters in F2L that are "singular" (no +/- distinction)
const SINGULAR_LETTERS = new Set(['F', 'T', 'S']);

/** Render a node to markup string, keeping only SAFE_INLINE tags. */
function nodeToMarkup(node) {
  if (!node) return '';
  if (node.type === 'text') return node.data ?? '';
  if (node.type !== 'tag') return '';
  const tag = (node.name || '').toLowerCase();
  const inner = (node.children || []).map(nodeToMarkup).join('');
  if (tag === 'br') return '\n';
  if (tag === 'p' || tag === 'div' || tag === 'li') return inner + '\n';
  if (SAFE_INLINE.has(tag)) {
    const norm = TAG_NORMALIZE[tag] ?? tag;
    if (inner.replace(/<[^>]+>/g, '').trim() === '') return inner;
    // Preserve `class="wavy"` on <u> for wavy-underline finger-trick notation.
    const cls = node.attribs?.class;
    if (norm === 'u' && cls === 'wavy') return `<u class="wavy">${inner}</u>`;
    return `<${norm}>${inner}</${norm}>`;
  }
  return inner;
}

function cellMarkup($cell) {
  return $cell.contents().toArray().map(nodeToMarkup).join('').trim();
}
function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }
function decodeEnts(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Detect an alg-text-ish line (no Chinese, has cube-letter+modifier pattern). */
function looksLikeAlg(s) {
  const txt = stripTags(decodeEnts(s)).trim();
  if (!txt) return false;
  if (/[一-鿿㐀-䶿＀-￯]/.test(txt)) return false;  // contains CJK → not alg
  if (!/[RUFLDBMESrufldbmes][2w']?/.test(txt)) return false;
  return true;
}

/** "EO,3,3,3" → "EO". "VM,4,4,4" → "VM". "IZ,7" → "IZ". */
function labelFromCell(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const m = /^([A-Za-z]+)(?:,|\s|$)/.exec(t);
  return m ? m[1] : t.slice(0, 12);
}

/** Section header detector: matches "A+A-[8,16]" / "F[2,2]" / "C [2,4]" etc.
 *  Returns { letter, leftCount, totalCount } or null. */
function parseSectionHeader(text) {
  const t = text.replace(/\s+/g, '').trim();
  // "A+A-[8,16]"  or  "C[2,4]"  or  "F[2,2]"
  const m = /^([A-Z]{1,2})(?:\+\1?-)?\[(\d+),(\d+)\]$/.exec(t);
  if (!m) return null;
  return { letter: m[1], leftCount: +m[2], totalCount: +m[3] };
}

/** Cell → list of {alg, algHtml?} entries. Splits on <br>/<p>/`=`/newline.
 *  primary marker `<strong>` is preserved as part of HTML for formatting,
 *  but each entry is a separate alg variant. */
function extractAlgsFromCell($cell) {
  const markup = cellMarkup($cell);
  if (!markup) return [];
  const lines = markup.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (let raw of lines) {
    // Strip leading "=" / "y' " continuation markers? Keep them — they're part of alt-alg notation.
    // Strip leading "•" / "*" if any
    let cleaned = raw.replace(/^[\s*•]+/, '').trim();
    if (!cleaned) continue;
    // The first <strong>...</strong> wrap: if the WHOLE line is wrapped, unwrap (it's the primary marker, not formatting).
    const wholeStrongMatch = /^<strong>([\s\S]*)<\/strong>$/.exec(cleaned);
    if (wholeStrongMatch) cleaned = wholeStrongMatch[1].trim();
    // Plain text version
    const plain = decodeEnts(stripTags(cleaned)).replace(/\s+/g, ' ').trim();
    if (!plain || !looksLikeAlg(plain)) continue;
    // If markup === plain (no inline tags survived), no algHtml needed
    const cleanedNorm = cleaned.replace(/\s+/g, ' ').trim();
    const entry = { alg: plain };
    if (cleanedNorm !== plain) entry.algHtml = cleanedNorm;
    out.push(entry);
  }
  return out;
}

/** Process one section (consecutive 3-row blocks after a header). */
function processSection(letter, hasPlusMinus, rows, $) {
  const cases = [];
  let i = 0;
  while (i < rows.length) {
    // Skip empty/separator rows
    const tds = $(rows[i]).find('td,th').toArray();
    const cellTexts = tds.map(c => $(c).text().trim());
    const isEmpty = cellTexts.every(t => !t);
    if (isEmpty || tds.length < 4) { i++; continue; }

    // Try (label, setup, alg) triplet starting here
    const labelCells = tds;
    const labelTexts = cellTexts;
    // Heuristic for label row: at least one cell has a short label (3-12 chars, alphanum + commas), no full alg
    const namedCols = labelTexts.filter(t => t && /^[A-Za-z]+(?:,|$)/.test(t)).length;
    if (namedCols === 0) { i++; continue; }

    // setup row = next non-empty row
    const setupRowIdx = i + 1;
    if (setupRowIdx >= rows.length) break;
    const setupTds = $(rows[setupRowIdx]).find('td,th').toArray();
    const setupTexts = setupTds.map(c => $(c).text().trim());

    // alg row = setupRowIdx + 1
    const algRowIdx = setupRowIdx + 1;
    if (algRowIdx >= rows.length) break;
    const algTds = $(rows[algRowIdx]).find('td,th').toArray();

    // Extract 4 cases (cols 0..3)
    for (let col = 0; col < 4; col++) {
      const labelText = labelTexts[col] || '';
      const setupText = setupTexts[col] || '';
      const algEntries = algTds[col] ? extractAlgsFromCell($(algTds[col])) : [];

      // Skip empty cells
      if (!setupText && algEntries.length === 0 && !labelText) continue;

      // Determine subgroup
      let subgroup;
      if (hasPlusMinus) {
        subgroup = (col === 0 || col === 2) ? `${letter}+` : `${letter}-`;
      } else {
        subgroup = letter;
      }

      // Determine name: use this col's label, or borrow from the named col in same pair (col 1 borrows from col 0, col 3 from col 2)
      let nameLabel = labelFromCell(labelText);
      if (!nameLabel) {
        const partnerCol = col % 2 === 0 ? col : col - 1;  // col 0,2 are named; col 1 borrows 0, col 3 borrows 2
        nameLabel = labelFromCell(labelTexts[partnerCol] || '');
      }
      if (!nameLabel) nameLabel = `case${cases.length + 1}`;

      cases.push({
        subgroup,
        name: nameLabel,
        col,
        setup: setupText,
        algs: algEntries,
      });
    }
    i = algRowIdx + 1;
  }
  return cases;
}

// ---- Main ----
const tables = $('table').toArray();
const allCases = [];

/** Solved Pair has a non-standard layout (no per-case label row).
 *  Header colspan=4 then: label-row (3 single-letter labels), setup, alg. */
function processSolvedPair(rows) {
  const labelTds = $(rows[0]).find('td,th').toArray().map(c => $(c).text().trim());
  const setupTds = $(rows[1]).find('td,th').toArray().map(c => $(c).text().trim());
  const algTds = $(rows[2]).find('td,th').toArray();
  for (let col = 0; col < labelTds.length; col++) {
    const algs = algTds[col] ? extractAlgsFromCell($(algTds[col])) : [];
    if (!setupTds[col] && algs.length === 0) continue;
    allCases.push({
      subgroup: 'Solved Pair',
      name: labelTds[col] || `case${col+1}`,
      col,
      setup: setupTds[col] || '',
      algs,
    });
  }
}

/** Walk one table's rows, splitting at every colspan=4 header that parseSectionHeader recognizes.
 *  Each section's body rows go through processSection (or processSolvedPair for Solved Pair). */
function processTable($t) {
  const rows = $t.find('tr').toArray();
  let curHeader = null;          // { letter, isSolvedPair, hasPlusMinus }
  let curStartIdx = -1;
  function flush(endIdx) {
    if (!curHeader || curStartIdx < 0) return;
    const sectionRows = rows.slice(curStartIdx, endIdx);
    if (curHeader.isSolvedPair) {
      processSolvedPair(sectionRows);
    } else {
      const cases = processSection(curHeader.letter, curHeader.hasPlusMinus, sectionRows, $);
      allCases.push(...cases);
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const tds = $(rows[i]).find('td,th').toArray();
    // Section header: single cell with any colspan >= 3 (Solved Pair uses cs=3, others cs=4)
    const cs = parseInt($(tds[0]).attr('colspan') || '0', 10);
    if (tds.length === 1 && cs >= 3) {
      const text = $(tds[0]).text().trim();
      // Solved Pair detector
      if (/^Solved\s*Pair/i.test(text)) {
        flush(i);
        curHeader = { letter: 'Solved Pair', isSolvedPair: true };
        curStartIdx = i + 1;
        continue;
      }
      const hdr = parseSectionHeader(text);
      if (hdr) {
        flush(i);
        curHeader = { letter: hdr.letter, isSolvedPair: false, hasPlusMinus: !SINGULAR_LETTERS.has(hdr.letter) };
        curStartIdx = i + 1;
      }
      // else: descriptive Chinese header → skip
    }
  }
  flush(rows.length);
}

for (const t of tables) processTable($(t));

// Output
console.log('Total cases:', allCases.length);
const bySubgroup = {};
for (const c of allCases) {
  bySubgroup[c.subgroup] = (bySubgroup[c.subgroup] || 0) + 1;
}
console.log('By subgroup:', bySubgroup);

writeFileSync('D:/cube/ruiminyan.github.io/core/packages/alg-build/zbls_scraped.json',
  JSON.stringify(allCases, null, 2), 'utf-8');
console.log('Wrote zbls_scraped.json');
