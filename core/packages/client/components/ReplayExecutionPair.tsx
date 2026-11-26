'use client';

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Play, Pause } from '@app-foundation/icons/lucide';
import { reviewCamera, reviewColorPrefix } from '@cuberoot/timer-ui/reconstruct/replay-view';
import SimCubeView from '@cuberoot/timer-ui/SimCubeView';
import type { F2lTransferComparison, F2lTransferHit } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import { readExecution } from '@/lib/replay-recorded-segment';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';

type Execution = NonNullable<ReturnType<typeof readExecution>>;
const sec = (ms: number) => (ms / 1000).toFixed(3);

const ExecutionLane = memo(function ExecutionLane({clip, index, playing, practice}: {clip: Execution; index: number; playing: boolean; practice:ReactNode}) {
  const t = useT();
  const lang = useLang();
  const {hit, first, moves, turns, gap} = clip;
  const log = useMemo(() => [...[reviewColorPrefix(clip.rotation), clip.setup].filter(Boolean).join(' ').trim().split(/\s+/), ...moves.slice(0,index + 1).map(move => move.m)], [clip.setup,clip.rotation,moves,index]);
  const nextGap = moves[index + 1] ? moves[index + 1].ts - moves[index].ts : 100;
  return <div className="rr-exec-lane" data-stage={hit.label} data-action={first + index}>
    <h5>{hit.label} · {hit.slot}</h5>
    <strong className="rr-exec-time">{sec(hit.executionMs)} <small>s</small></strong>
    <small>{sec(hit.timeMs)} s {t('整局','solve')} · {t('起手前','Entry')} {sec(hit.recognitionMs)} s</small>
    <SimCubeView moves={log} pose={clip.rotation} sceneRot={reviewCamera(hit.slot)} language={lang} animate={playing} moveDurationTicks={Math.max(1, Math.min(nextGap, 160) * 0.06)}
      ariaLabel={hit.label+' '+t('实录回放','recorded replay')}/>
    <b>{t(`执行 ${turns} 步`,`${turns} executed turns`)}</b>
    <small>{t(`段内动作 ${first}–${first + moves.length - 1}`,`Stage moves ${first}–${first + moves.length - 1}`)}</small>
    <div className="rr-exec-moves" dir="ltr">{moves.map((move,i)=><code key={i} aria-current={i===index?'step':undefined}
      data-gap={gap && (i===gap.from || i===gap.to) || undefined}>{move.m}</code>)}</div>
    {gap && <p>{t('最长动作间隔','Longest gap')} <b>{sec(gap.ms)} s</b><br/>
      {first+gap.from}→{first+gap.to} · <code>{moves[gap.from].m} → {moves[gap.to].m}</code></p>}
    <div className="rr-actions">{practice}</div>
  </div>;
});

function Comparison({slow, fast, name, practice, cohort}: {slow: Execution; fast: Execution; name: string; practice:ReactNode[]; cohort: ReactNode}) {
  const t = useT();
  const duration = Math.max(slow.hit.executionMs,fast.hit.executionMs);
  const difference = slow.hit.executionMs - fast.hit.executionMs;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const clock = useRef(0);
  function seek(ms: number) {
    setPlaying(false);
    clock.current = ms;
    setElapsed(ms);
  }
  useEffect(()=>{
    if (!playing) return;
    const zero = performance.now() - clock.current;
    let frame: number;
    const tick = (now:number) => {
      clock.current = Math.max(0, Math.min(duration, now - zero));
      setElapsed(clock.current);
      if (clock.current >= duration) setPlaying(false);
      else frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[duration,playing]);
  const loop = slow.loop;
  const loopMoves = loop && slow.moves.slice(loop.from + 1, loop.to + 1).map(move=>move.m).join(' ');
  const gap = slow.gap;
  const share = loop && !fast.loop && loop.ms <= difference ? Math.round(100 * loop.ms / difference) : undefined;
  return <section className="rr-panel rr-exec-pair" data-site-surface="panel" aria-label={name+' '+t('同槽执行对照','same-slot execution comparison')}>
    <h4>{name} · {slow.hit.slot} {t('同槽执行对照','execution comparison')}</h4>
    {cohort}
    <p>{t('练后两局从执行起点同步。执行用时相差','Two post-practice solves aligned at execution onset. Execution differs by')} <b>{sec(difference)} s</b></p>
    <div className="rr-exec-grid">{[slow, fast].map((clip, i) => {
      // Native range inputs round fractional milliseconds at the end of a recording.
      const next = clip.moves.findIndex(move => move.ts - elapsed > 0.001);
      return <ExecutionLane key={clip.hit.solveId} practice={practice[i]} clip={clip} index={next < 0 ? clip.moves.length-1 : Math.max(0,next-1)} playing={playing}/>;
    })}</div>
    <div className="rr-exec-controls rr-actions">
      <button type="button" onClick={()=>{if (!playing && clock.current>=duration) seek(0); setPlaying(!playing);}}>
        {playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? t('暂停','Pause') : t('同步回放','Play both')}</button>
      <input type="range" min={0} max={duration} step="any" value={elapsed} onChange={e=>seek(Number(e.target.value))}
        aria-label={t('同步执行时间','Shared execution time')} aria-valuetext={sec(elapsed)+' s'}/>
      <output>{sec(elapsed)} s</output>
    </div>
    <small>{t('动作按原始记录编号；实转步数将同向双拨计为一步。','Numbers follow the recorded moves. Two same-direction quarter turns count as one executed turn.')}</small>
    {loop && <p><b>{t('折返','Retraced moves')}</b> · {slow.hit.label} {t(`第 ${slow.first+loop.from+1}–${slow.first+loop.to} 个动作`,`moves ${slow.first+loop.from+1}–${slow.first+loop.to}`)} <code>{loopMoves}</code>
      {t(` 回到了第 ${slow.first+loop.from} 个动作后的局面，耗时 ${sec(loop.ms)} 秒。`,` returned to the state after move ${slow.first+loop.from}, taking ${sec(loop.ms)} s.`)}
      {share != null && t(`这段折返占两段执行用时差的 ${share}%。`,` This accounts for ${share}% of the time difference between these two executions.`)}</p>}
    {gap && <p><b>{t('专项训练','Practice')}</b> · {t(`先回看 ${slow.hit.label} 第 ${slow.first+gap.from}→${slow.first+gap.to} 个动作，再看 ${fast.hit.label} 的路线。`,`Review moves ${slow.first+gap.from}→${slow.first+gap.to} in ${slow.hit.label}, then watch the route in ${fast.hit.label}. `)}
      {loop ? t('练前先说出入槽方向，连续做对 5 次。记录折返次数和执行中位数，再用新打乱复测。','Confirm the insertion direction, then complete five correct repetitions. Track returns and median execution time, then retest on fresh scrambles.') : t('把间隔两侧的动作连练 5 次，复测最长间隔和执行用时中位数。','Link the two turns across the gap five times, then remeasure the longest gap and median execution time.')}</p>}
    <div className="rr-actions">{gap && <button type="button" onClick={()=>seek(slow.moves[gap.from].ts)}>{t('定位最长间隔','Seek to longest gap')}</button>}</div>
  </section>;
}

export default function ReplayExecutionPair({examples, name, practice, comparison}: {examples: F2lTransferHit[]; name: string; practice:(clip:Execution)=>ReactNode; comparison: F2lTransferComparison}) {
  const t = useT();
  const [slowHit, fastHit] = examples;
  const slow = useMemo(()=>readExecution(slowHit),[slowHit]);
  const fast = useMemo(()=>readExecution(fastHit),[fastHit]);
  if (!slow || !fast) return <p role="status">{t('此设备缺少可核对的两段实录，无法并排回放。','Both verified recordings are required on this device for side-by-side playback.')}</p>;
  const {before, after} = comparison;
  const inSlot = (period: typeof before) => new Set(period.hits.filter(hit=>hit.slot===slowHit.slot).map(hit=>hit.solveId)).size;
  const beforeCount = inSlot(before), afterCount = inSlot(after);
  const cohort = <p className="rr-caption">{before.recognitionMs!=null && after.recognitionMs!=null && t(
    `起手前中位数 ${sec(before.recognitionMs)} → ${sec(after.recognitionMs)} 秒。`,
    `Median entry ${sec(before.recognitionMs)} → ${sec(after.recognitionMs)} s. `)}
    {t(`${slowHit.slot} 占练前 ${beforeCount}/${before.count} 局、练后 ${afterCount}/${after.count} 局。`,
      `${slowHit.slot} occurred in ${beforeCount}/${before.count} matches before and ${afterCount}/${after.count} after. `)}
    {beforeCount===0 && t('尚缺同槽练前样本。','No pre-practice sample in this slot.')}</p>;
  return <Comparison slow={slow} fast={fast} name={name} practice={[practice(slow), practice(fast)]} cohort={cohort}/>;
}
