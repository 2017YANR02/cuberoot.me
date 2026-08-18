import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeachingSelfTrainingEvidenceResult } from '@cuberoot/shared/teaching';
import {
  TRAINING_EVIDENCE_OUTBOX_CAPACITY,
  TRAINING_EVIDENCE_OUTBOX_RETENTION_MS,
  TrainingEvidenceOutboxConflictError,
  createTrainingEvidenceEventId,
  enqueueTrainingEvidence,
  flushTrainingEvidenceOutbox,
  getTrainingEvidenceOutbox,
  parseTrainingAssignmentDestination,
  parseTrainingEvidenceDestination,
  startTrainingEvidenceOutbox,
  type TrainingEvidenceDraft,
} from '@/lib/training-evidence';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const DESTINATION = {
  organizationSlug: 'cube-school',
  assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};
const OCCURRED_AT = '2026-08-17T12:00:00.000Z';

function timerDraft(sourceEventId = 'timer:event-1'): TrainingEvidenceDraft {
  return {
    schemaVersion: 1,
    source: 'timer',
    activity: 'solve',
    sourceEventId,
    occurredAt: OCCURRED_AT,
    durationMs: 12_345,
    metrics: { success: true, resultMs: 12_345 },
    payloadVersion: 1,
    payload: { event: '333', penalty: 'ok' },
  };
}

function successBody(sourceEventId: string, replayed = false): TeachingSelfTrainingEvidenceResult {
  return {
    evidence: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      source: 'timer',
      sourceEventId,
      trustLevel: 'self_reported',
      occurredAt: OCCURRED_AT,
      localDate: '2026-08-17',
      durationMs: 12_345,
      resultMs: 12_345,
      success: true,
      createdAt: OCCURRED_AT,
    },
    assignmentIds: [DESTINATION.assignmentId],
    replayed,
  };
}

beforeEach(() => {
  const storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', {
    localStorage: storage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setInterval,
    clearInterval,
  });
});

describe('training evidence destination and identity boundaries', () => {
  it('enters assignment mode only with a complete valid launch context', () => {
    expect(parseTrainingAssignmentDestination(
      `?trainingOrg=Cube-School&trainingAssignment=${DESTINATION.assignmentId.toUpperCase()}&event=333`,
    )).toEqual(DESTINATION);
    expect(parseTrainingAssignmentDestination('?event=333')).toBeNull();
    expect(parseTrainingAssignmentDestination('?trainingOrg=cube-school')).toBeNull();
    expect(parseTrainingAssignmentDestination('?trainingOrg=../school&trainingAssignment=bad')).toBeNull();
  });

  it('accepts only organization and assignment routing context', () => {
    expect(parseTrainingEvidenceDestination({
      organizationSlug: ' Cube-School ',
      assignmentId: DESTINATION.assignmentId.toUpperCase(),
    })).toEqual(DESTINATION);
    expect(() => parseTrainingEvidenceDestination({ ...DESTINATION, studentId: 'student-1' })).toThrow(/not accepted/);
    expect(() => parseTrainingEvidenceDestination({ ...DESTINATION, actorId: 7 })).toThrow(/not accepted/);
    expect(() => parseTrainingEvidenceDestination({ organizationSlug: '../school' })).toThrow(/valid organization slug/);
    expect(() => parseTrainingEvidenceDestination({ ...DESTINATION, assignmentId: 'not-a-uuid' })).toThrow(/UUID/);
  });

  it('uses secure source-scoped UUID event IDs', () => {
    const first = createTrainingEvidenceEventId('predict');
    const second = createTrainingEvidenceEventId('predict');
    expect(first).toMatch(/^predict:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).not.toBe(first);
  });

  it('lets the shared parser reject identity-bearing payloads', () => {
    expect(() => enqueueTrainingEvidence(DESTINATION, {
      ...timerDraft(),
      payload: { nested: { organizationId: 'forbidden' } },
    }, { now: 1_000 })).toThrow(/invalid value/);
    expect(getTrainingEvidenceOutbox(1_000)).toHaveLength(0);
  });
});

describe('training evidence outbox', () => {
  it('accepts the registered timer, predict, and algorithm-attempt contracts', () => {
    const drafts: TrainingEvidenceDraft[] = [
      timerDraft(),
      {
        schemaVersion: 1,
        source: 'predict',
        activity: 'prediction',
        sourceEventId: 'predict:event-1',
        occurredAt: OCCURRED_AT,
        durationMs: 2_500,
        metrics: { success: false },
        payloadVersion: 1,
        payload: { puzzle: '333', mode: 'tracking', moveCount: 4 },
      },
      {
        schemaVersion: 1,
        source: 'alg-trainer',
        activity: 'algorithm_attempt',
        sourceEventId: 'alg-trainer:event-1',
        occurredAt: OCCURRED_AT,
        durationMs: 1_200,
        metrics: { success: true },
        payloadVersion: 1,
        payload: { puzzle: '333', set: 'pll', caseKey: 'Ua', mode: 'timing' },
      },
    ];

    drafts.forEach((draft, index) => {
      expect(enqueueTrainingEvidence(DESTINATION, draft, { now: 1_000 + index }).status).toBe('queued');
    });
    expect(getTrainingEvidenceOutbox(2_000).map((item) => [item.evidence.source, item.evidence.activity])).toEqual([
      ['timer', 'solve'],
      ['predict', 'prediction'],
      ['alg-trainer', 'algorithm_attempt'],
    ]);
  });

  it('canonicalizes assignment context, deduplicates exact events, and rejects ID reuse', () => {
    const queued = enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
    expect(queued.status).toBe('queued');
    expect(getTrainingEvidenceOutbox(1_000)[0].evidence.assignmentIds).toEqual([DESTINATION.assignmentId]);

    expect(enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 2_000 }).status).toBe('duplicate');
    expect(() => enqueueTrainingEvidence(DESTINATION, {
      ...timerDraft(),
      durationMs: 20_000,
      metrics: { success: true, resultMs: 20_000 },
    }, { now: 2_000 })).toThrow(TrainingEvidenceOutboxConflictError);
    expect(getTrainingEvidenceOutbox(2_000)).toHaveLength(1);
  });

  it('is capacity bounded without evicting live evidence', () => {
    for (let index = 0; index < TRAINING_EVIDENCE_OUTBOX_CAPACITY; index += 1) {
      expect(enqueueTrainingEvidence(DESTINATION, timerDraft(`timer:${index}`), { now: index }).status).toBe('queued');
    }
    expect(enqueueTrainingEvidence(DESTINATION, timerDraft('timer:overflow'), { now: 500 }).status).toBe('full');
    expect(getTrainingEvidenceOutbox(500)).toHaveLength(TRAINING_EVIDENCE_OUTBOX_CAPACITY);
  });

  it('removes expired and malformed records while keeping the retention window bounded', () => {
    enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
    localStorage.setItem('cuberoot-training-evidence.v1.corrupt', '{bad json');
    const now = 1_000 + TRAINING_EVIDENCE_OUTBOX_RETENTION_MS + 1;
    expect(getTrainingEvidenceOutbox(now)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});

describe('training evidence delivery', () => {
  it('does not start delivery outside a valid assignment launch', () => {
    const fetcher = vi.fn<typeof fetch>();
    enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });

    const cleanup = startTrainingEvidenceOutbox(null, { now: 1_000, fetch: fetcher });

    expect(fetcher).not.toHaveBeenCalled();
    expect(window.addEventListener).not.toHaveBeenCalled();
    cleanup();
  });

  it('defers without a bearer token and sends authenticated evidence once available', async () => {
    enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
    const fetcher = vi.fn<typeof fetch>();
    expect(await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher })).toMatchObject({ deferred: 1, sent: 0 });
    expect(fetcher).not.toHaveBeenCalled();

    localStorage.setItem('cuberoot_jwt', 'jwt-token');
    fetcher.mockResolvedValue(new Response(JSON.stringify(successBody('timer:event-1')), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    const summary = await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher });
    expect(summary).toMatchObject({ sent: 1, replayed: 0 });
    expect(getTrainingEvidenceOutbox(1_000)).toEqual([]);
    const [url, request] = fetcher.mock.calls[0];
    expect(String(url)).toContain('/v1/teaching/organizations/cube-school/me/training/evidence');
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer jwt-token');
    const body = JSON.parse(String(request?.body));
    expect(body.assignmentIds).toEqual([DESTINATION.assignmentId]);
    expect(JSON.stringify(body)).not.toMatch(/studentId|actorId|trustLevel|organizationId/i);
  });

  it('accepts an idempotent replay receipt', async () => {
    localStorage.setItem('cuberoot_jwt', 'jwt-token');
    enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify(successBody('timer:event-1', true)),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    expect(await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher })).toMatchObject({ sent: 1, replayed: 1 });
    expect(getTrainingEvidenceOutbox(1_000)).toEqual([]);
  });

  it('retries network, rate-limit, and server failures with the same event ID', async () => {
    localStorage.setItem('cuberoot_jwt', 'jwt-token');
    enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'slow down' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '10' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'try later' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(successBody('timer:event-1')), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }));

    expect(await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher })).toMatchObject({ retryScheduled: 1 });
    let item = getTrainingEvidenceOutbox(1_000)[0];
    expect(item.evidence.sourceEventId).toBe('timer:event-1');
    expect(item.nextAttemptAt).toBe(6_000);

    expect(await flushTrainingEvidenceOutbox({ now: 6_000, fetch: fetcher })).toMatchObject({ retryScheduled: 1 });
    item = getTrainingEvidenceOutbox(6_000)[0];
    expect(item.evidence.sourceEventId).toBe('timer:event-1');
    expect(item.nextAttemptAt).toBe(16_000);

    expect(await flushTrainingEvidenceOutbox({ now: 16_000, fetch: fetcher })).toMatchObject({ retryScheduled: 1 });
    item = getTrainingEvidenceOutbox(16_000)[0];
    expect(item.evidence.sourceEventId).toBe('timer:event-1');
    expect(item.nextAttemptAt).toBe(36_000);

    expect(await flushTrainingEvidenceOutbox({ now: 36_000, fetch: fetcher })).toMatchObject({ sent: 1 });
    expect(getTrainingEvidenceOutbox(36_000)).toEqual([]);
  });

  it('keeps 401 retryable and discards permanent business failures', async () => {
    localStorage.setItem('cuberoot_jwt', 'jwt-token');
    enqueueTrainingEvidence(DESTINATION, timerDraft('timer:auth'), { now: 1_000 });
    enqueueTrainingEvidence(DESTINATION, timerDraft('timer:invalid'), { now: 1_000 });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'login again' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'EVIDENCE_INVALID', message: 'bad evidence', requestId: 'req-1' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }));

    expect(await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher })).toMatchObject({
      retryScheduled: 1,
      permanentFailed: 1,
    });
    const [auth] = getTrainingEvidenceOutbox(1_000);
    expect(auth).toMatchObject({ state: 'pending', nextAttemptAt: 61_000, lastError: { code: 'UNAUTHENTICATED' } });
    expect(getTrainingEvidenceOutbox(1_000).some((item) => item.evidence.sourceEventId === 'timer:invalid')).toBe(false);

    await flushTrainingEvidenceOutbox({ now: 120_000, fetch: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('does not let permanent failures consume active outbox capacity', async () => {
    localStorage.setItem('cuberoot_jwt', 'jwt-token');
    for (let index = 0; index < TRAINING_EVIDENCE_OUTBOX_CAPACITY; index += 1) {
      enqueueTrainingEvidence(DESTINATION, timerDraft(`timer:failed-${index}`), { now: 1_000 });
    }
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(
      JSON.stringify({ error: { code: 'EVIDENCE_INVALID', message: 'bad evidence' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ));

    expect(await flushTrainingEvidenceOutbox({
      now: 1_000,
      fetch: fetcher,
      maxBatchSize: TRAINING_EVIDENCE_OUTBOX_CAPACITY,
    })).toMatchObject({ permanentFailed: TRAINING_EVIDENCE_OUTBOX_CAPACITY });
    expect(getTrainingEvidenceOutbox(1_000)).toEqual([]);
    expect(enqueueTrainingEvidence(DESTINATION, timerDraft('timer:after-failures'), { now: 2_000 }).status).toBe('queued');
  });

  it('does not discard evidence for a malformed success receipt', async () => {
    localStorage.setItem('cuberoot_jwt', 'jwt-token');
    enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher })).toMatchObject({ retryScheduled: 1, sent: 0 });
    expect(getTrainingEvidenceOutbox(1_000)[0].lastError?.message).toMatch(/invalid receipt/);
  });

  it('keeps evidence when a success receipt does not exactly match the request', async () => {
    const malformedReceipts: unknown[] = [
      { ...successBody('timer:event-1'), assignmentIds: [] },
      { ...successBody('timer:event-1'), assignmentIds: [DESTINATION.assignmentId, DESTINATION.assignmentId] },
      {
        ...successBody('timer:event-1'),
        evidence: { ...successBody('timer:event-1').evidence, trustLevel: 'server_recomputed' },
      },
      {
        ...successBody('timer:event-1'),
        evidence: { ...successBody('timer:event-1').evidence, createdAt: undefined },
      },
    ];

    for (const receipt of malformedReceipts) {
      localStorage.clear();
      localStorage.setItem('cuberoot_jwt', 'jwt-token');
      enqueueTrainingEvidence(DESTINATION, timerDraft(), { now: 1_000 });
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(receipt), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      expect(await flushTrainingEvidenceOutbox({ now: 1_000, fetch: fetcher })).toMatchObject({ sent: 0, retryScheduled: 1 });
      expect(getTrainingEvidenceOutbox(1_000)).toHaveLength(1);
    }
  });
});
