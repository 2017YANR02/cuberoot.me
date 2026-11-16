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
