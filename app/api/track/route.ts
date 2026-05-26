import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { recordEvent } from "@/lib/db/track";
import { USER_COOKIE, verifyUserToken } from "@/lib/auth-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANON_COOKIE = "cube_anon";
const ANON_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function newAnonId(): string {
  return "a_" + b64url(randomBytes(12));
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; payload?: unknown; url?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return new NextResponse(null, { status: 204 });

  const payload =
    body.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, unknown>)
      : null;
  const url = typeof body.url === "string" ? body.url : null;
  const referer = req.headers.get("referer");

  const userToken = req.cookies.get(USER_COOKIE)?.value;
  const userId = verifyUserToken(userToken);

  let anonId = req.cookies.get(ANON_COOKIE)?.value ?? null;
  let setCookie = false;
  if (!anonId) {
    anonId = newAnonId();
    setCookie = true;
  }

  await recordEvent({
    name,
    payload,
    userId: userId ?? null,
    anonId,
    url,
    referer,
  });

  const res = new NextResponse(null, { status: 204 });
  if (setCookie) {
    res.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: ANON_MAX_AGE,
    });
  }
  return res;
}
