import type { ReplayPairTrainingInput, ReconstructAssistantSummary } from '@cuberoot/timer-ui/reconstruct-report';
import { compareF2lTraining, trainingRounds, type TrainingInterval, practiceTransfer, type TransferTarget } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import { algCaseDetailHref, buildCaseSlugMap } from './alg_case_link';
import { loadLibrarySource } from './alg-library-cache';
import { f2lCaseIndex } from './recon-f2l-links';
import { guidedSamples, goalResults } from './replay-guided-practice';
import { readPracticeSolves } from './trainer-store';
import { caseKey } from './trainer-case-key';
import { replayFormulaCard } from './replay-formula-training';

type Stage = ReconstructAssistantSummary['stages'][number];
type Result = NonNullable<Stage['transfer']>[number];

/** Only aggregate measurements leave the device. The trainer role and case both have to match. */
export async function withPracticeTransfer(owner:string, summary:ReconstructAssistantSummary, context:ReplayPairTrainingInput) {
  if (!context.origin || !summary.evidence?.wholeSolve) return summary;
  const {solve,scope} = context.origin;
  const scoped = new Map<string,Stage>();
  for (const stage of summary.stages) {
    if (stage.key) scoped.set(JSON.stringify([scope,stage.key]),stage);
    if (stage.zbll?.disposition==='opportunity') scoped.set(JSON.stringify([scope,'optional-zbll']),stage);
  }
  const intervals = new Map<string,TrainingInterval[]>();
  const targets: {stage:Stage; target:TransferTarget; scope:string; caseKey:string; row:Pick<Result,'name'|'role'|'originalMs'|'goals'|'set'|'caseId'>}[] = [];
  for (const set of ['f2l','adv-f2l','oll','pll','zbll'] as const) {
    const latest = new Map<string,ReturnType<typeof readPracticeSolves>[number]>();
    const guided = guidedSamples(set,owner,scoped);
    for (const row of [...readPracticeSolves(set), ...guided]) {
      const sample=row.practiceSample, source=sample?.replay;
      if (!source || sample.owner!==owner || !scoped.has(source.scope) || !Number.isFinite(row.ms) || row.ms<=0) continue;
      if (!Number.isFinite(sample.startedAt)) continue;
      const key=JSON.stringify([source.scope,source.role,row.caseKey]);
      if (set === 'f2l' || set === 'adv-f2l') {
        const list=intervals.get(source.scope) ?? [];
        list.push({start:sample.startedAt,end:sample.startedAt+row.ms,caseKey:JSON.stringify([set,source.role,row.caseKey])});
        intervals.set(source.scope,list);
      }
      const previous=latest.get(key);
      if (!previous || sample.startedAt+row.ms > previous.practiceSample!.startedAt+previous.ms) latest.set(key,row);
    }
    if (!latest.size) continue;
    const file=await loadLibrarySource('3x3',set);
    for (const row of latest.values()) {
      const source=row.practiceSample!.replay!;
      const stage=scoped.get(source.scope)!;
      const item=file.cases.find(c=>caseKey(c)===row.caseKey);
      if (!item?.id) continue;
      const signal=(stage.recognitionMs ?? 0) > (stage.executionMs ?? 0) ? 'recognitionMs' : 'executionMs';
      const target:TransferTarget={since:row.practiceSample!.startedAt+row.ms,signal};
      let sameOriginal=false;
      if (set==='f2l' || set==='adv-f2l') {
        const slug=buildCaseSlugMap(file.cases,set).byId.get(item.id);
        if (!slug) continue;
        const href=algCaseDetailHref('3x3',set,slug);
        target.fingerprints=new Set([...f2lCaseIndex(file,set)].filter(([,links])=>links.size===1 && links.has(href)).map(([fp])=>fp));
        sameOriginal=!!stage.fingerprint && target.fingerprints.has(stage.fingerprint);
      } else {
        sameOriginal=!!stage.formula && stage.formula.set===set && replayFormulaCard(file,stage.formula,{})?.caseId===item.id
          && (!stage.zbll || stage.zbll.disposition==='executed' || set!=='zbll');
        target.formula=sameOriginal ? stage.formula : {set,caseName:set==='zbll' ? item.meta?.ollcp || item.name : item.name};
      }
      const samples = guided.filter(g=>g.practiceSample?.replay?.scope===source.scope
        && g.practiceSample.replay.role===source.role && g.caseKey===row.caseKey);
      targets.push({stage,target,scope:source.scope,caseKey:JSON.stringify([set,source.role,row.caseKey]),row:{
        set,caseId:item.id,goals:goalResults(samples),role:source.role,
        name:set==='zbll' ? item.meta?.ollcp || item.name : row.caseName,
        originalMs:sameOriginal ? stage[signal] : null,
      }});
    }
  }
  if (!targets.length) return summary;
  const history = context.history ?? [];
  const pairs = targets.filter(item => item.target.fingerprints);
  const lastLayer = targets.filter(item => !item.target.fingerprints);
  const rounds=new Map([...intervals].map(([scope,list])=>[scope,trainingRounds(history,solve,list)]));
  const batches=pairs.flatMap(pair=>(rounds.get(pair.scope) ?? []).filter(r=>r.cases.has(pair.caseKey))
    .map(window=>({pair,window,fingerprints:pair.target.fingerprints!})));
  const compared=await compareF2lTraining(history,solve,batches);
  const metrics = lastLayer.length ? await practiceTransfer(history, solve, lastLayer.map(item => item.target),
    set => loadLibrarySource('3x3', set)) : [];
  const byStage = new Map<Stage, Result[]>();
  function append(stage: Stage, result: Result) {
    const list = byStage.get(stage) ?? [];
    list.push(result);
    byStage.set(stage, list);
  }
  for(const pair of pairs){
    const history=batches.flatMap((batch,i)=>batch.pair===pair?[{start:batch.window.start,comparison:compared[i]}]:[]);
    const latest=history.pop();
    if(!latest)continue;
    const {comparison}=latest;
    append(pair.stage,{...pair.row,signal:pair.target.signal,count:comparison.after.count,
      medianMs:comparison.after[pair.target.signal],comparison,previousRounds:history});
  }
  lastLayer.forEach(({stage, row, target}, i) => append(stage, {...row, signal: target.signal, ...metrics[i]}));
  return {...summary, stages: summary.stages.map(stage => byStage.has(stage) ? {...stage, transfer: byStage.get(stage)} : stage)};
}
