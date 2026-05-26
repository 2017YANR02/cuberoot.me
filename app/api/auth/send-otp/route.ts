import { NextResponse, type NextRequest } from "next/server";
import { OTP_CONFIG, createCode, lastSentWithin } from "@/lib/db/otp";

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

  // Stub: print to server console instead of sending SMS.
  // eslint-disable-next-line no-console
  console.log(`[otp] phone=${phone} code=${code} expiresAt=${expiresAt}`);

  return NextResponse.json({ ok: true, expiresIn: OTP_CONFIG.TTL_SEC });
}
