// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import type { AlgPuzzle } from '@cuberoot/shared/alg';

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/CubeKeyboardSection', () => ({ default: () => null }));
vi.mock('@/components/AlgMirrorPanel', () => ({ default: () => null, hasMirror: () => false }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}), handleApi: async (r: Response) => r.json() }));

import AlgEditor from '@/components/AlgEditor';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';

const A_PLUS = "U2 x'·(L' U L' D2') (L U' L' D2') L2 x";

describe('algorithm editor caret follows the actual playback moves', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onCursorMoveCount = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
    onCursorMoveCount.mockClear();
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  const render = async (alg: string, puzzle: AlgPuzzle = '3x3') => {
    await act(async () => root.render(createElement(AlgEditor, {
      initialValue: [[{ alg }]], puzzle, onCursorMoveCount,
    })));
    const input = host.querySelector<HTMLDivElement>('[contenteditable]')!;
    await act(async () => input.focus());
    return input;
  };
  const moveCaret = async (input: HTMLDivElement, offset: number, keyboard = false) => {
    const range = document.createRange();
    range.setStart(input.firstChild!, offset); range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    await act(async () => input.dispatchEvent(keyboard
      ? new KeyboardEvent('keyup', { key: 'End', bubbles: true })
      : new MouseEvent('click', { bubbles: true })));
    return onCursorMoveCount.mock.lastCall?.[0] as number;
  };

  it('executes the final x in A+ and restores the top-face orientation', async () => {
    const input = await render(A_PLUS);
    const beforeRotation = await moveCaret(input, A_PLUS.lastIndexOf('x'));
    expect(beforeRotation).toBe(11);
    const afterRotation = await moveCaret(input, A_PLUS.length);
    expect(afterRotation).toBe(12);
    expect(onCursorMoveCount).toHaveBeenLastCalledWith(12, 0);

    const moves = resolveSimPreviewMoves('3x3', A_PLUS);
    const puzzle = await cube3x3x3.kpuzzle();
    const solved = puzzle.defaultPattern();
    const setup = solved.applyAlg(new Alg(moves.join(' ')).invert());
    const at = (step: number) => setup.applyAlg(moves.slice(0, step).join(' '));
    expect(at(beforeRotation).patternData.CENTERS.pieces).not.toEqual(solved.patternData.CENTERS.pieces);
    expect(at(afterRotation).patternData.CENTERS.pieces).toEqual(solved.patternData.CENTERS.pieces);
    expect(at(afterRotation).isIdentical(solved)).toBe(true);
  });

  it.each([
    ['3x3', 'R·U↑R\' x', 4],
    ['3x3', "M'R' U'D'", 4],
    ['3x3', "(R U R' U')2 x", 9],
    ['3x3', "x' (L' U", 3],
    ['sq1', '(1, 0) / (3, -3) /', 4],
  ] as const)('counts %s notation %s through the playback parser', async (puzzle, alg, expected) => {
    const input = await render(alg, puzzle);
    expect(await moveCaret(input, 0)).toBe(0);
    expect(await moveCaret(input, alg.length)).toBe(expected);
  });

  it('updates playback when the caret moves with keyboard navigation', async () => {
    const input = await render(A_PLUS);
    expect(await moveCaret(input, A_PLUS.length, true)).toBe(12);
    expect(await moveCaret(input, 0, true)).toBe(0);
  });
});
