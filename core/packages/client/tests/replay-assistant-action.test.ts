// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { ReconstructAssistantSummary } from '@cuberoot/timer-ui/reconstruct-report';
import ReplayAssistantAction from '@/components/ReplayAssistantAction';
import { ASSISTANT_PAGE_DRAFT_EVENT, type AssistantPageDraft } from '@/lib/assistant-conversations';

it('requests one immediate submission with the finished pair comparison after an early click', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const node = document.body.appendChild(document.createElement('div'));
  const root = createRoot(node);
  const drafts: AssistantPageDraft[] = [];
  const receive = (event: Event) => drafts.push((event as CustomEvent<AssistantPageDraft>).detail);
  window.addEventListener(ASSISTANT_PAGE_DRAFT_EVENT, receive);
  const stage = { label: 'F1', slot: 'FL', range: { startMs: 814, first: 8, last: 16 },
    stepMs: 1764, recognitionMs: 1004, executionMs: 760, cumulativeMs: 2578, turns: 8 };
  const summary: ReconstructAssistantSummary = { timeMs: 9568.6, penalty: 'ok', method: 'CFOP', stm: 61,
    tps: 6.38, stages: [stage], focus: { label: 'F1', goal: 'recognitionMs' }, notes: ['Selected baseline and retest'] };
  try {
    await act(() => root.render(createElement(ReplayAssistantAction, { owner: 'test', summary, pairPending: true, followUp: true })));
    const button = node.querySelector('button')!;
    vi.spyOn(button, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    await act(() => button.click());
    expect(button.disabled).toBe(true);
    expect(drafts).toHaveLength(0);
    const complete = { ...summary, evidence: { selected: 10 }, stages: [{ ...stage, setup: "R2 F' B", refUserTurns: 8, refTurns: 6 }] };
    await act(() => root.render(createElement(ReplayAssistantAction, { owner: 'test', summary: complete, followUp: true })));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].send).toBe(true);
    expect(drafts[0].draft).toContain('HTM 8/6');
    expect(drafts[0].draft).toContain(summary.notes![0]);
    expect(drafts[0].report?.summary).toBe(complete);
    expect(drafts[0].draft).not.toContain(complete.stages[0].setup);
    expect(drafts[0].trigger).toBe(button);
    expect(button.disabled).toBe(false);
    await act(() => root.render(createElement(ReplayAssistantAction, { owner: 'test', summary: { ...complete }, followUp: true })));
    expect(drafts).toHaveLength(1);
  } finally {
    await act(() => root.unmount());
    node.remove();
    window.removeEventListener(ASSISTANT_PAGE_DRAFT_EVENT, receive);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
