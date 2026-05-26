"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Tag } from "lucide-react";
import { previewCoupon, type CouponPreview } from "@/app/actions/order";
import { track } from "@/lib/track";
import type { OrderType } from "@/db/schema";

type Props = {
  type: OrderType;
  refId: string;
  amount: number;
  qty?: number;
  submitLabel: string;
  submitIcon?: "cart";
  disabled?: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function CouponBox({
  type,
  refId,
  amount,
  qty = 1,
  submitLabel,
  submitIcon,
  disabled,
  action,
}: Props) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function apply() {
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      const r = await previewCoupon({ type, refId, qty, code });
      setApplied(r);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setApplied(null);
    setCode("");
  }

  const payable = applied?.ok ? applied.payable : amount;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[12px] text-ink-3 inline-flex items-center gap-1">
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
            className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand transition disabled:bg-bg-soft disabled:text-ink-3"
          />
          {applied?.ok ? (
            <button
              type="button"
              onClick={clear}
              className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-ink-2 hover:border-brand hover:text-brand transition"
            >
              取消
            </button>
          ) : (
            <button
              type="button"
              onClick={apply}
              disabled={busy || !code.trim()}
              className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-ink-2 hover:border-brand hover:text-brand transition disabled:opacity-50"
            >
              {busy ? "校验中" : "应用"}
            </button>
          )}
        </div>
        {applied && !applied.ok ? (
          <div className="mt-1.5 text-[12px] text-red-600">{applied.message}</div>
        ) : null}
        {applied?.ok ? (
          <div className="mt-1.5 text-[12px] text-emerald-700">
            已应用 {applied.label},折扣 ¥{applied.discount}
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between rounded-md bg-bg-soft px-3 py-2">
        <span className="text-[12px] text-ink-3">应付</span>
        <span className="text-[18px] font-semibold text-brand">¥{payable}</span>
      </div>

      <form
        action={(fd) => {
          startTransition(() => {
            track("order_placed_attempt", { type, refId, payable, coupon: applied?.ok ? applied.code : null });
          });
          return action(fd);
        }}
      >
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="refId" value={refId} />
        <input type="hidden" name="qty" value={qty} />
        {applied?.ok ? (
          <input type="hidden" name="couponCode" value={applied.code} />
        ) : null}
        <button
          type="submit"
          disabled={!!disabled || pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
        >
          {submitIcon === "cart" ? <ShoppingCart size={16} /> : null}
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
