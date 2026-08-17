import { Gift, Ticket, Users } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { getOrCreateForUser, inviteStats } from "@/lib/db/invites";
import { getSiteUrl } from "@/lib/site";
import { StatCard } from "@/components/StatCard";
import { InviteShareCard } from "@/components/InviteShareCard";

export const metadata = {
  title: "我的邀请码 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function inviteLink(base: string, code: string): string {
  return `${base}/login?invite=${encodeURIComponent(code)}`;
}

export default async function MyInvitePage() {
  const user = await requireUser("/me/invite");
  // 确保至少有一个主邀请码,再拉全部统计。
  const primary = await getOrCreateForUser(user.id);
  const stats = await inviteStats(user.id);
  const base = getSiteUrl();
  const primaryLink = inviteLink(base, primary.code);

  // 把主码排在最前
  const codes = [...stats.codes].sort((a, b) =>
    a.code === primary.code ? -1 : b.code === primary.code ? 1 : 0,
  );

  return (
    <section className="container-page max-w-2xl py-12">
      <h1 className="text-[24px] font-semibold text-ink">我的邀请码</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        分享给好友,对方使用邀请码注册后,你可以累计裂变战报与奖励。
      </p>

      {/* 分享卡:可截图发群 */}
      <div className="mt-8">
        <InviteShareCard
          code={primary.code}
          link={primaryLink}
          rewardCoupon={primary.rewardCoupon}
        />
      </div>

      {/* 裂变战报 */}
      <h2 className="mt-10 text-[15px] font-semibold text-ink">裂变战报</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="累计邀请人次"
          value={String(stats.totalUses)}
          hint="好友用我的码注册成功的总次数"
        />
        <StatCard
          icon={Ticket}
          label="我的邀请码"
          value={String(stats.totalCodes)}
          hint="名下全部有效邀请码数量"
        />
        <StatCard
          icon={Gift}
          label="奖励券"
          value={primary.rewardCoupon ? "已配" : "—"}
          hint={
            primary.rewardCoupon
              ? `新人注册发券 ${primary.rewardCoupon}`
              : "暂未配置注册奖励券"
          }
        />
      </div>

      {/* 每个码的使用次数 */}
      <h2 className="mt-10 text-[15px] font-semibold text-ink">各邀请码明细</h2>
      <div className="mt-3 overflow-x-auto rounded-[14px] border border-line bg-white">
        <table className="w-full min-w-[460px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th className="px-4 py-3 font-medium">邀请码</th>
              <th className="px-4 py-3 font-medium">使用次数</th>
              <th className="px-4 py-3 font-medium">注册奖励券</th>
              <th className="px-4 py-3 font-medium">邀请链接</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold tracking-wider text-brand-dark">
                    {c.code}
                  </span>
                  {c.code === primary.code ? (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-dark">
                      主码
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink">{c.uses}</td>
                <td className="px-4 py-3 font-mono text-ink-2">
                  {c.rewardCoupon ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={inviteLink(base, c.code)}
                    className="font-mono text-ink-3 underline-offset-2 hover:text-brand hover:underline"
                  >
                    /login?invite={c.code}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] leading-5 text-ink-3">
        邀请人次按好友成功注册的次数累计。被邀请好友越多,后续奖励越多,具体奖励规则以活动页为准。
      </p>
    </section>
  );
}
