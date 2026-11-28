// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { runReconstructionNotation } from '@cuberoot/timer-ui/reconstruct/analysis-notation';
import type { AnalysisResponse, AnalysisWorkerRequest } from '@cuberoot/timer-ui/reconstruct/analysis-protocol';
import { LiveVideoNotation } from '@/app/[lang]/video-recon/LiveVideoNotation';

// Run the notation worker in-process, with the library lookup unavailable offline.
class NotationWorker {
  onmessage?: (event: { data: AnalysisResponse }) => void;
  async postMessage(message: AnalysisWorkerRequest) {
    if (!('input' in message)) return;
    const send = (patch: Omit<AnalysisResponse, 'id'>) => this.onmessage?.({ data: { id: message.id, ...patch } });
    await runReconstructionNotation(message, send, async () => { throw Error('offline'); });
    send({ done: true });
  }
  terminate() {}
}

it('keeps raw turns and adds cross and pair chips before the solve ends, discarding revised boundaries', async () => {
  vi.stubGlobal('Worker', NotationWorker);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const scramble = "R2 U' B2 L F2 D F2 D F' D2 B L2 D2 B' U2 B U2 R";
  const turns = "x y F U' B' F' L F' U F R Fw' D B U' B' B' U' B U R".split(' ');
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (moves: string[], frame: number) => act(async () => root.render(createElement(LiveVideoNotation, {
    scramble, frame, fps: 50, start: 0, steps: moves.map((m, i) => ({
      frame_index: i + 1, state_moves: [m], geometry_option_index: null,
    })),
  })));
  try {
    await render(turns, 4);
    expect(host.textContent).toBe("x y F U'");
    await render(turns, turns.length);
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.textContent).toMatch(/xcross/i);
      expect(host.querySelectorAll('.ccc-chip').length).toBeGreaterThanOrEqual(4);
    }, { timeout: 6000 });
    expect(host.textContent).toContain("F U' B' F' L F' U F R Fw' D");
    await render(['L', 'R'], 2);
    expect(host.querySelector('.ccc-chip')).toBeNull();
    expect(host.textContent).toBe('L R');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
