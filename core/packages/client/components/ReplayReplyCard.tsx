'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { assistantAlgorithmSelection } from '@cuberoot/shared/site-assistant-algorithms';
import type { ReplayF2lCases } from '@cuberoot/shared/site-assistant-replay';
import type { ReplayReply } from '@/lib/assistant-conversations';
import { loadLibrarySource } from '@/lib/alg-library-cache';
import { CfopStageTable, wholeSolveCoaching } from '@cuberoot/timer-ui/reconstruct-report';
import { useT } from '@/hooks/useT';
import { visualCubeSchemeForOrientation } from '@/lib/cube-orientation';
import { VisualCube } from './VisualCube';
import { CaseThumb } from './CaseThumb';
import MoreToggle from './MoreToggle';
import { isReplayReturnPath } from '@/lib/replay-training-session';
import { recordingRotation, reviewAlg, reviewCamera, reviewSlotYaw } from '@cuberoot/timer-ui/reconstruct/replay-view';
import ReplayTimeline from './ReplayTimeline';
import ReplayTransferComparison from './ReplayTransferComparison';
import ReplayStageCard from './ReplayStageCard';
import './replay-reply.css';

const Player = dynamic(() => import('./AlgPlayer'), {ssr:false});
const seconds = (value: number) => (value / 1000).toFixed(3);
type Stage = ReplayReply['summary']['stages'][number];

function LibraryCase({target, fallback}: {target?: ReplayF2lCases['recorded']; fallback?: string}) {
  const [item, setItem] = useState<{name:string; alg: NonNullable<ReturnType<typeof assistantAlgorithmSelection>>}>();
  useEffect(() => {
    let active = true;
    setItem(undefined);
    if (target) void loadLibrarySource('3x3',target.set).then(file => {
      const c = file.cases.find(c => c.id === target.id);
      const alg = c && assistantAlgorithmSelection(c, '3x3', target.set, 0);
      if (active && c && alg) setItem({name:c.name, alg});
    }).catch(() => {});
    return () => { active = false; };
  }, [target]);
  return item && target ? <span className="rr-case"><CaseThumb puzzle="3x3" set={target.set} local size={44}
    sticker={item.alg.sticker} alg={item.alg.alg} setup={item.alg.setup} alt={item.name}/><b>{item.name}</b></span> : fallback ? <h4>{fallback}</h4> : null;
}

function Bars({rows, neutral=false}: {rows:[string,number][]; neutral?:boolean}) {
  const t=useT();
  const max=Math.max(1,...rows.map(([,ms])=>ms));
  return <div className="rr-bars">{rows.map(([label,ms],i)=><div className="rr-bar" key={label}>
    <span>{label}</span><i aria-hidden="true"><b data-tone={i ? 'baseline' : neutral ? 'neutral' : 'accent'} style={{width:100*ms/max+'%'}}/></i>
    <strong>{seconds(ms)} {t('秒','s')}</strong></div>)}</div>;
}

function Pair({stage, action, target, rotation}: {stage: Stage; rotation?: string; action?: ReactNode; target?: ReplayF2lCases['recorded']}) {
  const t=useT();
  const [playing,setPlaying]=useState(false);
  const lines=[{label:t('原解','Recorded'),alg:stage.original,count:stage.refUserTurns},
    {label:t('同槽参考','Same-slot reference'),alg:stage.refSolution,count:stage.refTurns}];
  const saved=stage.refUserTurns != null && stage.refTurns != null ? stage.refUserTurns-stage.refTurns : null;
  return <section className="rr-panel" data-site-surface="panel">
    <div className="rr-heading"><h4>{stage.label} · {t('同槽对照','Same-slot comparison')}</h4>
      {saved != null && <small>{saved>0 ? t(`参考少 ${saved} 步`,`${saved} fewer reference moves`) : saved===0 ? t('步数相同','Equal move counts') : t(`参考多 ${-saved} 步`,`${-saved} more reference moves`)}</small>}</div>
    <div className="rr-pair-meta"><LibraryCase target={target}/><p className="rr-caption">{stage.slot} · HTM{stage.range && stage.cumulativeMs != null && ` · ${seconds(stage.range.startMs)}–${seconds(stage.cumulativeMs)} ${t('秒','s')}`}</p></div>
    <div className="rr-lines">{lines.map(line=><div key={line.label}>
      {stage.setup && !playing && <VisualCube scheme={visualCubeSchemeForOrientation('')} setup={[reviewAlg(stage.setup, '', rotation).setup, reviewSlotYaw[stage.slot ?? '']].filter(Boolean).join(' ')} view="iso" size={48} local alt={t('同一起始局面','Shared starting position')}/>}
      <span><strong>{line.label} · {t(`${line.count} 步`,`${line.count} moves`)}</strong><code dir="ltr">{line.alg}</code></span>
      {stage.setup && playing && line.alg && <Player puzzle="3x3" set="" sceneRot={reviewCamera(stage.slot)} {...reviewAlg(stage.setup, line.alg, rotation)} size={170} moveDurationMs={450}/>}</div>)}</div>
    <div className="rr-actions">{stage.setup && <button type="button" aria-expanded={playing} onClick={()=>setPlaying(!playing)}>{playing ? t('收起回放','Close players') : t('对照回放','Compare playback')}</button>}{action}</div>
  </section>;
}

export default function ReplayReplyCard({report,recordedAction,retestAction,children}: {
  report: ReplayReply; recordedAction?: ReactNode; retestAction?: ReactNode; children: ReactNode;
}) {
  const t=useT();
  const {summary,cases}=report;
  const recording = report.origin?.recording;
  const cfop = summary.method?.toUpperCase() === 'CFOP';
  const rotation = useMemo(() => summary.reviewRotation ?? (cfop && recording ? recordingRotation(recording) : undefined), [summary.reviewRotation, cfop, recording]);
  const cardId=useId();
  const evidence=summary.evidence;
  const training=evidence?.training;
  const retest=training?.retest;
  const stage=summary.stages.find(s=>s.label===summary.focus?.label);
  const hasTraining=Boolean(training?.drills.length || retest || (recordedAction && !stage?.zbll) || retestAction);
  const [view,setView]=useState<'analysis'|'training'>(report.afterPractice && hasTraining ? 'training' : 'analysis');
  const [playingStage, setPlayingStage] = useState<string>();
  const obs=evidence?.observation, priority=evidence?.priority;
  const stages=summary.stages.filter(s=>s.stepMs != null && s.stepMs>=0);

  const goal=summary.focus?.goal ?? 'stepMs';
  const goalName = {stepMs:t('阶段用时','Stage time'), recognitionMs:t('起手前用时','Time before execution'),
    executionMs:t('执行用时','Execution time'), turns:t('步数','Move count')}[goal];
  const coach = evidence?.wholeSolve && wholeSolveCoaching(stages, summary.timeMs, evidence.freePairs ?? 0, copy => t(copy.zh,copy.en));
  const pair=stage?.slot && stage.original && stage.refSolution && stage.refTurns!=null && stage.refUserTurns!=null;
  const focus=stage?.label ?? summary.method;
  const name=stage?.label==='F1' ? t('第一对','pair 1') : focus;
  const drillName=training?.drills[0]?.name;
  const title=view==='training' ? (drillName && retest?.name ? t(`${drillName} 专项与 ${retest.name} 复测`, `${drillName} drill and ${retest.name} retest`) : t('专项成绩与复测','Drill and retest results'))
    : evidence?.wholeSolve ? t('整局复盘','Whole-solve review')
    : priority && stage ? t(`回看${name}，长期练${priority.name}`,`Review ${name} · Practise ${priority.name}`)
    : t(`${name ?? ''} 复盘分析`,`${name ?? ''} solve review`);
  const rows=(label:string,times:string[],key:string)=><tr key={key}><th scope="row">{label}</th><td>{times.join(' · ') || '—'}</td></tr>;
  return <section className="replay-reply" aria-label={t('复盘报告','Solve report')}>
    <div className="rr-kicker">{t('智能复盘','Solve review')} · {summary.method}</div>
    <header><div><h3>{title}</h3>{view==='analysis' && evidence?.selected!=null && <p>{t(`个人基线取自 ${evidence.selected} 局复盘`,`Personal baseline from ${evidence.selected} solves`)}</p>}{view==='training' && <p>{t('本局关联训练','Practice linked to this solve')}</p>}</div>
      <strong className="rr-time">{seconds(summary.timeMs)} <small>{t('秒','s')} {summary.penalty!=='ok' && summary.penalty}</small></strong></header>
    {hasTraining && <div className="rr-switch" role="group" aria-label={t('报告视图','Report view')}>{(['analysis','training'] as const).map(v=><button key={v} type="button" aria-pressed={v===view}
      onClick={()=>setView(v)}>{v==='analysis' ? t('本局分析','Solve analysis') : t('训练复测','Practice and retest')}</button>)}</div>}
    {view==='analysis' && coach && stages.length>0 && <ReplayTimeline report={report} coach={coach} compare={s=>{
      setPlayingStage(s.key);
      requestAnimationFrame(() => document.getElementById(cardId+'-'+s.key)?.scrollIntoView({block:'start'}));
    }}/>}
    <ReplayTransferComparison summary={summary} origin={report.origin}/>
    {view==='analysis' ? <>
      {evidence?.wholeSolve && <section className="rr-panel" data-site-surface="panel">
        {coach && <>
          {coach.strength && <p><strong>{t('做得好','Strength')} · </strong>{coach.strength}</p>}{coach.timing && <p>{coach.timing}</p>}</>}
        {summary.stm != null && summary.tps != null && <p>{summary.stm} STM · {summary.tps.toFixed(2)} TPS</p>}
        {summary.stages.length === 0 && <p>{summary.notes?.join(' ') || t('没有可靠的分阶段用时。','Reliable stage timings are unavailable.')}</p>}
        {!!summary.stages.length && <CfopStageTable stages={summary.stages} tr={copy => t(copy.zh, copy.en)}/>}
         {!!evidence.excluded?.length && <p>{t('未计入用时比较','Excluded from timing comparisons')} · {evidence.excluded.join(', ')}</p>}
        {!!evidence.freePairs && <p>{t(`十字已带入 ${evidence.freePairs} 对 F2L，用时计入十字。`,`${evidence.freePairs} F2L pairs were solved with the cross.`)}</p>}
        {!!evidence.skipped?.length && <p>{t('跳过阶段','Skipped stages')} · {evidence.skipped.join(', ')}</p>}
      </section>}
      {evidence?.wholeSolve && summary.stages.filter(s => s.key).map(s => <ReplayStageCard id={cardId+'-'+s.key} key={s.key} stage={s} splitLastLayer={summary.stages.some(item => item.key === 'pll' && !!item.turns)} origin={report.origin} cfop={cfop} rotation={rotation} finding={evidence.stageFindings?.[s.label]}
        playing={playingStage === s.key} toggle={() => setPlayingStage(playingStage === s.key ? undefined : s.key)}/>)}
      <div className="rr-grid">{stage && <article className="rr-panel" data-site-surface="panel"><small>{t('本局观察','This solve')}</small>
        <h4>{stage.label} · {obs?.metric ?? goalName}{obs?.slower && t('偏慢',' was slower')}</h4>
        {obs ? <><Bars rows={[[t('本局','This solve'),obs.current],[t('同类基线','Baseline'),obs.baseline]]}/><p>{obs.note}</p></>
        : <><strong>{stage[goal]!=null && (goal==='turns' ? stage.turns+' HTM' : seconds(stage[goal]!)+' '+t('秒','s'))}</strong>
          <p>{evidence?.observationNote}</p></>}</article>}
        <article className="rr-panel" data-site-surface="panel"><small>{t('长期重点','Recurring target')}</small>
          {priority ? <><h4>{priority.name} · {priority.metric}</h4><Bars neutral rows={[[t(`近期 ${priority.recentCount} 局`,`Recent ${priority.recentCount}`),priority.recent],
            [t(`以往 ${priority.earlierCount} 局`,`Earlier ${priority.earlierCount}`),priority.earlier]]}/>
            <p>{t(`近期有 ${priority.slowerCount}/${priority.recentCount} 局超过慢速门槛。`,`${priority.slowerCount} of the last ${priority.recentCount} exceeded the slowdown threshold.`)}</p><p>{priority.instruction}</p></>
            : <p>{evidence?.historyFinding ?? t('选择个人历史后，可判断问题是否重复出现。','Select personal history to check whether the issue recurs.')}</p>}</article></div>
      {!evidence?.wholeSolve && stages.length>0 && <section className="rr-panel" data-site-surface="panel"><div className="rr-heading"><h4>{t('分段总览','Stage overview')}</h4><small>{t('阶段用时 · 秒','Stage times · s')}</small></div>
        <div className="rr-legend">{stages.map(s=><span data-current={s===stage} key={s.label} style={{flexGrow:s.stepMs ?? 0}}><i aria-hidden="true"/><b>{s.label==='Cross' ? t('十字','Cross') : s.label}</b> {((s.stepMs ?? 0)/1000).toFixed(2)}</span>)}</div>
        {!!evidence?.excluded?.length && <p>{t(`下列阶段已从用时比较中排除：${evidence.excluded.join("、")}`,`Excluded from timing comparisons: ${evidence.excluded.join(", ")}`)}</p>}</section>}
      {!evidence?.wholeSolve && stage?.zbll && <ReplayStageCard stage={stage} origin={report.origin} cfop={cfop} rotation={rotation} playing={playingStage===stage.key}
        toggle={() => setPlayingStage(playingStage===stage.key ? undefined : stage.key)}/>}
      {pair && stage ? <Pair stage={stage} rotation={rotation} action={recordedAction} target={cases?.recorded}/> : !stage?.zbll && recordedAction}
    </> : <>
      <div className="rr-grid">{(training?.drills.length || recordedAction) ? <article className="rr-panel" data-site-surface="panel">
        <small>{t('本局专项','This solve’s drill')} · {focus}</small><LibraryCase target={cases?.recorded} fallback={training?.drills[0]?.name}/>
        {training?.drills.length ? training.drills.map((d,i)=><div key={i}><small>{training.drills.length > 1 ? d.name+' · ' : ''}{d.clock}</small><p>{t('专项总用时中位数','Median drill time')}</p>
          <strong className="rr-number">{d.medianMs!=null ? seconds(d.medianMs)+' '+t('秒','s') : '—'}</strong>
          <p>{t(`有效 ${d.valid}/${d.total} 次`,`${d.valid}/${d.total} valid attempts`)}</p></div>) : <p>{t('尚无从本局入口记录的专项成绩。','No drills recorded from this solve yet.')}</p>}
        <div className="rr-actions">{recordedAction}</div></article> : null}
        {(retest || retestAction) && <article className="rr-panel" data-site-surface="panel"><small>{t('训练复测','Practice retest')}{retest && ' · '+retest.metric}</small><LibraryCase target={cases?.retest} fallback={retest?.name}/>
          {retest && <><div className="rr-median"><div><small>{t('练前中位数','Before')}</small><strong>{retest.beforeMs!=null ? seconds(retest.beforeMs) : '—'}</strong></div>
            <span>→</span><div><small>{t('练后中位数','After')}</small><strong>{retest.afterMs!=null ? seconds(retest.afterMs) : '—'}</strong></div><small>{t('秒','s')}</small></div>
            <p>{t(`练前 ${retest.before.length}/5，练后 ${retest.after.length}/5`,`Before ${retest.before.length}/5, after ${retest.after.length}/5`)}</p>
            <p>{t(`有效成绩：练前 ${retest.beforeValid} 次，练后 ${retest.afterValid} 次`,`Valid attempts: ${retest.beforeValid} before, ${retest.afterValid} after`)} · {retest.manual ? t('手工记录','Manual entry') : t('训练器记录','Trainer')}</p>
            {retest.beforeMs!=null && retest.afterMs!=null && <p>{retest.afterMs===retest.beforeMs ? t('两组中位数相同','Equal medians') : t(`用时${retest.afterMs<retest.beforeMs?'缩短':'增加'} ${seconds(Math.abs(retest.afterMs-retest.beforeMs))} 秒`,`Median time ${retest.afterMs<retest.beforeMs?'decreased':'increased'} by ${seconds(Math.abs(retest.afterMs-retest.beforeMs))} s`)}</p>}
            {retest.extra>0 && <p>{t(`复测后另练 ${retest.extra} 次`,`${retest.extra} further attempts after retest`)}</p>}</>}
          <div className="rr-actions">{retestAction}</div></article>}</div>
      {stage && obs && priority && <section className="rr-panel" data-site-surface="panel">
        <h4>{t('下一局看什么','What to check next solve')}</h4>
        <p>{t(`记录${name}的${obs.metric}和${priority.name}的${priority.metric}，再与个人基线比较。`, `Compare ${name} ${obs.metric} and ${priority.name} ${priority.metric} with your baseline in the next solve.`)}</p>
      </section>}
      {(training?.drills.length || retest) ? <details><MoreToggle as="summary" animate={false}>{t('查看逐次成绩（秒）','Attempt times (seconds)')}</MoreToggle><table><tbody>
        {training?.drills.map((d,i)=>rows(d.name+(d.total>d.times.length?t('（最近 20 次）',' (last 20)'):''),d.times,'drill'+i))}
        {retest && <>{rows(retest.name+' · '+t('练前','Before'),retest.before,'before')}{rows(retest.name+' · '+t('练后','After'),retest.after,'after')}</>}</tbody></table></details> : null}
    </>}
    <details><MoreToggle as="summary" animate={false}>{t('完整分析与判断依据','Full analysis and evidence')}</MoreToggle>{children}</details>
    {report.origin && isReplayReturnPath(report.origin.returnPath) && <div className="rr-actions"><a className="site-assistant-action" href={report.origin.returnPath}>{t('回到本局继续复盘','Return to this solve')}</a></div>}
  </section>;
}
