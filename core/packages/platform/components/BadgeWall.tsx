import {
  GraduationCap,
  BookOpenCheck,
  MessageSquarePlus,
  MessagesSquare,
  Star,
  Flame,
  CalendarHeart,
  ShoppingBag,
  Wallet,
  Timer,
  Repeat,
  Zap,
  Trophy,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { UserAchievementView } from "@/lib/db/achievements";

// 目录里用到的 lucide 图标名 → 组件映射(只列实际用到的,保持 tree-shake)。
const ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpenCheck,
  MessageSquarePlus,
  MessagesSquare,
  Star,
  Flame,
  CalendarHeart,
  ShoppingBag,
  Wallet,
  Timer,
  Repeat,
  Zap,
  Trophy,
};

const CATEGORY_LABEL: Record<UserAchievementView["category"], string> = {
  learning: "学习",
  timer: "计时",
  community: "社群",
  commerce: "成长",
};

// 解锁日期:用秒级 timestamp 转本地日,禁 new Date("YYYY-MM-DD")(这里是数字不是日期串,安全)。
function fmtDate(unlockedAt: number): string {
  const d = new Date(unlockedAt * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Props = {
  achievements: UserAchievementView[];
};

export function BadgeWall({ achievements }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {achievements.map((a) => {
        const Icon = ICONS[a.icon] ?? Trophy;
        const unlocked = a.unlocked;
        return (
          <div
            key={a.key}
            className={
              "flex flex-col rounded-[14px] border p-4 transition " +
              (unlocked
                ? "border-brand/40 bg-brand-soft/40 shadow-[0_4px_16px_rgba(42,93,244,0.08)]"
                : "border-line bg-white")
            }
          >
            <div className="flex items-center justify-between">
              <span
                className={
                  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full " +
                  (unlocked ? "bg-brand text-white" : "bg-bg-soft text-ink-3")
                }
              >
                {unlocked ? (
                  <Icon size={20} />
                ) : (
                  <Lock size={18} className="text-ink-3" />
                )}
              </span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] " +
                  (unlocked
                    ? "bg-brand/10 text-brand"
                    : "bg-bg-soft text-ink-3")
                }
              >
                {CATEGORY_LABEL[a.category]}
              </span>
            </div>

            <h3
              className={
                "mt-3 text-[14px] font-semibold " +
                (unlocked ? "text-ink" : "text-ink-3")
              }
            >
              {a.name}
            </h3>
            <p className="mt-1 flex-1 text-[12px] leading-5 text-ink-3">
              {a.description}
            </p>

            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className={unlocked ? "text-brand" : "text-ink-3"}>
                {a.points > 0 ? `+${a.points} 积分` : "纪念徽章"}
              </span>
              <span className="text-ink-3">
                {unlocked && a.unlockedAt
                  ? fmtDate(a.unlockedAt)
                  : "未解锁"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
