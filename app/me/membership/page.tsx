import Link from "next/link";
import { Crown, RefreshCw } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { membershipState } from "@/lib/db/membership";
import { placeOrderFromForm } from "@/app/actions/order";

export const metadata = {
  title: "我的会员 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function MyMembershipPage() {
  const user = await requireUser("/me/membership");
  const state = await membershipState(user.id);

  return (
    <section className="container-page py-12 max-w-2xl">
      <h1 className="text-[24px] font-semibold text-ink">我的会员</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        会员有效期内可畅看全部付费课程。
      </p>

      {state.active ? (
        <div className="mt-8 rounded-[14px] border border-line bg-white p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft">
              <Crown size={18} className="text-brand" />
            </span>
            <div>
              <div className="text-[16px] font-semibold text-ink">
                {state.plan?.label ?? "会员"}
              </div>
              <div className="text-[12px] text-brand">会员生效中</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
            <div className="rounded-md bg-bg-soft px-4 py-3">
              <div className="text-ink-3 text-[12px]">有效期至</div>
              <div className="mt-0.5 text-[16px] font-semibold text-ink">
                {state.expiresAt ? fmtDate(state.expiresAt) : "—"}
              </div>
            </div>
            <div className="rounded-md bg-bg-soft px-4 py-3">
              <div className="text-ink-3 text-[12px]">套餐</div>
              <div className="mt-0.5 text-[16px] font-semibold text-ink">
                {state.plan ? `¥${state.plan.price} / ${state.plan.per}` : "—"}
              </div>
            </div>
          </div>

          {state.plan ? (
            <form action={placeOrderFromForm} className="mt-6">
              <input type="hidden" name="type" value="membership" />
              <input type="hidden" name="refId" value={state.plan.id} />
              <input type="hidden" name="qty" value="1" />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white hover:bg-brand-dark transition"
              >
                <RefreshCw size={14} />
                续费会员
              </button>
            </form>
          ) : null}
          <p className="mt-3 text-[12px] text-ink-3 text-center">
            续费时长在当前到期日上叠加；想换套餐去
            <Link href="/membership" className="text-brand hover:underline mx-1">
              会员页
            </Link>
            选购。
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-12 text-center">
          <Crown size={28} className="mx-auto text-ink-3" />
          <div className="mt-3 text-[15px] font-medium text-ink">
            你还不是会员
          </div>
          <p className="mt-1 text-[13px] text-ink-3">
            开通会员，有效期内畅看全部付费课程。
          </p>
          <Link
            href="/membership"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-brand px-6 py-2.5 text-[14px] font-medium text-white hover:bg-brand-dark transition"
          >
            去开通
          </Link>
        </div>
      )}
    </section>
  );
}
