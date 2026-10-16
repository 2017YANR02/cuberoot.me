// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cubeThumbParams } from '@/lib/alg_thumb_plan';
import { visualCubeSchemeForOrientation } from '@/lib/cube-orientation';
import SolutionView from '@/components/SolutionView';
import StepMoveList from '@cuberoot/timer-ui/reconstruct/StepMoveList';
import { ReconstructHostContext } from '@cuberoot/timer-ui/reconstruct/ReconstructHost';
import { formatReconLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { reconInspectionOrientations, reconWasteBrackets, reconPlaybackSegments } from '@/lib/recon-alg-utils';
import { getTextOffsetInElement } from '@cuberoot/timer-ui/recon/text-cursor';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { loadAlg, type AlgFile } from '@cuberoot/shared/alg';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';

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
    vi.mocked(loadAlg).mockResolvedValue({ cases: [] } as unknown as AlgFile);
  });

  it.each(['timer', 'recon'])('resolves a bare OLL(CP) label to an exact case in %s', async surface => {
    const moves = "R U R' U R U2 R'";
    vi.mocked(loadAlg).mockResolvedValue({ cases: [{ id: 1, name: 'OLLCP27 1', algs: [[{ alg: moves }]] }] } as AlgFile);
    const line = { kind: 'oll' as const, key: 'oll', moves: moves.split(' '), label: 'OLL(CP)', fromIdx: 0, toIdx: 6,
      recognitionMs: null, executionMs: null, stepMs: null };
    const text = `${moves} // OLL(CP)`;
    const recon = { scramble: '', inspection: '', lines: [line], text, turns: 7, stm: 7, seconds: 1, tps: 7, rotations: [], blindPairs: 0 } as ReconTextResult;
    await act(async () => root.render(surface === 'recon'
      ? createElement(SolutionView, { text, event: '333', playerRef: { current: null } })
      : createElement(ReconstructHostContext.Provider, { value: {
        localize: value => value.en, writeClipboardText: async () => {}, replayUrl: () => '', recordGyro: false,
        LineDiagramProvider: ReconLineDiagramProvider,
        renderCaseLink: (href, children) => createElement('a', { href }, children),
      } }, createElement(StepMoveList, { recon, reference: null, slotReference: null }))));
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.querySelector('a[href*="/ollcp/ollcp27-1"]')?.textContent).toBe('OLL(CP)');
    });
    expect(text).toBe(`${moves} // OLL(CP)`);
  });

  it.each([true, false])('copies a whole timer row with playback enabled=%s', async canSeek => {
    const lines: ReconTextResult['lines'] = [{ kind: 'pll', key: 'pll', moves: ['R', 'U', "R'"],
      label: 'PLL-T', fromIdx: 7, toIdx: 9, recognitionMs: null, executionMs: null, stepMs: null }];
    const recon: ReconTextResult = { scramble: 'R2 U2', inspection: 'x2', lines,
      text: "x2 // insp\n" + lines.map(formatReconLine).join('\n'), turns: 3, stm: 3, seconds: 1,
      tps: 3, rotations: [], blindPairs: 0 };
    const copy = vi.fn(async () => {}), seek = vi.fn();
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, {
      value: { localize: text => text.en, writeClipboardText: copy, replayUrl: () => '', recordGyro: false },
    }, createElement(StepMoveList, { recon, reference: null, slotReference: null, onSeek: canSeek ? seek : undefined }))));
    const rows = [...host.querySelectorAll<HTMLElement>('.sml-moves')];
    await act(async () => rows[2].click());
    expect(copy).toHaveBeenLastCalledWith("R U R' // PLL-T");
    if (canSeek) expect(seek).toHaveBeenCalledWith(7, undefined);
    else expect(seek).not.toHaveBeenCalled();
    await act(async () => rows[0].click());
    expect(copy).toHaveBeenLastCalledWith('R2 U2');
    await act(async () => rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(copy).toHaveBeenLastCalledWith('x2 // insp');
  });

  it('renders the same chips, links, masks and line text in timer and recon', async () => {
    const alg = "R U R' U R U2 R'";
    vi.mocked(loadAlg).mockResolvedValue({ cases: [{ id: 1, name: 'OLLCP27 1', algs: [[{ alg }]] }] } as AlgFile);
    const labels = ['W xcross (RB+GO)', 'GR', 'OLL(CP)'];
    const lines: ReconTextResult['lines'] = labels.map((label, index) => ({
      kind: index === 0 ? 'cross' : index === 1 ? 'f2l' : 'oll', key: String(index),
      moves: (index === 2 ? alg : 'R U').split(' '), label,
      fromIdx: index * 2, toIdx: index * 2 + 1, recognitionMs: null, executionMs: null, stepMs: null,
    }));
    const text = "x2 y // insp\n" + lines.map(formatReconLine).join('\n');
    const recon: ReconTextResult = { scramble: "R U2 R'", inspection: 'x2 y', lines,
      text, turns: 11, stm: 11, seconds: 1, tps: 11, rotations: [], blindPairs: 0 };
    const readRows = () => [...host.querySelectorAll('.recon-plain-line, .recon-case-line-text')].map(row => ({
      // The localized inspection word is host data; everything around it is shared.
      text: row.textContent?.replace('inspection', 'insp'),
      chips: [...row.querySelectorAll('.ccc-chip')].map(chip => ({
        label: chip.getAttribute('aria-label'), vertical: chip.classList.contains('cube-orientation-chip'),
        colors: [...chip.children].map(child => (child as HTMLElement).style.background),
      })),
      links: [...row.querySelectorAll('a')].map(link => [new URL(link.href).pathname.replace(/^\/zh/, ''), link.textContent]),
    }));
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, { value: {
      localize: value => value.en, writeClipboardText: async () => {}, replayUrl: () => '', recordGyro: false,
      LineDiagramProvider: ReconLineDiagramProvider,
      inspectionColors: moves => reconInspectionOrientations(moves + ' // insp')[0]?.colors,
      renderCaseLink: (href, children) => createElement('a', { href }, children),
    } }, createElement(StepMoveList, { recon, reference: null, slotReference: null }))));
    const original = [...host.querySelectorAll('button')].find(button => button.title === 'Show original record');
    if (original) await act(async () => original.click());
    await vi.waitFor(async () => { await act(async () => {}); expect(host.querySelector('a[href*="ollcp27-1"]')).not.toBeNull(); });
    const timerRows = readRows().slice(1);
    const timerDiagrams = [...host.querySelectorAll('.recon-case-diagram svg')].map(svg => svg.outerHTML);
    await act(async () => root.render(createElement(SolutionView, { text, event: '333', scramble: recon.scramble, playerRef: { current: null } })));
    await vi.waitFor(async () => { await act(async () => {}); expect(host.querySelector('a[href*="ollcp27-1"]')).not.toBeNull(); });
    expect(readRows()).toEqual(timerRows);
    expect([...host.querySelectorAll('.recon-case-diagram svg')].map(svg => svg.outerHTML)).toEqual(timerDiagrams);
    expect(recon.text).toBe(text);
  });

  it('shares recon color-only grouping punctuation with timer labels', async () => {
    const labels = ['W xcross (RB)', 'W xxcross (RB+GO)', 'OLL(CP)'];
    const lines: ReconTextResult['lines'] = labels.map((label, i) => ({
      kind: 'oll', key: String(i), moves: ['U'], label, fromIdx: i, toIdx: i,
      recognitionMs: null, executionMs: null, stepMs: null,
    }));
    const recon: ReconTextResult = { scramble: '', inspection: '', lines,
      text: lines.map(formatReconLine).join('\n'), turns: 3, stm: 3, seconds: 1,
      tps: 3, rotations: [], blindPairs: 0 };
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, {
      value: { localize: text => text.en, writeClipboardText: async () => {},
        replayUrl: () => '', recordGyro: false },
    }, createElement(StepMoveList, { recon, reference: null, slotReference: null }))));
    const timer = [...host.querySelectorAll('.sml-label')];
    expect(timer[0].textContent).toBe('//  xcross ');
    expect(timer[1].textContent).toBe('//  xxcross  ');
    expect(timer[2].textContent).toBe('// OLL(CP)');
    expect(timer.map(el => el.querySelectorAll('.ccc-chip').length)).toEqual([2, 3, 0]);
  });

  it('uses recon waste brackets across timer rows instead of stale per-row groups', async () => {
    const lines: ReconTextResult['lines'] = ["U' U' U' F", "U R'", "R U' B"].map((moves, i) => ({
      kind: 'f2l', key: `slot-${i}`, moves: moves.split(' '),
      wasteGroups: i === 2 ? [null, null, 9] : undefined,
      label: null, fromIdx: i * 4, toIdx: i * 4 + moves.split(' ').length - 1,
      recognitionMs: null, executionMs: null, stepMs: null,
    }));
    const recon: ReconTextResult = { scramble: '', inspection: '', lines,
      text: lines.map(formatReconLine).join('\n'), turns: 9, stm: 9, seconds: 1,
      tps: 9, rotations: [], blindPairs: 0 };
    const original = JSON.stringify(recon);
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, {
      value: { localize: text => text.en, writeClipboardText: async () => {},
        replayUrl: () => '', recordGyro: false, wasteBrackets: reconWasteBrackets },
    }, createElement(StepMoveList, { recon, reference: null, slotReference: null }))));
    expect([...host.querySelectorAll('.sml-moves')].map(el => el.textContent)).toEqual([
      "(U' U' U') F", "(U R'", "R U') B",
    ]);
    expect(JSON.stringify(recon)).toBe(original);
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

  it.each(['OLL', 'PLL', 'COLL', 'ZBLL', 'EPLL'])('shows an actual-state plan for %s without requiring a case number', async label => {
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
    // yellow-U / red-F default. Keep real colours only where the library mask exposes them.
    const expected = document.createElement('div');
    const params = cubeThumbParams('3x3', label === 'EPLL' ? 'pll' : label.toLowerCase(), { kind: 'raw', tag: '', attrs: {} });
    expected.innerHTML = renderFromSimpleQuery({ setup: "R U2 R'", sch: visualCubeSchemeForOrientation('', params.view === 'oll'), view: params.view, mask: params.mask, ngs: params.hideGreySides ? '1' : undefined, size: 28, pzl: 3 });
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

  it.each(['ZBLS', 'VLS', 'WV', 'SV', 'GR ZBLS / PLL Skip'])('shows the library mask in 3D for %s', async label => {
    await act(async () => root.render(createElement(SolutionView, {
      text: `R U // ${label}`, event: '3x3', scramble: "R U2 R'", playerRef: { current: null },
    })));
    const expected = document.createElement('div');
    const set = label.includes('ZBLS') ? 'zbls' : label.toLowerCase();
    const params = cubeThumbParams('3x3', set, { kind: 'raw', tag: '', attrs: {} });
    expected.innerHTML = renderFromSimpleQuery({ setup: "R U2 R'", sch: 'wrgyob', view: 'iso', mask: params.mask, ngs: params.hideGreySides ? '1' : undefined, size: 28, pzl: 3 });
    expect(host.querySelector('.recon-case-diagram svg')?.outerHTML).toBe(expected.querySelector('svg')?.outerHTML);
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

  it('uses the recon vertical U/F chip for timer inspection without changing F2L chips', async () => {
    const lines: ReconTextResult['lines'] = [{ kind: 'f2l', key: 'f1', moves: ['R'], label: 'GR',
      fromIdx: 0, toIdx: 0, recognitionMs: null, executionMs: null, stepMs: null }];
    const recon: ReconTextResult = { scramble: '', inspection: "x' z'", lines,
      text: "x' z' // insp\nR // GR", turns: 1, stm: 1, seconds: 1, tps: 1, rotations: [], blindPairs: 0 };
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, {
      value: { localize: text => text.en, writeClipboardText: async () => {}, replayUrl: () => '', recordGyro: false,
        inspectionColors: moves => reconInspectionOrientations(moves + ' // insp')[0]?.colors },
    }, createElement(StepMoveList, { recon, reference: null, slotReference: null }))));
    const chips = [...host.querySelectorAll('.ccc-chip')];
    expect(chips).toHaveLength(2);
    expect(chips[0].classList.contains('cube-orientation-chip')).toBe(true);
    expect(chips[0].getAttribute('aria-label')).toBe('Red White');
    expect(chips[1].classList.contains('cube-orientation-chip')).toBe(false);
    expect(chips[1].getAttribute('aria-label')).toBe('Green Red');
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
