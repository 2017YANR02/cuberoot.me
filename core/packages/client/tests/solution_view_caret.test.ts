// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SolutionView from '@/components/SolutionView';
import { reconInspectionOrientations, reconWasteBrackets, reconPlaybackSegments } from '@/lib/recon-alg-utils';
import { getTextOffsetInElement } from '@cuberoot/timer-ui/recon/text-cursor';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';

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
  it('segments playback by solve rows including cross-line waste and inspection offsets', () => {
    expect(reconPlaybackSegments("x' z' // insp\nr' F R2 r' U r D F2 // xxcross\n(U' U' U') R' U R // GO\nU' R (U R' // GR\nR U) R' U R U2' R' U // ZBLL-S+67")).toEqual([10, 16, 20, 28]);
    expect(reconPlaybackSegments("// note\n(R U)2\n\nR' // end")).toEqual([4, 5]);
  });
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

  it('adds waste brackets across lines without shifting source offsets or duplicating manual marks', async () => {
    const text = "U' U' U' F\nU R' // pair\nR U' B";
    await act(async () => root.render(createElement(SolutionView, {
      text, event: '3x3', autoWaste: true, playerRef: { current: null },
    })));
    const pre = host.querySelector('pre')!;
    expect(pre.textContent).toBe("(U' U' U') F\n(U R' // pair\nR U') B");
    const last = pre.querySelector('.recon-plain-line:last-child');
    expect(last).not.toBeNull();
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let tail: Node | null = null;
    while ((node = walker.nextNode())) if (node.textContent === ' B') tail = node;
    expect(tail).not.toBeNull();
    window.getSelection()!.collapse(tail!, 2);
    expect(getTextOffsetInElement(pre)).toBe(text.length);
    expect([...reconWasteBrackets("(U' U' U') F\n(U R' // pair\nR U') B", '')]).toEqual([]);
    expect([...reconWasteBrackets('(R U)2', '')]).toEqual([]);
    expect([...reconWasteBrackets('R U // R R\nF', '')]).toEqual([]);
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
    // Recon executes scrambles from white-U / green-F, unlike the case library's
    // yellow-U / red-F default. Every last-layer label must retain real colours.
    const expected = document.createElement('div');
    expected.innerHTML = renderFromSimpleQuery({ setup: "R U2 R'", sch: 'wrgyob', view: 'plan', size: 28, pzl: 3 });
    expect(diagram?.querySelector('svg')?.outerHTML).toBe(expected.querySelector('svg')?.outerHTML);
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
