import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NewsItem, NewsItemInsert } from "@/db/schema";
import { searchNews, searchNewsCount } from "@/lib/db/search";
import type { PagedResult, ListOpts } from "@/lib/db/courses";

export async function list(): Promise<NewsItem[]> {
  return db.select().from(schema.news).orderBy(desc(schema.news.date)).all();
}

export async function listPaged({
  q,
  page = 1,
  pageSize = 12,
}: ListOpts = {}): Promise<PagedResult<NewsItem>> {
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * pageSize;
  const query = q?.trim() ?? "";

  if (query) {
    const [items, total] = await Promise.all([
      searchNews(query, { limit: pageSize, offset }),
      searchNewsCount(query),
    ]);
    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.news)
    .all();
  const total = totalRow[0]?.n ?? 0;
  const items = db
    .select()
    .from(schema.news)
    .orderBy(desc(schema.news.date))
    .limit(pageSize)
    .offset(offset)
    .all();
  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
