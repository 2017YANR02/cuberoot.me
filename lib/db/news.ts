import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NewsItem, NewsItemInsert } from "@/db/schema";

export async function list(): Promise<NewsItem[]> {
  return db.select().from(schema.news).orderBy(desc(schema.news.date)).all();
}

export async function findById(id: string): Promise<NewsItem | undefined> {
  const rows = db.select().from(schema.news).where(eq(schema.news.id, id)).all();
  return rows[0];
}

export async function upsert(values: NewsItemInsert): Promise<void> {
  await db
    .insert(schema.news)
    .values(values)
    .onConflictDoUpdate({
      target: schema.news.id,
      set: {
        title: values.title,
        date: values.date,
        category: values.category,
        excerpt: values.excerpt,
        body: values.body ?? null,
      },
    });
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.news).where(eq(schema.news.id, id));
}

export type { NewsItem };
