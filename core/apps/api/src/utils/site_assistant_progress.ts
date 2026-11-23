import { assistantToolWasReused } from './site_assistant_execution.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { assistantProgressScope, type AssistantProgress, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';

type ProgressScope = { emit: (event: AssistantStreamEvent) => Promise<void>; signal: AbortSignal; started: number; nextId: number; closed: boolean };
const scope = new AsyncLocalStorage<ProgressScope>();

/** Request-local execution events. No model output or arbitrary tool data crosses this boundary. */
export async function withAssistantProgress<T>(emit: ProgressScope['emit'] | undefined, signal: AbortSignal, started: number, run: () => Promise<T>, nextId=0) {
  if (!emit) return run();
  const state: ProgressScope = { emit, signal, started, nextId, closed: false };
  try { return await scope.run(state, run); }
  finally { state.closed = true; }
}

export async function startAssistantProgress(phase: string, tool?: string, activity?: AssistantProgress['activity'], toolArgs?:unknown) {
  const state = scope.getStore();
  if (!state || state.closed || state.signal.aborted || !['tool', 'model', 'review'].includes(phase) || state.nextId >= 512) return;
  const started = performance.now();
  const queryScope=phase==='tool' ? assistantProgressScope(toolArgs) : undefined;
  const event: AssistantProgress = { id: ++state.nextId, phase: phase as AssistantProgress['phase'], state: 'running',
    elapsedMs: Math.max(0, Math.round(started - state.started)), ...(phase === 'tool' && tool ? { tool } : {}),
    ...(phase === 'model' && activity ? {activity} : {}),...(queryScope?{scope:queryScope}:{}) };
  await state.emit({ type: 'progress', progress: event });
  return async (failed: boolean, result?: unknown) => {
    if (state.closed || state.signal.aborted) return;
    // A completed read is not proof of complete evidence or a correct final answer.
    const value = result && typeof result === 'object' ? result as Record<string, unknown> : undefined;
    const evidence = value?.evidence && typeof value.evidence === 'object' ? value.evidence as Record<string, unknown> : undefined;
    const outcome = value?.outcome && typeof value.outcome === 'object' ? value.outcome as Record<string, unknown> : undefined;
    const incomplete = evidence?.notEvidence === true || evidence?.contextIncomplete === true || !!evidence?.error || outcome?.state === 'partial';
    const unavailable = outcome?.state === 'temporary_failure' || evidence?.status === 'unavailable';
    const sources = phase === 'tool' && Array.isArray(value?.sources) ? value.sources : [];
    const sourceCount = new Set(sources.flatMap(source => source && typeof source === 'object' && source.read === true && typeof source.id === 'string' ? [source.id] : [])).size;
    await state.emit({ type: 'progress', progress: { ...event,
      ...(assistantToolWasReused(result) ? {reused:true} : {}),
      state: failed || unavailable ? 'error' : incomplete ? 'partial' : 'complete',
      durationMs: Math.max(0, Math.round(performance.now() - started)), ...(sourceCount ? { sourceCount } : {}) } });
  };
}
