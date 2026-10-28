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
import { reconstructionAnalyzer } from '@cuberoot/timer-ui/reconstruct-analysis';

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
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Component behavior is deterministic offline; reference recognition has its
  // own fixture suite. Never depend on the live algorithm API in a UI test.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline UI fixture'); }));
  // jsdom has no Worker. Mock the transport boundary; browser verification
  // exercises the real worker while this test checks progressive UI updates.
  vi.spyOn(reconstructionAnalyzer, 'subscribe').mockImplementation((input, notify) => {
    let alive = true;
    notify({ text: null, reference: null, slotReference: null, status: 'pending' });
    void sharedBuild(input.text).then(text => {
      if (alive) notify({ text, reference: null, slotReference: null, status: 'complete' });
    });
    return () => { alive = false; };
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  writeClipboardText.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  reconstructionAnalyzer.dispose();
});

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((element) => (
    element.getAttribute('aria-label') === label || element.textContent === label
  ));
  expect(found, label).toBeDefined();
  return found!;
}

describe('the complete shared reconstruction report', () => {
  it('automatically recognizes the method and ignores the old manual preference', async () => {
    localStorage.setItem('cuberoot.reconstruction.method', 'zz');
    const tokens = "L U L' R U R' R U R' U R U2 R' M' U2 M U2".split(' ');
    const value = {...solve, scramble:tokens.slice().reverse().map(m=>m.endsWith('2')?m:m.endsWith("'")?m.slice(0,-1):m+"'").join(' '),
      timeMs:tokens.length*200, moves:tokens.map((m,i)=>({m,ts:(i+1)*200}))};
    const history = Array.from({length:5},(_,i)=>({...value,id:'previous-'+i,ts:value.ts-i-1}));
    await act(async () => root.render(createElement(ReconstructReport, { solve:value, history, isZh:false, host })));
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(container.querySelector('.sa-row-avg')?.textContent).toContain('vs recent stage mean');
    });
    expect(container.querySelector('.sa-method-select')).toBeNull();
    expect([...container.querySelectorAll('.stl-names .stl-cap')].map(el=>el.textContent)).toEqual(['FB','SB','CMLL','LSE']);
    expect(localStorage.getItem('cuberoot.reconstruction.stage-cache.v1')).toContain('previous-4');
  });

  it('keeps live steps visible across final remount while collapsed references load separately', async () => {
    const live = { ...solve, id: 'live-attempt' };
    await act(async () => root.render(createElement(ReconstructReport, { solve: live, isZh: false, host, live: true })));
    await vi.waitFor(() => expect(container.querySelector('.sml-line')).not.toBeNull());
    const lines = container.querySelector('.sml-moves')?.textContent;
    reconstructionAnalyzer.handoff(live.id, solve.id);
    await act(async () => root.render(null));
    let publish: Parameters<typeof reconstructionAnalyzer.subscribe>[1] | undefined;
    let initial: ReturnType<typeof reconstructionAnalyzer.peek> | undefined;
    vi.mocked(reconstructionAnalyzer.subscribe).mockImplementation((input, notify, attemptId) => {
      initial = reconstructionAnalyzer.peek(input, attemptId);
      notify(initial);
      publish = notify;
      return () => {};
    });
    await act(async () => root.render(createElement(ReconstructReport, { solve, isZh: false, host })));
    expect(container.querySelector('.sml-moves')?.textContent).toBe(lines);
    expect(container.textContent).not.toContain('Analyzing solve…');
    expect(container.textContent).not.toContain('Computing reference lines…');
    expect(initial?.text).not.toBeNull();
    await act(async () => publish!({ ...initial!, provisional: false }));
    expect(container.textContent).not.toContain('Updating the final steps…');
    await act(async () => publish!({ ...initial!, provisional: false, status: 'error' }));
    expect(container.textContent).not.toContain('Some analysis could not load');
    expect(container.textContent).not.toContain('Reference lines could not load');
    await act(async () => publish!({ ...initial!, provisional: false }));
    const referenceToggle = [...container.querySelectorAll('button')].find(element => element.textContent?.includes('Reference lines'))!;
    expect(referenceToggle).toBeDefined();
    await act(async () => referenceToggle.click());
    expect(container.textContent).toContain('Computing reference lines…');
    expect(container.querySelector('.sml-moves')?.textContent).toBe(lines);
    await act(async () => publish!({ ...initial!, provisional: false, reference: { stages: [], refTurns: 1, userTurns: 2, delta: 1 }, status: 'complete' }));
    expect(container.textContent).not.toContain('Computing reference lines…');
    expect(container.querySelector('.sml-moves')?.textContent).toBe(lines);
  });

  it('renders identical move lines in live and final modes and clears them for a new attempt', async () => {
    const render = async (value: Solve, live: boolean) => {
      await act(async () => {
        root.render(createElement(ReconstructReport, { solve: value, isZh: false, host, live }));
      });
      await vi.waitFor(async () => {
        await act(async () => undefined);
        expect(container.querySelector('.sml-scramble')?.textContent).toContain(value.scramble);
      });
    };
    const lines = () => [...container.querySelectorAll('.sml-line')].map(line => ({
      moves: line.querySelector('.sml-moves')?.textContent,
      label: line.querySelector('.sml-label')?.textContent,
      pair: line.querySelector('.sml-sub-name')?.textContent,
    }));
    await render(solve, true);
    const liveLines = lines();
    expect(container.querySelector('.reconstruct-playback')).toBeNull();
    expect(vi.mocked(reconstructionAnalyzer.subscribe).mock.calls.at(-1)?.[0].scoreable).toBe(false);
    await render(solve, false);
    expect(lines()).toEqual(liveLines);
    await render({ ...solve, id: 'next-attempt', scramble: 'F', moves: [{ m: "F'", ts: 100 }] }, true);
    expect(container.querySelector('.sml-scramble')?.textContent).not.toContain('R U');
  });

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
    expect(container.textContent).toContain('Recognition');
    expect(container.querySelector('[data-timer-reconstruct-metrics]')).toBeNull();
    expect(container.textContent).not.toContain('Longest pause');
    expect(container.textContent).not.toContain('Wasted');
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
    const useScramble = vi.fn();
    await act(async () => {
      root.render(createElement(SolveRecap, {
        solve, history: [solve], isZh: true, onFull, onDismiss,
        onUseScramble: useScramble,
        host: { ...host, localize: (text) => text.zh },
      }));
    });
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(container.querySelector('.rc-report')).not.toBeNull();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('.reconstruct-playback')).not.toBeNull();
    expect(container.querySelector('.reconstruct-playback-toggle')).toBeNull();
    expect(container.querySelector('.shell-recap-body .rc-actions')).toBeNull();
    const toolbarButtons = [...container.querySelectorAll<HTMLButtonElement>('.shell-recap-head button')];
    expect(toolbarButtons.map((element) => element.getAttribute('aria-label') ?? element.textContent)).toEqual([
      '整屏', '复制分享链接', '用这条打乱', '收起',
    ]);
    const fullScreenButton = button('整屏');
    expect(fullScreenButton.textContent).toBe('');
    expect(button('复制分享链接').textContent).toBe('');
    await act(async () => button('复制分享链接').click());
    expect(writeClipboardText).toHaveBeenLastCalledWith(host.replayUrl(solve));
    await act(async () => button('用这条打乱').click());
    expect(useScramble).toHaveBeenCalledWith('R U');
    await act(async () => fullScreenButton.click());
    await act(async () => button('收起').click());
    expect(onFull).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
