import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { AssistantToolCall, ToolResult } from './site_assistant_tools.js';

export class AssistantSteered extends Error {}
export interface AssistantExecution {
  boundary(): Promise<void>;
  tool(call: AssistantToolCall, key: string, run: () => Promise<ToolResult>): Promise<ToolResult>;
  scope: string;
  bindings?: string;
  messages?: readonly string[];
}
const execution = new AsyncLocalStorage<AssistantExecution>();
export const withAssistantExecution = <T>(state: AssistantExecution, run: () => Promise<T>) => execution.run(state, run);
export const assistantExecutionMessages = () => execution.getStore()?.messages;
export const assistantExecutionBoundary = () => execution.getStore()?.boundary();
/** Keep a bounded set of independent reads in flight. Consume outcomes in
 * planner order so completion order never changes citations or tool IDs. */
export async function readAssistantBatch<T, R>(items: readonly T[], concurrency: 2 | 4,
  read: (item: T) => Promise<R>, signal?: AbortSignal): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length && !signal?.aborted) {
      const index = next++;
      try { results[index] = { status: 'fulfilled', value: await read(items[index]) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, worker));
  signal?.throwIfAborted();
  return results;
}

// Share capacity, never responses, across requests to the same public origin.
// Hand each freed slot directly to the oldest waiter to prevent queue jumping.
const sourceOrigins = new Map<string, { active: number; waiting: Set<() => void> }>();
const sourceConcurrency = 8;
export async function withAssistantSourceSlot<T>(origin: string, signal: AbortSignal, read: (signal: AbortSignal) => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  const pool = sourceOrigins.get(origin) ?? {active: 0, waiting: new Set<() => void>()};
  sourceOrigins.set(origin, pool);
  if (pool.active < sourceConcurrency) {
    pool.active++;
  } else {
    await new Promise<void>((resolve, reject) => {
      const resume = () => {
        signal.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        pool.waiting.delete(resume);
        reject(signal.reason);
      };
      pool.waiting.add(resume);
      signal.addEventListener('abort', abort, {once: true});
    });
  }
  try {
    signal.throwIfAborted();
    return await read(signal);
  } finally {
    const next = pool.waiting.values().next().value;
    if (next) {
      pool.waiting.delete(next);
      next();
    } else if (--pool.active === 0) {
      sourceOrigins.delete(origin);
    }
  }
}

function canonical(value: unknown): unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}
/** Only validated server calls are cached. Scope-dependent tools bind the full request. */
export async function checkpointAssistantTool(call: AssistantToolCall, run: () => Promise<ToolResult>, scoped=false): Promise<ToolResult> {
  const state=execution.getStore();
  if(!state)return run();
  await state.boundary();
  const key=createHash('sha256').update(JSON.stringify(canonical({version:1,call,bindings:state.bindings,scope:scoped?state.scope:undefined}))).digest('hex');
  return state.tool(call,key,run);
}

const reused = new WeakSet<object>();
export function markAssistantToolReused(result: ToolResult) { reused.add(result); return result; }
export function assistantToolWasReused(result: unknown) { return !!result && typeof result==='object' && reused.has(result); }
