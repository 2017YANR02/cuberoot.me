'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Solve } from '@cuberoot/shared/timer/types';
import CfopPersonalBaseline, { trainingPriorityName } from './CfopPersonalBaseline';
import type { CfopHistoryAnalysis } from './cfop-personal-baseline';
import { Clock3, GitCompareArrows, Play } from 'lucide-react';
import { CompactSelect } from '../CompactSelect';
import MoreToggle, { MoreTogglePanel } from '../MoreToggle';
import { cfopPracticeSolveId, cfopTrainingHref, selectCfopReplayStage, type CfopDiagnosis, type CfopReplayGoal, type CfopReplayRange } from './cfop-diagnosis';
import type { ReplayReportEvidence, ReplayTrainingEvidence, ReconstructHost, ReconstructLocalize } from './ReconstructHost';
import { CfopStageTable, CfopEvidence, CfopPracticePlan, cfopIssueLabels, cfopPracticeInstruction, cfopSeconds } from './CfopAnalysisDetails';

const goals = {
  stepMs: { zh: '阶段总用时', en: 'Stage time' },
  recognitionMs: { zh: '起手前用时', en: 'Time before execution' },
  executionMs: { zh: '执行用时', en: 'Execution time' },
  turns: { zh: '转动步数（HTM）', en: 'HTM turn count' },
};

export default function CfopReplayDiagnosis({ diagnosis, tr, onReplay, onCompare, renderTrainingLink, prepareFormula, renderFormula, renderPairTraining, followUp, history, current, renderRetest }: {
  diagnosis: CfopDiagnosis;
  tr: ReconstructLocalize;
  onReplay: (range: CfopReplayRange) => void;
  onCompare?: (slot: string) => void;
  renderTrainingLink: (href: string, label: string) => ReactNode;
  prepareFormula?: ReconstructHost['prepareAssistantFormula'];
  renderFormula?: ReconstructHost['renderAssistantFormula'];
  renderPairTraining?: ReconstructHost['renderPairTraining'];
  followUp: (focus?: { label: string; selectedKey?:string; goal: CfopReplayGoal }, notes?: string[], retestCaseKey?: string, practiceScope?: string, evidence?: ReplayReportEvidence) => ReactNode;
  history?: Solve[];
  current: Solve;
  renderRetest?: ReconstructHost['renderPracticeRetest'];
}) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<CfopReplayGoal>(() => selectCfopReplayStage(diagnosis.stages, 'recognitionMs') ? 'recognitionMs' : 'stepMs');
  const [phase, setPhase] = useState('whole');
  const panelId = useId();
  const [baseline, setBaseline] = useState<CfopHistoryAnalysis | null>(null);
  const lastLayer = diagnosis.stages.filter(stage => stage.training === 'oll' || stage.training === 'pll');
  const canShowOll = !diagnosis.issue && lastLayer.some(stage => stage.formula?.set === 'oll');
  const canShowPll = !diagnosis.issue && lastLayer.some(stage => stage.formula?.set === 'pll');
  useEffect(() => {
    if (canShowOll) prepareFormula?.('oll');
    if (canShowPll) prepareFormula?.('pll');
  }, [canShowOll, canShowPll, prepareFormula]);
  const requested = diagnosis.stages.find(stage => stage.column.key === phase || (stage.column.key==='zbll' && (phase==='oll' || phase==='pll')));
  const phaseLabel = phase === 'whole' ? tr({zh:'整局复盘',en:'Whole solve'}) : requested?.column.label ?? tr({zh:'推荐阶段',en:'Recommended'});
  const selected = open && phase !== 'whole' && (requested
    ? Number.isFinite(requested.column[goal]) && { stage: requested, tied: false }
    : selectCfopReplayStage(diagnosis.stages, goal));
  const stageTraining = (training: 'cross' | 'f2l' | 'oll' | 'pll' | 'zbll') =>
    renderTrainingLink(cfopTrainingHref(training), tr({ zh: '开始阶段训练', en: 'Start stage practice' }));
  const seconds = (ms: number) => tr({ zh: `${cfopSeconds(ms)} 秒`, en: `${cfopSeconds(ms)} s` });
  const rangeText = (startMs: number, endMs: number) => tr({
    zh: `${cfopSeconds(startMs)}–${cfopSeconds(endMs)} 秒`, en: `${cfopSeconds(startMs)}–${cfopSeconds(endMs)} s`,
  });

  const planSolve = cfopPracticeSolveId(current);
  const currentStage = selected ? selected.stage : undefined;
  const focus = currentStage && { label: currentStage.column.label, selectedKey:phase, goal };
  const signal = goal === 'recognitionMs' || (goal === 'stepMs' && currentStage && (currentStage.column.recognitionMs ?? 0) > (currentStage.column.executionMs ?? 0))
    ? 'recognitionMs' : 'executionMs';
  const observation = baseline?.observations.find(row => row.label === currentStage?.column.label);
  const match = goal !== 'turns' && observation && baseline?.comparisons.find(row => row.signal === signal &&
    JSON.stringify(row.situation) === JSON.stringify(observation.situation));
  const metricName = (value: string) => tr(value === 'recognitionMs'
    ? {zh:'起手前用时',en:'time before execution'} : {zh:'执行用时',en:'execution time'});
  const historyNotes = baseline ? [tr({
    zh: `个人基线取自所选 ${baseline.selected} 局，${baseline.usable} 局有可用阶段，其中 ${baseline.partial} 局部分可用。`,
    en: `Personal baseline: ${baseline.usable} of ${baseline.selected} selected solves usable, including ${baseline.partial} partial solves.`,
  }), ...baseline.priorities.slice(0, 3).map(row => {
    const name = trainingPriorityName(row, tr, false);
    return tr({zh:`值得长期练：${name}的${metricName(row.signal)}。以往 ${row.baselineCount} 局中位数 ${seconds(row.baselineMs)}，近期 ${row.recentCount} 局中位数 ${seconds(row.recentMs)}，其中 ${row.slowerCount} 局超出基线至少 ${seconds(row.thresholdMs)}。`,
      en:`Recurring practice target: ${name}, ${metricName(row.signal)}. Earlier median ${seconds(row.baselineMs)} (${row.baselineCount} solves), recent median ${seconds(row.recentMs)} (${row.recentCount} solves); ${row.slowerCount} exceeded baseline by at least ${seconds(row.thresholdMs)}.`});
  })] : [];
  if (baseline && !baseline.priorities.length) historyNotes.push(tr(baseline.comparableGroups
    ? {zh:'样本结论：同类局面尚未出现达到长期训练门槛的重复信号。',en:'History finding: no matching situation reached the recurrence threshold.'}
    : {zh:'样本结论：同类局面的基线或近期记录不足。',en:'History finding: there are too few comparable earlier or recent solves.'}));
  const value = observation?.[signal];
  const above = match && value != null && value - match.baselineMs >= match.thresholdMs;
  const frequency = match && tr(match.repeated
    ? {zh:'该类局面达到长期训练门槛。', en:'This situation reaches the recurring-practice threshold.'}
    : above && match.otherRecentCount > 0 && match.otherSlowerCount === 0
      ? {zh:`所选近期其余 ${match.otherRecentCount} 局同类局面均未达到慢速门槛，先单独回看本局。`, en:`None of the other ${match.otherRecentCount} comparable recent solves crossed the threshold. Review this attempt individually.`}
      : {zh:'所选样本尚未达到长期训练门槛。', en:'The selected sample is below the recurring-practice threshold.'});
  const scope = match && observation && value != null ? tr({
    zh: `本局观察：${observation.label} 的${metricName(signal)}为 ${seconds(value)}，同类基线 ${seconds(match.baselineMs)}。${above ? '本段明显偏慢。' : '本段在慢速门槛以内。'}按每局同类片段的中位数，近期 ${match.slowerCount}/${match.recentCount} 局明显变慢。${frequency}`,
    en: `Single-solve observation: ${observation.label} ${metricName(signal)} was ${seconds(value)}, versus a personal baseline of ${seconds(match.baselineMs)}. ${above ? 'This segment crossed the slowdown threshold.' : 'This segment is within the threshold.'} By each solve’s median across matching segments, ${match.slowerCount}/${match.recentCount} recent solves were slower. ${frequency}`,
  }) : tr(goal === 'turns' && baseline ? {zh:'本局比较原解和参考解的步数。个人基线只统计起手前与执行用时，无法判断步数问题是否反复出现。',en:'Turn counts compare this attempt with its reference. The time-based history cannot establish a recurring move-count issue.'} : baseline ? {zh:'本局观察：所选历史缺少此目标的可比样本，无法确定是否反复出现。',en:'Single-solve observation: comparable history is insufficient for this target.'}
    : {zh:'本局观察：尚未选取个人基线，长期训练价值待核实。',en:'Single-solve observation: select a personal baseline to check recurrence.'});
  const gap = currentStage?.longestGap;
  const rhythm = gap && currentStage && tr({
    zh: `${currentStage.column.label} 段内最长相邻动作间隔 ${seconds(gap.endMs - gap.startMs)}，位于第 ${gap.firstMoveIndex + 1}–${gap.endMoveIndex + 1} 个记录动作（${rangeText(gap.startMs, gap.endMs)}）。`,
    en: `The longest gap between recorded moves within ${currentStage.column.label} was ${seconds(gap.endMs - gap.startMs)}, between moves ${gap.firstMoveIndex + 1} and ${gap.endMoveIndex + 1} (${rangeText(gap.startMs, gap.endMs)}).`,
  });
  const practiceScope = (currentStage?.column.key.startsWith('slot-') || currentStage?.column.key === 'zbll') ? JSON.stringify([planSolve, currentStage.column.key]) : undefined;
  const primary = baseline?.priorities[0];
  const stageFindings: Record<string, string> = {};
  for (const observation of baseline?.observations ?? []) {
    const signals = baseline?.comparisons.filter(row =>
      JSON.stringify(row.situation) === JSON.stringify(observation.situation) && observation[row.signal] != null &&
      observation[row.signal]! - row.baselineMs >= row.thresholdMs) ?? [];
    const finding = signals.find(row => row.repeated) ?? signals[0];
    if (!finding) continue;
    const metric = metricName(finding.signal);
    const baselineTime = seconds(finding.baselineMs);
    const findingText = finding.repeated ? tr({
      zh:`近期 ${finding.slowerCount}/${finding.recentCount} 局反复偏慢。`,
      en:`Recurring slowdown in ${finding.slowerCount}/${finding.recentCount} recent solves.`,
    }) : finding.otherRecentCount && !finding.otherSlowerCount ? tr({
      zh:`其余 ${finding.otherRecentCount} 局同类片段均在门槛以内，先回看本局。`,
      en:`Comparable segments in the other ${finding.otherRecentCount} solves stayed within threshold. Review this attempt first.`,
    }) : tr({zh:'近期重复次数尚未达到长期训练门槛。',en:'Recent repeats are below the recurring-practice threshold.'});
    stageFindings[observation.label] = tr({zh:`同类局面的${metric}中位数为 ${baselineTime}。${findingText}`,
      en:`Baseline median for ${metric}: ${baselineTime}. ${findingText}`});
  }
  const evidence: ReplayReportEvidence = {
    stageFindings,
    wholeSolve: phase === 'whole', freePairs: diagnosis.freePairs, skipped: diagnosis.skipped,
    selected: baseline?.selected,
    observationNote: !match ? scope : undefined,
    excluded: diagnosis.limited.map(stage => stage.label),
    observation: match && value != null ? { metric: metricName(signal), current: value, baseline: match.baselineMs,
      slower: !!above, note: frequency || '' } : undefined,
    priority: primary && { name: primary.situation.stage === 'cross' ? tr({zh:'十字', en:'Cross'}) : trainingPriorityName(primary, tr, false),
      metric: metricName(primary.signal), earlier: primary.baselineMs, recent: primary.recentMs,
      earlierCount: primary.baselineCount, recentCount: primary.recentCount, slowerCount: primary.slowerCount,
      instruction: tr(cfopPracticeInstruction(primary.situation.stage, primary.signal === 'recognitionMs' ? 'recognition' : 'execution')) },
    historyFinding: !primary && baseline ? historyNotes.at(-1) : undefined,
  };
  const ask = (retest?: string, retestCaseKey?: string, training?: ReplayTrainingEvidence) => followUp(focus, [...historyNotes, ...(currentStage ? [scope] : []), ...(rhythm ? [rhythm] : []), ...(retest ? [retest] : [])], retestCaseKey, practiceScope, {...evidence, training});

  return <section className="cfop-analysis" data-no-timer>
    {followUp(undefined, historyNotes, undefined, undefined, {...evidence, wholeSolve:true, observation:undefined, observationNote:undefined})}
    <MoreToggle expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} animate={false}>
      {tr({ zh: '阶段回看与个人基线', en: 'Stage review and personal baseline' })}
    </MoreToggle>
    <MoreTogglePanel id={panelId} expanded={open} animate={false} contentClassName="cfop-layout">
      {diagnosis.issue && <p className="cfop-note" role="status">{tr({
        zh: `${tr(cfopIssueLabels[diagnosis.issue])}。请先核对原局动作。`,
        en: `${tr(cfopIssueLabels[diagnosis.issue])}. Check the original moves first.`,
      })}</p>}
      {!!diagnosis.limited.length && <section className="cfop-quality" aria-label={tr({ zh: '阶段数据质量', en: 'Stage data quality' })}>
        <p>{tr({ zh: `可分析 ${diagnosis.stages.length} 段，下列阶段不计入用时比较和训练推荐。`,
          en: `${diagnosis.stages.length} stages can be analyzed. The stages below are excluded from timing comparisons and training recommendations.` })}</p>
        <ul className="cfop-quality-list">{diagnosis.limited.map(({ label, issues, replay }) => <li key={label}>
          <div><strong>{label}</strong><span> · {issues.map(issue => tr(cfopIssueLabels[issue])).join(tr({ zh: '；', en: '; ' }))}</span></div>
          {replay && <div className="cfop-replay-row">
            <button className="rc-action rc-action--ghost" type="button"
              aria-label={tr({ zh: `回放 ${label} 的动作记录`, en: `Replay recorded ${label} moves` })}
              onClick={() => onReplay(replay)}>{tr({ zh: '回放动作记录', en: 'Replay recorded moves' })}</button>
            <span>{tr({ zh: `动作时间轴 ${rangeText(replay.startMs, replay.endMs)}`,
              en: `Move timeline ${rangeText(replay.startMs, replay.endMs)}` })}</span>
          </div>}
        </li>)}</ul>
      </section>}
      {!!diagnosis.stages.length && <>
        <div className="cfop-filters">
          <div><span>{tr({zh:'回看阶段', en:'Replay stage'})}</span>
            <CompactSelect ariaLabel={tr({zh:'回看阶段', en:'Replay stage'})}
              label={phaseLabel} value={phase}
              valueText={phaseLabel}
              items={[{value:'whole', label:tr({zh:'整局复盘',en:'Whole solve'})}, {value:'recommended', label:tr({zh:'推荐阶段', en:'Recommended'})},
                ...diagnosis.stages.map(({column}) => ({value:column.key, label:column.label}))]}
              onChange={setPhase} keyboardListNavigation dataNoTimer />
          </div>
          {phase !== 'whole' && <div><span>{tr({zh:'分析目标', en:'Analyze by'})}</span>
            <CompactSelect ariaLabel={tr({zh:'分析目标', en:'Analyze by'})} label={tr(goals[goal])} value={goal} valueText={tr(goals[goal])}
              items={(Object.keys(goals) as CfopReplayGoal[]).map(value => ({value, label:tr(goals[value])}))}
              onChange={setGoal} keyboardListNavigation dataNoTimer />
          </div>}
        </div>

        {phase === 'whole' ? <section className="cfop-result" data-site-surface="panel">
          <h3>{tr({zh:'整局复盘',en:'Whole-solve review'})} · {seconds(current.timeMs)}</h3>
          <CfopStageTable stages={diagnosis.stages.map(stage => stage.column)} tr={tr} />
        </section> : selected ? (() => {
          const { stage, tied } = selected;
          const { column, training, startMs, endMs, finalAdjustmentOnly } = stage;
          const slot = column.key.startsWith('slot-') ? column.key.slice(5) : null;
          const label = finalAdjustmentOnly ? tr({ zh: '末层调整（AUF）', en: 'Final U adjustment (AUF)' }) : slot ? `${column.label} · ${slot}` : column.label;
          const focus = goal === 'recognitionMs' ||
            (goal === 'stepMs' && (column.recognitionMs ?? 0) > (column.executionMs ?? 0)) ? 'recognition' : 'execution';
          const evidence = (Object.keys(goals) as CfopReplayGoal[]).flatMap(key => {
            const amount = column[key];
            return amount === null ? [] : [{
              key, label: tr(goals[key]), value: key === 'turns' ? tr({ zh: `${amount} 步`, en: `${amount} turns` }) : seconds(amount),
              highlighted: key === goal,
            }];
          });
          const {recognitionMs, executionMs, stepMs} = column;
          const split = recognitionMs !== null && executionMs !== null && stepMs !== null &&
            recognitionMs >= 0 && executionMs >= 0 && stepMs > 0 && Math.abs(recognitionMs + executionMs - stepMs) <= 1
            && recognitionMs + executionMs > 0;
          return <article className="cfop-result cfop-stage-card" data-site-surface="panel">
            <header className="cfop-stage-header">
              <div><h3>{tr(requested ? {
                zh: `回看 ${label}`, en: `Review ${label}`,
              } : {
                zh: `这局先回看 ${label}`, en: `Review ${label} first`,
              })}</h3>
              {!requested && <p>{tr(tied ? {
                zh: `按${tr(goals[goal])}比较，这段并列最高，先看较早出现的一段。`,
                en: `This stage ties for the highest ${tr(goals[goal]).toLowerCase()}. Start with the earlier one.`,
              } : {
                zh: `这段的${tr(goals[goal])}在可分析阶段中最高。`,
                en: `This stage has the highest ${tr(goals[goal]).toLowerCase()} among stages with verified data.`,
              })}</p>}
              </div>
              <div className="cfop-stage-play">
                <span><Clock3 size={14} aria-hidden="true"/>{rangeText(startMs, endMs)}</span>
                <button className="rc-action" type="button" onClick={() => onReplay(stage)}>
                  <Play size={14} aria-hidden="true"/>{tr({zh:'回放原段', en:'Replay original segment'})}
                </button>
              </div>
            </header>
            <div className="cfop-timing" data-split={split || undefined}>
              <CfopEvidence items={evidence}/>
              {split && <div className="cfop-time-track" aria-hidden="true">
                <span style={{flexGrow:recognitionMs}}/><span style={{flexGrow:executionMs}}/>
              </div>}
            </div>
            <div className="cfop-stage-body">
              <section className="cfop-why">
                <h4>{tr({zh:'判断依据', en:'What the replay shows'})}</h4>
                {rhythm && gap && <div className="cfop-replay-row">
                  <span>{rhythm}</span>
                  <button type="button" className="rc-action rc-action--ghost" onClick={() => onReplay(gap)}>
                    {tr({zh:'回放这两步', en:'Replay these two moves'})}
                  </button>
                </div>}
                {focus === 'recognition' && <p className="cfop-note">{tr({
                  zh: '起手前用时从上一段结束算到本段开始有效转动。转体、顶层调整和停顿都会计入。',
                  en: 'Time before execution runs from the end of the previous stage to the first effective turn. It includes rotations, U adjustments and pauses.',
                })}</p>}
                {column.refTurns !== null && column.refUserTurns !== null && <p className="cfop-note">{tr({
                  zh: `按同一起点和计步口径，原解 ${column.refUserTurns} 步，参考 ${column.refTurns} 步。`,
                  en: `Under the same counting rules, you used ${column.refUserTurns} turns and the reference uses ${column.refTurns}.`,
                })}</p>}
                {slot && column.refUserTurns != null && column.refTurns != null && <p className="cfop-note">{tr(
                  column.refUserTurns <= column.refTurns ? {
                    zh: '可以保留原解。这条同槽参考没有减少步数，先回看上一对到这一对的衔接。',
                    en: 'Keep the recorded line. This same-slot reference saves no turns. Review the transition into the pair.',
                  } : {
                    zh: `同槽参考少 ${column.refUserTurns - column.refTurns} 步。交替试两条路线，比较做对时的用时。`,
                    en: `The same-slot reference saves ${column.refUserTurns - column.refTurns} turns. Alternate both lines and time correct attempts.`,
                  })}</p>}
                {column.key.startsWith('slot-') && column.refUserTurns != null && column.refUserTurns !== column.turns && <p className="cfop-note">{tr({
                  zh: '独立回放从这一对的起点重新计步；整局计步会跨阶段合并连续同面动作。',
                  en: 'The isolated replay counts from the start of this pair. Whole-solve HTM merges consecutive same-face turns across stage boundaries.',
                })}</p>}
                {slot && onCompare && <button type="button" className="rc-action rc-action--ghost cfop-compare-action" onClick={() => onCompare(slot)}>
                  <GitCompareArrows size={15} aria-hidden="true"/>{tr({zh:'对照本对解法',en:'Compare this pair'})}
                </button>}
              </section>
              <CfopPracticePlan stage={finalAdjustmentOnly ? 'auf' : training} focus={goal === 'turns' ? 'turns' : focus} tr={tr}>
                {training === 'f2l' && renderPairTraining
                  ? renderPairTraining(column.caseFingerprint, column.label, slot && onCompare
                    ? <button type="button" className="rc-action" onClick={() => onCompare(slot)}>{tr({zh:'跟练本对原解',en:'Rehearse the recorded pair'})}</button>
                    : stageTraining(training), practiceScope ? {solve:current, scope:practiceScope} : undefined)
                  : stage.formula && renderFormula
                  ? renderFormula(stage.formula, focus, stageTraining(training))
                  : <div>{stageTraining(training)}</div>}
              </CfopPracticePlan>
            </div>
          </article>;
        })() : <p className="cfop-note">{tr({ zh: '这局缺少可按该指标比较的回放片段。', en: 'There is no replayable segment to compare for this metric.' })}</p>}
        {(diagnosis.freePairs > 0 || diagnosis.skipped.length > 0) && <div className="cfop-note">
          {!!diagnosis.freePairs && <p>{tr({
            zh: `十字完成时已有 ${diagnosis.freePairs} 组 F2L 就位（例如 X-Cross），这些组算在十字里。`,
            en: `${diagnosis.freePairs} F2L pair(s) were in place when the cross ended, as in an X-Cross. They share the cross segment.`,
          })}</p>}
          {!!diagnosis.skipped.length && <p>{tr({
            zh: `这局跳过了 ${diagnosis.skipped.join('、')}。`,
            en: `This solve skipped ${diagnosis.skipped.join(', ')}.`,
          })}</p>}
        </div>}
      </>}
      {currentStage && <p className="cfop-note">{scope}</p>}
      {history && <CfopPersonalBaseline history={history} current={current} tr={tr} renderTrainingLink={renderTrainingLink}
        prepareFormula={prepareFormula} renderFormula={renderFormula} renderPairTraining={renderPairTraining} onAnalysis={setBaseline}
        renderRetest={renderRetest && ((priority, label) => renderRetest({key: JSON.stringify([priority.situation, priority.signal]),
          legacyKey: JSON.stringify([current.device?.model, current.device?.name, priority.situation, priority.signal]),
          set: priority.situation.stage, label, metric: priority.signal === 'recognitionMs' ? 'recognition' : 'execution', formula: priority.replay?.target}, (result, _, training) => result ? followUp(undefined, [...historyNotes, result], undefined, undefined, {...evidence, wholeSolve: false, observation: undefined, training}) : null))}/>}
      {currentStage && renderRetest ? renderRetest({key: JSON.stringify([planSolve,currentStage.column.key,goal]), practiceScope, label: currentStage.column.label,
        set: currentStage.training, metric: goal === 'turns' || goal === 'stepMs' ? 'total' : goal === 'recognitionMs' ? 'recognition' : 'execution',
        formula: currentStage.formula}, ask) : phase !== 'whole' && <div className="cfop-follow-up">{ask()}</div>}
    </MoreTogglePanel>
  </section>;
}
