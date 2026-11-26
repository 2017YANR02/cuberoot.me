'use client';

import { ClearButton } from './ClearButton';
import { Play, Columns2 } from '@app-foundation/icons/lucide';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { CfopReplayRange } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import type { wholeSolveCoaching } from '@cuberoot/timer-ui/reconstruct/replay-coaching';
import type { ReplayReply } from '@/lib/assistant-conversations';
import { useT } from '@/hooks/useT';
import { StageTimeline, stageReplayCaption } from '@cuberoot/timer-ui/reconstruct-report';
import { StagePractice } from './ReplayStageCard';

const Player = dynamic(() => import('./ReplayTransferPlayer'), {ssr:false});
type Stage = ReplayReply['summary']['stages'][number];


export default function ReplayTimeline({report, coach, compare}: {
  report:ReplayReply; coach:ReturnType<typeof wholeSolveCoaching>;
  compare:(stage:Stage)=>void;
}) {
  const t = useT();
  const {summary, origin} = report;
  const recording = origin?.recording;
  const [play, setPlay] = useState<{title:string; stage:string; range:CfopReplayRange; slot?:string; run:number}>();
  const stages = summary.stages;
  const focus = stages.find(s => s.label === coach.review?.label);
  const clip = focus?.clips?.find(c => coach.review?.kind === 'entry' ? c.kind === 'transition'
    : coach.review?.kind === 'pause' && c.kind === 'pause' && c.first === coach.review.first);
  function open(stage:Stage, part?:typeof clip) {
    if (!recording || !stage.range || stage.cumulativeMs == null) return;
    const first = part?.first ?? stage.range.first, last = part?.last ?? stage.range.last;
    const startMs = part ? recording.moves[first-2]?.ts ?? 0 : stage.range.startMs;
    const endMs = part ? recording.moves[last-1]?.ts : stage.cumulativeMs;
    if (endMs == null || endMs <= startMs) return;
    playRange(stage,{startMs,endMs,firstMoveIndex:first-1,endMoveIndex:last-1});
  }
  function playRange(stage: Stage, range: CfopReplayRange) {
    const title = stageReplayCaption(stage.label, stage.slot, range, copy=>t(copy.zh,copy.en));
    setPlay(prev => ({title, stage:stage.label, slot:stage.slot, range, run:(prev?.run ?? 0)+1}));
  }
  return <StageTimeline totalMs={summary.timeMs} stages={stages} focus={focus?.label} selected={play?.stage}
    tr={copy=>t(copy.zh,copy.en)} onReplay={recording ? (stage,range)=>playRange(stage,range) : undefined}>
    {(coach.priority || focus) && <div className="rr-time-note">
      {coach.priority && <p>{coach.priority}</p>}
      {focus && <div className="rr-actions">
      {recording && focus.range && <button type="button" className="rr-action rr-time-primary" onClick={()=>open(focus,clip)}><Play size={14} aria-hidden/>{clip?.kind === 'transition'
        ? t('回放衔接','Play transition') : clip?.kind === 'pause' ? t('回放停顿','Play gap') : t('回放 ','Play ')+focus.label}</button>}
      {focus.original && focus.playbackReference && <button className="rr-action" type="button" onClick={()=>compare(focus)}>
        <Columns2 size={14} aria-hidden/>{focus.refUserTurns!=null && focus.refTurns!=null ? t('对照 ','Compare ')+focus.refUserTurns+' / '+focus.refTurns+t(' 步',' HTM') : t('模拟对照','Compare simulations')}</button>}
      {(focus.fingerprint || focus.formula) && <StagePractice stage={focus} origin={origin} goal={clip?.kind==='transition'?'transition':coach.review?.kind==='entry'?'recognition':coach.review?.kind==='route'?'routes':'execution'}/>}
      </div>}
    </div>}
    {play && recording && <div className="rr-timeline-player"><div className="rr-heading"><strong>{play.title}</strong>
      <ClearButton variant="standalone" className="rr-time-close" ariaLabel={t('收起','Close')} onClick={()=>setPlay(undefined)}/></div><Player key={play.run} recording={recording} range={play.range} slot={play.slot} rotation={summary.reviewRotation} cfopStage={summary.method?.toUpperCase() === 'CFOP' ? play.stage : undefined}/></div>}
  </StageTimeline>;
}
