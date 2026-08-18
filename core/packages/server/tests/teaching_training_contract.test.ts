import { describe, expect, it } from 'vitest';
import {
  hasTeachingPermission,
  parseTrainingEvidenceV1,
  TRAINING_ACTIVITY_REGISTRY,
  TRAINING_EVIDENCE_JSON_LIMITS,
  TRAINING_GOAL_REGISTRY,
  TRAINING_SOURCE_ACTIVITIES,
  type TeachingPermission,
  type TeachingTrainingAssignmentTarget,
  type TrainingEvidenceActivityForSource,
  type TrainingEvidenceV1,
} from '@cuberoot/shared/teaching';

const ASSIGNMENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ASSIGNMENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;
type _TimerActivityIsExact = Assert<Equal<TrainingEvidenceActivityForSource<'timer'>, 'solve'>>;
type _PredictActivityIsExact = Assert<Equal<TrainingEvidenceActivityForSource<'predict'>, 'prediction'>>;
type _AlgActivityIsExact = Assert<Equal<
  TrainingEvidenceActivityForSource<'alg-trainer'>,
  'algorithm_attempt'
>>;
type TrainingStudentTarget = Extract<TeachingTrainingAssignmentTarget, { targetKind: 'student' }>;
type TrainingGroupTarget = Extract<TeachingTrainingAssignmentTarget, { targetKind: 'group' }>;
type _StudentTargetSourceIsExplicit = Assert<Equal<TrainingStudentTarget['sourceGroupId'], string | null>>;
type _GroupSelectorHasNoSource = Assert<Equal<TrainingGroupTarget['sourceGroupId'], null>>;

if (false) {
  const timerBase = {} as Omit<
    Extract<TrainingEvidenceV1, { source: 'timer' }>,
    'source' | 'activity'
  >;
  const validTimerEvidence: TrainingEvidenceV1 = {
    ...timerBase,
    source: 'timer',
    activity: 'solve',
  };
  // @ts-expect-error timer evidence cannot claim the predict activity.
  const invalidTimerEvidence: TrainingEvidenceV1 = {
    ...timerBase,
    source: 'timer',
    activity: 'prediction',
  };
  // @ts-expect-error timer has no prediction goal registry entry.
  TRAINING_GOAL_REGISTRY.timer.prediction;
  // @ts-expect-error predict goals cannot use timer-only best_result_ms.
  TRAINING_GOAL_REGISTRY.predict.prediction.best_result_ms;
  void validTimerEvidence;
  void invalidTimerEvidence;
}

function timerEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    source: 'timer',
    sourceEventId: 'timer-event-1',
    occurredAt: '2026-01-15T12:00:00Z',
    activity: 'solve',
    durationMs: 12_345,
    metrics: { success: true, resultMs: 12_345 },
    payloadVersion: 1,
    payload: { scramble: "R U R'" },
    assignmentIds: [ASSIGNMENT_A],
    ...overrides,
  };
}

describe('Stage 3 training shared contract', () => {
  it('keeps the minimum training role matrix split by action', () => {
    const permissions: TeachingPermission[] = [
      'training:template:read',
      'training:template:manage',
      'training:assignment:read',
      'training:assignment:manage',
      'training:review',
    ];
    for (const permission of permissions) {
      expect(hasTeachingPermission('owner', permission)).toBe(true);
      expect(hasTeachingPermission('admin', permission)).toBe(true);
      expect(hasTeachingPermission('finance', permission)).toBe(false);
      expect(hasTeachingPermission('viewer', permission)).toBe(false);
    }
    expect(permissions.map((permission) => hasTeachingPermission('teacher', permission))).toEqual([
      true, false, true, true, true,
    ]);
    expect(permissions.map((permission) => hasTeachingPermission('assistant', permission))).toEqual([
      true, false, true, false, true,
    ]);
  });

  it('derives every source, activity, metric, and goal combination from one registry', () => {
    expect(TRAINING_SOURCE_ACTIVITIES).toEqual({
      timer: ['solve'],
      predict: ['prediction'],
      'alg-trainer': ['algorithm_attempt'],
    });
    expect(TRAINING_GOAL_REGISTRY).toEqual({
      timer: {
        solve: {
          evidence_count: ['gte'],
          duration_ms: ['gte'],
          success_count: ['gte'],
          best_result_ms: ['lte'],
        },
      },
      predict: {
        prediction: {
          evidence_count: ['gte'],
          duration_ms: ['gte'],
          success_count: ['gte'],
        },
      },
      'alg-trainer': {
        algorithm_attempt: {
          evidence_count: ['gte'],
          duration_ms: ['gte'],
          success_count: ['gte'],
        },
      },
    });
    expect(TRAINING_ACTIVITY_REGISTRY.timer.solve.metrics).toEqual(['success', 'resultMs']);
    expect(TRAINING_ACTIVITY_REGISTRY.predict.prediction.metrics).toEqual(['success']);
    expect(TRAINING_ACTIVITY_REGISTRY['alg-trainer'].algorithm_attempt.metrics).toEqual(['success']);
  });

  it('accepts all registered evidence combinations and rejects cross-tool fields', () => {
    expect(parseTrainingEvidenceV1(timerEvidence()).source).toBe('timer');
    expect(parseTrainingEvidenceV1(timerEvidence({
      source: 'predict',
      activity: 'prediction',
      metrics: { success: false },
    })).source).toBe('predict');
    expect(parseTrainingEvidenceV1(timerEvidence({
      source: 'alg-trainer',
      activity: 'algorithm_attempt',
      metrics: { success: true },
    })).source).toBe('alg-trainer');

    expect(() => parseTrainingEvidenceV1(timerEvidence({ source: 'predict' }))).toThrow(/activity is not registered/);
    expect(() => parseTrainingEvidenceV1(timerEvidence({
      source: 'predict',
      activity: 'prediction',
      metrics: { success: true, resultMs: 123 },
    }))).toThrow(/resultMs is not registered/);
    expect(() => parseTrainingEvidenceV1(timerEvidence({
      metrics: { success: true, resultMs: null },
    }))).toThrow(/successful timer evidence requires/);
  });

  it('strictly validates and canonicalizes the occurred-at instant', () => {
    const utc = parseTrainingEvidenceV1(timerEvidence({ occurredAt: '2026-01-15T12:00:00Z' }));
    const offset = parseTrainingEvidenceV1(timerEvidence({ occurredAt: '2026-01-15T20:00:00+08:00' }));
    expect(offset.occurredAt).toBe(utc.occurredAt);
    expect(parseTrainingEvidenceV1(offset).occurredAt).toBe(offset.occurredAt);

    for (const occurredAt of [
      '2026-02-30T12:00:00Z',
      '2026-01-15T24:00:00Z',
      '2026-01-15T12:00:00+14:01',
      '1970-01-01T00:00:00+14:00',
    ]) {
      expect(() => parseTrainingEvidenceV1(timerEvidence({ occurredAt })), occurredAt).toThrow();
    }
    const futureForApplicationClock = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(parseTrainingEvidenceV1(timerEvidence({ occurredAt: futureForApplicationClock })).occurredAt)
      .toBe(futureForApplicationClock);
  });

  it('canonicalizes natural-id and assignment-link inputs before hashing', () => {
    const parsed = parseTrainingEvidenceV1(timerEvidence({
      sourceEventId: '  event-with-spaces  ',
      assignmentIds: [` ${ASSIGNMENT_B.toUpperCase()} `, ASSIGNMENT_A, ASSIGNMENT_B],
    }));
    expect(parsed.sourceEventId).toBe('event-with-spaces');
    expect(parsed.assignmentIds).toEqual([ASSIGNMENT_A, ASSIGNMENT_B]);
  });

  it('recursively rejects client identity and trust fields in bounded JSON', () => {
    for (const reservedKey of [
      'organizationId',
      'organization_id',
      'student-id',
      'actorUserId',
      'actor_user_id',
      'account_user_id',
      'submitted_by_user_id',
      'trust_level',
    ]) {
      expect(() => parseTrainingEvidenceV1(timerEvidence({
        payload: { outer: [{ nested: { [reservedKey]: 'forged' } }] },
      })), reservedKey).toThrow(/bounded JSON limits|invalid value/);
    }
    expect(() => parseTrainingEvidenceV1({
      ...timerEvidence(),
      actorUserId: 42,
    })).toThrow(/not accepted in client evidence/);
  });

  it('enforces safe integer and bounded JSON limits at their entry points', () => {
    expect(parseTrainingEvidenceV1(timerEvidence({
      durationMs: 86_400_000,
      metrics: { success: true, resultMs: 86_400_000 },
      payload: { safe: Number.MAX_SAFE_INTEGER },
    })).durationMs).toBe(86_400_000);
    expect(() => parseTrainingEvidenceV1(timerEvidence({ durationMs: 86_400_001 }))).toThrow(/durationMs/);
    expect(() => parseTrainingEvidenceV1(timerEvidence({
      metrics: { success: true, resultMs: Number.MAX_SAFE_INTEGER + 1 },
    }))).toThrow(/bounded JSON limits|resultMs/);
    expect(() => parseTrainingEvidenceV1(timerEvidence({
      payload: { text: 'x'.repeat(TRAINING_EVIDENCE_JSON_LIMITS.maxStringLength + 1) },
    }))).toThrow(/bounded JSON limits/);
    expect(() => parseTrainingEvidenceV1(timerEvidence({
      assignmentIds: Array.from(
        { length: TRAINING_EVIDENCE_JSON_LIMITS.maxAssignmentIds + 1 },
        () => ASSIGNMENT_A,
      ),
    }))).toThrow(/at most/);
  });
});
