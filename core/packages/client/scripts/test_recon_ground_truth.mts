// Ground-truth parity test for recon autofill comment suggestions.
//
// For every (scramble, solution, tabPoint) in RECON_GROUND_TRUTH, simulate
// what the autofill popup would emit when the user presses Tab at the end of
// `tabPoint.afterText`. Compare to `tabPoint.expected[]` and report diffs.
//
// Run: `npx tsx scripts/test_recon_ground_truth.mts`

import { RECON_GROUND_TRUTH } from '../src/pages/recon/components/__fixtures__/cubedb_ground_truth';
import { patternFromAlg, countMoves } from '../src/utils/cube3';
import { buildCommentSuggestions } from '../src/utils/popup_suggest';

// Mirror of ReconAutofill.tsx's helpers. Kept inline so the test exercises the
// same pure-data path without dragging in React.
function lineRange(text: string, idx: number): { start: number; end: number } {
  let s = idx;
  while (s > 0 && text[s - 1] !== '\n') s--;
  let e = idx;
  while (e < text.length && text[e] !== '\n') e++;
  return { start: s, end: e };
}
function movesOnly(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return i >= 0 ? line.substring(0, i) : line;
    })
    .join(' ')
    .replace(/[()]/g, ' ')
    .replace(/[↑↓·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
interface Result {
  fixtureId: string;
  tabIdx: number;
  afterText: string;
  expected: string[];
  actual: string[];
  passed: boolean;
}

async function evaluateTabPoint(
  scramble: string,
  value: string,
  caret: number,
): Promise<string[]> {
  const { start, end } = lineRange(value, caret);
  const fullLine = value.substring(start, end);
  const linesBefore = value.substring(0, start);
  const linesUpToHere = value.substring(0, end);
  const prevMoves = movesOnly(linesBefore);
  const currMoves = movesOnly(linesUpToHere);
  const thisLineMovesText = movesOnly(fullLine);
  const moveCount = countMoves(thisLineMovesText);
  const prevAlg = [scramble, prevMoves].filter(Boolean).join(' ');
  const currAlg = [scramble, currMoves].filter(Boolean).join(' ');
  const prevPattern = await patternFromAlg(prevAlg);
  const currPattern = await patternFromAlg(currAlg);
  return buildCommentSuggestions({
    prevPattern, currPattern, lineMovesText: thisLineMovesText, moveCount,
  });
}

const results: Result[] = [];

for (const fixture of RECON_GROUND_TRUTH) {
  for (let i = 0; i < fixture.tabPoints.length; i++) {
    const tp = fixture.tabPoints[i];
    const value = tp.afterText;
    const caret = value.length;
    const actual = await evaluateTabPoint(fixture.scramble, value, caret);
    const passed = JSON.stringify(actual) === JSON.stringify(tp.expected);
    results.push({
      fixtureId: fixture.id, tabIdx: i, afterText: tp.afterText,
      expected: tp.expected, actual, passed,
    });
  }
}

const pass = results.filter(r => r.passed).length;
const fail = results.length - pass;

console.log(`\n=== ${pass} / ${results.length} pass ===\n`);

if (fail > 0) {
  console.log('Failures:\n');
  for (const r of results.filter(r => !r.passed)) {
    const lastLine = r.afterText.split('\n').pop();
    console.log(`✗ ${r.fixtureId} tab #${r.tabIdx} (last line: "${lastLine}")`);
    console.log(`  expected: ${JSON.stringify(r.expected)}`);
    console.log(`  actual:   ${JSON.stringify(r.actual)}`);
    console.log();
  }
  process.exit(1);
} else {
  console.log('All ground-truth tabPoints match.');
}
