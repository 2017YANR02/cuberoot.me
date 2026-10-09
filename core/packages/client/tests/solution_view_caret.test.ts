// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SolutionView from '@/components/SolutionView';

vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: vi.fn(async () => ({ cases: [] })),
}));

describe('SolutionView caret mapping', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    window.getSelection()?.removeAllRanges();
    await act(async () => root.unmount());
    host.remove();
  });

  it('links F2L chips without letting link clicks or arrow keys scrub the player', async () => {
    const jumpToMoveCount = vi.fn();
    await act(async () => {
      root.render(createElement(SolutionView, {
        text: "R U // RG\nR U' // F2L",
        event: '3x3',
        playerRef: { current: { __kind: 'nxn-cuber', jumpToMoveCount } },
      }));
    });
    const links = host.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/alg/3x3/f2l');
    expect(links[0].parentElement?.dataset.reconTextLength).toBe('2');
    host.addEventListener('click', e => e.preventDefault(), { capture: true, once: true });
    await act(async () => {
      links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(jumpToMoveCount).not.toHaveBeenCalled();
    expect(host.querySelector('.recon-move-current')).toBeNull();
  });

  it('does not send other puzzles to the 3x3 library', async () => {
    await act(async () => {
      root.render(createElement(SolutionView, {
        text: '(1,0) / // PLL', event: 'sq1', playerRef: { current: null },
      }));
    });
    expect(host.querySelector('a')).toBeNull();
  });

  it('keeps the final move aligned after color labels were replaced by chips', async () => {
    const text = [
      "D F L F' R D' R2 // W cross cancel into",
      "U' R' // RG",
      "U y2 R' U' R // OB",
      "y' U R' U2 R U R' U' R // OG",
      "y' R' U2 R U R' U' R // RG",
      "F U R U' R' F' // OELL",
      "U' R' U2 R U R' U R // OCLL",
      "U z U' R U' R' U' R' U' R U R U2' // EPLL-U-",
    ].join('\n');

    await act(async () => {
      root.render(createElement(SolutionView, {
        text,
        playerRef: { current: null },
      }));
    });

    const pre = host.querySelector('pre');
    expect(pre).not.toBeNull();
    const walker = document.createTreeWalker(pre!, NodeFilter.SHOW_TEXT);
    let finalLineNode: Text | null = null;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.includes("U2' // EPLL-U-")) {
        finalLineNode = walker.currentNode as Text;
        break;
      }
    }
    expect(finalLineNode).not.toBeNull();

    const moveEnd = finalLineNode!.data.indexOf("U2'") + "U2'".length;
    const range = document.createRange();
    range.setStart(finalLineNode!, moveEnd);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    await act(async () => {
      pre!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pre!.querySelector('.recon-move-current')?.textContent).toBe("U2'");
  });
});
