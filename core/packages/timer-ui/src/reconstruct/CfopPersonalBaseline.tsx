'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Solve } from '@cuberoot/shared/timer/types';
import MoreToggle, { MoreTogglePanel } from '../MoreToggle';
import { TimerRoomDialog } from '../TimerRoomDialog';
import PlaybackPanel from './PlaybackPanel';
import { cfopTrainingHref, type CfopReplayRange } from './cfop-diagnosis';
import { type CfopHistoryAnalysis, analyzeCfopHistory, cfopBaselineCandidates, CFOP_BASELINE_LIMIT, CFOP_BASELINE_MIN, type CfopHistoryIssue, type CfopStageReplay, type CfopTrainingPriority } from './cfop-personal-baseline';
import type { ReconstructHost, ReconstructLocalize } from './ReconstructHost';
import { CfopEvidence, CfopPracticePlan, cfopIssueLabels, cfopSeconds as seconds } from './CfopAnalysisDetails';
const starts = {
  'paired-top': { zh: '顶层已配对', en: 'Paired in the top layer' },
  'split-top': { zh: '角块与棱块分居顶层', en: 'Unpaired in the top layer' },
  'corner-slotted': { zh: '角块在槽内、棱块在顶层', en: 'Corner in the slot, edge in the top layer' },
  'edge-slotted': { zh: '棱块在槽内、角块在顶层', en: 'Edge in the slot, corner in the top layer' },
  'both-slotted': { zh: '角块与棱块都在槽内', en: 'Both pieces in the slot' },
};

export function trainingPriorityName({ situation }: Pick<CfopTrainingPriority, 'situation'>, tr: ReconstructLocalize, hideAnswer: boolean) {
  if (situation.stage === 'cross') {
    const face = situation.side.split('-')[0];
    return tr({
      zh: `十字（${face} 面，完成时已有 ${situation.freePairs} 组 F2L 就位）`,
      en: `Cross (${face} face, ${situation.freePairs} F2L pairs in place at completion)`,
    });
  }
  if (situation.stage === 'f2l') return `F2L · ${tr(starts[situation.start])}`;
  return hideAnswer ? situation.stage.toUpperCase() : situation.caseName;
}

function HistoricalSegment({ solve, range, tr, onClose }: {
  solve: Solve; range: CfopReplayRange; tr: ReconstructLocalize; onClose: () => void;
}) {
  const player = useRef<((range: CfopReplayRange) => void) | null>(null);
  useEffect(() => { player.current?.(range); }, [range]);
  const language = tr({ zh: 'zh' as const, en: 'en' as const });
  return <TimerRoomDialog title={tr({ zh: '原局回放', en: 'Original solve replay' })} className="reconstruct-modal"
    language={language} onClose={onClose}>
    <p>{tr({ zh: `${seconds(range.startMs)}–${seconds(range.endMs)} 秒`, en: `${seconds(range.startMs)}–${seconds(range.endMs)} s` })}</p>
    <PlaybackPanel method="cfop" event={solve.event} scramble={solve.scramble} moves={solve.moves ?? []} totalMs={solve.timeMs}
      gyro={solve.gyro} deviceModel={solve.device?.model} isZh={language === 'zh'} replayRangeRef={player}/>
  </TimerRoomDialog>;
}

export default function CfopPersonalBaseline({ history, current, tr, renderTrainingLink, prepareFormula, renderFormula, renderPairTraining, onAnalysis, renderRetest }: {
  onAnalysis: (result: CfopHistoryAnalysis | null) => void;
  renderRetest?: (priority: CfopTrainingPriority, name: string) => ReactNode;
  history: readonly Solve[];
  current: Solve;
  tr: ReconstructLocalize;
  renderTrainingLink: (href: string, label: string) => ReactNode;
  prepareFormula?: ReconstructHost['prepareAssistantFormula'];
  renderFormula?: ReconstructHost['renderAssistantFormula'];
  renderPairTraining?: ReconstructHost['renderPairTraining'];
}) {
  const [open, setOpen] = useState(false);
  const [showSamples, setShowSamples] = useState(true);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [analysis, setAnalysis] = useState<{ solves: Solve[]; result: ReturnType<typeof analyzeCfopHistory> } | null>(null);
  const [replay, setReplay] = useState<CfopStageReplay | null>(null);
  const panelId = useId();
  const samplePanelId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const candidates = open || analysis ? cfopBaselineCandidates(history, current) : [];
  const chosen = candidates.filter(solve => selected.has(solve.id));
  const result = analysis?.solves.length === chosen.length && analysis.solves.every((solve, i) => solve === chosen[i])
    ? analysis.result : null;
  useEffect(() => { onAnalysis(result); }, [onAnalysis, result]);
  useEffect(() => {
    if (result && !showSamples) resultRef.current?.focus({ preventScroll: true });
  }, [result, showSamples]);
  const replaySolve = replay && result ? chosen.find(solve => solve.id === replay.solveId) : undefined;
  const date = open ? new Intl.DateTimeFormat(tr({ zh: 'zh-CN', en: 'en-US' }), { dateStyle: 'short', timeStyle: 'short' }) : null;
  const updateSelection = (next: ReadonlySet<string>) => {
    setSelected(next);
    setAnalysis(null);
  };
  const analyze = () => {
    const result = analyzeCfopHistory(history, current, selected);
    const formulaSets = new Set(result.priorities.slice(0, 3).map(priority => priority.replay?.target?.set));
    for (const set of formulaSets) if (set) prepareFormula?.(set);
    setAnalysis({ solves: chosen, result });
    if (result.comparableGroups) setShowSamples(false);
  };

  const time = (ms: number) => tr({ zh: `${seconds(ms)} 秒`, en: `${seconds(ms)} s` });

  return <section className="cfop-history">
    <MoreToggle expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} animate={false}>
      {tr({ zh: '用近期复盘建立个人基线', en: 'Build a personal baseline from recent solves' })}
    </MoreToggle>
    <MoreTogglePanel expanded={open} id={panelId} animate={false} contentClassName="cfop-layout">
        {candidates.length ? <>
          <MoreToggle expanded={showSamples} aria-controls={samplePanelId} onToggle={() => setShowSamples(value => !value)} animate={false}>
            {tr({ zh: `复盘样本 · 已选 ${chosen.length} / ${candidates.length} 局`, en: `Solves · ${chosen.length} of ${candidates.length} selected` })}
          </MoreToggle>
          <MoreTogglePanel expanded={showSamples} id={samplePanelId} animate={false} contentClassName="cfop-layout">
            <p className="cfop-note">{tr({
              zh: `从当前计时会话中选择你自己的近期复盘，最多 ${CFOP_BASELINE_LIMIT} 局。至少需要 ${CFOP_BASELINE_MIN} 局有效三阶 CFOP 记录。同类局面按相同分段口径比较。`,
              en: `Choose up to ${CFOP_BASELINE_LIMIT} of your recent solves from this timer session. At least ${CFOP_BASELINE_MIN} valid 3×3 CFOP solves are needed. Matching positions use the same stage timing rules.`,
            })}</p>
            <div className="cfop-baseline-options" role="group" aria-label={tr({ zh: '近期复盘', en: 'Recent solves' })}>
              {candidates.map(solve => <label key={solve.id}>
                {/* allow-checkbox: selecting individual solves for comparison, not changing a setting */}
                <input type="checkbox" checked={selected.has(solve.id)} onChange={event => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(solve.id);
                  else next.delete(solve.id);
                  updateSelection(next);
                }}/>{' '}
                {date?.format(solve.ts)} · {time(solve.timeMs)}
                {solve.penalty === '+2' && ' (+2)'}{solve.id === current.id && ' · ' + tr({ zh: '本局', en: 'This solve' })}
              </label>)}
            </div>
            <div className="cfop-actions">
              <button type="button" className="rc-action rc-action--ghost" onClick={() => updateSelection(new Set(
                chosen.length === candidates.length ? [] : candidates.map(solve => solve.id),
              ))}>{tr(chosen.length === candidates.length
                ? { zh: '清除选择', en: 'Clear selection' }
                : { zh: '选择当前列表', en: 'Select the listed solves' })}</button>
              <button type="button" className="rc-action" disabled={!chosen.length} onClick={analyze}>
                {tr({ zh: '分析所选复盘', en: 'Analyze selected solves' })}
              </button>
            </div>
          </MoreTogglePanel>
        </> : <p className="cfop-note">{tr({ zh: '没有可选择的近期复盘。', en: 'There are no recent solves to select.' })}</p>}
        {result && <div ref={resultRef} tabIndex={-1} className="cfop-history-result">
          <p className="cfop-note" role="status">{tr({
            zh: `所选 ${result.selected} 局中，${result.usable} 局有可比较的阶段。`,
            en: `${result.usable} of ${result.selected} selected solves have comparable stages.`,
          })}{!!result.recentCount && ' ' + tr({
            zh: `用较早的 ${result.baselineCount} 局对照最近 ${result.recentCount} 局。`,
            en: `The earlier ${result.baselineCount} solves form the baseline for the latest ${result.recentCount}.`,
          })}</p>
          {!!(result.partial || result.excluded) && <section className="cfop-quality" aria-label={tr({ zh: '样本使用情况', en: 'How solves were used' })}>
            <p>{tr({
              zh: `${result.partial} 局仅使用可靠阶段，${result.excluded} 局整局排除。`,
              en: `${result.partial} solves contributed only verified stages. ${result.excluded} solves were excluded entirely.`,
            })}</p>
            <ul className="cfop-quality-list">{(Object.entries(result.issueCounts) as [
              CfopHistoryIssue, { partial: number; excluded: number },
            ][]).map(([issue, count]) => <li key={issue}>
              <strong>{tr(cfopIssueLabels[issue])}</strong>
              <span>{tr(count.partial && count.excluded ? {
                zh: `保留部分阶段 ${count.partial} 局 · 整局排除 ${count.excluded} 局`,
                en: `${count.partial} partially used · ${count.excluded} fully excluded`,
              } : count.partial ? {
                zh: `保留部分阶段 ${count.partial} 局`, en: `${count.partial} partially used`,
              } : {
                zh: `整局排除 ${count.excluded} 局`, en: `${count.excluded} fully excluded`,
              })}</span>
            </li>)}</ul>
            <p className="cfop-note">{tr({
              zh: '一局如有多种问题，会分别列在对应原因下。',
              en: 'A solve with multiple issues is counted under each relevant reason.',
            })}</p>
          </section>}
          {!result.recentCount ? <p role="status">{tr({
            zh: `样本不足。至少需要 ${CFOP_BASELINE_MIN} 局有效记录，较早 5 局做基线，较新 3 局做对照。`,
            en: `Too few samples. At least ${CFOP_BASELINE_MIN} valid solves are needed, with five earlier solves and three recent solves to compare.`,
          })}</p> : <>
            {!result.comparableGroups ? <p role="status">{tr({
              zh: '同类局面的样本不足。每类至少需要 5 局基线记录和 3 局近期记录。',
              en: 'There are too few matching positions. Each group needs at least five baseline solves and three recent solves.',
            })}</p> : !result.priorities.length ? <p role="status">{tr({
              zh: `比较了 ${result.comparableGroups} 类局面，没发现反复慢于个人基线的阶段。`,
              en: `Across ${result.comparableGroups} comparable groups, none repeatedly fell behind your personal baseline.`,
            })}</p> : <ol className="cfop-priorities">{result.priorities.slice(0, 3).map((priority, index) => {
              const focus = priority.signal === 'recognitionMs' ? 'recognition' : 'execution';
              const example = priority.replay;
              const target = example?.target;
              const name = trainingPriorityName(priority, tr, !!(focus === 'recognition' && target && renderFormula));
              const metric = tr(focus === 'recognition'
                ? { zh: '起手前用时', en: 'Time before execution' }
                : { zh: '执行用时', en: 'Execution time' });
              const stageTraining = renderTrainingLink(cfopTrainingHref(priority.situation.stage), tr({
                zh: '开始阶段训练', en: 'Start stage practice',
              }));
              return <li className="cfop-result" data-site-surface="panel" key={JSON.stringify(priority.situation)}>
                <header>
                  <h3>{index === 0 ? tr({ zh: `优先练 ${name}`, en: `Practise ${name} first` }) : name}</h3>
                  <p>{tr({ zh: `${metric}反复比以往长。`, en: `${metric} repeatedly took longer than usual.` })}</p>
                </header>
                <section className="cfop-why">
                  <h4>{tr({ zh: '判断依据', en: 'What the solves show' })}</h4>
                  <CfopEvidence items={[
                    { label: tr({ zh: '以往中位数', en: 'Earlier median' }), value: time(priority.baselineMs),
                      detail: tr({ zh: `${priority.baselineCount} 局同类局面`, en: `${priority.baselineCount} matching solves` }) },
                    { label: tr({ zh: '近期中位数', en: 'Recent median' }), value: time(priority.recentMs), highlighted: true,
                      detail: tr({zh:`${priority.recentCount} 局同类局面`, en:`${priority.recentCount} matching solves`}) },
                    { label: tr({ zh: '明显变慢', en: 'Clear slowdowns' }), value: tr({
                      zh: `${priority.slowerCount} / ${priority.recentCount} 局`, en: `${priority.slowerCount} / ${priority.recentCount} solves`,
                    }) },
                  ]}/>
                  <p className="cfop-note">{tr({
                    zh: `只比较同类局面。中位数是用时排序后的中间值。比以往中位数多用至少 ${time(priority.thresholdMs)}，就算一次明显变慢。`,
                    en: `Only matching positions are compared. The median is the middle value after sorting. A slowdown counts if it was at least ${time(priority.thresholdMs)} above your earlier median.`,
                  })}</p>
                </section>
                {example && <div className="cfop-replay-row"><button type="button" className="rc-action rc-action--ghost" onClick={() => setReplay(example)}>
                  {tr({ zh: '回放原段', en: 'Replay original segment' })}
                </button><span>{tr({
                  zh: `${seconds(example.range.startMs)}–${seconds(example.range.endMs)} 秒`,
                  en: `${seconds(example.range.startMs)}–${seconds(example.range.endMs)} s`,
                })}</span></div>}
                <CfopPracticePlan stage={priority.situation.stage} focus={focus} tr={tr}>
                  {priority.situation.stage === 'f2l' && renderPairTraining
                    ? renderPairTraining(example?.pairFingerprint, tr({zh:'历史示例',en:'History example'}), stageTraining)
                    : target && renderFormula ? renderFormula(target, focus, stageTraining) : <div>{stageTraining}</div>}
                </CfopPracticePlan>
                {renderRetest?.(priority, trainingPriorityName(priority, tr, false))}
              </li>;
            })}</ol>}
          </>}
        </div>}
    </MoreTogglePanel>
    {replay && replaySolve && <HistoricalSegment solve={replaySolve} range={replay.range} tr={tr} onClose={() => setReplay(null)}/>}
  </section>;
}
