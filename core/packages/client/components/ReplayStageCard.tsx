'use client';

import { readExecution } from '@/lib/replay-recorded-segment';
import { practiceSlot, whiteBottomScramble } from '@/lib/replay-practice-view';
import { recordingRotation, reviewAlg, reviewCamera } from '@cuberoot/timer-ui/reconstruct/replay-view';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useT } from '@/hooks/useT';
import type { F2lTransferHit } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import type { ReplayPracticeOrigin, ReplayReply } from '@/lib/assistant-conversations';
import ReplayPracticeRetest, { replayRetestStorageKey } from './ReplayPracticeRetest';
import { recordedPairCase, replayRetestCase } from '@/lib/replay-f2l-training';
import { loadLibrarySource } from '@/lib/alg-library-cache';
import { replayFormulaCard, verifiedPracticeFormula } from '@/lib/replay-formula-training';
import { goalLabels, rememberReplayTraining, replayReturnChannel, type PracticeGoal } from '@/lib/replay-training-session';
import { practiceGroups } from '@/lib/replay-practice-retest';
import AppLink from './AppLink';

const Player = dynamic(() => import('./AlgPlayer'), {ssr:false});
type Stage = ReplayReply['summary']['stages'][number];
type Target = NonNullable<ReplayReply['cases']>['recorded'] & {name:string};
const seconds = (ms: number) => (ms / 1000).toFixed(3);

async function stageCase(stage: Stage): Promise<Target | undefined> {
  if (stage.fingerprint) return recordedPairCase(stage.fingerprint);
  if (stage.formula) {
    const data = await loadLibrarySource('3x3', stage.formula.set);
    const card = replayFormulaCard(data, stage.formula, {});
    if (card) return {id:card.caseId, name:card.name, set:card.set};
  }
}

export function StagePractice({stage, origin, retestKey, goal, exact, practiceRole, execution: suppliedExecution, executionHit, slot = stage.slot}: {stage:Stage; origin?:ReplayPracticeOrigin; retestKey?:string; goal?:PracticeGoal; executionHit?:F2lTransferHit; execution?:NonNullable<ReturnType<typeof readExecution>>; slot?:string; exact?:Target; practiceRole?:'recorded'|'retest'}) {
  const t = useT();
  const [target, setTarget] = useState<Target>();
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'pending'|'done'|'failed'>('pending');
  const [token, setToken] = useState<string | null>();
  const [attempts, setAttempts] = useState(0);
  const execution = useMemo(() => suppliedExecution ?? (executionHit && readExecution(executionHit)), [suppliedExecution, executionHit]);
  const role = practiceRole ?? (retestKey ? 'retest' : 'recorded');
  const scope = origin && JSON.stringify([origin.solveKey, stage.key]);
  useEffect(() => {
    let live = true;
    setStatus('pending');
    setTarget(undefined);
    const lookup = exact ? Promise.resolve(exact) : retestKey ? replayRetestCase(retestKey) : stageCase(stage);
    lookup.then(result => {
      if (live) { setTarget(result); setStatus('done'); }
    }).catch(() => { if (live) setStatus('failed'); });
    return () => { live = false; };
  }, [stage, retestKey, retry, exact?.id, exact?.set, exact?.name]);
  useEffect(() => {
    setToken(undefined);
    setAttempts(0);
    if (!target || !origin || !scope) return;
    const id = crypto.randomUUID();
    const transition = stage.clips?.find(c=>c.kind==='transition');
    const line = role === 'recorded' && !exact ? stage : undefined;
    const sourceSetup = goal === 'transition' ? transition?.setup : line?.setup;
    const sourceAlg = goal === 'transition' ? transition?.alg : line?.original;
    const rotation = goal && sourceSetup && origin.recording ? recordingRotation(origin.recording) : undefined;
    const display = execution
      ? reviewAlg(execution.setup, execution.moves.map(move => move.m).join(' '), execution.rotation, true)
      : sourceSetup && sourceAlg ? reviewAlg(sourceSetup, sourceAlg, rotation,
        goal === 'transition' || (line?.rawSetup ?? !line?.playbackReference)) : undefined;
    const drill = goal && {goal, sourceStage:execution?.hit.label, setup:display && whiteBottomScramble(display.setup), whiteBottom:!!display, original:display?.alg, reference:line?.playbackReference,
      entryAfter:goal==='transition' && transition && stage.range ? stage.range.first-transition.first : undefined,
      recordedTurns:line?.refUserTurns ?? undefined, referenceTurns:line?.refTurns ?? undefined};
    if (!rememberReplayTraining(id, {owner:origin.owner, returnPath:origin.returnPath, scope, slot:practiceSlot(slot), cases:{[role]:target}, ...(drill && {drill})})) {
      setToken(null);
      return;
    }
    setToken(id);
    let live = true;
    const refresh = async () => {
      if (goal) {
        const {guidedSamples}=await import('@/lib/replay-guided-practice');
        const rows=guidedSamples(target.set,origin.owner,new Map([[scope,true]]));
        if(live)setAttempts(rows.filter(r=>r.goal===goal && r.caseName===target.name && r.practiceSample?.replay?.role===role).length);
        return;
      }
      if (role === 'retest') return;
      const {readPracticeSolves} = await import('@/lib/trainer-store');
      const groups = practiceGroups(readPracticeSolves(target.set), origin.owner, undefined, scope, 'recorded');
      if (live) setAttempts([...groups.values()].reduce((count, rows) => count + rows.length, 0));
    };
    void refresh();
    const onStorage = (event:StorageEvent) => { if (!event.key || event.key === 'trainer:3x3/'+target.set || event.key.startsWith('cfop-guided-attempt:'+target.set+':')) void refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(replayReturnChannel);
    if (channel) channel.onmessage = event => {
      if (event.data?.type === 'return' && event.data.id === id) {
        channel.postMessage({type:'ready', id});
        window.focus();
        void refresh();
      }
    };
    return () => {
      live = false;
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, [origin, scope, target, role, goal, stage, slot, execution, exact?.id]);
  if (status === 'failed') return <button className="rr-action" type="button" onClick={() => setRetry(retry + 1)}>{t('重新查找公式','Retry formula lookup')}</button>;
  if (status === 'pending' || (target && origin && scope && token === undefined)) return <small role="status">{t('正在匹配公式…','Matching case…')}</small>;
  if (!target) return <small>{t('未匹配到唯一公式，可跟练本段原解。','No unique library case. Rehearse the recorded moves.')}</small>;
  if (goal && !token) return <small>{t('本机无法保存关联训练。','Linked training requires local storage.')}</small>;
  const query = new URLSearchParams({cases:String(target.id), mode:'train'});
  if (token) query.set('replayPractice', token+'.'+role);
  return <><AppLink className="site-assistant-action" target="_blank" rel="noopener noreferrer"
    href={'/alg/3x3/'+target.set+'/run?'+query}>{goal ? t('练 '+target.name+' · '+goalLabels[goal].zh,'Practise '+target.name+' · '+goalLabels[goal].en) : retestKey ? t('重练复测公式','Repeat retest case') : t('练 '+stage.label,'Practise '+stage.label)}{!goal && ' · '+target.name}</AppLink>
    {executionHit && execution && <small>{executionHit.label} · {executionHit.slot}</small>}
    {token === null && <small>{t('设备存储不可用，本次练习无法关联复盘。','Device storage is unavailable. This attempt cannot be linked to the solve.')}</small>}
    {goal && attempts>0 && <small>{t('已记 '+attempts+' 次','Logged '+attempts+' attempts')}</small>}
    {!goal && attempts > 0 && <small>{t(`本局专项已练 ${attempts} 次`,`${attempts} linked attempts`)}</small>}</>;
}

type Transfer = NonNullable<Stage['transfer']>[number];

export function GuidedResults({goals}:Pick<Transfer,'goals'>) {
  const t=useT();
  if (!goals?.length) return null;
  return <div>{goals.map(g=><p key={g.goal+g.variant}>
    <strong>{t(goalLabels[g.goal].zh,goalLabels[g.goal].en)}
      {g.variant==='reference'?t(' · 参考解',' · reference'):g.variant==='recorded'?t(' · 原解',' · recorded'):''}</strong>
    {' · '}{t('正确','Correct')} {g.correct}/{g.attempts} · {t('手动中位数','Manual median')} {g.medianMs==null?'—':seconds(g.medianMs)+' s'}
    {g.entryMs!=null && ' · '+t('至目标段','To stage entry')+' '+seconds(g.entryMs)+' s'}
    {g.deviceExecutionMs!=null && g.longestGapMs!=null && <small>{t('智能魔方','Smart cube')} · {g.deviceCount} {t('次','attempts')}
      {' · '}{t('首末转动中位数','Median turn span')} {seconds(g.deviceExecutionMs)} s · {t('最长间隔中位数','Median longest gap')} {seconds(g.longestGapMs)} s</small>}
  </p>)}</div>;
}

const retestMetrics = {stepMs:'total', recognitionMs:'recognition', executionMs:'execution', turns:'total'} as const;
type Goal = keyof typeof retestMetrics;

function SavedStageRetests({stage, origin}: {stage:Stage; origin:ReplayPracticeOrigin}) {
  const t = useT();
  const [saved, setSaved] = useState<Goal[]>([]);
  useEffect(() => {
    const refresh = () => {
      try {
        setSaved((Object.keys(retestMetrics) as Goal[]).filter(goal => {
          const key = JSON.stringify([origin.solveKey, stage.key, goal]);
          return localStorage.getItem(replayRetestStorageKey(origin.owner, key)) !== null;
        }));
      } catch { setSaved([]); }
    };
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key.startsWith('cfop-retest:')) refresh(); };
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [stage.key, origin]);
  const set = stage.slot ? 'f2l' : stage.key;
  if (set !== 'cross' && set !== 'oll' && set !== 'pll' && set !== 'zbll' && set !== 'f2l') return null;
  return saved.map(goal => <ReplayPracticeRetest key={goal} readOnly owner={origin.owner} target={{
    key:JSON.stringify([origin.solveKey, stage.key, goal]), label:stage.label, set, metric:retestMetrics[goal],
    practiceScope:stage.slot || stage.key === 'zbll' ? JSON.stringify([origin.solveKey, stage.key]) : undefined, formula:stage.formula,
  }} action={(_, retestKey, evidence) => {
    const result = evidence?.retest;
    if (!result) return null;
    const before = result.beforeMs == null ? '—' : seconds(result.beforeMs);
    const after = result.afterMs == null ? '—' : seconds(result.afterMs);
    return <div className="rr-stage-retest">
      <strong>{t('训练复测','Practice retest')} · {result.name}</strong>
      <p>{result.metric} · {t('中位数','Median')} {before} → {after} {t('秒','s')}</p>
      <small>{t(`有效成绩 · 练前 ${result.beforeValid}/${result.before.length}，练后 ${result.afterValid}/${result.after.length}`,
        `Valid attempts · before ${result.beforeValid}/${result.before.length}, after ${result.afterValid}/${result.after.length}`)}</small>
      {retestKey && <div className="rr-actions"><StagePractice stage={stage} origin={origin} retestKey={retestKey}/></div>}
    </div>;
  }}/>);
}

export default function ReplayStageCard({id, stage: source, origin, playing, toggle, finding, cfop, rotation, splitLastLayer}: {
  cfop?:boolean; rotation?:string; splitLastLayer?:boolean; id?:string; stage:Stage; origin?:ReplayPracticeOrigin; finding?:string; playing:boolean; toggle:()=>void;
}) {
  const [matched, setMatched] = useState<{source: Stage; formula: NonNullable<Stage['formula']>}>();
  useEffect(() => {
    const set = source.key;
    if (!cfop || source.formula || !source.setup || !source.playbackReference || source.rawSetup ||
        (set !== 'pll' && !(set === 'oll' && splitLastLayer))) return;
    let active = true;
    const setup = source.setup;
    void loadLibrarySource('3x3', set).then(file => verifiedPracticeFormula(set, setup, file))
      .then(formula => { if (active && formula) setMatched({source, formula}); }).catch(() => {});
    return () => { active = false; };
  }, [source, cfop, splitLastLayer]);
  const stage = useMemo(() => matched?.source === source ? {...source, formula:matched.formula} : source, [source, matched]);
  const t = useT();
  const [selected, select] = useState<{setup:string; alg:string; label:string; note?:string; slot?:string}>();
  const [chooseGoal, setChooseGoal] = useState(false);
  const zbll = stage.zbll;
  const possible = useMemo<Stage | undefined>(() => zbll?.disposition === 'opportunity' ? {
    ...stage, key:'optional-zbll', label:'ZBLL', fingerprint:undefined, formula:{set:'zbll',caseName:zbll.caseName},
  } : undefined,[stage,zbll]);
  const simulate = (label:string, setup:string, alg:string, note?:string, slot = stage.slot, raw = false) => <button className="rr-action" type="button" key={label} aria-pressed={selected?.label === label}
    onClick={() => select(selected?.label === label ? undefined : {...(cfop ? reviewAlg(setup,alg,rotation,raw) : {setup,alg}),label,note,slot})}>{label}</button>;
  const unit = t('秒','s');
  const original = stage.original, reference = stage.playbackReference;
  const hasPlayer = Boolean(original && stage.setup);
  const title = [stage.label === 'Cross' ? t('十字','Cross') : stage.label, stage.slot].filter(Boolean).join(' · ');
  const timing = (label:string, ms:number|null) => ms != null && <span>{label} <b>{seconds(ms)} {unit}</b></span>;
  return <article id={id} className="rr-panel rr-stage" data-stage={stage.label} aria-label={title} data-site-surface="panel">
    <div className="rr-heading"><h4>{title}</h4>{stage.stepMs != null && <strong>{seconds(stage.stepMs)} {unit}</strong>}</div>
    <div className="rr-stage-metrics">
      {timing(t('起手前','Before execution'),stage.recognitionMs)}{timing(t('执行','Execution'),stage.executionMs)}
      {stage.turns != null && <span>{stage.turns} HTM</span>}
    </div>
    {reference && stage.refUserTurns != null && stage.refTurns != null && <p>{t('原解','Recorded')} <b>{stage.refUserTurns}</b> {t('步','moves')} · {t(stage.slot ? '同槽参考' : '参考解',stage.slot ? 'Same-slot reference' : 'Reference')} <b>{stage.refTurns}</b> {t('步','moves')}</p>}
    {stage.longestGap && <p className="rr-caption">{t(
      `段内最长间隔 ${seconds(stage.longestGap.durationMs)} 秒 · 第 ${stage.longestGap.first}–${stage.longestGap.last} 个动作`,
      `Longest gap ${seconds(stage.longestGap.durationMs)} s · moves ${stage.longestGap.first}–${stage.longestGap.last}`)}</p>}
    {zbll && <p><strong>{zbll.caseName}</strong> · {zbll.disposition === 'executed' ? t('实录末层与公式库路线吻合。','The recorded last layer matches the library algorithm.')
      : zbll.disposition === 'opportunity' ? t('本局分做 OLL 和 PLL。这个起点也可用 ZBLL 一次完成。','This solve used OLL and PLL. ZBLL is available from the same position.')
      : t('本局一次完成末层，执行公式未能唯一确认。可对照此 ZBLL。','The last layer was solved in one stage. Compare the recorded turns with this candidate ZBLL.')}</p>}
    {!!zbll?.sharedWith?.length && <p className="rr-caption">{t(`这条路线也收录在 ${zbll.sharedWith.join(' / ')}。单凭转动记录无法区分当时用哪种方法识别。`,
      `The same sequence is listed in ${zbll.sharedWith.join(' / ')}. The turns alone cannot identify the recognition method.`)}</p>}
    {possible && zbll && <div className="rr-actions"><StagePractice stage={possible} origin={origin}/>
      {simulate(t('回放末层原解','Play recorded last layer'),zbll.setup,zbll.original)}
      {simulate(t('模拟 ZBLL 参考','Play ZBLL reference'),zbll.setup,zbll.reference)}</div>}
    {finding && <p>{finding}</p>}
    {stage.instruction && <p>{stage.instruction}</p>}
    <div className="rr-actions">
      {hasPlayer && <button className="rr-action" type="button" aria-expanded={playing} onClick={toggle}>{playing ? t('收起模拟','Close simulation')
        : reference ? t('模拟对比','Compare solutions') : t('跟练本段原解','Rehearse recorded moves')}</button>}
      {(stage.slot || stage.formula) && <StagePractice stage={stage} origin={origin}/>}
      {stage.key === 'cross' && <AppLink className="site-assistant-action" target="_blank" rel="noopener noreferrer" href="/alg/3x3/cross">{t('练十字','Practise cross')}</AppLink>}
    </div>
    {origin && (stage.fingerprint || stage.formula) && <details onToggle={e=>setChooseGoal(e.currentTarget.open)}><summary>{t('选择练法','Choose a drill')}</summary>
      <div className="rr-actions">{chooseGoal && (['recognition','execution','transition','routes'] as const)
        .filter(goal => goal==='routes' ? original && reference && stage.setup : goal==='transition' ? stage.clips?.some(c=>c.kind==='transition') : true)
        .map(goal=><StagePractice key={goal} stage={stage} origin={origin} goal={goal}/>)}</div></details>}
    {!!stage.clips?.length && <details><summary>{t('衔接与停顿回放','Transitions and pauses')}{!!stage.gapCount && t(` · ${stage.gapCount} 处超过 0.5 秒`,` · ${stage.gapCount} gaps over 0.5 s`)}</summary>
      <div className="rr-actions">{stage.clips.map(c => simulate(c.kind === 'transition' ? t('从上一段连做','Play from previous stage') :
        t(`第 ${c.first}–${c.last} 步 · ${seconds(c.ms)} 秒`,`Moves ${c.first}–${c.last} · ${seconds(c.ms)} s`),c.setup,c.alg,c.startMs!=null && c.endMs!=null ? t(
          `原记录 ${seconds(c.startMs)}–${seconds(c.endMs)} 秒 · ${c.kind==='transition'?'跨段衔接':c.beforeExecution?'起手前':'执行中'}`,
          `Recorded ${seconds(c.startMs)}–${seconds(c.endMs)} s · ${c.kind==='transition'?'transition':c.beforeExecution?'stage entry':'during execution'}`) : undefined, stage.slot, true))}</div></details>}
    {!!stage.alternatives?.length && stage.setup && <details><summary>{t('比较其他空槽','Compare other open slots')}</summary>
      <p>{t('先从本段起点选一对，再查看各槽的路线。每条参考都保留十字和已完成的槽。','Choose your next pair from the stage start, then check the routes. Every line preserves the cross and completed slots.')}</p>
      <div className="rr-actions">{stage.alternatives.map(a => simulate(`${a.slot} · ${a.turns} HTM`,stage.setup!,a.alg,undefined,a.slot))}</div>
      <small>{t('复做 5 次，每次先报出想选的槽，再看路线。记录所选路线的步数和下一对起手前用时。','Repeat five times. Name the slot before revealing the routes. Log its insertion count and the next pair’s entry time.')}</small></details>}
    {stage.fullRoute && <div className="rr-actions">{simulate(t(`整局验证 · ${stage.fullRoute.originalTurns} → ${stage.fullRoute.turns} HTM`,
      `Verified full solve · ${stage.fullRoute.originalTurns} → ${stage.fullRoute.turns} HTM`),stage.fullRoute.setup,stage.fullRoute.alg)}</div>}
    {selected && <div className="rr-lines"><div><span><strong>{selected.label}</strong>{selected.note && <small>{selected.note}</small>}<code dir="ltr">{selected.alg}</code></span>
      <Player key={selected.label} puzzle="3x3" set="" sceneRot={cfop ? reviewCamera(selected.slot, stage.label) : undefined} setup={selected.setup} alg={selected.alg} size={170} moveDurationMs={450}/></div></div>}
    {stage.transfer?.filter(row => !row.comparison).map(row => <div className="rr-stage-retest" key={row.role+row.name}><strong>{t('练后整局','Full solves after practice')} · {row.name}</strong>
      <small>{row.role==='retest' ? t('复测公式','Retest case') : t('本局专项','Recorded case')} · {row.signal==='recognitionMs' ? t('起手前','Before execution') : t('执行','Execution')}</small>
      <p>{t(`近期新打乱中有 ${row.count} 局可比。`,`${row.count} comparable recent solves on new scrambles.`)}
      {row.medianMs!=null && t(` 中位数 ${seconds(row.medianMs)} 秒。`,` Median ${seconds(row.medianMs)} s.`)}
      {row.originalMs!=null && t(` 本局 ${seconds(row.originalMs)} 秒。`,` Original ${seconds(row.originalMs)} s.`)}</p>
      {row.opportunities!=null && <p>{t(`遇到这个 ZBLL 局面 ${row.opportunities} 局，执行路线吻合 ${row.count} 局。`,`Encountered this ZBLL in ${row.opportunities} solves, with ${row.count} matching executions.`)}</p>}
      <GuidedResults goals={row.goals}/>
      {row.count<3 && <small>{t('再积累到 3 局同公式的整局记录，查看专项表现能否复现。','Collect three comparable full solves to check whether the drill result carries over.')}</small>}</div>)}
    {origin && <SavedStageRetests stage={stage} origin={origin}/>}
    {playing && hasPlayer && <div className="rr-lines">
      {[{name:t('本局原解','Recorded solution'), alg:original}, ...(reference ? [{name:t('参考解','Reference solution'), alg:reference}] : [])].map(line =>
        <div key={line.name} role="region" aria-label={line.name}><span><strong>{line.name}</strong><code dir="ltr">{line.alg}</code></span>
          <Player puzzle="3x3" set="" sceneRot={cfop ? reviewCamera(stage.slot, stage.label) : undefined}
            {...(cfop ? reviewAlg(stage.setup!, line.alg!, rotation, stage.rawSetup ?? !reference)
              : {setup:stage.setup!, alg:line.alg!})} size={170} moveDurationMs={450}/></div>)}
      {reference && (stage.key === 'oll' || stage.key === 'pll') && <small>{t('模拟包含起手对齐，步数对照按执行步数统计。','Playback includes the opening alignment. Counts compare execution turns.')}</small>}
    </div>}
  </article>;
}
