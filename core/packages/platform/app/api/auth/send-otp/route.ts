import { NextResponse, type NextRequest } from "next/server";
import { OTP_CONFIG, createCode, lastSentWithin } from "@/lib/db/otp";
import { getActive, isConsoleFallback } from "@/lib/sms/registry";
import { logError } from "@/lib/db/logs";

export const runtime = "nodejs";

function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(req: NextRequest) {
  let body: { phone?: string } = {};
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const phone = String(body.phone ?? "").trim();
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  if (await lastSentWithin(phone, OTP_CONFIG.COOLDOWN)) {
    return NextResponse.json(
      { error: "too_frequent", retryAfter: OTP_CONFIG.COOLDOWN },
      { status: 429 },
    );
  }

  const { code, expiresAt } = await createCode(phone);

  const provider = getActive();
  let sent: { ok: true } | { ok: false; error: string };
  try {
    sent = await provider.sendOtp(phone, code);
  } catch (e) {
    const err = e as Error;
    sent = { ok: false, error: err.message };
  }

  // Always echo to server log in console fallback so devs can complete the flow.
  if (isConsoleFallback()) {
    // eslint-disable-next-line no-console
    console.log(`[otp] phone=${phone} code=${code} expiresAt=${expiresAt}`);
  }

  if (!sent.ok) {
    await logError({
      level: "error",
      message: `sms_send_failed: ${sent.error}`,
      path: "/api/auth/send-otp",
    });
    return NextResponse.json(
      { ok: false, error: "短信发送失败,请重试" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, expiresIn: OTP_CONFIG.TTL_SEC });
}
