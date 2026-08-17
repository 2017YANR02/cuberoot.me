import "server-only";
import { inArray, sql } from "drizzle-orm";
import type BetterSqlite3 from "better-sqlite3";
import { db, schema } from "@/db";
import { buildFtsQuery } from "@/lib/search/segment";
import type {
  Course,
  Product,
  CubeEvent,
  NewsItem,
} from "@/db/schema";
import type { PostWithAuthor } from "@/lib/db/posts";

export type SearchType =
  | "courses"
  | "products"
  | "events"
  | "news"
  | "posts";

function sqlite(): BetterSqlite3.Database {
  return db.$client as BetterSqlite3.Database;
}

function ftsIds(
  table: string,
  q: string,
  limit: number,
  offset: number,
): string[] {
  const rows = sqlite()
    .prepare(
      `SELECT id FROM ${table} WHERE ${table} MATCH ? ORDER BY rank LIMIT ? OFFSET ?`,
    )
    .all(q, limit, offset) as { id: string }[];
  return rows.map((r) => r.id);
}

function ftsCount(table: string, q: string): number {
  const row = sqlite()
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table} MATCH ?`)
    .get(q) as { n: number };
  return row.n;
}

function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const idx = new Map(ids.map((id, i) => [id, i] as const));
  return rows
    .filter((r) => idx.has(r.id))
    .sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
}

export type SearchOpts = { limit?: number; offset?: number };

export async function searchCourses(
  raw: string,
  { limit = 10, offset = 0 }: SearchOpts = {},
): Promise<Course[]> {
  const q = buildFtsQuery(raw);
  if (!q) return [];
  const ids = ftsIds("courses_fts", q, limit, offset);
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(schema.courses)
    .where(inArray(schema.courses.id, ids))
    .all();
  return orderByIds(rows, ids);
}

export async function searchCoursesCount(raw: string): Promise<number> {
  const q = buildFtsQuery(raw);
  if (!q) return 0;
  return ftsCount("courses_fts", q);
}

export async function searchProducts(
  raw: string,
  { limit = 10, offset = 0 }: SearchOpts = {},
): Promise<Product[]> {
  const q = buildFtsQuery(raw);
  if (!q) return [];
  const ids = ftsIds("products_fts", q, limit, offset);
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(schema.products)
    .where(inArray(schema.products.id, ids))
    .all();
  return orderByIds(rows, ids);
}

export async function searchProductsCount(raw: string): Promise<number> {
  const q = buildFtsQuery(raw);
  if (!q) return 0;
  return ftsCount("products_fts", q);
}

export async function searchEvents(
  raw: string,
  { limit = 10, offset = 0 }: SearchOpts = {},
): Promise<CubeEvent[]> {
  const q = buildFtsQuery(raw);
  if (!q) return [];
  const ids = ftsIds("events_fts", q, limit, offset);
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(schema.events)
    .where(inArray(schema.events.id, ids))
    .all();
  return orderByIds(rows, ids);
}

export async function searchEventsCount(raw: string): Promise<number> {
  const q = buildFtsQuery(raw);
  if (!q) return 0;
  return ftsCount("events_fts", q);
}

export async function searchNews(
  raw: string,
  { limit = 10, offset = 0 }: SearchOpts = {},
): Promise<NewsItem[]> {
  const q = buildFtsQuery(raw);
  if (!q) return [];
  const ids = ftsIds("news_fts", q, limit, offset);
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(schema.news)
    .where(inArray(schema.news.id, ids))
    .all();
  return orderByIds(rows, ids);
}

export async function searchNewsCount(raw: string): Promise<number> {
  const q = buildFtsQuery(raw);
  if (!q) return 0;
  return ftsCount("news_fts", q);
}

export async function searchPosts(
  raw: string,
  { limit = 10, offset = 0 }: SearchOpts = {},
): Promise<PostWithAuthor[]> {
  const q = buildFtsQuery(raw);
  if (!q) return [];
  const ids = ftsIds("posts_fts", q, limit, offset);
  if (ids.length === 0) return [];
  const commentCountSql = sql<number>`(
    SELECT COUNT(*) FROM ${schema.comments}
    WHERE ${schema.comments.postId} = ${schema.posts.id}
  )`;
  const rows = db
    .select({
      post: schema.posts,
      authorNickname: schema.users.nickname,
      authorAvatar: schema.users.avatar,
      commentCount: commentCountSql,
    })
    .from(schema.posts)
    .leftJoin(schema.users, sql`${schema.posts.authorId} = ${schema.users.id}`)
    .where(inArray(schema.posts.id, ids))
    .all();
  const mapped: PostWithAuthor[] = rows.map((r) => ({
    ...r.post,
    authorNickname: r.authorNickname ?? "未知用户",
    authorAvatar: r.authorAvatar ?? null,
    commentCount: Number(r.commentCount ?? 0),
  }));
  return orderByIds(mapped, ids);
}

export async function searchPostsCount(raw: string): Promise<number> {
  const q = buildFtsQuery(raw);
  if (!q) return 0;
  return ftsCount("posts_fts", q);
}

export type SearchAllResult = {
  courses: Course[];
  products: Product[];
  events: CubeEvent[];
  news: NewsItem[];
  posts: PostWithAuthor[];
  counts: Record<SearchType, number>;
};

export async function searchAll(
  raw: string,
  limitPerType = 5,
): Promise<SearchAllResult> {
  const empty: SearchAllResult = {
    courses: [],
    products: [],
    events: [],
    news: [],
    posts: [],
    counts: { courses: 0, products: 0, events: 0, news: 0, posts: 0 },
  };
  const q = buildFtsQuery(raw);
  if (!q) return empty;
  const [
    courses,
    products,
    events,
    news,
    posts,
    cC,
    cP,
    cE,
    cN,
    cPo,
  ] = await Promise.all([
    searchCourses(raw, { limit: limitPerType }),
    searchProducts(raw, { limit: limitPerType }),
    searchEvents(raw, { limit: limitPerType }),
    searchNews(raw, { limit: limitPerType }),
    searchPosts(raw, { limit: limitPerType }),
    searchCoursesCount(raw),
    searchProductsCount(raw),
    searchEventsCount(raw),
    searchNewsCount(raw),
    searchPostsCount(raw),
  ]);
  return {
    courses,
    products,
    events,
    news,
    posts,
    counts: {
      courses: cC,
      products: cP,
      events: cE,
      news: cN,
      posts: cPo,
    },
  };
}
