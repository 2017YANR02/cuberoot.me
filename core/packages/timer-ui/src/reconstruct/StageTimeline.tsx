'use client';

import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import type { ReconstructAssistantSummary } from './ReconstructHost';
import type { CfopReplayRange } from './cfop-diagnosis';
import './stage-timeline.css';

type Stage = ReconstructAssistantSummary['stages'][number];
const sec = (ms: number) => (ms / 1000).toFixed(3);

type Translate = (copy: {zh: string; en: string}) => string;

export function stageReplayCaption(label: string, slot: string | undefined, range: CfopReplayRange, tr: Translate) {
  const first = range.firstMoveIndex + 1, last = range.endMoveIndex + 1;
  return [tr({zh:'实录',en:'Recorded'}), label, slot, sec(range.startMs)+'–'+sec(range.endMs)+' s',
    tr({zh:`第 ${first}–${last} 个动作`,en:`Moves ${first}–${last}`})].filter(Boolean).join(' · ');
}

export function stageReplayRange(stage: Stage): CfopReplayRange | undefined {
  const {range, cumulativeMs} = stage;
  if (!range || cumulativeMs == null || cumulativeMs <= range.startMs || range.first < 1 || range.last < range.first) return;
  return {startMs: range.startMs, endMs: cumulativeMs, firstMoveIndex: range.first - 1, endMoveIndex: range.last - 1};
}

export default function StageTimeline({totalMs, stages, focus, selected, onReplay, tr, children}: {
  totalMs: number;
  stages: Stage[];
  focus?: string;
  selected?: string;
  onReplay?: (stage: Stage, range: CfopReplayRange) => void;
  tr: Translate;
  children?: ReactNode;
}) {
  const t = (zh: string, en: string) => tr({zh, en});
  const unit = t('秒','s');
  const percent = (ms:number) => Math.max(0,Math.min(100,100*ms/totalMs))+'%';
  return <section className="rr-timeline" data-site-surface="panel" aria-label={t('整局时间轴','Solve timeline')}>
    <div className="rr-timeline-head"><h4>{t('整局时间轴','Solve timeline')}</h4>
      <div className="rr-time-key"><span>{t('起手前','Entry')}</span><span>{t('执行','Execution')}</span></div>
    </div>
    <div className="rr-timeline-chart">
      <div className="rr-time-axis" aria-hidden="true">
        <span>{t('阶段','Stage')}</span>
        <div><span>0</span><span>{(totalMs/2000).toFixed(2)}</span><span>{sec(totalMs)} s</span></div>
        <span>{t('用时','Time')}</span>
      </div>
      {stages.map(s => {
        const {stepMs, cumulativeMs, recognitionMs, executionMs} = s;
        const hasBar = stepMs!=null && stepMs>0 && cumulativeMs!=null && totalMs>0;
        const split = hasBar && recognitionMs!=null && executionMs!=null;
        const duration = stepMs==null ? '—' : sec(stepMs);
        const label = [s.label, s.slot].filter(Boolean).join(' · ');
        const detail = [
          hasBar && sec(Math.max(0,cumulativeMs-stepMs))+'–'+sec(cumulativeMs)+' s',
          recognitionMs!=null && t('起手前 ','Entry ')+sec(recognitionMs)+' s',
          executionMs!=null && t('执行 ','Execution ')+sec(executionMs)+' s',
        ].filter(Boolean).join(' · ');
        const range = stageReplayRange(s);
        const enabled = Boolean(onReplay && range);
        return <Tooltip key={s.label} content={detail || label}>{tip=><button {...tip} type="button" className="rr-time-row"
          onFocus={event=>{ if (event.currentTarget.matches(':focus-visible')) tip.onFocus?.(event); }}
          disabled={!enabled} data-review={s.label===focus || undefined} aria-pressed={selected===s.label}
          aria-label={t('回放 ','Play ')+label+' · '+duration+' '+unit} onClick={()=>{if (range) onReplay?.(s,range);}}>
          <span className="rr-time-name"><b>{s.label}</b>{s.slot && <small>{s.slot}</small>}</span>
          <span className="rr-time-lane" aria-hidden="true">{hasBar && <span className="rr-time-span" data-split={split}
            style={{insetInlineStart:percent(cumulativeMs-stepMs),width:percent(stepMs)}}>
            {split && <i style={{width:Math.min(100,Math.max(0,100*recognitionMs/stepMs))+'%'}}/>}
          </span>}</span>
          <span className="rr-time-amount">{duration}{stepMs!=null && <small> s</small>}</span>
          {enabled && <Play className="rr-time-play" size={13} aria-hidden/>}
        </button>}</Tooltip>;
      })}
    </div>
    {children}
  </section>;
}
