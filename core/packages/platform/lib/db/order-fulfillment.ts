import "server-only";
import type { Order } from "@/db/schema";
import { bumpRegistered, releaseRegistered } from "@/lib/db/events";
import {
  cancelMembershipForOrder,
  fulfillMembershipOrder,
} from "@/lib/db/membership";
import { awardPoints, getBalance } from "@/lib/db/points";

// 订单状态机的副作用统一收口在这里(支付成功 / 退款),
// 由 lib/db/orders.ts 的 markPaid / markPaidWithProvider / setRefunded 调用,
// 覆盖三条标记已付路径:用户付款、渠道回调、后台手动标记。
// 各业务把自己的履约逻辑写在对应模块,这里只做按订单类型派发,避免多处改 markPaid 互相打架。

// 消费返积分:每满 10 元(amount 单位:元)记 1 分;会员订单额外加一倍奖励(共 2 倍)。
const POINTS_PER_YUAN = 1 / 10;
const MEMBERSHIP_BONUS_MULTIPLIER = 2;

function purchasePoints(order: Order): number {
  const base = Math.floor(Math.max(order.amount, 0) * POINTS_PER_YUAN);
  if (order.type === "membership") return base * MEMBERSHIP_BONUS_MULTIPLIER;
  return base;
}

export async function onOrderPaid(order: Order): Promise<void> {
  switch (order.type) {
    case "event":
      await bumpRegistered(order.refId, order.qty);
      break;
    case "membership":
      await fulfillMembershipOrder(order);
      break;
    default:
      break; // course / product 暂无付款副作用
  }

  // 通用消费返积分(所有付费类型),hasAwarded 以 order.id 去重防重复发(三条标记已付路径只发一次)。
  const pts = purchasePoints(order);
  if (pts > 0) {
    await awardPoints(order.userId, pts, "purchase", {
      refId: order.id,
      note: order.refTitle,
    });
  }
}

export async function onOrderRefunded(order: Order): Promise<void> {
  switch (order.type) {
    case "event":
      await releaseRegistered(order.refId, order.qty);
      break;
    case "membership":
      await cancelMembershipForOrder(order);
      break;
    default:
      break;
  }

  // 退款扣回此前发的消费积分(若发过)。不把余额扣成负数:取已发积分与当前余额的较小值。
  const awarded = purchasePoints(order);
  if (awarded > 0) {
    const balance = await getBalance(order.userId);
    const clawback = Math.min(awarded, Math.max(balance, 0));
    if (clawback > 0) {
      await awardPoints(order.userId, -clawback, "refund_clawback", {
        refId: order.id,
        note: order.refTitle,
      });
    }
  }
}
