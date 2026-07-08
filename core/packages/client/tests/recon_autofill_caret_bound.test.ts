import { describe, it, expect } from 'vitest';
import { detectStage } from '@/lib/stage_detect';
import { resolveCommentPopupState } from '@/lib/recon_autofill_core';
import { buildCommentSuggestions } from '@/lib/popup_suggest';

// Real repro from GH issue #17 (https://github.com/2017YANR02/cuberoot.me/issues/17):
// caret placed mid-line, right after "U R' U R" and before the line's remaining
// "U' R' U R" — at that point only the cross is solved (no F2L pair complete),
// but the popup used to evaluate the FULL line regardless of caret position and
// suggest a bogus "// RG" / "// F2L1" pair (the pair that only completes once
// the rest of the line runs).
const SCRAMBLE = "U' L' B2 U' R' D2 L' R F' R2 D2 U' L' D B D2 R2 D";
const VALUE = "x' z' // insp\nr R2' D' R2 // Y cross\nU R' U R U' R' U R";

describe('recon autofill comment popup is bounded by the caret, not the line end (issue #17)', () => {
  it('caret mid-line (right after "U R\' U R") sees only the cross — no bogus F2L pair', async () => {
    const caret = VALUE.indexOf("U R' U R") + "U R' U R".length;
    const state = await resolveCommentPopupState(SCRAMBLE, VALUE, caret);
    expect(state.moveCount).toBe(4);

    const currInfo = await detectStage(state.currPattern);
    expect(currInfo.stage).toBe('cross');
    expect(currInfo.solvedSlots).toEqual([]);

    const suggestions = await buildCommentSuggestions({
      prevPattern: state.prevPattern,
      currPattern: state.currPattern,
      lineMovesText: state.lineMovesText,
      prevMovesText: state.prevMovesText,
      moveCount: state.moveCount,
      explicit: true,
    });
    expect(suggestions).toEqual([]);
  });

  it('caret at the true end of the line still sees the completed pair (fix does not regress the normal case)', async () => {
    const caret = VALUE.length;
    const state = await resolveCommentPopupState(SCRAMBLE, VALUE, caret);
    expect(state.moveCount).toBe(8);

    const currInfo = await detectStage(state.currPattern);
    expect(currInfo.stage).toBe('xcross');
    expect(currInfo.solvedSlots).toEqual(['FR']);

    const suggestions = await buildCommentSuggestions({
      prevPattern: state.prevPattern,
      currPattern: state.currPattern,
      lineMovesText: state.lineMovesText,
      prevMovesText: state.prevMovesText,
      moveCount: state.moveCount,
      explicit: true,
    });
    expect(suggestions).toEqual(['// RG', '// RG (8)', '// F2L1', '// F2L1 (8)']);
  });
});
