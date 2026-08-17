import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Favorite, FavoriteTarget } from "@/db/schema";

export type { Favorite, FavoriteTarget };

// 五类收藏目标 → 详情页链接前缀。商品落 /shop,帖子落 /community/posts。
const HREF_PREFIX: Record<FavoriteTarget, string> = {
  course: "/courses",
  product: "/shop",
  event: "/events",
  news: "/news",
  post: "/community/posts",
};

// 各类型中文名,收藏夹分组小标题用
export const FAVORITE_TYPE_LABEL: Record<FavoriteTarget, string> = {
  course: "课程",
  product: "商品",
  event: "赛事",
  news: "资讯",
  post: "帖子",
};

export const FAVORITE_TYPES: FavoriteTarget[] = [
  "course",
  "product",
  "event",
  "news",
  "post",
];

export function isFavoriteTarget(v: string): v is FavoriteTarget {
  return (FAVORITE_TYPES as string[]).includes(v);
}

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function newFavoriteId(): string {
  return "fav_" + b64url(randomBytes(9));
}

export function favoriteHref(type: FavoriteTarget, id: string): string {
  return `${HREF_PREFIX[type]}/${id}`;
}

/** 该用户是否已收藏指定对象 */
export async function isFavorited(
  userId: string,
  type: FavoriteTarget,
  id: string,
): Promise<boolean> {
  const rows = db
    .select({ id: schema.favorites.id })
    .from(schema.favorites)
    .where(
      and(
        eq(schema.favorites.userId, userId),
        eq(schema.favorites.targetType, type),
        eq(schema.favorites.targetId, id),
      ),
    )
    .all();
  return rows.length > 0;
}

/** 切换收藏:已收藏则取消,否则新增。返回切换后的状态(true = 现在已收藏) */
export async function toggleFavorite(
  userId: string,
  type: FavoriteTarget,
  id: string,
): Promise<boolean> {
  const has = await isFavorited(userId, type, id);
  if (has) {
    await db
      .delete(schema.favorites)
      .where(
        and(
          eq(schema.favorites.userId, userId),
          eq(schema.favorites.targetType, type),
          eq(schema.favorites.targetId, id),
        ),
      );
    return false;
  }
  await db.insert(schema.favorites).values({
    id: newFavoriteId(),
    userId,
    targetType: type,
    targetId: id,
    createdAt: Math.floor(Date.now() / 1000),
  });
  return true;
}

/** 某个对象被多少人收藏 */
export async function countFor(
  type: FavoriteTarget,
  id: string,
): Promise<number> {
  const rows = db
    .select({ id: schema.favorites.id })
    .from(schema.favorites)
    .where(
      and(
        eq(schema.favorites.targetType, type),
        eq(schema.favorites.targetId, id),
      ),
    )
    .all();
  return rows.length;
}

export type FavoriteItem = {
  favoriteId: string;
  targetType: FavoriteTarget;
  targetId: string;
  title: string;
  href: string;
  createdAt: number;
};

export type FavoriteGroup = {
  type: FavoriteTarget;
  label: string;
  items: FavoriteItem[];
};

// 各资源表的标题列,统一映射成 FavoriteItem.title
const TITLE_COL = {
  course: schema.courses.title,
  product: schema.products.name,
  event: schema.events.title,
  news: schema.news.title,
  post: schema.posts.title,
} as const;

const ID_COL = {
  course: schema.courses.id,
  product: schema.products.id,
  event: schema.events.id,
  news: schema.news.id,
  post: schema.posts.id,
} as const;

const TABLE = {
  course: schema.courses,
  product: schema.products,
  event: schema.events,
  news: schema.news,
  post: schema.posts,
} as const;

/**
 * 按 targetType 分组返回某用户的收藏,每项带原对象标题与详情链接。
 * 逐类型查 favorites 拿 id 列表,再 join 对应资源表取标题;原对象已删的收藏自动跳过。
 */
export async function listByUser(userId: string): Promise<FavoriteGroup[]> {
  const favs = db
    .select()
    .from(schema.favorites)
    .where(eq(schema.favorites.userId, userId))
    .orderBy(desc(schema.favorites.createdAt))
    .all();

  if (favs.length === 0) {
    return FAVORITE_TYPES.map((type) => ({
      type,
      label: FAVORITE_TYPE_LABEL[type],
      items: [],
    }));
  }

  const groups: FavoriteGroup[] = [];

  for (const type of FAVORITE_TYPES) {
    const typed = favs.filter((f) => f.targetType === type);
    if (typed.length === 0) {
      groups.push({ type, label: FAVORITE_TYPE_LABEL[type], items: [] });
      continue;
    }

    const ids = typed.map((f) => f.targetId);
    // 一次查出该类型所有命中标题,O(类型数) 次查询而非 O(收藏数)
    const titleRows = db
      .select({ id: ID_COL[type], title: TITLE_COL[type] })
      .from(TABLE[type])
      .where(inArray(ID_COL[type], ids))
      .all();
    const titleMap = new Map(titleRows.map((r) => [r.id, r.title]));

    const items: FavoriteItem[] = typed
      .map((f): FavoriteItem | null => {
        const title = titleMap.get(f.targetId);
        if (title == null) return null; // 原对象已删,跳过
        return {
          favoriteId: f.id,
          targetType: type,
          targetId: f.targetId,
          title,
          href: favoriteHref(type, f.targetId),
          createdAt: f.createdAt,
        };
      })
      .filter((x): x is FavoriteItem => x !== null);

    groups.push({ type, label: FAVORITE_TYPE_LABEL[type], items });
  }

  return groups;
}
