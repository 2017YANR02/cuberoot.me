import "server-only";
import { and, asc, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PromptTemplate, PromptTemplateInsert } from "@/db/schema";

export type { PromptTemplate };

export type PromptTemplateInput = {
  name: string;
  category?: string | null;
  body: string;
  dimension?: string | null;
};

// 在用整套预设模板(dimension 为 null,未进回收站):编辑器「整套模板」快速选 + 后台管理。
export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  return db
    .select()
    .from(schema.promptTemplates)
    .where(
      and(
        isNull(schema.promptTemplates.dimension),
        isNull(schema.promptTemplates.deletedAt),
      ),
    )
    .orderBy(asc(schema.promptTemplates.sortOrder), asc(schema.promptTemplates.id))
    .all();
}

// 在用维度组合积木(dimension 非 null,未进回收站):编辑器组合器 + 后台管理。
export async function listPromptBlocks(): Promise<PromptTemplate[]> {
  return db
    .select()
    .from(schema.promptTemplates)
    .where(
      and(
        isNotNull(schema.promptTemplates.dimension),
        isNull(schema.promptTemplates.deletedAt),
      ),
    )
    .orderBy(asc(schema.promptTemplates.sortOrder), asc(schema.promptTemplates.id))
    .all();
}

// 回收站里的模板(已软删),按删除时间倒序(最近删的在前)
export async function listDeletedPromptTemplates(): Promise<PromptTemplate[]> {
  return db
    .select()
    .from(schema.promptTemplates)
    .where(isNotNull(schema.promptTemplates.deletedAt))
    .orderBy(desc(schema.promptTemplates.deletedAt))
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

// 新模板 / 积木排到同维度末尾(同维度当前最大 sortOrder + 10,预设与各维度各自独立排序)
export async function createPromptTemplate(input: PromptTemplateInput): Promise<number> {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body) throw new Error("name / body 必填");
  const dimension = input.dimension?.trim() || null;
  const maxRow = db
    .select({ m: sql<number>`coalesce(max(${schema.promptTemplates.sortOrder}), 0)` })
    .from(schema.promptTemplates)
    .where(
      dimension
        ? eq(schema.promptTemplates.dimension, dimension)
        : isNull(schema.promptTemplates.dimension),
    )
    .get();
  const v: PromptTemplateInsert = {
    name,
    category: input.category?.trim() || null,
    body,
    dimension,
    sortOrder: (maxRow?.m ?? 0) + 10,
    createdAt: Math.floor(Date.now() / 1000),
  };
  const res = db.insert(schema.promptTemplates).values(v).run();
  return Number(res.lastInsertRowid);
}

// 编辑名称 / 正文 / 分组(维度不在此改,避免错位;要换维度删了重建)
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

// 移到回收站(软删):保留数据,从在用列表与编辑器选择器消失,可恢复
export async function trashPromptTemplate(id: number): Promise<void> {
  await db
    .update(schema.promptTemplates)
    .set({ deletedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.promptTemplates.id, id));
}

// 从回收站恢复
export async function restorePromptTemplate(id: number): Promise<void> {
  await db
    .update(schema.promptTemplates)
    .set({ deletedAt: null })
    .where(eq(schema.promptTemplates.id, id));
}

// 彻底删除(不可恢复),仅回收站里的彻底删按钮调用
export async function purgePromptTemplate(id: number): Promise<void> {
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
