'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import type { ReplayPracticeTarget, ReplayTrainingEvidence } from '@cuberoot/timer-ui/reconstruct-report';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { tr } from '@/i18n/tr';
import { loadLibrarySource } from '@/lib/alg-library-cache';
import { replayFormulaCard, summarizeReplayRetest } from '@/lib/replay-formula-training';
import { practiceGroups, retestWindows, type RetestPlan } from '@/lib/replay-practice-retest';
import { persistItem } from '@/lib/safe-storage';
import type { TrainerSolve } from '@/lib/trainer-store';

function readPlan(key: string): RetestPlan {
  try {
    const plan = JSON.parse(localStorage.getItem(key) || '{}');
    return plan && typeof plan === 'object' &&
      [plan.before, plan.after].every(ids => ids === undefined || (Array.isArray(ids) && ids.length <= 5 && ids.every(id => typeof id === 'string'))) &&
      (plan.previous === undefined || (Array.isArray(plan.previous) && plan.previous.every((r: unknown) => {
        const row = r as {at?: number; caseName?: string; before?: unknown; after?: unknown};
        const times = (value: unknown) => Array.isArray(value) && value.length <= 5 && value.every(time => typeof time === 'string');
        return Number.isFinite(row?.at) && typeof row.caseName === 'string' && times(row.before) && times(row.after);
      }))) && [plan.manualBefore, plan.manualAfter].every(value => value === undefined || typeof value === 'string') ? plan : {};
  } catch { return {}; }
}

export function replayRetestStorageKey(owner: string, key: string) {
  return 'cfop-retest:v1:' + JSON.stringify([owner, key]);
}

export default function ReplayPracticeRetest({ target, owner, action, readOnly = false }: {
  readOnly?: boolean;
  target: ReplayPracticeTarget; owner: string; action: (result?: string, retestCaseKey?: string, training?: ReplayTrainingEvidence) => ReactNode;
}) {
  const key = replayRetestStorageKey(owner, target.key);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(() => readPlan(key));
  const [saved, setSaved] = useState(true);
  const [solves, setSolves] = useState<TrainerSolve[]>([]);
  const [caseKey, setCaseKey] = useState('');
  const id = useId();
  useEffect(() => {
    if (!target.legacyKey || Object.keys(readPlan(key)).length) return;
    const legacy = readPlan('cfop-retest:v1:' + JSON.stringify([owner, target.legacyKey]));
    if (!Object.keys(legacy).length) return;
    setSaved(persistItem(key, JSON.stringify(legacy)));
    setPlan(legacy);
  }, [key, owner, target.legacyKey]);
  const formulaSet = target.formula?.set;
  const formulaName = target.formula?.caseName;
  const active = readOnly || open || !!plan.before || !!target.practiceScope;
  useEffect(() => {
    if (!active) return;
    let live = true;
    async function refresh() {
      const { readPracticeSolves } = await import('@/lib/trainer-store');
      if (live) setSolves(target.practiceScope && target.set==='f2l' ? [...readPracticeSolves(target.set), ...readPracticeSolves('adv-f2l').filter(s => s.practiceSample?.replay?.role === 'recorded')] : readPracticeSolves(target.set));
    }
    function storage(event: StorageEvent) {
      if (event.key === key) setPlan(readPlan(key));
      else if (!event.key || event.key.startsWith('trainer:')) void refresh();
    }
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', storage);
    return () => { live = false; window.removeEventListener('focus', refresh); window.removeEventListener('storage', storage); };
  }, [active, key, target.set, target.practiceScope]);
  useEffect(() => {
    if (!active || !formulaSet || !formulaName) return;
    let live = true;
    void loadLibrarySource('3x3', formulaSet).then(file => {
      if (live) setCaseKey(replayFormulaCard(file, {set:formulaSet, caseName:formulaName}, {})?.trainerKey ?? '');
    }).catch(() => {});
    return () => { live = false; };
  }, [active, formulaSet, formulaName]);

  function update(changes: Partial<RetestPlan>) {
    const next = {...plan, ...changes};
    setSaved(persistItem(key, JSON.stringify(next)));
    setPlan(next);
  }
  const groups = practiceGroups(solves, owner, formulaSet ? caseKey : undefined, target.practiceScope);
  const selected = plan.group ?? [...groups.keys()].at(-1) ?? '';
  const group = groups.get(selected) ?? [];
  const {before, after, beforeTimes, afterTimes} = retestWindows(group, plan);
  const afterReady = after.length === 5 && !plan.after;
  useEffect(() => {
    if (!afterReady || readOnly) return;
    const next = {...plan, after};
    setSaved(persistItem(key, JSON.stringify(next)));
    setPlan(next);
  }, [afterReady, plan, key, after, readOnly]);
  const manual = !!plan.manual;
  const first = summarizeReplayRetest(manual ? plan.manualBefore ?? '' : beforeTimes.join(' '));
  const last = summarizeReplayRetest(manual ? plan.manualAfter ?? '' : afterTimes.join(' '));
  const metric = manual && target.metric !== 'total' ? tr(target.metric === 'recognition'
    ? {zh:'起手前用时', en:'time before execution'} : {zh:'执行用时', en:'execution time'})
    : tr({zh:'专项总用时', en:'total drill time'});
  const caseName = group[0]?.caseName ?? '';
  const exercise = formulaSet ? caseName : tr({zh:`自选 case ${caseName}`, en:`selected case ${caseName}`});
  const name = manual ? target.label : target.label + ' · ' + exercise;
  let report: string | undefined;
  if (first.completed && last.completed) {
    const source = tr(manual ? {zh:'手工分段记录',en:'manually entered timings'} : {zh:'训练器记录',en:'trainer timings'});
    report = tr({zh:`训练复测（${source}）：${name}，${metric}。有效成绩练前 ${first.correct}/5，练后 ${last.correct}/5。`,
      en:`Practice retest (${source}): ${name}, ${metric}. Valid attempts: ${first.correct}/5 before, ${last.correct}/5 after.`});
    if (first.medianMs !== null && last.medianMs !== null) {
      const times = [first.medianMs, last.medianMs].map(ms => (ms / 1000).toFixed(3)).join(' → ');
      const delta = ((last.medianMs - first.medianMs) / 1000).toFixed(3);
      report += tr({zh:` 中位数 ${times} 秒，变化 ${delta} 秒。`,en:` Median ${times} s, change ${delta} s.`});
    } else report += tr({zh:' 每组至少需要三次有效成绩才能比较中位数。',en:' Each group needs three valid attempts for a median comparison.'});
    if (last.correct < first.correct) report += tr({zh:' 练后有效次数减少。',en:' Fewer attempts were valid after practice.'});
  }
  const recorded = target.practiceScope ? practiceGroups(solves, owner, undefined, target.practiceScope, 'recorded') : undefined;
  const practiceNotes: string[] = [];
  const drills: ReplayTrainingEvidence['drills'] = [];
  let extraCount = 0;
  for (const rows of recorded?.values() ?? []) {
    const times = rows.filter(r => r.penalty !== 'DNF').map(r => r.ms + (r.penalty === '+2' ? 2000 : 0)).sort((a,b) => a-b);
    const n = times.length;
    const medianMs = n ? (times[Math.floor((n - 1) / 2)] + times[Math.floor(n / 2)]) / 2 : null;
    const median = medianMs === null ? null : (medianMs / 1000).toFixed(3);
    const clock = tr(rows[0].practiceSample.clock === 'manual' ? {zh:'手动计时', en:'manual timer'} : {zh:'智能魔方计时', en:'smart cube timer'});
    drills.push({ name: rows[0].caseName, clock, valid: n, total: rows.length, medianMs,
      times: rows.slice(-20).map(r => r.penalty === 'DNF' ? 'DNF' : ((r.ms + (r.penalty === '+2' ? 2000 : 0)) / 1000).toFixed(3)) });
    practiceNotes.push(tr({zh:`本局专项：${target.label} · ${rows[0].caseName}（${clock}），有效 ${n}/${rows.length} 次。`,
      en:`This solve’s drill: ${target.label} · ${rows[0].caseName} (${clock}), ${n}/${rows.length} valid attempts.`})
      + (median ? tr({zh:` 专项总用时中位数 ${median} 秒。`, en:` Median drill time ${median} s.`}) : ''));
  }
  if (report && !manual && plan.after?.length) {
    const end = Math.max(...group.filter(r => plan.after?.includes(r.practiceSample.id)).map(r => r.practiceSample.startedAt));
    const source = group[0]?.practiceSample;
    const extra = [...groups.values()].flat().filter(r => r.caseKey === group[0]?.caseKey && r.practiceSample.clock === source?.clock
      && r.practiceSample.conditions === source?.conditions && r.practiceSample.replay?.role === 'retest' && r.practiceSample.startedAt > end);
    if (Number.isFinite(end)) extraCount = extra.length;
    if (extraCount) practiceNotes.push(tr({zh:`复测后加练：${caseName} 又练了 ${extra.length} 次，已保存的两组成绩单独保留。`,
      en:`After the retest: ${extra.length} additional ${caseName} attempts. The two saved groups are kept separately.`}));
  }
  const entries = (s: string | undefined) => (s ?? '').normalize('NFKC').trim().split(/[\s,、]+/).filter(Boolean);
  const baselineTimes = manual ? entries(plan.manualBefore) : beforeTimes;
  const postTimes = manual ? entries(plan.manualAfter) : afterTimes;
  const training: ReplayTrainingEvidence = { drills, retest: !first.invalid && !last.invalid && (baselineTimes.length || postTimes.length)
    ? {name: manual ? target.label : caseName, metric, before:baselineTimes, after:postTimes,
      beforeMs:first.medianMs, afterMs:last.medianMs, beforeValid:first.correct, afterValid:last.correct, extra:extraCount, manual} : undefined };
  if (readOnly) return <>{action(report, !manual && target.set === 'f2l' ? group[0]?.caseKey : undefined, training)}</>;
  const count = (rows: string[]) => rows.length + '/5' + (rows.length ? ' · ' + rows.join(', ') : '');
  return <section className="cfop-retest" data-no-timer>
    <MoreToggle expanded={open} aria-controls={id} onToggle={() => setOpen(!open)} animate={false}>
      {tr({zh:'训练前后对比',en:'Compare practice and retest'})}
    </MoreToggle>
    <MoreTogglePanel id={id} expanded={open} contentClassName="cfop-layout" animate={false}>
      <label>{tr({zh:'复测来源',en:'Timing source'})}{' '}
        <select className="native-select" value={manual ? 'manual' : 'trainer'} onChange={e => update({manual:e.target.value === 'manual'})}>
          <option value="trainer">{tr({zh:'训练器自动记录',en:'Trainer records'})}</option>
          <option value="manual">{tr({zh:'手工记录同一局面',en:'Enter same-position timings'})}</option>
        </select></label>
      {manual ? <>
        <p>{tr({zh:`在同一设备、同一局面和朝向，按相同规则各做 5 次。以秒填写${metric}，认错或拧错填 DNF。`,
          en:`Use the same device, position, orientation and timing rules. Enter five ${metric} values per group in seconds, with DNF for a mistake.`})}</p>
        {target.metric !== 'total' && <p className="cfop-note">{tr(target.metric === 'recognition'
          ? {zh:'从看到局面计到首次有效转动。', en:'Time from seeing the position to the first effective turn.'}
          : {zh:'从首次有效转动计到完成目标。', en:'Time from the first effective turn to completion.'})}</p>}
        {(['manualBefore','manualAfter'] as const).map((field,i) => <label key={field}>{tr(i ? {zh:'练后',en:'After practice'} : {zh:'练前',en:'Before practice'})}{' '}
          <textarea rows={2} maxLength={160} value={plan[field] ?? ''} aria-invalid={i ? last.invalid : first.invalid}
            onChange={e => update({[field]:e.target.value})} placeholder="1.12, 1.27, DNF, 1.30, 1.25" /></label>)}
        {(first.invalid || last.invalid) && <p role="status">{tr({zh:'每组最多 5 次，用空格或逗号分隔秒数或 DNF。',en:'Enter up to five times or DNF, separated by spaces or commas.'})}</p>}
      </> : <>
        <p>{tr({zh:'先在计时训练中完成同一 case 的 5 次练前测量，错例标 DNF。保存练前组，完成专项练习后点「开始练后复测」，再测 5 次。比较同一计时来源与设置的专项总用时。',en:'Time five attempts on one case and mark mistakes DNF. Save the baseline, practise, then start the retest and time five more. Only total drill times with matching timing source and settings are compared.'})}</p>
        {!!groups.size && <label>{tr({zh:'训练样本组',en:'Practice group'})}{' '}
          <select className="native-select" disabled={!!plan.before} value={selected} onChange={e => update({group:e.target.value})}>
            {[...groups].map(([groupId, rows], index) => <option key={groupId} value={groupId}>{rows[0].caseName} · {tr(rows[0].practiceSample.clock === 'manual'
              ? {zh:'手动计时',en:'Manual timer'} : {zh:'智能魔方计时',en:'Smart cube timer'})} · {tr({zh:`设置组 ${index + 1}（${rows.length} 次）`,en:`setup ${index + 1} (${rows.length} reps)`})}</option>)}
          </select></label>}
        <table className="cfop-retest-times">
          <caption>{tr({zh:'专项用时（秒）', en:'Drill times (seconds)'})}</caption>
          <thead><tr><th scope="col">{tr({zh:'组别',en:'Group'})}</th>
            {[1,2,3,4,5].map(n => <th scope="col" key={n}>{n}</th>)}</tr></thead>
          <tbody>{[beforeTimes, ...(plan.afterAt ? [afterTimes] : [])].map((times, index) => <tr key={index}>
            <th scope="row">{tr(index ? {zh:'练后',en:'After'} : {zh:'练前',en:'Before'})} <small>{times.length}/5</small></th>
            {Array.from({length:5}, (_, i) => <td key={i}>{times[i] ?? '—'}</td>)}
          </tr>)}</tbody>
        </table>
        {!plan.before && <button type="button" className="rc-action" disabled={before.length !== 5}
          onClick={() => update({group:selected, before})}>{tr({zh:'保存练前 5 次',en:'Save five baseline attempts'})}</button>}
        {plan.before && !plan.afterAt && <button type="button" className="rc-action" onClick={() => update({afterAt:Date.now()})}>
          {tr({zh:'开始练后复测',en:'Start the post-practice retest'})}</button>}
        {plan.before && <button type="button" className="rc-action rc-action--ghost" onClick={() => {
          const now = Date.now();
          const previous = [...(plan.previous ?? []), {at:now, caseName:group[0]?.caseName ?? target.label, before:beforeTimes, after:afterTimes}];
          update({group:undefined, before:undefined, after:undefined, afterAt:undefined, since:now, previous});
        }}>{tr({zh:'保留本轮，重新测量',en:'Keep this round and measure again'})}</button>}
        {!!plan.previous?.length && <details><MoreToggle as="summary" animate={false}>{tr({zh:'以往复测',en:'Previous rounds'})}</MoreToggle>
          {plan.previous.map(round => <p key={round.at}>{round.caseName} · {toLocalIsoDate(new Date(round.at))}<br/>
            {tr({zh:'练前',en:'Before'})} {count(round.before)}<br/>{tr({zh:'练后',en:'After'})} {count(round.after)}</p>)}
        </details>}
      </>}
      {!saved && <p role="status">{tr({zh:'本次修改仅在当前页面有效，设备存储写入失败。',en:'Device storage is unavailable. This change lasts only on this page.'})}</p>}
      {practiceNotes.map(note => <p key={note} className="cfop-retest-result" role="status">{note}</p>)}
      {report && <p className="cfop-retest-result" role="status">{report}</p>}
    </MoreTogglePanel>
    {action([...practiceNotes, report].filter(Boolean).join('\n') || undefined, report && !manual && target.set === 'f2l' ? group[0]?.caseKey : undefined, training)}
  </section>;
}
