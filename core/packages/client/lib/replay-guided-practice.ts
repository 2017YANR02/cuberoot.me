import { persistItem } from './safe-storage';
import type { TrainerSolve } from './trainer-store';
import type { PracticeGoal } from './replay-training-session';

export type GuidedSample = TrainerSolve & {goal:PracticeGoal; variant:'recorded'|'reference'|'case'; entryMs?:number; turnSpan?:{executionMs:number; longestGapMs:number}};
const prefix = 'cfop-guided-attempt:';

export function measuredTurnSpan(times:readonly number[]) {
  if (times.length<2) return;
  let longestGapMs=0;
  for (let i=1;i<times.length;i++) {
    const gap=times[i]-times[i-1];
    if (!Number.isFinite(gap) || gap<=0) return;
    longestGapMs=Math.max(longestGapMs,gap);
  }
  return {executionMs:times[times.length-1]-times[0],longestGapMs};
}

export function storeGuidedSample(set:string, sample:GuidedSample) {
  return persistItem(prefix+set+':'+sample.practiceSample!.id, JSON.stringify(sample));
}

export function guidedSamples(set:string, owner:string, scopes:ReadonlyMap<string,unknown>) {
  const rows:GuidedSample[] = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix+set+':')) continue;
    try {
      const row:GuidedSample = JSON.parse(localStorage.getItem(key) ?? 'null');
      const sample = row?.practiceSample;
      if (sample?.owner===owner && sample.replay && scopes.has(sample.replay.scope) && row.ms>0) rows.push(row);
    } catch { /* Skip an incomplete local entry. */ }
  }
  return rows;
}

export function goalResults(samples:GuidedSample[]) {
  const groups = new Map<string, GuidedSample[]>();
  for (const row of samples) {
    const key = row.goal+'/'+row.variant;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key,group);
  }
  const median = (values:number[]) => {
    if (!values.length) return null;
    values.sort((a,b)=>a-b);
    return (values[(values.length-1)>>1]+values[values.length>>1])/2;
  };
  return [...groups.values()].map(group => {
    const valid = group.filter(row=>row.penalty==='ok');
    return {goal:group[0].goal,variant:group[0].variant, attempts:group.length, correct:valid.length,
      deviceCount:valid.filter(row=>row.turnSpan).length,
      deviceExecutionMs:median(valid.flatMap(row=>row.turnSpan?[row.turnSpan.executionMs]:[])),
      longestGapMs:median(valid.flatMap(row=>row.turnSpan?[row.turnSpan.longestGapMs]:[])),
      medianMs:median(valid.map(row=>row.ms)), entryMs:median(valid.flatMap(row=>row.entryMs!=null?[row.entryMs]:[]))};
  });
}
