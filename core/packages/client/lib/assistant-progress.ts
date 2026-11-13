import type { AssistantProgress } from '@cuberoot/shared/site-assistant';

/** Ignore malformed/newer events and keep updates tied to their original step. */
export function updateAssistantProgress(previous: AssistantProgress[], input: unknown): AssistantProgress[] {
  if (!input || typeof input !== 'object') return previous;
  const p = input as AssistantProgress;
  const ms = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 600_000;
  if (!Number.isSafeInteger(p.id) || p.id < 1 || p.id > 64 || !['tool','model','review'].includes(p.phase)
    || !['running','complete','partial','error'].includes(p.state) || !ms(p.elapsedMs)
    || (p.durationMs !== undefined && !ms(p.durationMs)) || (p.tool !== undefined && (typeof p.tool !== 'string' || !/^[a-z_]{1,64}$/.test(p.tool)))
    || (p.sourceCount !== undefined && (!Number.isSafeInteger(p.sourceCount) || p.sourceCount < 0 || p.sourceCount > 100))) return previous;
  const value: AssistantProgress = { id:p.id, phase:p.phase, state:p.state, elapsedMs:p.elapsedMs,
    ...(p.tool ? {tool:p.tool} : {}), ...(p.durationMs === undefined ? {} : {durationMs:p.durationMs}), ...(p.sourceCount === undefined ? {} : {sourceCount:p.sourceCount}) };
  const existing = previous.find(item => item.id === p.id);
  if (existing && (existing.state !== 'running' || existing.phase !== p.phase || existing.tool !== p.tool)) return previous;
  return (existing ? previous.map(item => item.id === p.id ? value : item) : [...previous, value]).sort((a,b) => a.id-b.id).slice(-64);
}
