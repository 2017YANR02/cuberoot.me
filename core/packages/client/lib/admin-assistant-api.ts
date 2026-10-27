import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';
import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';

export interface ChatCounts {
  requests: number; users: number; success: number; errors: number; cancelled: number; rejected: number; running: number; interrupted: number; images: number;
  avg_ms: number | null; p50_ms: number | null; p95_ms: number | null; first_answer_ms: number | null;
}
export interface ChatSummary {
  timeZone: string; days: number; updatedAt: string;
  state: { enabled_at: string; last_cleanup_at: string | null; failed_writes?: number; last_replay_at?: string | null } | null;
  health: { pendingCompletions?: number; failedWrites: number; lastFailureAt: string | null; lastWriteAt: string | null };
  totals: ChatCounts; daily: Array<ChatCounts & { day: string }>;
  models: Array<{ model: string; kind: string; calls: number; missing_usage: number; thinking_calls: number; input_tokens: number | null; output_tokens: number | null; cached_tokens: number | null; reasoning_tokens: number | null }>;
  tools: Array<{ tool: string; calls: number }>;
  errors: Array<{ error_code: string; requests: number }>;
}
export interface ChatRecord {
  conversation_id: string | null; parent_id: string | null; retry_of: string | null; feedback: string | null; review_status: string;
  id: string; user_id: string | null; started_at: string; status: string; error_code: string | null; lang: string; model: string;
  streaming: boolean; image_count: number; history_count: number; duration_ms: number | null; first_answer_ms: number | null; question: string | null;
}
export interface ChatDetail extends ChatRecord {
  review_note: string | null; reviewed_by: string | null; reviewed_at: string | null; clicked_actions: Record<string,boolean>;
  content_expired: boolean; answer: string | null; response: Omit<AssistantAnswer, 'answer'> | null;
  metrics: { stages?: Record<string, { calls: number; ms: number; errors: number }>; tools?: Record<string, number>;
    models?: Array<{ model: string; thinking: boolean; input: number | null; output: number | null; cached: number | null; reasoning: number | null; cacheAdjustedCny?: {min:number;max:number}|null }> };
}
export interface ChatRecords { rows: ChatRecord[]; total: number; page: number; pageSize: number }
export async function fetchChatMonitoring<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  return handleApi<T>(await sessionFetch(apiUrl(`/v1/admin/assistant/${path}?${new URLSearchParams(params)}`), { headers: authHeaders(false), cache: 'no-store', signal }));
}

export interface ChatInsights {
  feedback: Array<{ feedback: string; review_status: string; requests: number }>;
  retrievals: Array<{ mode: string; reason: string | null; calls: number; empty: number }>;
  entries: Array<{ code: string; requests: number }>;
  alerts: Array<{ code: string; active: boolean; opened_at: string; resolved_at: string | null; checked_at: string; details: unknown }>;
  daily: Array<{ day: string; metrics: { requests: number; users: number; success: number; errors: number; feedback: number; helpful: number; clicked: number; gross_cny: number; unpriced_calls: number; avg_ms: number | null; p95_ms: number | null } }>;
  audit: Array<{ at: string; actor: string; action: string; record_id: string | null }>;
  cost: { gross_cny: number; unpriced_calls: number; clicked: number; with_links: number };
}
export async function reviewAssistantRequest(id: string, status: string, note: string) {
  return handleApi(await sessionFetch(apiUrl(`/v1/admin/assistant/requests/${id}/review`), { method: 'POST', headers: authHeaders(), body: JSON.stringify({status,note}) }));
}
