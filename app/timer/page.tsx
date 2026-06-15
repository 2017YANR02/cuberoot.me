import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { CubeTimer } from "@/components/CubeTimer";
import { FaceSvg } from "@/components/cube/FaceSvg";
import { getCurrentUser } from "@/lib/auth-user";
import { listRecent, type TimerSolve } from "@/lib/db/timer";

export const metadata: Metadata = {
  title: "魔方计时器 — 魔方开放社群",
  description:
    "在线魔方计时器,自动生成 WCA 风格打乱,实时统计 ao5 / ao12 / 最好成绩。空格蓄力开始,手机长按即可计时,登录后成绩永久保存。",
};

export const dynamic = "force-dynamic";

// 计时器默认练三阶,登录用户预载三阶历史做首屏统计;切项目后由客户端实时算。
export default async function TimerPage() {
  const user = await getCurrentUser();
  let serverSolves: TimerSolve[] = [];
  if (user) {
    serverSolves = await listRecent(user.id, "333", 200);
  }

  return (
    <Section
      eyebrow="练习工具"
      title="魔方计时器"
      subtitle="自动出打乱、按住空格蓄力计时,实时给你 ao5 / ao12 与最好成绩。手机长按也能玩,登录后成绩永久存档。"
    >
      <div className="mb-8 flex items-center gap-3">
        <FaceSvg n={3} size={56} seed={13} />
        <FaceSvg n={2} size={56} seed={4} className="hidden sm:block" />
        <FaceSvg n={4} size={56} seed={27} className="hidden sm:block" />
      </div>

      <CubeTimer
        loggedIn={Boolean(user)}
        initialEvent="333"
        serverSolves={serverSolves}
      />
    </Section>
  );
}
