import Link from "next/link";
import {
  AlertTriangle,
  Crown,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import {
  getMembershipTimeline,
  type MembershipEvent,
} from "@/lib/db/membership";
import { placeOrderFromForm } from "@/app/actions/order";

export const metadata = {
  title: "我的会员 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DAY = 86400;

// 秒级时间戳格式化为 YYYY-MM-DD(从数值 ts 构造,非禁用的字符串 new Date)。
function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 拆成 [年, 月, 日],状态卡分行强调用。
function splitDate(ts: number): { y: string; md: string } {
  const [y, m, d] = fmtDate(ts).split("-");
  return { y, md: `${m}-${d}` };
}

function fmtRemain(seconds: number): string {
  if (seconds <= 0) return "已到期";
  if (seconds < DAY) {
    const h = Math.max(1, Math.floor(seconds / 3600));
    return `剩 ${h} 小时`;
  }
  return `剩 ${Math.ceil(seconds / DAY)} 天`;
}

const EVENT_META: Record<
  MembershipEvent["kind"],
  { label: string; Icon: typeof Crown; tone: string }
> = {
  activate: { label: "开通会员", Icon: Plus, tone: "text-brand bg-brand-soft" },
  renew: { label: "续费会员", Icon: RefreshCw, tone: "text-brand bg-brand-soft" },
  refund: { label: "退款撤销", Icon: XCircle, tone: "text-red-600 bg-red-50" },
  expire: {
    label: "会员到期",
    Icon: RotateCcw,
    tone: "text-ink-3 bg-bg-soft",
  },
};

export default async function MyMembershipPage() {
  const user = await requireUser("/me/membership");
  const { state, events } = await getMembershipTimeline(user.id);

  const now = Math.floor(Date.now() / 1000);
  const remainSec = state.expiresAt ? state.expiresAt - now : 0;
  const expiringSoon = state.active && remainSec > 0 && remainSec <= 7 * DAY;
  const urgent = state.active && remainSec > 0 && remainSec <= DAY;

  return (
    <section className="container-page py-12 max-w-2xl">
      <h1 className="text-[24px] font-semibold text-ink">我的会员</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        会员有效期内可畅看全部付费课程。
      </p>

      {/* 即将到期提醒:剩 ≤7 天醒目,剩 ≤24h 更强(红) */}
      {expiringSoon ? (
        <div
          className={`mt-6 flex items-start gap-3 rounded-[14px] border px-5 py-4 ${
            urgent
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <AlertTriangle
            size={18}
            className={`mt-0.5 shrink-0 ${urgent ? "text-red-600" : "text-amber-600"}`}
          />
          <div className="min-w-0 flex-1">
            <div
              className={`text-[14px] font-semibold ${urgent ? "text-red-700" : "text-amber-800"}`}
            >
              {urgent ? "会员今天就到期了" : "会员即将到期"}
            </div>
            <p
              className={`mt-0.5 text-[12px] ${urgent ? "text-red-700/90" : "text-amber-700"}`}
            >
              {fmtRemain(remainSec)}到期（{fmtDate(state.expiresAt!)}）。
              续费后时长在当前到期日上叠加,不浪费剩余天数。
            </p>
            {state.plan ? (
              <form action={placeOrderFromForm} className="mt-3">
                <input type="hidden" name="type" value="membership" />
                <input type="hidden" name="refId" value={state.plan.id} />
                <input type="hidden" name="qty" value="1" />
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium text-white transition ${
                    urgent
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  <RefreshCw size={13} />
                  立即续费
                </button>
              </form>
            ) : (
              <Link
                href="/membership"
                className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium text-white transition ${
                  urgent
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                <RefreshCw size={13} />
                去续费
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {state.active ? (
        <div className="mt-6 rounded-[14px] border border-line bg-white p-6">
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

          <div className="mt-6 grid grid-cols-3 gap-3 text-[13px]">
            <div className="rounded-md bg-bg-soft px-4 py-3">
              <div className="text-ink-3 text-[12px]">有效期至</div>
              {state.expiresAt ? (
                <div className="mt-0.5 leading-tight">
                  <span className="text-[18px] font-semibold text-ink">
                    {splitDate(state.expiresAt).md}
                  </span>
                  <span className="ml-1 text-[12px] text-ink-3">
                    {splitDate(state.expiresAt).y}
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 text-[16px] font-semibold text-ink">—</div>
              )}
            </div>
            <div className="rounded-md bg-bg-soft px-4 py-3">
              <div className="text-ink-3 text-[12px]">剩余</div>
              <div
                className={`mt-0.5 text-[16px] font-semibold ${
                  urgent ? "text-red-600" : expiringSoon ? "text-amber-600" : "text-ink"
                }`}
              >
                {fmtRemain(remainSec)}
              </div>
            </div>
            <div className="rounded-md bg-bg-soft px-4 py-3">
              <div className="text-ink-3 text-[12px]">套餐</div>
              <div className="mt-0.5 text-[16px] font-semibold text-ink">
                {state.plan ? `¥${state.plan.price}` : "—"}
              </div>
              {state.plan ? (
                <div className="text-[11px] text-ink-3">{state.plan.per}</div>
              ) : null}
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
            续费时长在当前到期日上叠加;想换套餐去
            <Link href="/membership" className="text-brand hover:underline mx-1">
              会员页
            </Link>
            选购。
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-12 text-center">
          <Crown size={28} className="mx-auto text-ink-3" />
          <div className="mt-3 text-[15px] font-medium text-ink">
            你还不是会员
          </div>
          <p className="mt-1 text-[13px] text-ink-3">
            {events.length > 0
              ? "你的会员已过期,重新开通即可继续畅看全部付费课程。"
              : "开通会员,有效期内畅看全部付费课程。"}
          </p>
          <Link
            href="/membership"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-brand px-6 py-2.5 text-[14px] font-medium text-white hover:bg-brand-dark transition"
          >
            {events.length > 0 ? "重新开通" : "去开通"}
          </Link>
        </div>
      )}

      {/* 续费/开通历史时间线 */}
      {events.length > 0 ? (
        <div className="mt-10">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <History size={15} className="text-ink-3" />
            会员记录
          </div>
          <ol className="mt-4 space-y-0">
            {events.map((e, i) => {
              const meta = EVENT_META[e.kind];
              const Icon = meta.Icon;
              const last = i === events.length - 1;
              const isFuture = e.kind === "expire" && e.upcoming;
              return (
                <li key={`${e.kind}-${e.orderId ?? e.at}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${meta.tone} ${
                        isFuture ? "opacity-70" : ""
                      }`}
                    >
                      <Icon size={14} />
                    </span>
                    {last ? null : (
                      <span className="w-px flex-1 bg-line" aria-hidden />
                    )}
                  </div>
                  <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-5"}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-medium text-ink">
                        {isFuture ? "会员到期(预告)" : meta.label}
                      </span>
                      {e.amount != null ? (
                        <span
                          className={`shrink-0 text-[13px] font-medium ${
                            e.kind === "refund" ? "text-red-600" : "text-ink"
                          }`}
                        >
                          {e.kind === "refund" ? "-" : ""}¥{e.amount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
                      <span>{fmtDate(e.at)}</span>
                      {e.planLabel ? <span>{e.planLabel}</span> : null}
                      {isFuture ? (
                        <span className="text-brand">尚未到期</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
