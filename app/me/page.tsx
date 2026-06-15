import Link from "next/link";
import {
  BookOpen,
  Heart,
  Crown,
  Gift,
  Timer,
  Flame,
  CalendarCheck,
  Trophy,
  ChevronRight,
  Award,
  NotebookPen,
  BarChart3,
} from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { getStreakInfo } from "@/lib/db/checkins";
import { getBalance } from "@/lib/db/points";
import { CheckInButton } from "@/components/CheckInButton";
import { StreakCalendar } from "@/components/StreakCalendar";
import { PointsBadge } from "@/components/PointsBadge";

export const metadata = {
  title: "个人中心 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const QUICK_LINKS: {
  href: string;
  label: string;
  desc: string;
  icon: typeof BookOpen;
}[] = [
  { href: "/me/courses", label: "我的课程", desc: "已购课程与学习进度", icon: BookOpen },
  { href: "/me/badges", label: "我的徽章", desc: "解锁的成就徽章", icon: Award },
  { href: "/me/notes", label: "我的笔记", desc: "课程时间戳笔记", icon: NotebookPen },
  { href: "/me/favorites", label: "我的收藏", desc: "收藏的课程 / 商品 / 帖子", icon: Heart },
  { href: "/me/membership", label: "我的会员", desc: "会员状态与续费", icon: Crown },
  { href: "/me/invite", label: "我的邀请", desc: "邀请码与好友奖励", icon: Gift },
  { href: "/timer", label: "计时器", desc: "记录还原成绩", icon: Timer },
  { href: "/leaderboard", label: "排行榜", desc: "速拧 / 学习 / 积分榜", icon: BarChart3 },
];

export default async function MePage() {
  const user = await requireUser("/me");
  const streak = await getStreakInfo(user.id);
  const balance = await getBalance(user.id);

  const stats: { label: string; value: number; unit: string; icon: typeof Flame }[] = [
    { label: "当前连续", value: streak.current, unit: "天", icon: Flame },
    { label: "累计打卡", value: streak.total, unit: "天", icon: CalendarCheck },
    { label: "最长记录", value: streak.longest, unit: "天", icon: Trophy },
  ];

  return (
    <section className="container-page py-10 md:py-12">
      {/* 欢迎 + 今日打卡 */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-semibold text-ink">
            你好,{user.nickname}
          </h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {streak.checkedToday
              ? "今天已经打卡,保持下去。"
              : "坚持每天来练一练,点亮今天的打卡。"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PointsBadge balance={balance} label="积分" size="lg" />
          <CheckInButton checkedToday={streak.checkedToday} current={streak.current} />
        </div>
      </header>

      {/* 统计 */}
      <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[14px] border border-line bg-white px-4 py-4 sm:px-5 sm:py-5"
          >
            <div className="flex items-center gap-1.5 text-ink-3">
              <s.icon size={14} className="text-brand" />
              <span className="text-[12px]">{s.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[26px] sm:text-[30px] font-semibold text-ink leading-none">
                {s.value}
              </span>
              <span className="text-[12px] text-ink-3">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 打卡热力图 */}
      <div className="mt-6 rounded-[14px] border border-line bg-white p-5 md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">学习打卡</h2>
          <span className="text-[12px] text-ink-3">最近 17 周</span>
        </div>
        <div className="mt-4">
          {streak.dates.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">
              还没有打卡记录,点上方「今日打卡」开启你的第一天。
            </p>
          ) : (
            <StreakCalendar dates={streak.dates} />
          )}
        </div>
      </div>

      {/* 快捷入口九宫格 */}
      <h2 className="mt-10 mb-4 text-[15px] font-semibold text-ink">快捷入口</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-center gap-4 rounded-[14px] border border-line bg-white px-5 py-4 transition hover:border-brand/40 hover:shadow-[0_4px_16px_rgba(42,93,244,0.08)]"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft">
              <l.icon size={20} className="text-brand" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">
                {l.label}
              </span>
              <span className="block truncate text-[12px] text-ink-3">
                {l.desc}
              </span>
            </span>
            <ChevronRight
              size={18}
              className="shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-brand"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
