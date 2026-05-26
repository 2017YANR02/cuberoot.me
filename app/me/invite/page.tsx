import { requireUser } from "@/lib/auth-user";
import { getOrCreateForUser } from "@/lib/db/invites";
import { getSiteUrl } from "@/lib/site";
import { CopyButton } from "@/components/CopyButton";

export const metadata = {
  title: "我的邀请码 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyInvitePage() {
  const user = await requireUser("/me/invite");
  const invite = await getOrCreateForUser(user.id);
  const base = getSiteUrl();
  const link = `${base}/login?invite=${encodeURIComponent(invite.code)}`;

  return (
    <section className="container-page py-12 max-w-2xl">
      <h1 className="text-[24px] font-semibold text-ink">我的邀请码</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        分享给好友,对方使用邀请码注册后,你可以累计奖励。
      </p>

      <div className="mt-8 rounded-[14px] border border-line bg-white p-6">
        <div className="text-[12px] text-ink-3">邀请码</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="rounded-md bg-brand-soft px-4 py-2 text-[24px] font-mono font-semibold text-brand-dark tracking-wider">
            {invite.code}
          </div>
          <CopyButton text={invite.code} label="复制邀请码" />
        </div>

        <div className="mt-6 text-[12px] text-ink-3">邀请链接</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] truncate rounded-md border border-line bg-bg-soft px-3 py-2 text-[13px] text-ink-2 font-mono">
            {link}
          </div>
          <CopyButton text={link} label="复制链接" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
          <div className="rounded-md bg-bg-soft px-4 py-3">
            <div className="text-ink-3 text-[12px]">使用次数</div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink">{invite.uses}</div>
          </div>
          <div className="rounded-md bg-bg-soft px-4 py-3">
            <div className="text-ink-3 text-[12px]">注册奖励券</div>
            <div className="mt-0.5 text-[14px] font-mono text-ink">
              {invite.rewardCoupon ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
