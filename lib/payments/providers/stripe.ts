import "server-only";
import Stripe from "stripe";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyCallbackResult,
} from "../types";

const SECRET = process.env.STRIPE_SECRET_KEY ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const ENABLED = Boolean(SECRET) && Boolean(WEBHOOK_SECRET);

let _client: Stripe | null = null;
function client(): Stripe {
  if (!_client) {
    _client = new Stripe(SECRET, { apiVersion: "2026-04-22.dahlia" });
  }
  return _client;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe（信用卡）",
  enabled: ENABLED,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!ENABLED) throw new Error("stripe not configured");
    const { order, returnUrl } = input;
    const unitAmount = Math.max(0, Math.round(order.amount / Math.max(1, order.qty))) * 100;
    const sep = returnUrl.includes("?") ? "&" : "?";
    const session = await client().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: { name: order.refTitle },
          },
          quantity: order.qty,
        },
      ],
      success_url: `${returnUrl}${sep}stripe_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      metadata: { orderId: order.id },
      client_reference_id: order.id,
    });
    if (!session.url) throw new Error("stripe session has no url");
    return { kind: "redirect", url: session.url, providerId: session.id };
  },

  async verifyCallback(
    req: Request,
    rawBody: string,
  ): Promise<VerifyCallbackResult | null> {
    if (!ENABLED) return null;
    const sig = req.headers.get("stripe-signature");
    if (!sig) return null;
    let event: Stripe.Event;
    try {
      event = client().webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch {
      return null;
    }
    if (event.type !== "checkout.session.completed") return null;
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId =
      (session.metadata?.orderId as string | undefined) ??
      session.client_reference_id ??
      "";
    if (!orderId) return null;
    return {
      orderId,
      paid: session.payment_status === "paid",
      providerId: session.id,
      raw: event,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!ENABLED) return { ok: false, reason: "stripe not configured" };
    const { order, amount } = input;
    const sessionId = order.providerId;
    if (!sessionId) {
      return { ok: false, reason: "missing stripe session id" };
    }
    try {
      const session = await client().checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });
      const piRaw = session.payment_intent;
      const paymentIntent =
        typeof piRaw === "string"
          ? piRaw
          : piRaw && typeof piRaw === "object"
            ? piRaw.id
            : "";
      if (!paymentIntent) {
        return { ok: false, reason: "missing payment_intent" };
      }
      const refundAmount = Math.max(1, Math.round((amount ?? order.amount) * 100));
      const refund = await client().refunds.create({
        payment_intent: paymentIntent,
        amount: refundAmount,
      });
      return {
        ok: refund.status === "succeeded" || refund.status === "pending",
        providerRefundId: refund.id,
        raw: refund,
        reason: refund.status === "succeeded" ? undefined : `status=${refund.status}`,
      };
    } catch (e) {
      return { ok: false, reason: (e as Error).message, raw: { error: String(e) } };
    }
  },
};
