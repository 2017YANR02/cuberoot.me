// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Solve } from '@cuberoot/shared/timer';
import { encodeReplayPayload, encodeReplayUrl } from '@cuberoot/shared/timer/replay-encode';
import { buildReconText as sharedBuild } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { buildReconText as webBuild } from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { decodeReplayParam } from '@/app/[lang]/timer/_lib/share/decode';
import ReconstructReport, { type ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import SolveRecap from '@cuberoot/timer-ui/solve-recap';

vi.mock('@cuberoot/timer-ui/SimCubeView', () => ({
  default: ({ moves }: { moves: string[] }) => createElement('div', { 'data-replay-moves': moves.join(' ') }),
}));

const solve: Solve = {
  id: 'shared-report', event: '333', ts: 1_700_000_000_000,
  scramble: 'R U', timeMs: 300, penalty: 'ok',
  moves: [{ m: "U'", ts: 100 }, { m: "R'", ts: 200 }],
  device: { model: 'gan-v4', name: 'Test cube' },
};

let root: Root;
let container: HTMLDivElement;
const writeClipboardText = vi.fn(async (_text: string) => undefined);
const host: ReconstructHost = {
  localize: (text) => text.en,
  writeClipboardText,
  replayUrl: (value) => encodeReplayUrl(value, 'https://www.cuberoot.me/timer'),
  recordGyro: true,
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Component behavior is deterministic offline; reference recognition has its
  // own fixture suite. Never depend on the live algorithm API in a UI test.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline UI fixture'); }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  writeClipboardText.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((element) => (
    element.getAttribute('aria-label') === label || element.textContent === label
  ));
  expect(found, label).toBeDefined();
  return found!;
}

describe('the complete shared reconstruction report', () => {
  it('keeps the website analysis export identical and replay payload compatible', () => {
    expect(webBuild).toBe(sharedBuild);
    expect(decodeReplayParam(encodeReplayPayload(solve))).toMatchObject({
      event: '333', scramble: 'R U', totalMs: 300,
      moves: [{ m: "U'", ts: 0 }, { m: "R'", ts: 100 }],
      device: solve.device,
    });
    expect(encodeReplayUrl(solve, 'https://www.cuberoot.me/zh/timer?old=1#old'))
      .toBe(`https://www.cuberoot.me/zh/timer?replay=${encodeReplayPayload(solve)}`);
  });

  it('renders the full score, timeline and analysis, and sends actions to the host', async () => {
    const feedback = vi.fn();
    const useScramble = vi.fn();
    await act(async () => {
      root.render(createElement(ReconstructReport, {
        solve, history: [solve], isZh: false, host,
        onReconFeedback: feedback, onUseScramble: useScramble,
      }));
    });
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(container.querySelector('.sml-scramble'), container.textContent ?? '').not.toBeNull();
    });
    expect(container.querySelector('.stl-track')).not.toBeNull();
    expect(container.querySelector('.sa-scroll')).not.toBeNull();
    expect(container.querySelector('.sml-scramble')?.textContent).toContain('R U');
    expect(container.textContent).toContain('Step analysis');
    expect(container.textContent).toContain('QTM');
    await act(async () => button('Copy share link').click());
    expect(writeClipboardText).toHaveBeenLastCalledWith(host.replayUrl(solve));
    await act(async () => button('Copy in /recon format').click());
    expect(writeClipboardText.mock.lastCall?.[0]).toContain('R U');
    await act(async () => button('Use this scramble').click());
    expect(useScramble).toHaveBeenCalledWith('R U');
    await act(async () => button('The split is right').click());
    expect(feedback).toHaveBeenCalledWith(true);
    await act(async () => button('Step forward').click());
    expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('0.10 / 0.30');
    await act(async () => button('To end').click());
    expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('0.20 / 0.30');
    await act(async () => button('To start').click());
    expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('0.00 / 0.30');
  });

  it('keeps the inline recap nonmodal and reuses the same report with localized controls', async () => {
    const onFull = vi.fn();
    const onDismiss = vi.fn();
    await act(async () => {
      root.render(createElement(SolveRecap, {
        solve, history: [solve], isZh: true, onFull, onDismiss,
        host: { ...host, localize: (text) => text.zh },
      }));
    });
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(container.querySelector('.rc-report')).not.toBeNull();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain('回放与分步动作');
    await act(async () => button('整屏').click());
    await act(async () => button('收起').click());
    expect(onFull).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
