import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { InviteCode, InviteCodeInsert } from "@/db/schema";

export type { InviteCode };

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

function randomCode(): string {
  const buf = randomBytes(6);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[buf[i % buf.length] % alphabet.length];
  return out;
}

export async function list(): Promise<InviteCode[]> {
  return db
    .select()
    .from(schema.inviteCodes)
    .orderBy(desc(schema.inviteCodes.createdAt))
    .all();
}

export async function findByCode(code: string): Promise<InviteCode | undefined> {
  const c = normalize(code);
  const rows = db
    .select()
    .from(schema.inviteCodes)
    .where(eq(schema.inviteCodes.code, c))
    .all();
  return rows[0];
}

export async function findByOwner(ownerId: string): Promise<InviteCode | undefined> {
  const rows = db
    .select()
    .from(schema.inviteCodes)
    .where(eq(schema.inviteCodes.ownerId, ownerId))
    .all();
  return rows[0];
}

export async function incrementUses(code: string): Promise<void> {
  const c = normalize(code);
  await db
    .update(schema.inviteCodes)
    .set({ uses: sql`${schema.inviteCodes.uses} + 1` })
    .where(eq(schema.inviteCodes.code, c));
}

export async function getOrCreateForUser(
  ownerId: string,
  opts?: { rewardCoupon?: string | null },
): Promise<InviteCode> {
  const existing = await findByOwner(ownerId);
  if (existing) return existing;
  const now = Math.floor(Date.now() / 1000);
  let code = randomCode();
  // collision retry
  for (let i = 0; i < 5; i++) {
    const dup = await findByCode(code);
    if (!dup) break;
    code = randomCode();
  }
  const v: InviteCodeInsert = {
    code,
    ownerId,
    uses: 0,
    rewardCoupon: opts?.rewardCoupon ?? null,
    createdAt: now,
  };
  await db.insert(schema.inviteCodes).values(v);
  const row = await findByCode(code);
  if (!row) throw new Error("invite create failed");
  return row;
}

export async function createForUser(
  ownerId: string,
  rewardCoupon: string | null,
): Promise<InviteCode> {
  let code = randomCode();
  for (let i = 0; i < 5; i++) {
    const dup = await findByCode(code);
    if (!dup) break;
    code = randomCode();
  }
  const now = Math.floor(Date.now() / 1000);
  const v: InviteCodeInsert = {
    code,
    ownerId,
    uses: 0,
    rewardCoupon,
    createdAt: now,
  };
  await db.insert(schema.inviteCodes).values(v);
  const row = await findByCode(code);
  if (!row) throw new Error("invite create failed");
  return row;
}

export async function applyInviteOnSignup(
  newUserId: string,
  code: string,
): Promise<InviteCode | null> {
  const inv = await findByCode(code);
  if (!inv) return null;
  if (inv.ownerId === newUserId) return null;
  await incrementUses(inv.code);
  return inv;
}

export async function remove(code: string): Promise<void> {
  await db.delete(schema.inviteCodes).where(eq(schema.inviteCodes.code, normalize(code)));
}
