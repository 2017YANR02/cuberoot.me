// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import StepMoveList from '@cuberoot/timer-ui/reconstruct/StepMoveList';
import { ReconstructHostContext } from '@cuberoot/timer-ui/reconstruct/ReconstructHost';
import { buildNormalizedSolution } from '@cuberoot/shared/recon-ground-truth';
import { formatReconLine, type ReconTextLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';

vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: vi.fn(async (_puzzle: string, set: string) => ({ cases: [{
    id: set === 'pll' ? 2 : 1, name: set === 'pll' ? 'Aa' : 'OLL 27',
    meta: set === 'pll' ? { ollcp: 'PLL-A+' } : undefined,
    subgroup: '', setup: '', sticker: { kind: 'raw', tag: 'div', attrs: {} }, algs: [],
  }] })),
}));

function line(kind: 'cross' | 'oll' | 'pll', moves: string[], label: string, fromIdx: number): ReconTextLine {
  return { kind, key: kind, moves, label, fromIdx, toIdx: fromIdx,
    recognitionMs: null, executionMs: null, stepMs: null };
}

it('reuses cross normalization for display and copy without rewriting playback data, and links exact cases', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const lines = [line('cross', ["M'"], 'W cross', 0), line('oll', ['R'], 'OLL-S+', 1), line('pll', ['U'], 'PLL-A+', 2)];
  const recon: ReconTextResult = { scramble: 'R U', inspection: 'z2', lines, turns: 4, stm: 3,
    seconds: 1, tps: 4, rotations: [], blindPairs: 0,
    text: ['z2 // insp', ...lines.map(formatReconLine)].join('\n') };
  const original = JSON.stringify(recon);
  const normalized = buildNormalizedSolution(recon.text)!;
  const copy = vi.fn(async () => {});
  const seek = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, { value: {
      localize: text => text.zh, writeClipboardText: copy, replayUrl: () => '', recordGyro: false,
    } }, createElement(StepMoveList, { recon, reference: null, slotReference: null, onSeek: seek }))));
    const toggle = host.querySelector<HTMLButtonElement>('.recon-cross-toggle')!;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.parentElement?.className).toBe('sml-head');
    expect(toggle.nextElementSibling?.className).toBe('sml-copy');
    const normalizedLines = normalized.split('\n');
    const moves = [...host.querySelectorAll('.sml-moves')].map(element => element.textContent);
    expect(moves[1]).toBe(normalizedLines[0].split('//')[0].trim());
    expect(moves[2]).toBe(normalizedLines[1].split('//')[0].trim());
    await act(async () => host.querySelector<HTMLButtonElement>('.sml-copy')!.click());
    expect(copy).toHaveBeenLastCalledWith(expect.stringContaining(normalized));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-stage="cross"] .sml-moves')!.click());
    expect(seek).toHaveBeenLastCalledWith(0, undefined);
    expect(JSON.stringify(recon)).toBe(original);
    expect(host.querySelector('a[href="/zh/alg/3x3/oll/s+"]')?.textContent).toBe('OLL-S+');
    expect(host.querySelector('a[href="/zh/alg/3x3/pll/a+"]')?.textContent).toBe('PLL-A+');
    await act(async () => toggle.click());
    expect(host.querySelector('[data-stage="cross"] .sml-moves')?.textContent).toBe("M'");
    await act(async () => host.querySelector<HTMLButtonElement>('.sml-copy')!.click());
    expect(copy).toHaveBeenLastCalledWith(expect.stringContaining(recon.text));
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});


it('switches F2L notation and copy reversibly, and seeks using the surviving raw range', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const f2l: ReconTextLine = { ...line('cross', ["x'", 'x', 'y', 'U'], 'BR', 4), kind: 'f2l', key: 'slot-BR',
    moveRanges: [
      { token: "x'", ts: 100, endTs: 100, startIdx: 4, endIdx: 3 },
      { token: 'x', ts: 200, endTs: 200, startIdx: 4, endIdx: 3 },
      { token: 'y', ts: 300, endTs: 300, startIdx: 4, endIdx: 3 },
      { token: 'U', ts: 400, endTs: 450, startIdx: 4, endIdx: 4 },
    ] };
  const recon: ReconTextResult = { scramble: 'R U', inspection: '', lines: [f2l], turns: 1, stm: 1,
    seconds: 1, tps: 1, rotations: [], blindPairs: 0, text: formatReconLine(f2l) };
  const original = JSON.stringify(recon), copy = vi.fn(async (_text: string) => {}), seek = vi.fn();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, { value: {
      localize: text => text.zh, writeClipboardText: copy, replayUrl: () => '', recordGyro: false,
    } }, createElement(StepMoveList, { recon, reference: null, slotReference: null, onSeek: seek }))));
    const moves = host.querySelector<HTMLButtonElement>('[data-stage="f2l"] .sml-moves')!;
    expect(moves.textContent).toBe('y U');
    const selection = window.getSelection()!;
    selection.collapse(moves.firstChild, 3);
    await act(async () => moves.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    expect(seek).toHaveBeenLastCalledWith(5, 450);
    await act(async () => host.querySelector<HTMLButtonElement>('.sml-copy')!.click());
    expect(copy.mock.calls.at(-1)?.[0]).toContain('y U // BR');
    const toggle = host.querySelector<HTMLButtonElement>('.recon-cross-toggle')!;
    await act(async () => toggle.click());
    expect(moves.textContent).toBe("x' x y U");
    await act(async () => host.querySelector<HTMLButtonElement>('.sml-copy')!.click());
    expect(copy.mock.calls.at(-1)?.[0]).toContain("x' x y U // BR");
    await act(async () => toggle.click());
    expect(moves.textContent).toBe('y U');
    expect(JSON.stringify(recon)).toBe(original);
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it('restores library-corrected source, copies the selected version and seeks full verified intervals', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { correctLibraryLine } = await import('@cuberoot/shared/timer/reconstruct/library-correction');
  const { formattedReconMoves } = await import('@cuberoot/shared/timer/reconstruct/recon-text');
  const tokens = "R B' R' F R B R' F' R B R' F l U' R' D'".split(' ');
  const source: ReconTextLine = { ...line('pll', tokens, 'PLL-E', 0), toIdx: tokens.length - 1,
    moveRanges: tokens.map((token, index) => ({ token, ts: index * 100, endTs: index * 100, startIdx: index, endIdx: index })) };
  const corrected = await correctLibraryLine(source, [{ alg: "x' (R U' R' D) (R U R' D') (R U R' D) (R U' R' D') x" }]);
  const recon: ReconTextResult = { scramble: '', inspection: '', lines: [corrected], turns: 16, stm: 16,
    seconds: 2, tps: 8, rotations: [], blindPairs: 0, text: formatReconLine(corrected) };
  const copy = vi.fn(async (_text: string) => {}), seek = vi.fn();
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(ReconstructHostContext.Provider, { value: {
      localize: text => text.zh, writeClipboardText: copy, replayUrl: () => '', recordGyro: false,
    } }, createElement(StepMoveList, { recon, reference: null, slotReference: null, onSeek: seek }))));
    const target = host.querySelector<HTMLButtonElement>('[data-stage="pll"] .sml-moves')!;
    const index = corrected.moveRanges!.findIndex(range => range.seekEndIdx !== undefined && range.seekEndIdx !== range.endIdx);
    expect(index).toBeGreaterThanOrEqual(0);
    const range = corrected.moveRanges![index];
    const position = formattedReconMoves(corrected).slice(0, index + 1).join(' ').length;
    window.getSelection()!.collapse(target.firstChild, position);
    await act(async () => target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    expect(seek).toHaveBeenLastCalledWith(range.seekEndIdx! + 1, range.endTs);
    await act(async () => host.querySelector<HTMLButtonElement>('.sml-copy')!.click());
    expect(copy.mock.calls.at(-1)?.[0]).toContain(formatReconLine(corrected));
    await act(async () => host.querySelector<HTMLButtonElement>('.recon-cross-toggle')!.click());
    expect(target.textContent).toBe(tokens.join(' '));
    await act(async () => host.querySelector<HTMLButtonElement>('.sml-copy')!.click());
    expect(copy.mock.calls.at(-1)?.[0]).toContain(tokens.join(' '));
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
