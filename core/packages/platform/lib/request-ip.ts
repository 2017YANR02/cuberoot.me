import type { NextRequest } from "next/server";

function normalizeIp(value: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 100 || /[\r\n]/.test(candidate)) {
    return null;
  }
  return candidate;
}

export function getClientIp(req: Pick<NextRequest, "headers">): string {
  const realIp = normalizeIp(req.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for")?.split(",", 1)[0] ?? null;
  return normalizeIp(forwarded) ?? "unknown";
}
