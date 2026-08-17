"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cancel, markPaid } from "@/lib/db/orders";
import { write as writePaymentLog } from "@/lib/db/payment-logs";
import type { PaymentMethod } from "@/db/schema";

export async function adminMarkPaid(f: FormData) {
  const id = String(f.get("id") ?? "");
  const methodRaw = String(f.get("method") ?? "mock_wechat");
  const method: PaymentMethod =
    methodRaw === "mock_alipay" ? "mock_alipay" : "mock_wechat";
  if (id) {
    await markPaid(id, method);
    await writePaymentLog({
      orderId: id,
      providerId: method,
      kind: "manual_paid",
      payload: { source: "admin" },
    });
    revalidatePath("/admin/orders");
    revalidatePath("/admin/reconcile");
    revalidatePath(`/orders/${id}`);
    revalidatePath("/orders");
  }
  redirect("/admin/orders");
}

export async function adminCancelOrder(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await cancel(id);
    await writePaymentLog({
      orderId: id,
      providerId: "admin",
      kind: "manual_cancel",
      payload: { source: "admin" },
    });
    revalidatePath("/admin/orders");
    revalidatePath("/admin/reconcile");
    revalidatePath(`/orders/${id}`);
    revalidatePath("/orders");
  }
  redirect("/admin/orders");
}
