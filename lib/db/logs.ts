import "server-only";
import { randomUUID } from "node:crypto";
import { desc, count } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  ErrorLog,
  ErrorLogInsert,
  LogLevel,
  RequestLog,
  RequestLogInsert,
} from "@/db/schema";

export type { ErrorLog, RequestLog };

export async function logError(input: {
  level?: LogLevel;
  message: string;
  stack?: string | null;
  path?: string | null;
  userId?: string | null;
}): Promise<void> {
  const row: ErrorLogInsert = {
    id: randomUUID(),
    ts: Math.floor(Date.now() / 1000),
    level: input.level ?? "error",
    message: input.message.slice(0, 2000),
    stack: input.stack ? input.stack.slice(0, 8000) : null,
    path: input.path ?? null,
    userId: input.userId ?? null,
  };
  try {
    await db.insert(schema.errorLogs).values(row);
  } catch (e) {
    // Logging must never throw. Fall back to console so dev still sees it.
    // eslint-disable-next-line no-console
    console.error("[logs] insert error_logs failed", e, row);
  }
}

export async function logSlowRequest(input: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId?: string | null;
}): Promise<void> {
  const row: RequestLogInsert = {
    id: randomUUID(),
    ts: Math.floor(Date.now() / 1000),
    method: input.method.slice(0, 16),
    path: input.path.slice(0, 512),
    status: input.status,
    durationMs: input.durationMs,
    userId: input.userId ?? null,
  };
  try {
    await db.insert(schema.requestLogs).values(row);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[logs] insert request_logs failed", e, row);
  }
}

export async function listErrors(limit = 50, offset = 0): Promise<ErrorLog[]> {
  return db
    .select()
    .from(schema.errorLogs)
    .orderBy(desc(schema.errorLogs.ts))
    .limit(limit)
    .offset(offset)
    .all();
}

export async function countErrors(): Promise<number> {
  const r = db.select({ c: count() }).from(schema.errorLogs).all();
  return Number(r[0]?.c ?? 0);
}

export async function listSlowRequests(
  limit = 50,
  offset = 0,
): Promise<RequestLog[]> {
  return db
    .select()
    .from(schema.requestLogs)
    .orderBy(desc(schema.requestLogs.ts))
    .limit(limit)
    .offset(offset)
    .all();
}

export async function countSlowRequests(): Promise<number> {
  const r = db.select({ c: count() }).from(schema.requestLogs).all();
  return Number(r[0]?.c ?? 0);
}

export const SLOW_THRESHOLD_MS = 500;
