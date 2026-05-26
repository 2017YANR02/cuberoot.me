import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getProvider } from "@/lib/payments/registry";
import { findById, markPaidWithProvider } from "@/lib/db/orders";
import { write as writePaymentLog } from "@/lib/db/payment-logs";
import type { PaymentMethod } from "@/db/schema";
import type { ProviderId } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ProviderId[] = [
  "mock_wechat",
  "mock_alipay",
  "stripe",
  "wechat",
  "alipay",
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider as ProviderId)) {
    return new NextResponse("not found", { status: 404 });
  }
  const p = getProvider(provider as ProviderId);
  if (!p || !p.enabled) {
    return new NextResponse("not found", { status: 404 });
  }
  const rawBody = await req.text();
  const result = await p.verifyCallback(req, rawBody);
  if (!result) {
    return new NextResponse("invalid", { status: 400 });
  }
  if (result.paid && result.orderId) {
    const order = await findById(result.orderId);
    if (order && order.status !== "paid") {
      await markPaidWithProvider(
        result.orderId,
        p.id as PaymentMethod,
        result.providerId ?? null,
        result.raw ?? null,
      );
      await writePaymentLog({
        orderId: result.orderId,
        providerId: p.id,
        kind: "callback",
        payload: result.raw ?? null,
      });
      revalidatePath("/orders");
      revalidatePath(`/orders/${result.orderId}`);
    }
  }
  // provider 自定义 response body (例如支付宝必须返 "success")
  if (typeof result.response === "string") {
    return new NextResponse(result.response, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json({ ok: true });
}
