import type { AssistantErrorCode } from '@cuberoot/shared/site-assistant';
import { currentDiagnosticRequestId, diagnosticLog } from '../observability/request.js';
import { recordAssistantStage } from './site_assistant_monitor.js';

export interface AssistantModelDiagnostic {
  reason: 'empty_output' | 'invalid_json' | 'invalid_schema' | 'output_truncated' | 'unexpected_tool_call' | 'http_error' | 'network_error' | 'provider_error' | 'empty_body' | 'response_too_large' | 'aborted';
  finishReason?: string;
  issues?: Array<{ path: string; code: string }>;
}

export class AssistantFailure extends Error {
  constructor(public readonly code: AssistantErrorCode, public readonly upstreamStatus?: number,
    public readonly diagnostic?: AssistantModelDiagnostic, public readonly retryAfterMs?: number) { super(code); }
}
export function assistantFailureCode(error: unknown): AssistantErrorCode {
  if (error instanceof AssistantFailure) return error.code;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout';
  return 'unavailable';
}

/** Bound even a stalled quota/provider dependency; late completion cannot start new work. */
export function assistantDeadline<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new AssistantFailure('timeout'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(run).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Never log questions, identities, URLs, evidence, provider bodies or credentials. */
export async function assistantStage<T>(stage: 'auth' | 'quota' | 'model' | 'data' | 'page' | 'tool' | 'total', run: () => Promise<T>, round?: number, tool?: string): Promise<T> {
  const started = performance.now();
  const requestId = currentDiagnosticRequestId();
  diagnosticLog('site_assistant_stage', { requestId, stage, phase: 'start', round });
  let code: AssistantErrorCode | undefined;
  let upstreamStatus: number | undefined;
  try { return await run(); }
  catch (error) { code = assistantFailureCode(error); upstreamStatus=error instanceof AssistantFailure?error.upstreamStatus:undefined; throw error; }
  finally {
    const durationMs = Math.round(performance.now() - started);
    recordAssistantStage(stage, durationMs, !!code, tool);
    diagnosticLog('site_assistant_stage', { requestId, stage, phase: 'end', round, durationMs, code: code ?? 'ok', upstreamStatus }, !!code);
  }
}

export function checkAssistantResponse(response: Response, source: 'model' | 'source') {
  const location = response.headers.get('location') ?? '';
  if (response.headers.get('x-cuberoot-verification-required') === '1' || /\/(?:zh\/|en\/)?competition-verify(?:[/?]|$)/.test(location) || (source === 'source' && [401, 403].includes(response.status))) {
    throw new AssistantFailure('source_verification_required',response.status);
  }
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs = retryAfter === null ? undefined : /^\d+(?:\.\d+)?$/.test(retryAfter)
      ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
    throw new AssistantFailure(source === 'model' ? response.status === 429 ? 'model_rate_limited' : 'model_unavailable' : 'source_unavailable', response.status,
      source === 'model' ? { reason: 'http_error' } : undefined,
      Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
  }
}
