// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import type { ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
const mocks = vi.hoisted(() => ({ submit: vi.fn(), read: vi.fn(), admin: true, renders: 0 }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => mocks.admin }));
vi.mock('@/lib/recon-intake-api', () => ({ submitReconIntake: mocks.submit, intakeRequest: vi.fn() }));
vi.mock('@cuberoot/shared/timer/replay-client', () => ({ readTimerReplay: mocks.read }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: unknown }) => value.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: React.ReactNode }) => createElement('a', null, children) }));
const snapshot: ReconSnapshot = { inspection: '', lines: [{ key: 'cross', kind: 'cross', fromIdx: 0, toIdx: 0, moves: ["R'"], label: 'W cross' }] };
vi.mock('@cuberoot/timer-ui/reconstruct-report', () => ({
  default: ({ onReviewSnapshot, host }: { onReviewSnapshot: (value: ReconSnapshot) => void; host: ReconstructHost }) => {
    if (++mocks.renders > 20) throw new Error('Unbounded review rerender');
    useEffect(() => onReviewSnapshot(snapshot), [onReviewSnapshot]);
    return host.renderAnnotationAction?.({ ...snapshot.lines[0], kind: 'cross',
      recognitionMs: null, executionMs: null, stepMs: null }, () => {});
  },
}));
import ReconIntakeAction from '@/components/recon/ReconIntakeAction';
import SolveRecap from '@cuberoot/timer-ui/solve-recap';
const solve = { id: 'sample', event: '333' as const, ts: 0, penalty: 'ok' as const,
  scramble: 'R', moves: [{ m: "R'", ts: 0 }], timeMs: 1000 };
const host: ReconstructHost = { localize: value => value.en, writeClipboardText: async () => {}, replayUrl: () => '', recordGyro: false };
let root: Root, container: HTMLDivElement;
function button(text: string) {
  const found = [...document.querySelectorAll('button')].find(b => b.textContent === text);
  if (!found) throw new Error('Missing button ' + text);
  return found;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.submit.mockReset().mockResolvedValue({}); mocks.read.mockReset(); mocks.admin = true; mocks.renders = 0;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(createElement(ReconIntakeAction, { solve, snapshot, host }))); }
async function click(text: string) { await act(async () => button(text).click()); }
it('collects the confirmed snapshot without overwriting the original recording', async () => {
  await render(); await click('Collect sample'); await click('Confirm correct · Queue tests');
  expect(mocks.submit).toHaveBeenCalledTimes(1);
  expect(mocks.submit.mock.calls[0][1]).toMatchObject({ verdict: 'correct', observed: snapshot,
    recording: { scramble: 'R', moves: solve.moves }, annotations: [] });
});
it('keeps the selected source identity on the recorded solve when collecting', async () => {
  const linkedSolve = { ...solve, scrambleSource: { kind: 'manual' as const, identity: `recon-test:123:${'a'.repeat(32)}` } };
  await act(async () => root.render(createElement(ReconIntakeAction, { solve: linkedSolve, snapshot, host })));
  await click('Collect sample'); await click('Confirm correct · Queue tests');
  expect(mocks.submit.mock.calls[0][1]).toMatchObject({ sourceReconId: 123,
    sourceReconHash: 'a'.repeat(32), source: 'https://cuberoot.me/recon/123', recording: { scramble: 'R' } });
});
it('collects from the post-solve recap toolbar using that report’s snapshot', async () => {
  const recapHost: ReconstructHost = { ...host, renderIntakeAction: (current, observed) =>
    createElement(ReconIntakeAction, { solve: current, snapshot: observed, host: recapHost }) };
  await act(async () => root.render(createElement(SolveRecap, {
    host: recapHost, solve, isZh: false, history: [], onFull: vi.fn(), onDismiss: vi.fn(),
  })));
  await vi.waitFor(() => expect(container.querySelector('.shell-recap-head .ri-action')).not.toBeNull());
  await click('Collect sample');
  await vi.waitFor(() => expect(button('Confirm correct · Queue tests').disabled).toBe(false));
  await click('Confirm correct · Queue tests');
  expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({
    recording: expect.objectContaining({ scramble: solve.scramble, moves: solve.moves }),
    observed: snapshot, verdict: 'correct',
  }));
});
it('opens the shared replay, binds a step annotation to encoder indices and submits it', async () => {
  await render(); await click('Collect sample'); await click('Annotate and collect'); await click('Annotate');
  const field = document.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Rotation must follow this trigger');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Add annotation and continue'); await click('Submit annotations · Needs correction');
  const input = mocks.submit.mock.calls[0][1];
  expect(input.verdict).toBe('needs-fix');
  expect(input.annotations[0]).toMatchObject({ range: { fromIdx: 0, toIdx: 0 }, problem: 'Rotation must follow this trigger' });
  expect(input.annotations[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(mocks.renders).toBeLessThan(20);
});
it('dismisses annotation without saving, and hides collection for non-administrators', async () => {
  await render(); await click('Collect sample'); await click('Annotate and collect'); await click('Close');
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  mocks.admin = false; await render(); expect(container.textContent).toBe('');
});
