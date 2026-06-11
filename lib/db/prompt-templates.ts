import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PromptTemplate, PromptTemplateInsert } from "@/db/schema";

export type { PromptTemplate };

export type PromptTemplateInput = {
  name: string;
  category?: string | null;
  body: string;
};

// 后台列表 + 卡片编辑页选择器共用,按 sortOrder 升序(同序再按 id)
export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  return db
    .select()
    .from(schema.promptTemplates)
    .orderBy(asc(schema.promptTemplates.sortOrder), asc(schema.promptTemplates.id))
    .all();
}

export async function findPromptTemplate(id: number): Promise<PromptTemplate | undefined> {
  const rows = db
    .select()
    .from(schema.promptTemplates)
    .where(eq(schema.promptTemplates.id, id))
    .all();
  return rows[0];
}

// 新模板排到末尾(当前最大 sortOrder + 10)
export async function createPromptTemplate(input: PromptTemplateInput): Promise<number> {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body) throw new Error("name / body 必填");
  const maxRow = db
    .select({ m: sql<number>`coalesce(max(${schema.promptTemplates.sortOrder}), 0)` })
    .from(schema.promptTemplates)
    .get();
  const v: PromptTemplateInsert = {
    name,
    category: input.category?.trim() || null,
    body,
    sortOrder: (maxRow?.m ?? 0) + 10,
    createdAt: Math.floor(Date.now() / 1000),
  };
  const res = db.insert(schema.promptTemplates).values(v).run();
  return Number(res.lastInsertRowid);
}

export async function updatePromptTemplate(
  id: number,
  input: PromptTemplateInput,
): Promise<void> {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body) return;
  await db
    .update(schema.promptTemplates)
    .set({ name, body, category: input.category?.trim() || null })
    .where(eq(schema.promptTemplates.id, id));
}

export async function removePromptTemplate(id: number): Promise<void> {
  await db.delete(schema.promptTemplates).where(eq(schema.promptTemplates.id, id));
}

// 上移 / 下移:与相邻模板交换 sortOrder(列表已按 sortOrder 排好,传相邻两 id)
export async function swapPromptTemplateOrder(aId: number, bId: number): Promise<void> {
  const a = await findPromptTemplate(aId);
  const b = await findPromptTemplate(bId);
  if (!a || !b) return;
  await db
    .update(schema.promptTemplates)
    .set({ sortOrder: b.sortOrder })
    .where(eq(schema.promptTemplates.id, aId));
  await db
    .update(schema.promptTemplates)
    .set({ sortOrder: a.sortOrder })
    .where(eq(schema.promptTemplates.id, bId));
}
