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

/**
 * 按发布日期倒序排列后的上一篇(更新)/ 下一篇(更早)。
 * 列表页同样按 date desc 排列,这里保持一致:prev = 列表里在它前面的(更新),next = 后面的(更早)。
 */
export async function findAdjacent(
  current: NewsItem,
): Promise<{ prev: NewsItem | undefined; next: NewsItem | undefined }> {
  // prev:日期更新的最近一条(date 更大)
  const prevRows = db
    .select()
    .from(schema.news)
    .where(sql`${schema.news.date} > ${current.date}`)
    .orderBy(schema.news.date)
    .limit(1)
    .all();
  // next:日期更早的最近一条(date 更小)
  const nextRows = db
    .select()
    .from(schema.news)
    .where(sql`${schema.news.date} < ${current.date}`)
    .orderBy(desc(schema.news.date))
    .limit(1)
    .all();
  return { prev: prevRows[0], next: nextRows[0] };
}

/** 同分类的相关资讯(排除自己),按日期倒序取若干条 */
export async function listRelated(
  current: NewsItem,
  limit = 3,
): Promise<NewsItem[]> {
  return db
    .select()
    .from(schema.news)
    .where(
      sql`${schema.news.category} = ${current.category} and ${schema.news.id} <> ${current.id}`,
    )
    .orderBy(desc(schema.news.date))
    .limit(limit)
    .all();
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
