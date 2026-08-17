import Link from "next/link";
import {
  Bell,
  BellOff,
  Check,
  Heart,
  MessageCircle,
  Reply,
  AtSign,
  Trophy,
  Megaphone,
} from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { listForUser, unreadCount } from "@/lib/db/notifications";
import type { NotificationType } from "@/db/schema";
import {
  markAllReadAction,
  markReadAction,
} from "@/app/actions/notifications";

export const metadata = {
  title: "通知 — 魔方开放社群",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  comment: MessageCircle,
  reply: Reply,
  like: Heart,
  mention: AtSign,
  achievement: Trophy,
  system: Megaphone,
};

function formatTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const [items, unread] = await Promise.all([
    listForUser(user.id, { limit: 80 }),
    unreadCount(user.id),
  ]);

  return (
    <section className="container-page py-12 max-w-2xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink">通知</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {unread > 0 ? `你有 ${unread} 条未读通知` : "暂无未读通知"}
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand hover:text-brand transition"
            >
              <Check size={14} />
              全部已读
            </button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-[14px] border border-line bg-white py-16 text-center">
          <BellOff size={28} className="text-ink-3" />
          <div className="text-[14px] text-ink-2">还没有通知</div>
          <p className="max-w-xs text-[13px] text-ink-3">
            当有人评论、点赞你的帖子或 @ 你时,会在这里收到提醒。
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-[14px] border border-line bg-white divide-y divide-line overflow-hidden">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            const isUnread = n.readAt == null;
            const Inner = (
              <>
                <div
                  className={
                    "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md " +
                    (isUnread
                      ? "bg-brand-soft text-brand"
                      : "bg-bg-soft text-ink-3")
                  }
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={
                      "text-[14px] truncate " +
                      (isUnread ? "text-ink font-medium" : "text-ink-2")
                    }
                  >
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="mt-0.5 text-[13px] text-ink-3 line-clamp-2">
                      {n.body}
                    </div>
                  )}
                  <div className="mt-1 text-[12px] text-ink-3">
                    {formatTime(n.createdAt)}
                  </div>
                </div>
                {isUnread && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
                )}
              </>
            );

            // 内容区:有 href 用真 <a>(支持中键新开),无 href 纯展示。
            // 不在渲染时自动已读;未读项右侧给单条「标记已读」按钮。
            return (
              <div
                key={n.id}
                className={
                  "flex items-start gap-1 px-2 transition hover:bg-bg-soft " +
                  (isUnread ? "" : "opacity-70")
                }
              >
                {n.href ? (
                  <Link
                    href={n.href}
                    className="flex flex-1 gap-3 min-w-0 px-3 py-4"
                  >
                    {Inner}
                  </Link>
                ) : (
                  <div className="flex flex-1 gap-3 min-w-0 px-3 py-4">
                    {Inner}
                  </div>
                )}
                {isUnread && (
                  <form action={markReadAction} className="shrink-0 py-4 pr-2">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      aria-label="标记已读"
                      title="标记已读"
                      className="inline-flex items-center rounded-md border border-line px-2 py-1 text-[12px] text-ink-3 hover:border-brand hover:text-brand transition"
                    >
                      <Check size={13} />
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
