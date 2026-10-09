// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { getTextOffsetInElement, snapCaretToLine } from '@cuberoot/timer-ui/recon/text-cursor';
import { findTokenPositions, syncReconPlayerCursorFromText } from '@/lib/recon-alg-utils';

it('M2 is one cursor step, with no boundary between M and 2', () => {
  const text = 'R M2 U';
  const positions = findTokenPositions(text);
  expect(positions.map(position => position.text)).toEqual(['R', 'M2', 'U']);
  expect(snapCaretToLine(3, text, positions)).toBe(2);
  expect(snapCaretToLine(3.8, text, positions)).toBe(4);
  const jumpToMoveCount = vi.fn();
  const player = { __kind: 'nxn-cuber', jumpToMoveCount };
  syncReconPlayerCursorFromText(player, 'R M2', true);
  expect(jumpToMoveCount).toHaveBeenLastCalledWith(2, true);
  syncReconPlayerCursorFromText(player, 'R M2');
  expect(jumpToMoveCount).toHaveBeenLastCalledWith(2, false);
});

it('keeps the first move of the clicked line instead of selecting the previous line', () => {
  const text = "R U // cross\nM2 U2";
  const offset = text.indexOf('M2');
  expect(snapCaretToLine(offset, text, findTokenPositions(text))).toBe(offset);
});

it('counts source characters across highlighted text and color chips', () => {
  const el = document.createElement('pre');
  el.innerHTML = 'R // <span data-recon-text-length="1">white</span>\n<span>M2</span> U';
  document.body.append(el);
  try {
    const selection = document.getSelection()!;
    const range = document.createRange();
    range.setStart(el.children[1].firstChild!, 2);
    range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    expect(getTextOffsetInElement(el)).toBe('R // W\nM2'.length);
  } finally { el.remove(); document.getSelection()?.removeAllRanges(); }
});
