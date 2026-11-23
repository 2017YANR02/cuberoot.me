import { assistantProgressScope, type AssistantProgress } from '@cuberoot/shared/site-assistant';

export function assistantProgressView(progress: readonly AssistantProgress[]) {
  const steps=[...progress].sort((a,b)=>a.id-b.id);
  return {steps,current:steps.findLast(step=>step.state==='running') ?? steps.at(-1)};
}

/** Ignore malformed/newer events and keep updates tied to their original step. */
export function updateAssistantProgress(previous: AssistantProgress[], input: unknown): AssistantProgress[] {
  if (!input || typeof input !== 'object') return previous;
  const p = input as AssistantProgress;
  const scope=p.phase==='tool' ? assistantProgressScope(p.scope) : undefined;
  const ms = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 600_000;
  if (!Number.isSafeInteger(p.id) || p.id < 1 || p.id > 64 || !['tool','model','review'].includes(p.phase)
    || !['running','complete','partial','error'].includes(p.state) || !ms(p.elapsedMs)
    || (p.durationMs !== undefined && !ms(p.durationMs)) || (p.tool !== undefined && (typeof p.tool !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(p.tool)))
    || (p.activity !== undefined && (p.phase!=='model' || !['plan','write'].includes(p.activity)))
    || (p.sourceCount !== undefined && (!Number.isSafeInteger(p.sourceCount) || p.sourceCount < 0 || p.sourceCount > 100))) return previous;
  const value: AssistantProgress = { id:p.id, phase:p.phase, state:p.state, elapsedMs:p.elapsedMs,
    ...(p.tool ? {tool:p.tool} : {}), ...(scope ? {scope} : {}), ...(p.activity ? {activity:p.activity} : {}), ...(p.reused===true ? {reused:true} : {}),
    ...(p.durationMs === undefined ? {} : {durationMs:p.durationMs}), ...(p.sourceCount === undefined ? {} : {sourceCount:p.sourceCount}) };
  const existing = previous.find(item => item.id === p.id);
  if (existing && (existing.state !== 'running' || existing.phase !== p.phase || existing.tool !== p.tool || existing.activity !== p.activity)) return previous;
  return (existing ? previous.map(item => item.id === p.id ? value : item) : [...previous, value]).sort((a,b) => a.id-b.id).slice(-64);
}
