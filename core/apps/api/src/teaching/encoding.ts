import { createHash } from 'node:crypto';
import { type TrainingEvidenceV1 } from '@cuberoot/shared/teaching';
import { type JsonObject } from './types.js';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('Canonical JSON does not accept undefined');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

export function canonicalTrainingEvidencePayload(input: TrainingEvidenceV1): JsonObject {
  return {
    schemaVersion: 1,
    source: input.source,
    sourceEventId: input.sourceEventId,
    occurredAt: input.occurredAt,
    activity: input.activity,
    durationMs: input.durationMs ?? null,
    metrics: input.metrics as JsonObject,
    payloadVersion: input.payloadVersion,
    payload: (input.payload ?? {}) as JsonObject,
    assignmentIds: input.assignmentIds ?? [],
  };
}
