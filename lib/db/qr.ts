import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { QrCode, QrCodeInsert } from "@/db/schema";

export type { QrCode };

function normalize(code: string): string {
  return code.trim().toLowerCase();
}

function randomSuffix(len: number): string {
  const buf = randomBytes(len);
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i % buf.length] % alphabet.length];
  return out;
}

export async function list(): Promise<QrCode[]> {
  return db
    .select()
    .from(schema.qrCodes)
    .orderBy(desc(schema.qrCodes.createdAt))
    .all();
}

export async function findByCode(code: string): Promise<QrCode | undefined> {
  const c = normalize(code);
  const rows = db
    .select()
    .from(schema.qrCodes)
    .where(eq(schema.qrCodes.code, c))
    .all();
  return rows[0];
}

export async function incrementScans(code: string): Promise<void> {
  const c = normalize(code);
  await db
    .update(schema.qrCodes)
    .set({ scans: sql`${schema.qrCodes.scans} + 1` })
    .where(eq(schema.qrCodes.code, c));
}

export async function createBatch(values: {
  prefix: string;
  count: number;
  label: string;
  target: string;
}): Promise<QrCode[]> {
  const prefix = normalize(values.prefix).replace(/[^a-z0-9-]/g, "");
  const count = Math.max(1, Math.min(500, Math.floor(values.count)));
  const label = values.label.trim() || "未命名批次";
  const target = values.target.trim() || "/";
  const now = Math.floor(Date.now() / 1000);
  const created: QrCode[] = [];
  for (let i = 0; i < count; i++) {
    let code = `${prefix ? prefix + "-" : ""}${randomSuffix(6)}`;
    for (let r = 0; r < 5; r++) {
      const dup = await findByCode(code);
      if (!dup) break;
      code = `${prefix ? prefix + "-" : ""}${randomSuffix(6)}`;
    }
    const v: QrCodeInsert = {
      code,
      label,
      target,
      scans: 0,
      createdAt: now,
    };
    await db.insert(schema.qrCodes).values(v);
    const row = await findByCode(code);
    if (row) created.push(row);
  }
  return created;
}

export async function remove(code: string): Promise<void> {
  await db.delete(schema.qrCodes).where(eq(schema.qrCodes.code, normalize(code)));
}
