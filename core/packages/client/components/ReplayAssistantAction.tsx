'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import type { ReplayF2lCases } from '@cuberoot/shared/site-assistant-replay';
import type { ReplayPairTrainingInput, ReconstructAssistantSummary } from '@cuberoot/timer-ui/reconstruct-report';
import { cfopPracticeSolveId } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import { createReplayTrainingSession, replayTrainingReturnPath } from '@/lib/replay-training-session';
import { tr } from '@/i18n/tr';
import { ASSISTANT_PAGE_DRAFT_EVENT, type AssistantPageDraft } from '@/lib/assistant-conversations';
import { formatReplayAssistantDraft } from '@/lib/assistant-replay-draft';

function openDraft(owner: string, summary: ReconstructAssistantSummary, trigger: HTMLButtonElement, send: boolean, cases?: ReplayF2lCases, origin?: ReplayPairTrainingInput['origin']) {
  const practice = createReplayTrainingSession(owner, origin, cases);
  const reportOrigin = origin && (summary.evidence?.wholeSolve || summary.stages.some(stage=>stage.zbll))
    ? {owner, solveKey:cfopPracticeSolveId(origin.solve), returnPath:replayTrainingReturnPath(origin.solve),
      ...(summary.evidence?.wholeSolve && origin.solve.reconOk !== false && origin.solve.moves?.length
        ? {recording:{scramble:origin.solve.scramble, moves:origin.solve.moves.map(({m, ts}) => ({m, ts}))}} : {})} : undefined;
  window.dispatchEvent(new CustomEvent<AssistantPageDraft>(ASSISTANT_PAGE_DRAFT_EVENT, {
    detail: { owner, send, draft: formatReplayAssistantDraft(summary, tr, cases), trigger, practice, report: summary.evidence ? {summary, cases, origin:reportOrigin} : undefined },
  }));
}

export default function ReplayAssistantAction({ owner, summary, followUp, pairPending, pairTraining }: {
  owner: string;
  summary: ReconstructAssistantSummary;
  followUp?: boolean;
  pairPending?: boolean;
  pairTraining?: ReplayPairTrainingInput;
}) {
  const [waiting, setWaiting] = useState<HTMLButtonElement | null>(null);
  const finish = useEffectEvent(async (trigger: HTMLButtonElement, active:()=>boolean, cases?: ReplayF2lCases) => {
    let ready = summary;
    if (pairTraining?.origin && summary.evidence?.wholeSolve) {
      try {
        const {withPracticeTransfer} = await import('@/lib/replay-practice-transfer');
        ready = await withPracticeTransfer(owner,summary,pairTraining);
      } catch {
        ready = {...summary,notes:[...(summary.notes ?? []),tr({zh:'练后整局对照暂不可用。',en:'Post-practice full-solve measurements are unavailable.'})]};
      }
    }
    if (!active()) return;
    setWaiting(null);
    if (trigger.isConnected && trigger.getClientRects().length && !trigger.closest('[inert], [hidden]')) {
      openDraft(owner, ready, trigger, !!followUp, cases, pairTraining?.origin);
    }
  });
  const { fingerprint, formula, retestCaseKey } = pairTraining ?? {};
  const set = formula?.set, caseName = formula?.caseName;
  useEffect(() => {
    if (!waiting || pairPending) return;
    let active = true;
    if (!fingerprint && !set && !retestCaseKey) {
      void finish(waiting,()=>active);
      return () => { active=false; };
    }
    void import('@/lib/replay-f2l-training')
      .then(({ replayF2lTrainingCases }) => replayF2lTrainingCases({ fingerprint, formula: set && caseName ? {set, caseName} : undefined, retestCaseKey }))
      .catch(() => undefined)
      .then(cases => { if (active) void finish(waiting,()=>active,cases); });
    return () => { active = false; };
  }, [owner, pairPending, waiting, fingerprint, set, caseName, retestCaseKey]);

  return <div className="rc-actions" data-no-timer>
    <button type="button" className="rc-action rc-action--ghost" disabled={!!waiting} aria-busy={!!waiting}
      onClick={event => {
        if (pairPending || pairTraining) setWaiting(event.currentTarget);
        else openDraft(owner, summary, event.currentTarget, !!followUp);
      }}>
      {tr(waiting && summary.evidence?.wholeSolve ? {zh:'正在准备整局复盘…',en:'Preparing full solve report…'}
        : waiting ? (['OLL','PLL','ZBLL','LL'].includes(summary.focus?.label ?? '')
        ? {zh:'正在确认本局公式…', en:'Identifying the recorded case…'}
        : { zh: '正在准备同槽对照…', en: 'Preparing the same-slot comparison…' })
        : summary.evidence?.wholeSolve ? {zh:'在 Agent 中查看整局复盘', en:'Open full solve report in Agent'}
        : followUp ? { zh: '在 Agent 里追问', en: 'Ask Agent a follow-up' }
        : { zh: '用 Agent 分析这局', en: 'Analyze this solve with Agent' })}
    </button>
  </div>;
}
