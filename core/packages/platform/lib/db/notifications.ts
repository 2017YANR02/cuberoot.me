import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type {
  Notification,
  NotificationInsert,
  NotificationType,
} from "@/db/schema";

export type { Notification, NotificationType };

// 收件人为 actor 本人时不通知(别给自己发被赞/被评)。
export type NotifyInput = {
  userId: string; // 收件人
  type: NotificationType;
  actorId?: string; // 触发者(系统通知留空)
  title: string;
  body?: string;
  href?: string;
  refType?: string;
  refId?: string;
};

export type NotificationWithActor = Notification & {
  actorNickname: string | null;
  actorAvatar: string | null;
};

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function newNotificationId(): string {
  return "nf_" + b64url(randomBytes(9));
}

// 写一条通知。userId === actorId 时跳过(不通知自己),返回 null。
export async function notify(input: NotifyInput): Promise<Notification | null> {
  const { userId, actorId } = input;
  if (!userId) return null;
  if (actorId && userId === actorId) return null;

  const now = Math.floor(Date.now() / 1000);
  const row: NotificationInsert = {
    id: newNotificationId(),
    userId,
    type: input.type,
    actorId: actorId ?? null,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    readAt: null,
    createdAt: now,
  };
  db.insert(schema.notifications).values(row).run();
  return row as Notification;
}

// 收件人通知列表(按时间倒序),带触发者昵称/头像。
export async function listForUser(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationWithActor[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 200);
  const where = opts.unreadOnly
    ? and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt),
      )
    : eq(schema.notifications.userId, userId);

  const rows = db
    .select({
      notification: schema.notifications,
      actorNickname: schema.users.nickname,
      actorAvatar: schema.users.avatar,
    })
    .from(schema.notifications)
    .leftJoin(schema.users, eq(schema.notifications.actorId, schema.users.id))
    .where(where)
    .orderBy(
      desc(schema.notifications.createdAt),
      desc(schema.notifications.id),
    )
    .limit(limit)
    .all();

  return rows.map((r) => ({
    ...r.notification,
    actorNickname: r.actorNickname ?? null,
    actorAvatar: r.actorAvatar ?? null,
  }));
}

// 未读条数。
export async function unreadCount(userId: string): Promise<number> {
  const rows = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt),
      ),
    )
    .all();
  return Number(rows[0]?.n ?? 0);
}

// 标记单条已读(必须属于该收件人,防越权)。返回是否命中。
export async function markRead(id: string, userId: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const res = db
    .update(schema.notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(schema.notifications.id, id),
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt),
      ),
    )
    .run();
  return res.changes > 0;
}

// 全部标记已读。返回标记的条数。
export async function markAllRead(userId: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const res = db
    .update(schema.notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt),
      ),
    )
    .run();
  return res.changes;
}

// 从正文里解析 @昵称(@ 后跟非空白),去重返回昵称列表。
export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  const re = /@(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1].trim();
    if (name) out.add(name);
  }
  return [...out];
}

// 按昵称查用户 id(精确匹配,取第一个)。查不到返回 null。
export async function findUserIdByNickname(
  nickname: string,
): Promise<string | null> {
  const rows = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.nickname, nickname))
    .limit(1)
    .all();
  return rows[0]?.id ?? null;
}
