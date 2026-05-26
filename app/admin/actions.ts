"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getAdminPassword,
  signSession,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/admin") ? nextRaw : "/admin";

  if (password !== getAdminPassword()) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = signSession();
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(next);
}

export async function logoutAction() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
