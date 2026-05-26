import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User, UserInsert, UserRole } from "@/db/schema";
import { newUserId } from "@/lib/auth-user";

export type { User, UserRole };

export async function findById(id: string): Promise<User | undefined> {
  const rows = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .all();
  return rows[0];
}

export async function findByPhone(phone: string): Promise<User | undefined> {
  const rows = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .all();
  return rows[0];
}

export async function upsertByPhone(phone: string): Promise<User> {
  const existing = await findByPhone(phone);
  if (existing) return existing;
  const now = Math.floor(Date.now() / 1000);
  const tail = phone.slice(-4);
  const nickname = `用户${tail}`;
  const values: UserInsert = {
    id: newUserId(),
    phone,
    nickname,
    avatar: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.users).values(values);
  const row = await findByPhone(phone);
  if (!row) throw new Error("upsert failed");
  return row;
}

export async function setRole(id: string, role: UserRole): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(schema.users)
    .set({ role, updatedAt: now })
    .where(eq(schema.users.id, id));
}
