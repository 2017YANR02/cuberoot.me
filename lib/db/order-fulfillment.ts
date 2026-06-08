import "server-only";
import type { Order } from "@/db/schema";
import { bumpRegistered, releaseRegistered } from "@/lib/db/events";
import {
  cancelMembershipForOrder,
  fulfillMembershipOrder,
} from "@/lib/db/membership";

// 订单状态机的副作用统一收口在这里(支付成功 / 退款),
// 由 lib/db/orders.ts 的 markPaid / markPaidWithProvider / setRefunded 调用,
// 覆盖三条标记已付路径:用户付款、渠道回调、后台手动标记。
// 各业务把自己的履约逻辑写在对应模块,这里只做按订单类型派发,避免多处改 markPaid 互相打架。

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
}
