"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LogIn, Tag, Users, CheckCircle2, CalendarX, UserCheck } from "lucide-react";
import { previewCoupon, placeOrderFromForm, type CouponPreview } from "@/app/actions/order";
import { track } from "@/lib/track";

type Props = {
  eventId: string;
  fee: number;
  registered: number;
  capacity: number;
  /** 报名是否开放(状态为「报名中」)。即将开放 / 已结束都为 false */
  open: boolean;
  /** 是否已结束,用于区分文案 */
  ended: boolean;
  /** 服务端解析的登录态;未登录引导登录,不在前端发起下单 */
  isLoggedIn: boolean;
  /** 未登录登录后回跳的本页地址 */
  loginNext: string;
};

export function RegisterPanel({
  eventId,
  fee,
  registered,
  capacity,
  open,
  ended,
  isLoggedIn,
  loginNext,
}: Props) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const soldOut = registered >= capacity;
  const remaining = Math.max(0, capacity - registered);
  const ratio = capacity > 0 ? Math.min(1, registered / capacity) : 0;
  const isFree = fee === 0;
  // 报名中且有名额才可下单;已结束 / 即将开放 / 满员都不可
  const canRegister = open && !soldOut;
  const payable = applied?.ok ? applied.payable : fee;

  async function apply() {
    if (busy || isFree || !code.trim()) return;
    setBusy(true);
    try {
      const r = await previewCoupon({ type: "event", refId: eventId, code });
      setApplied(r);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setApplied(null);
    setCode("");
  }

  // 进度条颜色:满员 / 已结束转灰,正常用主色
  const barTone = ended ? "bg-ink-3" : soldOut ? "bg-amber-500" : "bg-brand";

  return (
    <aside className="rounded-[14px] border border-line bg-white p-6">
      <div className="text-[13px] text-ink-3">报名费</div>
      <div className="mt-1 text-[36px] font-semibold text-brand leading-none">
        {isFree ? "免费" : `¥${fee}`}
      </div>
      <div className="mt-1 text-[12px] text-ink-3">含赛事胸卡 现场补给 数据成绩册</div>

      {/* 容量进度条:满员 / 已结束有视觉区分 */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[12px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Users size={12} />
            报名进度
          </span>
          <span className={ended ? "text-ink-3" : soldOut ? "text-amber-600" : "text-ink"}>
            {registered}/{capacity}
            {ended ? " 已结束" : soldOut ? " 已满员" : ` 余 ${remaining}`}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line-soft">
          <div className={`h-full transition-[width] ${barTone}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>

      <div className="mt-5">
        {!canRegister ? (
          // 已结束 / 即将开放 / 满员:无关登录态,直接禁用并提示原因(已结束的赛事不该再引导登录)
          <>
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-line-soft py-2.5 text-[14px] font-medium text-ink-3"
            >
              {ended ? (
                <>
                  <CalendarX size={16} />
                  报名已结束
                </>
              ) : soldOut ? (
                <>
                  <Users size={16} />
                  名额已报满
                </>
              ) : (
                "报名即将开放"
              )}
            </button>
            <div className="mt-2 text-center text-[12px] text-ink-3">
              {ended
                ? "本场赛事已结束,欢迎关注下一场"
                : soldOut
                  ? "名额已满,可加入候补社群等补位"
                  : "报名通道尚未开放,敬请期待"}
            </div>
          </>
        ) : !isLoggedIn ? (
          // 报名中且有名额但未登录:引导登录(真 <a>/Link,可中键新开),登录后回跳本页
          <>
            <Link
              href={`/login?next=${encodeURIComponent(loginNext)}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark"
            >
              <LogIn size={16} />
              登录后报名
            </Link>
            <div className="mt-2 text-center text-[12px] text-ink-3">登录手机号即可报名,无需注册</div>
          </>
        ) : (
          // 报名中且有名额:可下单(复用 placeOrder,type=event)
          <>
            {!isFree ? (
              <div className="mb-3">
                <label className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <Tag size={12} />
                  优惠码
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                    disabled={!!applied?.ok}
                    placeholder="可选,输入优惠码"
                    className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none transition focus:border-brand disabled:bg-bg-soft disabled:text-ink-3"
                  />
                  {applied?.ok ? (
                    <button
                      type="button"
                      onClick={clear}
                      className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-ink-2 transition hover:border-brand hover:text-brand"
                    >
                      取消
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={apply}
                      disabled={busy || !code.trim()}
                      className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-ink-2 transition hover:border-brand hover:text-brand disabled:opacity-50"
                    >
                      {busy ? "校验中" : "应用"}
                    </button>
                  )}
                </div>
                {applied && !applied.ok ? (
                  <div className="mt-1.5 text-[12px] text-red-600">{applied.message}</div>
                ) : null}
                {applied?.ok ? (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-emerald-700">
                    <CheckCircle2 size={12} />
                    已应用 {applied.label},折扣 ¥{applied.discount}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!isFree ? (
              <div className="mb-3 flex items-baseline justify-between rounded-md bg-bg-soft px-3 py-2">
                <span className="text-[12px] text-ink-3">应付</span>
                <span className="text-[18px] font-semibold text-brand">¥{payable}</span>
              </div>
            ) : null}

            <form
              action={(fd) => {
                startTransition(() => {
                  track("order_placed_attempt", {
                    type: "event",
                    refId: eventId,
                    payable,
                    coupon: applied?.ok ? applied.code : null,
                  });
                });
                return placeOrderFromForm(fd);
              }}
            >
              <input type="hidden" name="type" value="event" />
              <input type="hidden" name="refId" value={eventId} />
              <input type="hidden" name="qty" value={1} />
              {applied?.ok ? <input type="hidden" name="couponCode" value={applied.code} /> : null}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
              >
                <UserCheck size={16} />
                {isFree ? "免费报名" : "立即报名"}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-4 text-[12px] leading-6 text-ink-3">
        报名后可加入赛事专属社群,赛前训练赛与赛事直播全部包含。
      </div>
    </aside>
  );
}
