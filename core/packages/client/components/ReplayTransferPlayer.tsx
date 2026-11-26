'use client';

import { useEffect, useMemo, useRef } from 'react';
import { readSegment, segment } from '@/lib/replay-recorded-segment';
import type { F2lTransferHit } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import type { CfopReplayRange } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import PlaybackPanel from '@cuberoot/timer-ui/reconstruct/PlaybackPanel';
import { ReconstructHostContext, useReconstructHost } from '@cuberoot/timer-ui/reconstruct/ReconstructHost';
import '@cuberoot/timer-ui/reconstruct-report.css';
import type { ReplayRecording } from '@/lib/assistant-conversations';
import { tr, useLang } from '@/i18n/tr';

type Source = {hit:F2lTransferHit; recording?:never; range?:never; slot?:never; cfopStage?:never; rotation?:never} | {hit?:never; recording:ReplayRecording; range:CfopReplayRange; slot?:string; cfopStage?:string; rotation?:string};
export default function ReplayTransferPlayer({hit, recording, range, slot, cfopStage, rotation}: Source) {
  const host = useReconstructHost();
  const lang = useLang();
  const clip = useMemo(() => hit ? readSegment(hit) : segment(recording, range, cfopStage !== undefined, rotation), [hit, recording, range, cfopStage, rotation]);
  const play = useRef<((range: CfopReplayRange) => void) | null>(null);
  useEffect(() => {
    if (clip) play.current?.({firstMoveIndex:0, endMoveIndex:clip.moves.length-1, startMs:0, endMs:clip.duration});
  }, [clip]);
  if (!clip) return <p role="status">{tr({zh:'此设备上找不到对应的原始转动记录。', en:'The original move recording is unavailable on this device.'})}</p>;
  return <ReconstructHostContext.Provider value={{...host, localize:tr}}>
    <PlaybackPanel event="333" scramble={clip.setup} moves={clip.moves} totalMs={clip.duration}
      recordedView={clip.rotation !== undefined ? {rotation:clip.rotation, slot:hit?.slot ?? slot, label:cfopStage} : undefined}
      allowRearView={['BL','BR'].includes(hit?.slot ?? slot ?? '')} replayRangeRef={play} isZh={lang === 'zh'}/>
  </ReconstructHostContext.Provider>;
}
