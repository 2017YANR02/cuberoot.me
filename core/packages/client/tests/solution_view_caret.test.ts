// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SolutionView from '@/components/SolutionView';
import { reconInspectionOrientations } from '@/lib/recon-alg-utils';

vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: vi.fn(async () => ({ cases: [] })),
}));
vi.mock('@/lib/recon-f2l-links', () => ({
  reconF2lAnnotations: vi.fn(async () => ({ links: new Map([
    [0, new Map([['RG', '/alg/3x3/f2l/a+']])],
    [1, new Map([['F2L', '/alg/3x3/f2l/b+']])],
  ]), diagrams: new Map() })),
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

  it.each(['OLL', 'PLL', 'COLL', 'ZBLL', 'EPLL', 'ZBLS'])('shows an actual-state plan for %s without requiring a case number', async label => {
    await act(async () => {
      root.render(createElement(SolutionView, {
        text: `R U // ${label}`, event: '3x3', scramble: "R U2 R'",
        playerRef: { current: null },
      }));
    });
    const diagram = host.querySelector('.recon-case-diagram');
    expect(diagram?.getAttribute('data-recon-text-length')).toBe('0');
    expect(diagram?.querySelector('svg')).not.toBeNull();
    expect(diagram?.querySelector('button')).not.toBeNull();
    expect(host.querySelector('.recon-comment-link')?.getAttribute('href')).toBe(`/alg/3x3/${label === 'EPLL' ? 'pll' : label.toLowerCase()}`);
    const before = diagram?.querySelector('svg')?.outerHTML;
    await act(async () => diagram?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    // Top-layer views rotate the same flat drawing, never rebuild it as an isometric cube.
    expect(diagram?.querySelector('svg')?.outerHTML).toBe(before);
    const rotated = diagram?.querySelector('button > span') as HTMLSpanElement;
    expect(rotated.style.transform).toMatch(/^rotate\([\d.]+deg\)$/);
    await act(async () => diagram?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(rotated.style.transform).toBe('rotate(0deg)');
    expect(host.querySelector('.detail-cursor')).toBeNull();
    await act(async () => diagram?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(diagram?.querySelector('svg')?.outerHTML).toBe(before);
    expect(rotated.style.transform).toBe('');
  });

  it('shows inspection U/F colors without changing source text or caret offsets', async () => {
    const text = "x' z' // insp\nU R' // F2L2";
    expect(reconInspectionOrientations(text)).toEqual([{ line: 0, offset: 13, colors: 'RW' }]);
    expect(reconInspectionOrientations("// insp")).toEqual([{ line: 0, offset: 7, colors: 'WG' }]);
    expect(reconInspectionOrientations("R U\nx // insp")).toEqual([]);
    await act(async () => {
      root.render(createElement(SolutionView, { text, playerRef: { current: null } }));
    });
    const chip = host.querySelector('.recon-inspection-chip');
    expect(chip?.getAttribute('data-recon-text-length')).toBe('0');
    expect(chip?.querySelector('.cube-orientation-chip')?.getAttribute('aria-label')).toBe('Red White');
    expect(host.querySelector('pre')?.textContent).toBe(text);
  });

  it('links F2L chips without letting link clicks or arrow keys scrub the player', async () => {
    const jumpToMoveCount = vi.fn();
    await act(async () => {
      root.render(createElement(SolutionView, {
        text: "R U // RG\nR U' // F2L",
        event: '3x3',
        scramble: "R U R' U'",
        playerRef: { current: { __kind: 'nxn-cuber', jumpToMoveCount } },
      }));
    });
    const links = host.querySelectorAll('a.recon-comment-link');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/alg/3x3/f2l/a+');
    expect(links[1].getAttribute('href')).toBe('/alg/3x3/f2l/b+');
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
