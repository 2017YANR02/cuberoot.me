'use client';

import { useClipboardFeedback } from '../browser-clipboard';
import ReportContent from './ReportContent';
import { reportActions, initialReportUI } from './report-content';
import type { Solve } from '@cuberoot/shared/timer';
import type { ReconstructHost } from './ReconstructHost';
import type { ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';

interface ReconstructActionsProps {
  host: ReconstructHost;
  solve: Solve;
  onUseScramble?: (scramble: string) => void;
  placement: 'detail' | 'report' | 'recap';
  snapshot?: ReconSnapshot | null;
}

/** Share and retry actions shared by the inline recap, full detail, and report. */
export default function ReconstructActions({
  host, solve, onUseScramble, placement, snapshot = null,
}: ReconstructActionsProps) {
  const { copy, feedback } = useClipboardFeedback(solve.id, host.writeClipboardText);
  const ui = { ...initialReportUI(), copied: feedback?.copied ? feedback.target : null };
  const actions = reportActions(solve, host.localize, ui, Boolean(onUseScramble), placement, 'copy', Boolean(host.replayUrl));
  const intakeActions = host.renderIntakeAction?.(solve, snapshot);
  if (placement === 'report' && intakeActions) {
    actions.children = [...(actions.children ?? []), { id: 'intake-actions', kind: 'slot' }];
  }
  return <><ReportContent node={actions} slots={{ 'intake-actions': intakeActions }} dispatch={action=>{
    if(action.type==='use-scramble')onUseScramble?.(solve.scramble);
    if(action.type==='share')void (async()=>{
      try {
        const url = await host.replayUrl?.(solve);
        if (!url) return;
        if (!await copy(url, 'share')) console.warn('[reconstruct] copy share link failed');
      }catch(err){console.warn('[reconstruct] copy share link failed:',err);}
    })();
  }}/>{placement !== 'report' && intakeActions}</>;
}
