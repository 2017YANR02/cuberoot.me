import Link from "next/link";
import { Check, Crown, RefreshCw, Sparkles } from "lucide-react";
import { Section } from "@/components/Section";
import { getCurrentUser } from "@/lib/auth-user";
import { MEMBERSHIP_PLANS, membershipState } from "@/lib/db/membership";
import { placeOrderFromForm } from "@/app/actions/order";

export const metadata = {
  title: "会员订阅 — 魔方开放社群",
  description: "开通会员,有效期内畅看全部付费课程,新课自动可看,随时续费。",
};

export const dynamic = "force-dynamic";

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const BENEFITS = [
  "解锁全部付费课程,有效期内随便看",
  "平台新上线的付费课,会员自动可看",
  "随时续费,时长自动叠加,不浪费",
];

export default async function MembershipPage() {
  const user = await getCurrentUser();
  const state = user ? await membershipState(user.id) : null;
  const active = Boolean(state?.active);

  return (
    <Section
      eyebrow="会员订阅"
      title="开通会员，畅看全部付费课程"
      subtitle="一次开通，有效期内平台所有付费课程随便学；新课上线也自动可看，不用一门门单独买。"
    >
      {active && state ? (
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-brand/40 bg-brand-soft px-5 py-4">
          <Crown size={18} className="text-brand shrink-0" />
          <div className="text-[14px] text-ink">
            你已是
            <span className="font-semibold text-brand-dark mx-1">
              {state.plan?.label ?? "会员"}
            </span>
            {state.expiresAt ? (
              <span className="text-ink-2">
                有效期至 {fmtDate(state.expiresAt)}
              </span>
            ) : null}
          </div>
          <span className="text-[13px] text-ink-3 ml-auto">
            续费即在当前到期日上叠加时长
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MEMBERSHIP_PLANS.map((plan) => {
          const highlight = plan.highlight;
          return (
            <div
              key={plan.id}
              className={
                "relative flex flex-col rounded-[14px] border bg-white p-6 transition hover:shadow-card " +
                (highlight
                  ? "border-brand shadow-card"
                  : "border-line hover:border-brand/40")
              }
            >
              {plan.badge ? (
                <span
                  className={
                    "absolute -top-2.5 right-5 rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
                    (highlight
                      ? "bg-brand text-white"
                      : "bg-brand-soft text-brand-dark")
                  }
                >
                  {plan.badge}
                </span>
              ) : null}

              <div className="text-[15px] font-semibold text-ink">{plan.label}</div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[34px] font-semibold leading-none text-brand">
                  ¥{plan.price}
                </span>
                <span className="text-[13px] text-ink-3">/ {plan.per}</span>
              </div>
              <div className="mt-1.5 text-[12px] text-ink-3">
                有效期 {plan.days} 天，到期前可续费
              </div>

              <form action={placeOrderFromForm} className="mt-6">
                <input type="hidden" name="type" value="membership" />
                <input type="hidden" name="refId" value={plan.id} />
                <input type="hidden" name="qty" value="1" />
                <button
                  type="submit"
                  className={
                    "inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2.5 text-[14px] font-medium transition " +
                    (highlight
                      ? "bg-brand text-white hover:bg-brand-dark"
                      : "border border-line text-ink-2 hover:border-brand hover:text-brand")
                  }
                >
                  {active ? (
                    <>
                      <RefreshCw size={14} />
                      续费此套餐
                    </>
                  ) : (
                    "立即开通"
                  )}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-[14px] border border-line bg-bg-soft p-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Sparkles size={16} className="text-brand" />
          会员权益
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[13px] leading-6 text-ink-2">
              <Check size={16} className="text-brand shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[13px] text-ink-3">
        想看自己的会员状态？
        <Link href="/me/membership" className="text-brand hover:underline mx-1">
          我的会员
        </Link>
      </p>
    </Section>
  );
}
