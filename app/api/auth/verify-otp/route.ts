import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { consume, findActive } from "@/lib/db/otp";
import { findByPhone, upsertByPhone } from "@/lib/db/users";
import { applyInviteOnSignup } from "@/lib/db/invites";
import {
  USER_COOKIE,
  USER_SESSION_MAX_AGE,
  signUserToken,
} from "@/lib/auth-user";

export const runtime = "nodejs";

function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string; invite?: string } = {};
  try {
    body = (await req.json()) as { phone?: string; code?: string; invite?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const phone = String(body.phone ?? "").trim();
  const code = String(body.code ?? "").trim();
  const invite = String(body.invite ?? "").trim();

  if (!isValidPhone(phone) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const otp = await findActive(phone, code);
  if (!otp) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 401 });
  }
  await consume(otp.id);

  const wasNew = !(await findByPhone(phone));
  const user = await upsertByPhone(phone);

  let inviteApplied: { code: string; rewardCoupon: string | null } | null = null;
  if (wasNew && invite) {
    const inv = await applyInviteOnSignup(user.id, invite);
    if (inv) {
      inviteApplied = { code: inv.code, rewardCoupon: inv.rewardCoupon };
    }
  }

  const token = signUserToken(user.id);

  const c = await cookies();
  c.set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({
    ok: true,
    isNew: wasNew,
    invite: inviteApplied,
    user: {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      role: user.role,
    },
  });
}
