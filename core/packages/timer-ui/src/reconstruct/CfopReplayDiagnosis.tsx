'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import MoreToggle, { MoreTogglePanel } from '../MoreToggle';
import { cfopTrainingHref, selectCfopReplayStage, type CfopDiagnosis, type CfopReplayGoal, type CfopReplayRange } from './cfop-diagnosis';
import type { ReconstructHost, ReconstructLocalize } from './ReconstructHost';
import { CfopEvidence, CfopPracticePlan, cfopIssueLabels, cfopSeconds } from './CfopAnalysisDetails';

const goals = {
  stepMs: { zh: '阶段总用时', en: 'Stage time' },
  recognitionMs: { zh: '起手前用时', en: 'Time before execution' },
  executionMs: { zh: '执行用时', en: 'Execution time' },
  turns: { zh: '转动步数（HTM）', en: 'HTM turn count' },
};

export default function CfopReplayDiagnosis({ diagnosis, tr, onReplay, renderTrainingLink, prepareFormula, renderFormula, followUp, personalBaseline }: {
  diagnosis: CfopDiagnosis;
  tr: ReconstructLocalize;
  onReplay: (range: CfopReplayRange) => void;
  renderTrainingLink: (href: string, label: string) => ReactNode;
  prepareFormula?: ReconstructHost['prepareAssistantFormula'];
  renderFormula?: ReconstructHost['renderAssistantFormula'];
  followUp: ReactNode;
  personalBaseline?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<CfopReplayGoal>('stepMs');
  const [phase, setPhase] = useState<'oll' | 'pll' | 'recommended'>('recommended');
  const panelId = useId();
  const lastLayer = diagnosis.stages.filter(stage => stage.training === 'oll' || stage.training === 'pll');
  const canShowOll = !diagnosis.issue && lastLayer.some(stage => stage.formula?.set === 'oll');
  const canShowPll = !diagnosis.issue && lastLayer.some(stage => stage.formula?.set === 'pll');
  useEffect(() => {
    if (canShowOll) prepareFormula?.('oll');
    if (canShowPll) prepareFormula?.('pll');
  }, [canShowOll, canShowPll, prepareFormula]);
  const requested = lastLayer.find(stage => stage.training === phase);
  const selected = open && (requested
    ? Number.isFinite(requested.column[goal]) && { stage: requested, tied: false }
    : selectCfopReplayStage(diagnosis.stages, goal));
  const stageTraining = (training: 'cross' | 'f2l' | 'oll' | 'pll') =>
    renderTrainingLink(cfopTrainingHref(training), tr({ zh: '开始阶段训练', en: 'Start stage practice' }));
  const seconds = (ms: number) => tr({ zh: `${cfopSeconds(ms)} 秒`, en: `${cfopSeconds(ms)} s` });
  const rangeText = (startMs: number, endMs: number) => tr({
    zh: `${cfopSeconds(startMs)}–${cfopSeconds(endMs)} 秒`, en: `${cfopSeconds(startMs)}–${cfopSeconds(endMs)} s`,
  });

  return <section className="cfop-analysis" data-no-timer>
    <MoreToggle expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} animate={false}>
      {tr({ zh: '用 Agent 分析这局', en: 'Analyze this solve with Agent' })}
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
        <div className="cfop-filters"><label>{tr({ zh: '分析目标', en: 'Analyze by' })}
          <select value={goal} onChange={event => setGoal(event.target.value as CfopReplayGoal)}>
            {Object.entries(goals).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
          </select>
        </label>{lastLayer.length > 0 && <label>{tr({ zh: '回看阶段', en: 'Replay stage' })}
          <select value={requested ? phase : 'recommended'} onChange={event => setPhase(event.target.value as typeof phase)}>
            <option value="recommended">{tr({ zh: '推荐阶段', en: 'Recommended' })}</option>
            {lastLayer.map(stage => <option key={stage.training} value={stage.training}>{stage.training.toUpperCase()}</option>)}
          </select>
        </label>}</div>

        {selected ? (() => {
          const { stage, tied } = selected;
          const { column, training, startMs, endMs, finalAdjustmentOnly } = stage;
          const label = finalAdjustmentOnly ? tr({ zh: '末层调整（AUF）', en: 'Final U adjustment (AUF)' }) : column.label;
          const focus = goal === 'recognitionMs' ||
            (goal === 'stepMs' && (column.recognitionMs ?? 0) > (column.executionMs ?? 0)) ? 'recognition' : 'execution';
          const evidence = (Object.keys(goals) as CfopReplayGoal[]).flatMap(key => {
            const amount = column[key];
            return amount === null ? [] : [{
              label: tr(goals[key]), value: key === 'turns' ? tr({ zh: `${amount} 步`, en: `${amount} turns` }) : seconds(amount),
              highlighted: key === goal,
            }];
          });
          return <article className="cfop-result" data-site-surface="panel">
            <header>
              <h3>{tr(requested ? {
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
            </header>
            <section className="cfop-why">
              <h4>{tr({ zh: '判断依据', en: 'What the replay shows' })}</h4>
              <CfopEvidence items={evidence}/>
              {focus === 'recognition' && <p className="cfop-note">{tr({
                zh: '起手前用时从上一段结束算到本段开始有效转动。转体、顶层调整和停顿都会计入。',
                en: 'Time before execution runs from the end of the previous stage to the first effective turn. It includes rotations, U adjustments and pauses.',
              })}</p>}
              {goal === 'turns' && column.refTurns !== null && column.refUserTurns !== null && <p className="cfop-note">{tr({
                zh: `用同一规则数步，你这段用了 ${column.refUserTurns} 步，参考解法用 ${column.refTurns} 步。`,
                en: `Under the same counting rules, you used ${column.refUserTurns} turns and the reference uses ${column.refTurns}.`,
              })}</p>}
            </section>
            <div className="cfop-replay-row">
              <button className="rc-action rc-action--ghost" type="button" onClick={() => onReplay(stage)}>
                {tr({ zh: '回放原段', en: 'Replay original segment' })}
              </button>
              <span>{rangeText(startMs, endMs)}</span>
            </div>
            <CfopPracticePlan stage={finalAdjustmentOnly ? 'auf' : training} focus={goal === 'turns' ? 'turns' : focus} tr={tr}>
              {stage.formula && renderFormula
                ? renderFormula(stage.formula, focus, stageTraining(training))
                : <div>{stageTraining(training)}</div>}
            </CfopPracticePlan>
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
        <div className="cfop-follow-up">{followUp}</div>
      </>}
      {personalBaseline}
    </MoreTogglePanel>
  </section>;
}
