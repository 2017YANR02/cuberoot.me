import type { SolveMove } from '@cuberoot/shared/timer/types';
import type { CfopReplayStage } from './cfop-diagnosis';
import type { ReconstructAssistantSummary } from './ReconstructHost';

export const MIN_TRANSFER_SOLVES = 3;

type Stage = ReconstructAssistantSummary['stages'][number];
export function reviewClips(stage:CfopReplayStage, scramble:string, moves:SolveMove[]): Pick<Stage,'clips'|'gapCount'> {
  const clips: NonNullable<Stage['clips']> = [];
  const tokens = (first:number, last:number) => moves.slice(first,last+1).map(move=>move.m).join(' ');
  const clip = (kind:'pause'|'transition', first:number, last:number, ms:number, beforeExecution:boolean) => ({
    kind, first:first+1, last:last+1, startMs:moves[first].ts, endMs:moves[last].ts, ms, beforeExecution,
    setup:[scramble,tokens(0,first-1)].filter(Boolean).join(' '), alg:tokens(first,last),
  });
  const threshold = stage.column.recognitionMs == null ? null : stage.startMs + stage.column.recognitionMs;
  const gaps = [];
  for (let i=Math.max(1,stage.firstMoveIndex); i<=stage.endMoveIndex; i++) {
    const ms = moves[i].ts - moves[i-1].ts;
    if (ms > 500) gaps.push({i,ms});
  }
  for (const {i,ms} of gaps.sort((a,b)=>b.ms-a.ms).slice(0,3)) {
    clips.push(clip('pause',i-1,i,ms,threshold != null && moves[i].ts <= threshold));
  }
  if (stage.firstMoveIndex > 0 && stage.column.key.startsWith('slot-')) {
    clips.push(clip('transition', Math.max(0,stage.firstMoveIndex-3),stage.endMoveIndex,stage.column.recognitionMs ?? 0,true));
  }
  return {clips,gapCount:gaps.length};
}

export function wholeSolveCoaching(stages:Stage[], total:number, freePairs:number, tr:(copy:{zh:string;en:string})=>string) {
  const starts = stages.filter(s=>s.recognitionMs != null && s.stepMs && s.recognitionMs > s.stepMs/2);
  const start = starts.sort((a,b)=>b.recognitionMs! - a.recognitionMs!)[0];
  const rhythm = stages.flatMap(s=>(s.clips ?? []).filter(c=>c.kind==='pause' && !c.beforeExecution).map(c=>({s,c})))
    .sort((a,b)=>b.c.ms-a.c.ms)[0];
  const routes = stages.filter(s=>s.slot && s.refTurns != null && s.refUserTurns != null && s.refTurns < s.refUserTurns)
    .sort((a,b)=>(b.refUserTurns!-b.refTurns!) - (a.refUserTurns!-a.refTurns!));
  const sec = (ms:number) => (ms/1000).toFixed(3);
  const route = routes[0];
  let review: {label:string; kind:'entry'|'pause'|'route'; first?:number; last?:number} | undefined;
  let priority:string | undefined;
  if (start && start.recognitionMs! >= (rhythm?.c.ms ?? 0)) {
    review = {label:start.label, kind:'entry'};
    const share = Math.round(100*start.recognitionMs!/start.stepMs!);
    priority = tr({zh:`先回看 ${start.label} 起手。起手前 ${sec(start.recognitionMs!)} 秒，占本段 ${share}%。先从上一段末尾连入，再练本段。`,
      en:`Review the entry to ${start.label} first. Its ${sec(start.recognitionMs!)} s before execution accounts for ${share}% of the stage. Practise the transition first.`});
  } else if (rhythm) {
    review = {label:rhythm.s.label, kind:'pause', first:rhythm.c.first, last:rhythm.c.last};
    priority = tr({zh:`先回看 ${rhythm.s.label} 的第 ${rhythm.c.first}–${rhythm.c.last} 个动作。执行中间隔 ${sec(rhythm.c.ms)} 秒，先慢速连做这两步。`,
      en:`Review moves ${rhythm.c.first}–${rhythm.c.last} in ${rhythm.s.label}. There is a ${sec(rhythm.c.ms)} s execution gap. Link these turns slowly.`});
  } else if (route) {
    review = {label:route.label, kind:'route'};
    priority = tr({zh:`先回看 ${route.label} 的路线。原解 ${route.refUserTurns} 步，同槽参考 ${route.refTurns} 步，分别练配对和入槽。`,
      en:`Review the ${route.label} route first. Compare ${route.refUserTurns} recorded moves with ${route.refTurns} for the same slot. Practise pairing and insertion separately.`});
  }
  const equal = stages.find(s=>s.slot && s.refUserTurns!=null && s.refTurns!=null && s.refUserTurns<=s.refTurns);
  const strength = freePairs ? tr({zh:`十字完成时已带入 ${freePairs} 对 F2L，值得保留这次连做。`,en:`The cross also solved ${freePairs} F2L pair(s). Keep that transition.`})
    : equal && tr({zh:`${equal.label} 的原解 ${equal.refUserTurns} 步，已达到同槽参考的步数水平。`, en:`${equal.label} took ${equal.refUserTurns} moves, matching or beating its reference.`});
  const before = stages.reduce((n,s)=>n+(s.recognitionMs ?? 0),0);
  const complete = stages.length>0 && stages.every(s=>s.recognitionMs!=null && s.stepMs!=null);
  const timing = complete && total>0 ? tr({zh:`可分析阶段起手前共 ${sec(before)} 秒，占整局 ${(100*before/total).toFixed(1)}%。`,
    en:`Measured stage entries total ${sec(before)} s (${(100*before/total).toFixed(1)}% of the solve).`}) : undefined;
  return {priority,strength,timing,review};
}

export function transferReading(comparison: import('./cfop-personal-baseline').F2lTransferComparison,
  tr:(copy:{zh:string;en:string})=>string) {
  const {before,after} = comparison;
  if (before.count<MIN_TRANSFER_SOLVES || after.count<MIN_TRANSFER_SOLVES) return;
  const changes = (['recognitionMs','executionMs'] as const).flatMap(metric => {
    const a=before[metric], b=after[metric];
    if (a==null || b==null) return [];
    const delta=Math.round(b-a), seconds=(Math.abs(delta)/1000).toFixed(3);
    const label=tr(metric==='recognitionMs'?{zh:'起手前',en:'Entry'}:{zh:'执行',en:'Execution'});
    return [label+tr(delta===0?{zh:'持平',en:' unchanged'}:delta>0
      ?{zh:'变长 '+seconds+' 秒',en:' longer by '+seconds+' s'}:{zh:'缩短 '+seconds+' 秒',en:' shorter by '+seconds+' s'})];
  });
  return changes.join(tr({zh:'，',en:', '}));
}

/** Compare two observed executions from distinct solves at the same slot. */
export function executionExamples(comparison: import('./cfop-personal-baseline').F2lTransferComparison) {
  const {before,after} = comparison;
  if (Math.min(before.count,after.count)<MIN_TRANSFER_SOLVES || before.executionMs==null ||
    after.executionMs==null || after.executionMs<=before.executionMs) return [];
  const sorted=[...after.hits].sort((a,b)=>b.executionMs-a.executionMs);
  for (const slow of sorted) {
    for (let index = sorted.length - 1; index >= 0; index--) {
      const fast = sorted[index];
      if (fast.slot === slow.slot && fast.solveId !== slow.solveId && fast.executionMs < slow.executionMs) {
        return [slow, fast];
      }
    }
  }
  return [];
}
