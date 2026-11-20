'use client';

import { useState } from 'react';
import ReportContent from './ReportContent';
import { reportActions, initialReportUI, reduceReportUI } from './report-content';
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
  const [ui,setUI]=useState(initialReportUI);
  return <><ReportContent node={reportActions(solve,host.localize,ui,Boolean(onUseScramble),placement)} dispatch={action=>{
    if(action.type==='use-scramble')onUseScramble?.(solve.scramble);
    if(action.type==='share')void (async()=>{
      try {
        await host.writeClipboardText(await host.replayUrl(solve));
        setUI(state=>reduceReportUI(state,{type:'copied',key:'share'}));
        setTimeout(()=>setUI(state=>reduceReportUI(state,{type:'copied'})),1500);
      }catch(err){console.warn('[reconstruct] copy share link failed:',err);}
    })();
  }}/>{host.renderIntakeAction?.(solve, snapshot)}</>;
}
