import type { AssistantErrorCode } from '@cuberoot/shared/site-assistant';
import { currentDiagnosticRequestId, diagnosticLog } from '../observability/request.js';

export class AssistantFailure extends Error {
  constructor(public readonly code: AssistantErrorCode, public readonly upstreamStatus?: number) { super(code); }
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
export async function assistantStage<T>(stage: 'auth' | 'quota' | 'model' | 'data' | 'page' | 'tool' | 'total', run: () => Promise<T>, round?: number): Promise<T> {
  const started = performance.now();
  const requestId = currentDiagnosticRequestId();
  diagnosticLog('site_assistant_stage', { requestId, stage, phase: 'start', round });
  let code: AssistantErrorCode | undefined;
  let upstreamStatus: number | undefined;
  try { return await run(); }
  catch (error) { code = assistantFailureCode(error); upstreamStatus=error instanceof AssistantFailure?error.upstreamStatus:undefined; throw error; }
  finally { diagnosticLog('site_assistant_stage', { requestId, stage, phase: 'end', round, durationMs: Math.round(performance.now() - started), code: code ?? 'ok', upstreamStatus }, !!code); }
}

export function checkAssistantResponse(response: Response, source: 'model' | 'source') {
  const location = response.headers.get('location') ?? '';
  if (response.headers.get('x-cuberoot-verification-required') === '1' || /\/(?:zh\/|en\/)?competition-verify(?:[/?]|$)/.test(location) || (source === 'source' && [401, 403].includes(response.status))) {
    throw new AssistantFailure('source_verification_required',response.status);
  }
  if (!response.ok) throw new AssistantFailure(source === 'model' ? 'model_unavailable' : 'source_unavailable',response.status);
}
