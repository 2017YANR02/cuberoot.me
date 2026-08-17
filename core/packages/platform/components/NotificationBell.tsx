import Link from "next/link";
import { Bell } from "lucide-react";

// 纯展示:铃铛 + 未读角标。count 由主线在 header 注入,本组件不自取数。
export function NotificationBell({
  count,
  href = "/notifications",
}: {
  count: number;
  href?: string;
}) {
  const hasUnread = count > 0;
  const badge = count > 99 ? "99+" : String(count);
  return (
    <Link
      href={href}
      aria-label={hasUnread ? `通知,${count} 条未读` : "通知"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-bg-soft hover:text-brand transition"
    >
      <Bell size={18} />
      {hasUnread && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-[16px] text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
