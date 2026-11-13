import { type JsonObject } from '../types.js';

export function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

export function actorSnapshotToJson(row: Record<string, unknown>, prefix: string): JsonObject | null {
  const userId = row[`${prefix}_user_id_snapshot`];
  if (userId == null) return null;
  return {
    userId: String(userId),
    displayName: String(row[`${prefix}_display_name_snapshot`]),
    role: String(row[`${prefix}_role_snapshot`]),
    relationship: row[`${prefix}_relationship_snapshot`] == null
      ? null
      : String(row[`${prefix}_relationship_snapshot`]),
  };
}
