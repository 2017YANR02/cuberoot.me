import { Award } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import {
  listUserAchievements,
  recomputeAchievements,
} from "@/lib/db/achievements";
import { BadgeWall } from "@/components/BadgeWall";

export const metadata = {
  title: "我的徽章 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyBadgesPage() {
  const user = await requireUser("/me/badges");
  // 进页先补算一次:历史达成但未解锁的成就在此回填(幂等,不重复发分)。
  await recomputeAchievements(user.id);

  const achievements = await listUserAchievements(user.id);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;
  const earnedPoints = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.points, 0);

  return (
    <section className="container-page py-10 md:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[24px] md:text-[28px] font-semibold text-ink">
            <Award size={24} className="text-brand" />
            我的徽章
          </h1>
          <p className="mt-1 text-[13px] text-ink-3">
            完成学习、计时、社群与成长里程碑,点亮专属徽章。
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[26px] font-semibold leading-none text-brand">
              {unlocked}
              <span className="text-[14px] text-ink-3"> / {total}</span>
            </div>
            <div className="mt-1 text-[12px] text-ink-3">已解锁</div>
          </div>
          <div>
            <div className="text-[26px] font-semibold leading-none text-ink">
              {earnedPoints}
            </div>
            <div className="mt-1 text-[12px] text-ink-3">徽章积分</div>
          </div>
        </div>
      </header>

      <div className="mt-8">
        <BadgeWall achievements={achievements} />
      </div>
    </section>
  );
}
