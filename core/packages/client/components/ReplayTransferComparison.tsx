'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { MIN_TRANSFER_SOLVES, transferReading, executionExamples } from '@cuberoot/timer-ui/reconstruct/replay-coaching';
import type { F2lTransferHit } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import type { ReplayReply } from '@/lib/assistant-conversations';
import { GuidedResults, StagePractice } from './ReplayStageCard';
import { useT } from '@/hooks/useT';

const SegmentPlayer = dynamic(() => import('./ReplayTransferPlayer'), {ssr: false});
const ExecutionPair = dynamic(() => import('./ReplayExecutionPair'), {ssr: false});
const seconds = (value: number | null) => value == null ? '—' : (value / 1000).toFixed(3);

export default function ReplayTransferComparison({summary,origin}: Pick<ReplayReply, 'summary'|'origin'>) {
  const t = useT();
  const [selected, setSelected] = useState<{hit: F2lTransferHit; title: string; run: number}>();
  const [openPair, setOpenPair] = useState<string>();
  const pairAnchor = useRef<HTMLDivElement>(null);
  useEffect(()=>{ if (openPair) pairAnchor.current?.scrollIntoView({block:'start'}); },[openPair]);
  const cases = summary.stages.flatMap(stage => (stage.transfer ?? []).flatMap(row =>
    row.comparison ? [{...row, comparison: row.comparison, stage}] : []));
  const paired = cases.find(row => row.stage.key+row.role+row.name === openPair);
  const pairHits = paired && executionExamples(paired.comparison);
  if (!cases.length) return null;
  return <section className="rr-transfer" aria-label={t('练前练后整局对照','Full solves before and after practice')}>
    <h4>{t('练前练后整局对照','Full solves before and after practice')}</h4>
    <div className="rr-grid">{cases.map(({stage, name, role, comparison, set, caseId, goals, previousRounds}) => {
      const {before, after} = comparison;
      const periods = [['before', before, t('练前','Before')], ['after', after, t('练后','After')]] as const;
      const caseName = name.replace(/-$/, '−');
      const reading=transferReading(comparison,copy=>t(copy.zh,copy.en));
      const examples=executionExamples(comparison);
      function show(hit:F2lTransferHit) {
        setOpenPair(undefined);
        setSelected(previous=>({hit,title:caseName+' · '+seconds(hit.timeMs)+' s · '+hit.label+' '+hit.slot,run:(previous?.run ?? 0)+1}));
      }
      return <article key={stage.key+role+name} className="rr-panel" data-case={name} data-site-surface="panel">
        <small>{stage.label} · {role === 'recorded' ? t('本局专项','Recorded case') : t('复测公式','Retest case')}</small>
        <h4>{caseName}{!!previousRounds?.length && <small> · {t('本轮','Current round')}</small>}</h4>
        {reading && <p>{reading}</p>}
        <table aria-label={caseName}><thead><tr><th scope="col">{t('指标','Metric')}</th>
          {periods.map(([key,,label]) => <th key={key} scope="col">{label}</th>)}</tr></thead><tbody>
          <tr><th scope="row">{t('筛查整局','Solves reviewed')}</th><td>{before.reviewed}</td><td>{after.reviewed}</td></tr>
          <tr><th scope="row">{t('命中局数','Matching solves')}</th><td>{before.count}</td><td>{after.count}</td></tr>
          <tr><th scope="row">{t('起手前中位数（秒）','Median entry (s)')}</th><td>{seconds(before.recognitionMs)}</td><td>{seconds(after.recognitionMs)}</td></tr>
          <tr><th scope="row">{t('执行中位数（秒）','Median execution (s)')}</th><td>{seconds(before.executionMs)}</td><td>{seconds(after.executionMs)}</td></tr>
        </tbody></table>
        {periods.map(([key, period, label]) => period.count < MIN_TRANSFER_SOLVES && <p key={key}>
          <strong>{t(label+'样本不足',label+' · limited sample')}</strong>
          {t('，至少需要 '+MIN_TRANSFER_SOLVES+' 局同公式记录。',' · At least '+MIN_TRANSFER_SOLVES+' matching solves needed.')}</p>)}
        {examples.length>0 && <div className="rr-actions"><button type="button" aria-expanded={openPair===stage.key+role+name}
          onClick={()=>{setSelected(undefined);setOpenPair(openPair===stage.key+role+name ? undefined : stage.key+role+name);}}>
          {openPair===stage.key+role+name ? t('收起对照','Close comparison') : t('并排回放','Compare replays')} · {examples[0].label} / {examples[1].label} · {examples[0].slot}
        </button></div>}
        {origin && set && caseId && openPair!==stage.key+role+name && (reading || after.count>=MIN_TRANSFER_SOLVES) && <div className="rr-actions"><StagePractice stage={stage} origin={origin} exact={{set,id:caseId,name}}
          executionHit={examples[1]} slot={examples[1]?.slot ?? stage.slot} practiceRole={role} goal={examples.length || after.executionMs!=null && before.executionMs!=null && after.executionMs>before.executionMs ? 'execution' : 'recognition'}/></div>}
        <GuidedResults goals={goals}/>
        {previousRounds?.map(({start,comparison:c},i)=><details key={start} className="rr-prior-round"><summary>
          {t('第 '+(i+1)+' 轮','Round '+(i+1))} · {t('练后命中 '+c.after.count+' 局',c.after.count+' matching solves after practice')}</summary>
          <p>{t('练前 → 练后','Before → after')} · {c.before.count} → {c.after.count} {t('局','solves')}</p>
          <p>{t('起手前中位数','Median entry')} {seconds(c.before.recognitionMs)} → {seconds(c.after.recognitionMs)} s
            {' · '}{t('执行中位数','Median execution')} {seconds(c.before.executionMs)} → {seconds(c.after.executionMs)} s</p>
          {Math.min(c.before.count,c.after.count)<MIN_TRANSFER_SOLVES && <small>{t('样本不足','Limited sample')}</small>}
          <div className="rr-actions">{c.after.hits.map(hit=><button type="button" key={hit.solveId+':'+hit.range.firstMoveIndex}
            onClick={()=>show(hit)}>▷ {seconds(hit.timeMs)} s · {hit.label} {hit.slot}</button>)}</div>
        </details>)}
        {periods.map(([key, period, label]) => period.hits.length > 0 && <details key={key} open={key === 'after'}>
          <summary>{t(label+'命中记录',label+' · matching segments')} · {period.hits.length}</summary>
          <div className="rr-actions">{period.hits.map(hit => {
            const title = caseName+' · '+seconds(hit.timeMs)+' s · '+hit.label+' '+hit.slot;
            return <button key={hit.solveId+':'+hit.range.firstMoveIndex} type="button"
              data-solve={hit.solveId} aria-label={t('回放 ','Play ')+title}
              onClick={() => show(hit)}>
              ▷ {seconds(hit.timeMs)} s · {hit.label} {hit.slot}</button>;
          })}</div></details>)}
      </article>;
    })}</div>
    {paired && pairHits?.length===2 && <div ref={pairAnchor}><ExecutionPair key={openPair} name={paired.name} examples={pairHits} comparison={paired.comparison}
      practice={clip => origin && paired.set && paired.caseId && <StagePractice stage={paired.stage} origin={origin}
        exact={{set:paired.set,id:paired.caseId,name:paired.name}} slot={clip.hit.slot} execution={clip} practiceRole={paired.role} goal="execution"/>}/></div>}
    {selected && <div className="rr-panel rr-transfer-player" key={selected.run}>
      <div className="rr-heading"><strong>{selected.title}</strong><button type="button" onClick={() => setSelected(undefined)}>{t('收起回放','Close replay')}</button></div>
      <p>{t('整局时间轴','Full solve timeline')} {seconds(selected.hit.range.startMs)}–{seconds(selected.hit.range.endMs)} s
        {' · '}{t('起手前','Entry')} {seconds(selected.hit.recognitionMs)} s · {t('执行','Execution')} {seconds(selected.hit.executionMs)} s</p>
      <SegmentPlayer hit={selected.hit}/>
    </div>}
  </section>;
}
