"use server";

import { revalidatePath } from "next/cache";
import { generatePayouts, markPaidPayout } from "@/lib/db/instructor-payouts";

export async function generatePayoutsFromForm(f: FormData) {
  const period = String(f.get("period") ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(period)) {
    await generatePayouts(period);
    revalidatePath("/admin/instructor-payouts");
  }
}

export async function markPaidFromForm(f: FormData) {
  const id = String(f.get("id") ?? "").trim();
  const method = String(f.get("method") ?? "").trim() || undefined;
  const reference = String(f.get("reference") ?? "").trim() || undefined;
  const note = String(f.get("note") ?? "").trim() || undefined;
  if (id) {
    await markPaidPayout(id, { method, reference, note });
    revalidatePath("/admin/instructor-payouts");
  }
}
