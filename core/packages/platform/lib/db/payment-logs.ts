import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PaymentLog, PaymentLogKind } from "@/db/schema";

export type { PaymentLog };

export async function write(args: {
  orderId: string;
  providerId: string;
  kind: PaymentLogKind;
  payload?: unknown;
}): Promise<void> {
  await db.insert(schema.paymentLogs).values({
    orderId: args.orderId,
    providerId: args.providerId,
    kind: args.kind,
    payload: args.payload ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

export async function listByOrder(orderId: string): Promise<PaymentLog[]> {
  return db
    .select()
    .from(schema.paymentLogs)
    .where(eq(schema.paymentLogs.orderId, orderId))
    .orderBy(desc(schema.paymentLogs.createdAt))
    .all();
}

export async function recent(limit = 50): Promise<PaymentLog[]> {
  return db
    .select()
    .from(schema.paymentLogs)
    .orderBy(desc(schema.paymentLogs.createdAt))
    .limit(limit)
    .all();
}

export async function recentByKind(
  kind: PaymentLogKind,
  limit = 50,
): Promise<PaymentLog[]> {
  return db
    .select()
    .from(schema.paymentLogs)
    .where(eq(schema.paymentLogs.kind, kind))
    .orderBy(desc(schema.paymentLogs.createdAt))
    .limit(limit)
    .all();
}
