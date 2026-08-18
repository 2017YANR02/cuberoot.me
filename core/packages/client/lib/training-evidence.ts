import {
  TEACHING_ERROR_CODES,
  parseTrainingEvidenceV1,
  type TeachingApiErrorBody,
  type TeachingErrorCode,
  type TeachingSelfTrainingEvidenceResult,
  type TrainingEvidenceSource,
  type TrainingEvidenceV1,
} from '@cuberoot/shared/teaching';

import { authHeaders } from './admin-api';
import { apiUrl } from './api-base';
import { persistItem } from './safe-storage';

export const TRAINING_EVIDENCE_OUTBOX_PREFIX = 'cuberoot-training-evidence.v1.';
export const TRAINING_EVIDENCE_OUTBOX_CAPACITY = 200;
export const TRAINING_EVIDENCE_OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const TRAINING_EVIDENCE_RETRY_BASE_MS = 5_000;
export const TRAINING_EVIDENCE_RETRY_MAX_MS = 60 * 60 * 1_000;

const DEFAULT_FLUSH_BATCH_SIZE = 20;
const AUTH_RETRY_MS = 60_000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1_000;
const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TrainingEvidenceDestination {
  organizationSlug: string;
  assignmentId?: string;
}

export type TrainingEvidenceDraft = TrainingEvidenceV1 extends infer Evidence
  ? Evidence extends TrainingEvidenceV1
    ? Omit<Evidence, 'assignmentIds'>
    : never
  : never;

export interface TrainingEvidenceOutboxError {
  status: number | null;
  code?: TeachingErrorCode;
  message: string;
  requestId?: string;
}

export interface TrainingEvidenceOutboxItem {
  destination: TrainingEvidenceDestination;
  evidence: TrainingEvidenceV1;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  state: 'pending' | 'failed';
  lastError?: TrainingEvidenceOutboxError;
}

export type TrainingEvidenceEnqueueResult =
  | { status: 'queued'; item: TrainingEvidenceOutboxItem }
  | { status: 'duplicate'; item: TrainingEvidenceOutboxItem }
  | { status: 'full' }
  | { status: 'unavailable' };

export interface TrainingEvidenceFlushSummary {
  sent: number;
  replayed: number;
  retryScheduled: number;
  permanentFailed: number;
  deferred: number;
  expired: number;
  invalid: number;
}

interface EnqueueOptions {
  now?: number;
}

interface FlushOptions {
  now?: number;
  fetch?: typeof fetch;
  maxBatchSize?: number;
}

interface ReadOutboxResult {
  items: Array<{ storageKey: string; item: TrainingEvidenceOutboxItem }>;
  expired: number;
  invalid: number;
}

export class TrainingEvidenceOutboxConflictError extends Error {
  constructor() {
    super('sourceEventId is already queued with different training evidence');
    this.name = 'TrainingEvidenceOutboxConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTrainingEvidenceDestination(value: unknown): TrainingEvidenceDestination {
  if (!isRecord(value)) throw new Error('training evidence destination must be an object');
  const allowed = new Set(['organizationSlug', 'assignmentId']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${key} is not accepted in the training evidence destination`);
  }

  const organizationSlug = typeof value.organizationSlug === 'string'
    ? value.organizationSlug.trim().toLowerCase()
    : '';
  if (!ORGANIZATION_SLUG_PATTERN.test(organizationSlug)) {
    throw new Error('organizationSlug must be a valid organization slug');
  }

  if (value.assignmentId === undefined) return { organizationSlug };
  const assignmentId = typeof value.assignmentId === 'string' ? value.assignmentId.trim().toLowerCase() : '';
  if (!UUID_PATTERN.test(assignmentId)) throw new Error('assignmentId must be a UUID');
  return { organizationSlug, assignmentId };
}

/**
 * Training tools only enter assignment mode when both opaque launch parameters
 * are present and valid. Ordinary visits remain completely local.
 */
export function parseTrainingAssignmentDestination(
  search: string | URLSearchParams,
): TrainingEvidenceDestination | null {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;
  const organizationSlug = params.get('trainingOrg');
  const assignmentId = params.get('trainingAssignment');
  if (!organizationSlug || !assignmentId) return null;
  try {
    return parseTrainingEvidenceDestination({ organizationSlug, assignmentId });
  } catch {
    return null;
  }
}

function uuidV4(): string {
  if (typeof crypto === 'undefined') throw new Error('secure random source is unavailable');
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/** Generate once per completed attempt. The queued evidence keeps this ID across every retry. */
export function createTrainingEvidenceEventId(source: TrainingEvidenceSource): string {
  return `${source}:${uuidV4()}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function outboxIdentity(destination: TrainingEvidenceDestination, evidence: TrainingEvidenceV1): string {
  return `${destination.organizationSlug}\u0000${evidence.source}\u0000${evidence.sourceEventId}`;
}

function outboxStorageKey(destination: TrainingEvidenceDestination, evidence: TrainingEvidenceV1): string {
  return TRAINING_EVIDENCE_OUTBOX_PREFIX + encodeURIComponent(outboxIdentity(destination, evidence));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalEvidenceForDestination(
  destination: TrainingEvidenceDestination,
  draft: TrainingEvidenceDraft,
): TrainingEvidenceV1 {
  if ('assignmentIds' in draft) {
    throw new Error('assignmentIds must come from the training evidence destination');
  }
  return parseTrainingEvidenceV1({
    ...draft,
    assignmentIds: destination.assignmentId ? [destination.assignmentId] : undefined,
  });
}

function parseOutboxError(value: unknown): TrainingEvidenceOutboxError | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status === null || (Number.isSafeInteger(value.status) && (value.status as number) >= 0)
    ? value.status as number | null
    : null;
  const code = typeof value.code === 'string'
    && (TEACHING_ERROR_CODES as readonly string[]).includes(value.code)
    ? value.code as TeachingErrorCode
    : undefined;
  const message = typeof value.message === 'string' ? value.message.slice(0, 500) : 'Training evidence request failed';
  const requestId = typeof value.requestId === 'string' ? value.requestId.slice(0, 200) : undefined;
  return { status, code, message, requestId };
}

function parseOutboxItem(value: unknown): TrainingEvidenceOutboxItem {
  if (!isRecord(value)) throw new Error('invalid outbox item');
  const destination = parseTrainingEvidenceDestination(value.destination);
  const evidence = parseTrainingEvidenceV1(value.evidence);
  if (destination.assignmentId) {
    if (evidence.assignmentIds?.length !== 1 || evidence.assignmentIds[0] !== destination.assignmentId) {
      throw new Error('outbox assignment does not match its destination');
    }
  } else if (evidence.assignmentIds !== undefined) {
    throw new Error('unassigned outbox destination cannot contain assignmentIds');
  }
  const queuedAt = value.queuedAt;
  const attempts = value.attempts;
  const nextAttemptAt = value.nextAttemptAt;
  if (!Number.isSafeInteger(queuedAt) || (queuedAt as number) < 0
      || !Number.isSafeInteger(attempts) || (attempts as number) < 0
      || !Number.isSafeInteger(nextAttemptAt) || (nextAttemptAt as number) < 0
      || (value.state !== 'pending' && value.state !== 'failed')) {
    throw new Error('invalid outbox retry metadata');
  }
  const lastError = parseOutboxError(value.lastError);
  return {
    destination,
    evidence,
    queuedAt: queuedAt as number,
    attempts: attempts as number,
    nextAttemptAt: nextAttemptAt as number,
    state: value.state,
    ...(lastError ? { lastError } : {}),
  };
}

function removeStorageItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best-effort cleanup; a later read can retry.
  }
}

function readOutbox(now: number): ReadOutboxResult {
  const storage = getStorage();
  if (!storage) return { items: [], expired: 0, invalid: 0 };
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(TRAINING_EVIDENCE_OUTBOX_PREFIX)) keys.push(key);
    }
  } catch {
    return { items: [], expired: 0, invalid: 0 };
  }

  const result: ReadOutboxResult = { items: [], expired: 0, invalid: 0 };
  for (const storageKey of keys) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw === null) continue;
      const item = parseOutboxItem(JSON.parse(raw));
      if (item.state === 'failed') {
        removeStorageItem(storage, storageKey);
        continue;
      }
      if (item.queuedAt > now + 5 * 60_000 || now - item.queuedAt > TRAINING_EVIDENCE_OUTBOX_RETENTION_MS) {
        removeStorageItem(storage, storageKey);
        result.expired += 1;
        continue;
      }
      result.items.push({ storageKey, item });
    } catch {
      removeStorageItem(storage, storageKey);
      result.invalid += 1;
    }
  }
  result.items.sort((left, right) => left.item.queuedAt - right.item.queuedAt);
  return result;
}

function persistOutboxItem(item: TrainingEvidenceOutboxItem): boolean {
  return persistItem(outboxStorageKey(item.destination, item.evidence), JSON.stringify(item));
}

export function getTrainingEvidenceOutbox(now = Date.now()): TrainingEvidenceOutboxItem[] {
  return readOutbox(now).items.map(({ item }) => item);
}

export function enqueueTrainingEvidence(
  destinationInput: TrainingEvidenceDestination,
  draft: TrainingEvidenceDraft,
  options: EnqueueOptions = {},
): TrainingEvidenceEnqueueResult {
  const now = options.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('now must be a non-negative integer timestamp');
  const destination = parseTrainingEvidenceDestination(destinationInput);
  const evidence = canonicalEvidenceForDestination(destination, draft);
  const storage = getStorage();
  if (!storage) return { status: 'unavailable' };

  const outbox = readOutbox(now);
  const storageKey = outboxStorageKey(destination, evidence);
  const existing = outbox.items.find((entry) => entry.storageKey === storageKey)?.item;
  if (existing) {
    if (canonicalJson(existing.destination) !== canonicalJson(destination)
        || canonicalJson(existing.evidence) !== canonicalJson(evidence)) {
      throw new TrainingEvidenceOutboxConflictError();
    }
    return { status: 'duplicate', item: existing };
  }
  if (outbox.items.length >= TRAINING_EVIDENCE_OUTBOX_CAPACITY) return { status: 'full' };

  const item: TrainingEvidenceOutboxItem = {
    destination,
    evidence,
    queuedAt: now,
    attempts: 0,
    nextAttemptAt: now,
    state: 'pending',
  };
  return persistOutboxItem(item) ? { status: 'queued', item } : { status: 'unavailable' };
}

/** Queue without disturbing the training tool if storage is unavailable/full. */
export function submitTrainingEvidence(
  destination: TrainingEvidenceDestination | null,
  draft: TrainingEvidenceDraft,
): void {
  if (!destination) return;
  try {
    const result = enqueueTrainingEvidence(destination, draft);
    if (result.status === 'queued' || result.status === 'duplicate') {
      void flushTrainingEvidenceOutbox();
    }
  } catch {
    // Evidence delivery is best-effort and must never break the training tool.
  }
}

function hasAuthorization(headers: HeadersInit): boolean {
  return new Headers(headers).has('Authorization');
}

function retryDelayMs(attempts: number, now: number, response?: Response): number {
  const retryAfter = response?.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_RETRY_AFTER_MS, Math.max(1_000, seconds * 1_000));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(1_000, date - now));
  }
  return Math.min(TRAINING_EVIDENCE_RETRY_MAX_MS, TRAINING_EVIDENCE_RETRY_BASE_MS * 2 ** Math.min(10, attempts));
}

async function responseError(response: Response): Promise<TrainingEvidenceOutboxError> {
  const fallback = `Training evidence API returned ${response.status}`;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return { status: response.status, message: fallback };
  }
  if (!isRecord(body) || !isRecord(body.error)) return { status: response.status, message: fallback };
  const error = body.error as TeachingApiErrorBody['error'];
  const code = typeof error.code === 'string'
    && (TEACHING_ERROR_CODES as readonly string[]).includes(error.code)
    ? error.code as TeachingErrorCode
    : undefined;
  return {
    status: response.status,
    code,
    message: typeof error.message === 'string' ? error.message.slice(0, 500) : fallback,
    requestId: typeof error.requestId === 'string' ? error.requestId.slice(0, 200) : undefined,
  };
}

async function parseSuccessResponse(
  response: Response,
  expected: TrainingEvidenceV1,
): Promise<TeachingSelfTrainingEvidenceResult> {
  const body: unknown = await response.json();
  const expectedAssignmentIds = expected.assignmentIds ?? [];
  if (!isRecord(body) || !isRecord(body.evidence)
      || !UUID_PATTERN.test(typeof body.evidence.id === 'string' ? body.evidence.id : '')
      || body.evidence.source !== expected.source
      || body.evidence.sourceEventId !== expected.sourceEventId
      || body.evidence.trustLevel !== 'self_reported'
      || body.evidence.occurredAt !== expected.occurredAt
      || !/^\d{4}-\d{2}-\d{2}$/.test(typeof body.evidence.localDate === 'string' ? body.evidence.localDate : '')
      || body.evidence.durationMs !== (expected.durationMs ?? null)
      || body.evidence.resultMs !== (expected.source === 'timer' ? (expected.metrics.resultMs ?? null) : null)
      || body.evidence.success !== expected.metrics.success
      || !Number.isFinite(Date.parse(typeof body.evidence.createdAt === 'string' ? body.evidence.createdAt : ''))
      || typeof body.replayed !== 'boolean'
      || !Array.isArray(body.assignmentIds)
      || body.assignmentIds.length !== expectedAssignmentIds.length
      || !body.assignmentIds.every((id, index) => id === expectedAssignmentIds[index])) {
    throw new Error('Training evidence API returned an invalid receipt');
  }
  return body as unknown as TeachingSelfTrainingEvidenceResult;
}

function isRetryableStatus(status: number): boolean {
  return status === 401 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function summaryFromRead(read: ReadOutboxResult): TrainingEvidenceFlushSummary {
  return {
    sent: 0,
    replayed: 0,
    retryScheduled: 0,
    permanentFailed: 0,
    deferred: 0,
    expired: read.expired,
    invalid: read.invalid,
  };
}

let activeFlush: Promise<TrainingEvidenceFlushSummary> | null = null;

async function performFlush(options: FlushOptions): Promise<TrainingEvidenceFlushSummary> {
  const now = options.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('now must be a non-negative integer timestamp');
  const read = readOutbox(now);
  const summary = summaryFromRead(read);
  const storage = getStorage();
  if (!storage) return summary;
  const requestedBatchSize = options.maxBatchSize ?? DEFAULT_FLUSH_BATCH_SIZE;
  if (!Number.isSafeInteger(requestedBatchSize) || requestedBatchSize < 1) {
    throw new Error('maxBatchSize must be a positive integer');
  }
  const due = read.items
    .filter(({ item }) => item.state === 'pending' && item.nextAttemptAt <= now)
    .slice(0, Math.min(requestedBatchSize, TRAINING_EVIDENCE_OUTBOX_CAPACITY));
  const headers = authHeaders();
  if (!hasAuthorization(headers)) {
    summary.deferred = due.length;
    return summary;
  }

  const fetcher = options.fetch ?? fetch;
  for (const { storageKey, item } of due) {
    let response: Response | undefined;
    let error: TrainingEvidenceOutboxError;
    try {
      response = await fetcher(apiUrl(`/v1/teaching/organizations/${encodeURIComponent(item.destination.organizationSlug)}/me/training/evidence`), {
        method: 'POST',
        headers,
        body: JSON.stringify(item.evidence),
        cache: 'no-store',
      });
      if (response.ok) {
        const receipt = await parseSuccessResponse(response, item.evidence);
        removeStorageItem(storage, storageKey);
        summary.sent += 1;
        if (receipt.replayed) summary.replayed += 1;
        continue;
      }
      error = await responseError(response);
    } catch (caught) {
      error = {
        status: null,
        message: caught instanceof Error ? caught.message.slice(0, 500) : 'Training evidence request failed',
      };
    }

    const retryable = response === undefined || response.ok || isRetryableStatus(response.status);
    const attempts = item.attempts + 1;
    if (retryable) {
      persistOutboxItem({
        ...item,
        attempts,
        nextAttemptAt: now + (response?.status === 401 ? AUTH_RETRY_MS : retryDelayMs(item.attempts, now, response)),
        lastError: error,
      });
      summary.retryScheduled += 1;
    } else {
      removeStorageItem(storage, storageKey);
      summary.permanentFailed += 1;
    }
  }
  return summary;
}

export function flushTrainingEvidenceOutbox(options: FlushOptions = {}): Promise<TrainingEvidenceFlushSummary> {
  if (activeFlush) return activeFlush;
  activeFlush = performFlush(options).finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

/**
 * Start best-effort delivery for a mounted training page. The caller owns the
 * returned cleanup function; evidence remains durable if the page closes.
 */
export function startTrainingEvidenceOutbox(
  destination: TrainingEvidenceDestination | null,
  options: FlushOptions = {},
): () => void {
  if (!destination || typeof window === 'undefined') return () => undefined;
  const flush = () => { void flushTrainingEvidenceOutbox(options); };
  flush();
  window.addEventListener('online', flush);
  const timer = window.setInterval(flush, 60_000);
  return () => {
    window.removeEventListener('online', flush);
    window.clearInterval(timer);
  };
}
