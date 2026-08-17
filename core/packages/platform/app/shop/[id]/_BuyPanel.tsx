"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Tag, LogIn, Crown, Lock } from "lucide-react";
import { previewCoupon, placeOrderFromForm, type CouponPreview } from "@/app/actions/order";
import { track } from "@/lib/track";

const MAX_QTY = 99;

type Props = {
  refId: string;
  price: number;
  originalPrice: number | null;
  inStock: boolean;
  loggedIn: boolean;
  // 会员专享价:memberPrice 为会员单价(元,null 表示无会员折扣);
  // isMember 当前用户是否会员;memberOnly 仅会员可购。
  memberPrice?: number | null;
  isMember?: boolean;
  memberOnly?: boolean;
};

export function BuyPanel({
  refId,
  price,
  originalPrice,
  inStock,
  loggedIn,
  memberPrice = null,
  isMember = false,
  memberOnly = false,
}: Props) {
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  function changeQty(next: number) {
    const clamped = Math.min(MAX_QTY, Math.max(1, next));
    if (clamped === qty) return;
    setQty(clamped);
    // 数量变了原优惠预览失效,清掉让用户重新校验(避免按旧总价算折扣)
    if (applied) {
      setApplied(null);
      setCode("");
    }
  }

  async function applyCoupon() {
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      const r = await previewCoupon({ type: "product", refId, qty, code });
      setApplied(r);
    } finally {
      setBusy(false);
    }
  }

  function clearCoupon() {
    setApplied(null);
    setCode("");
  }

  // 会员价是否生效:配置了 memberPrice 且低于常规价。
  const hasMemberDeal = memberPrice != null && memberPrice >= 0 && memberPrice < price;
  // 当前用户单价:会员 + 有会员价则用会员价,否则常规价。
  const unitPrice = isMember && hasMemberDeal ? memberPrice : price;
  const memberSaveEach = hasMemberDeal ? price - memberPrice : 0;
  // 会员专享商品对非会员:禁止下单。
  const lockedForGuest = memberOnly && !isMember;

  const gross = unitPrice * qty;
  const payable = applied?.ok ? applied.payable : gross;
  const saved =
    (originalPrice ? (originalPrice - unitPrice) * qty : 0) +
    (applied?.ok ? applied.discount : 0);
  // 下单按钮可用条件:有货、未锁(会员专享对非会员锁)。
  const canBuy = inStock && !lockedForGuest;

  return (
    <div className="space-y-4">
      {/* 会员价 / 会员引导 */}
      {hasMemberDeal ? (
        isMember ? (
          <div className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-[13px] text-brand">
            <Crown size={14} className="shrink-0" />
            <span>
              会员价 ¥{memberPrice}
              <span className="ml-2 text-ink-3 line-through">¥{price}</span>
            </span>
          </div>
        ) : (
          <Link
            href="/membership"
            className="flex items-center justify-between gap-2 rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-[13px] text-brand transition hover:border-brand/60"
          >
            <span className="inline-flex items-center gap-2">
              <Crown size={14} className="shrink-0" />
              会员立省 ¥{memberSaveEach}/件,开通会员
            </span>
            <span className="text-[12px] text-ink-3">去开通 →</span>
          </Link>
        )
      ) : null}

      {/* 会员专享锁:非会员不可购 */}
      {lockedForGuest ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>会员专享商品,开通会员后可购买。</span>
        </div>
      ) : null}
      {/* 数量 */}
      <div>
        <label className="text-[12px] text-ink-3">数量</label>
        <div className="mt-1.5 inline-flex items-stretch rounded-md border border-line bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => changeQty(qty - 1)}
            disabled={!inStock || qty <= 1}
            aria-label="减少数量"
            className="grid w-9 place-items-center text-ink-2 hover:text-brand transition disabled:opacity-40 disabled:hover:text-ink-2"
          >
            <Minus size={14} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={qty}
            disabled={!inStock}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              changeQty(Number.isNaN(n) ? 1 : n);
            }}
            aria-label="购买数量"
            className="w-12 border-x border-line text-center text-[14px] text-ink outline-none disabled:bg-bg-soft disabled:text-ink-3"
          />
          <button
            type="button"
            onClick={() => changeQty(qty + 1)}
            disabled={!inStock || qty >= MAX_QTY}
            aria-label="增加数量"
            className="grid w-9 place-items-center text-ink-2 hover:text-brand transition disabled:opacity-40 disabled:hover:text-ink-2"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* 优惠码 */}
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
            disabled={!!applied?.ok || !canBuy}
            placeholder="可选,输入优惠码"
            className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand transition disabled:bg-bg-soft disabled:text-ink-3"
          />
          {applied?.ok ? (
            <button
              type="button"
              onClick={clearCoupon}
              className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-ink-2 hover:border-brand hover:text-brand transition"
            >
              取消
            </button>
          ) : (
            <button
              type="button"
              onClick={applyCoupon}
              disabled={busy || !code.trim() || !canBuy}
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

      {/* 应付 */}
      <div className="rounded-md bg-bg-soft px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-ink-3">应付</span>
          <span className="text-[20px] font-semibold text-brand">¥{payable}</span>
        </div>
        {saved > 0 ? (
          <div className="mt-1 text-right text-[12px] text-ink-3">已省 ¥{saved}</div>
        ) : null}
      </div>

      {/* 下单 / 登录引导 / 会员专享引导 */}
      {loggedIn && lockedForGuest ? (
        // 已登录非会员遇会员专享:引导开通会员(真 a 链可中键新开)
        <Link
          href="/membership"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark"
        >
          <Crown size={16} />
          开通会员后购买
        </Link>
      ) : loggedIn ? (
        <form
          action={(fd) => {
            startTransition(() => {
              track("order_placed_attempt", {
                type: "product",
                refId,
                qty,
                payable,
                coupon: applied?.ok ? applied.code : null,
              });
            });
            return placeOrderFromForm(fd);
          }}
        >
          <input type="hidden" name="type" value="product" />
          <input type="hidden" name="refId" value={refId} />
          <input type="hidden" name="qty" value={qty} />
          {applied?.ok ? <input type="hidden" name="couponCode" value={applied.code} /> : null}
          <button
            type="submit"
            disabled={!canBuy || pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
          >
            <ShoppingCart size={16} />
            {inStock ? (pending ? "提交中..." : "立即购买") : "补货中"}
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/shop/${refId}`)}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark"
          >
            <LogIn size={16} />
            登录后购买
          </Link>
          <p className="text-center text-[12px] text-ink-3">登录即可下单,新用户注册得新人优惠券</p>
        </div>
      )}
    </div>
  );
}
