import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  CircleId,
  Comment,
  CommentInsert,
  Post,
  PostInsert,
} from "@/db/schema";
import type { CircleSort } from "@/lib/search-params";
import { randomBytes } from "node:crypto";
import { awardPoints } from "@/lib/db/points";

export type { Post, Comment, CircleId };

export type PostWithAuthor = Post & {
  authorNickname: string;
  authorAvatar: string | null;
  commentCount: number;
};

export type CommentWithAuthor = Comment & {
  authorNickname: string;
  authorAvatar: string | null;
};

export const CIRCLE_META: Record<
  CircleId,
  { name: string; activity: string; members: number; desc: string }
> = {
  newbie: {
    name: "新手互助营",
    activity: "高",
    members: 4218,
    desc: "面向 30s+ 用户的零门槛入门圈子,每日打卡 + 教练答疑。",
  },
  speed: {
    name: "竞速突破组",
    activity: "极高",
    members: 1862,
    desc: "sub-15 选手集结地,周赛 + PB 复盘 + 公式互测。",
  },
  blind: {
    name: "盲拧研习社",
    activity: "中",
    members: 432,
    desc: "盲拧 + 多盲爱好者,定期分享记忆法与训练数据。",
  },
  campus: {
    name: "校园魔方联盟",
    activity: "高",
    members: 2790,
    desc: "全国高校魔方社联合,赛事内推 + 校际联谊。",
  },
};

export function isCircleId(v: string): v is CircleId {
  return v === "newbie" || v === "speed" || v === "blind" || v === "campus";
}

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function newPostId(): string {
  return "p_" + b64url(randomBytes(9));
}

export function newCommentId(): string {
  return "cm_" + b64url(randomBytes(9));
}

export async function listPosts(opts?: {
  circleId?: CircleId;
  limit?: number;
}): Promise<PostWithAuthor[]> {
  const where = opts?.circleId
    ? eq(schema.posts.circleId, opts.circleId)
    : undefined;

  const commentCountSql = sql<number>`(
    SELECT COUNT(*) FROM ${schema.comments}
    WHERE ${schema.comments.postId} = ${schema.posts.id}
  )`;

  const base = db
    .select({
      post: schema.posts,
      authorNickname: schema.users.nickname,
      authorAvatar: schema.users.avatar,
      commentCount: commentCountSql,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id));

  const ordered = (where ? base.where(where) : base).orderBy(
    desc(schema.posts.createdAt),
  );
  const rows = opts?.limit ? ordered.limit(opts.limit).all() : ordered.all();

  return rows.map((r) => ({
    ...r.post,
    authorNickname: r.authorNickname ?? "未知用户",
    authorAvatar: r.authorAvatar ?? null,
    commentCount: Number(r.commentCount ?? 0),
  }));
}

export async function countCommentsByPost(postId: string): Promise<number> {
  const rows = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.comments)
    .where(eq(schema.comments.postId, postId))
    .all();
  return Number(rows[0]?.n ?? 0);
}

export type PagedPosts = {
  items: PostWithAuthor[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * 单个圈子的分页帖子列表。
 * sort='latest':按 createdAt 倒序。
 * sort='hot':热度排序 = likes*2 + 评论数*3,近 7 天的帖子整体加权(× 时间衰减),
 *   让新热帖压过陈年高赞帖;同分回落到 createdAt 倒序。
 */
export async function listPagedByCircle({
  circleId,
  sort,
  page = 1,
  pageSize = 20,
}: {
  circleId: CircleId;
  sort: CircleSort;
  page?: number;
  pageSize?: number;
}): Promise<PagedPosts> {
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * pageSize;

  const where = eq(schema.posts.circleId, circleId);

  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.posts)
    .where(where)
    .all();
  const total = Number(totalRow[0]?.n ?? 0);

  const commentCountSql = sql<number>`(
    SELECT COUNT(*) FROM ${schema.comments}
    WHERE ${schema.comments.postId} = ${schema.posts.id}
  )`;

  // 热度分:基础分 likes*2 + 评论*3;近 7 天加 1.6 倍权重(线性衰减:今天 ×1.6 → 第 7 天 ×1.0)。
  // 用 strftime('%s','now') 取当前秒,避免把 Date.now() 拼进 SQL 影响缓存语义。
  const hotScoreSql = sql<number>`(
    (${schema.posts.likes} * 2 + ${commentCountSql} * 3 + 1)
    * (1 + 0.6 * MAX(0, 7 - (CAST(strftime('%s','now') AS INTEGER) - ${schema.posts.createdAt}) / 86400.0) / 7.0)
  )`;

  const base = db
    .select({
      post: schema.posts,
      authorNickname: schema.users.nickname,
      authorAvatar: schema.users.avatar,
      commentCount: commentCountSql,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .where(where);

  const ordered =
    sort === "hot"
      ? base.orderBy(desc(hotScoreSql), desc(schema.posts.createdAt))
      : base.orderBy(desc(schema.posts.createdAt));

  const rows = ordered.limit(pageSize).offset(offset).all();

  const items: PostWithAuthor[] = rows.map((r) => ({
    ...r.post,
    authorNickname: r.authorNickname ?? "未知用户",
    authorAvatar: r.authorAvatar ?? null,
    commentCount: Number(r.commentCount ?? 0),
  }));

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function findPostById(id: string): Promise<PostWithAuthor | undefined> {
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
    .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .where(eq(schema.posts.id, id))
    .all();
  const r = rows[0];
  if (!r) return undefined;
  return {
    ...r.post,
    authorNickname: r.authorNickname ?? "未知用户",
    authorAvatar: r.authorAvatar ?? null,
    commentCount: Number(r.commentCount ?? 0),
  };
}

export async function listComments(postId: string): Promise<CommentWithAuthor[]> {
  const rows = db
    .select({
      comment: schema.comments,
      authorNickname: schema.users.nickname,
      authorAvatar: schema.users.avatar,
    })
    .from(schema.comments)
    .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
    .where(eq(schema.comments.postId, postId))
    .orderBy(asc(schema.comments.createdAt))
    .all();
  return rows.map((r) => ({
    ...r.comment,
    authorNickname: r.authorNickname ?? "未知用户",
    authorAvatar: r.authorAvatar ?? null,
  }));
}

export async function createPost(values: {
  authorId: string;
  circleId: CircleId;
  title: string;
  body: string;
}): Promise<Post> {
  const now = Math.floor(Date.now() / 1000);
  const v: PostInsert = {
    id: newPostId(),
    authorId: values.authorId,
    circleId: values.circleId,
    title: values.title,
    body: values.body,
    likes: 0,
    createdAt: now,
  };
  await db.insert(schema.posts).values(v);
  // 发帖发分,按新帖 id 去重(同一帖不重复发)。
  await awardPoints(values.authorId, 3, "post", { refId: v.id });
  return { ...v, likes: 0 } as Post;
}

export async function createComment(values: {
  postId: string;
  authorId: string;
  body: string;
}): Promise<Comment> {
  const now = Math.floor(Date.now() / 1000);
  const v: CommentInsert = {
    id: newCommentId(),
    postId: values.postId,
    authorId: values.authorId,
    body: values.body,
    createdAt: now,
  };
  await db.insert(schema.comments).values(v);
  return v as Comment;
}

export async function isLikedByUser(
  postId: string,
  userId: string,
): Promise<boolean> {
  const rows = db
    .select()
    .from(schema.postLikes)
    .where(
      and(
        eq(schema.postLikes.postId, postId),
        eq(schema.postLikes.userId, userId),
      ),
    )
    .all();
  return rows.length > 0;
}

export async function toggleLike(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; likes: number }> {
  const liked = await isLikedByUser(postId, userId);
  const now = Math.floor(Date.now() / 1000);
  if (liked) {
    await db
      .delete(schema.postLikes)
      .where(
        and(
          eq(schema.postLikes.postId, postId),
          eq(schema.postLikes.userId, userId),
        ),
      );
    await db
      .update(schema.posts)
      .set({ likes: sql`MAX(${schema.posts.likes} - 1, 0)` })
      .where(eq(schema.posts.id, postId));
  } else {
    await db.insert(schema.postLikes).values({ postId, userId, createdAt: now });
    await db
      .update(schema.posts)
      .set({ likes: sql`${schema.posts.likes} + 1` })
      .where(eq(schema.posts.id, postId));
  }
  const rows = db
    .select({ likes: schema.posts.likes })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .all();
  return { liked: !liked, likes: rows[0]?.likes ?? 0 };
}

export async function removePost(id: string): Promise<void> {
  await db.delete(schema.comments).where(eq(schema.comments.postId, id));
  await db.delete(schema.postLikes).where(eq(schema.postLikes.postId, id));
  await db.delete(schema.posts).where(eq(schema.posts.id, id));
}
