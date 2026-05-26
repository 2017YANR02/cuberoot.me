import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getActive } from "@/lib/storage/registry";
import { logError } from "@/lib/db/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200 MiB upper bound for video.

export async function POST(req: NextRequest) {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!verifySession(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);
  const contentType = file.type || "application/octet-stream";
  const filename = file.name || "file";

  const provider = getActive();
  try {
    const r = await provider.put(buf, filename, contentType);
    return NextResponse.json({ ok: true, url: r.url, key: r.key });
  } catch (e) {
    const err = e as Error;
    await logError({
      level: "error",
      message: `upload_failed:${provider.id}:${err.message}`,
      stack: err.stack,
      path: "/api/upload",
    });
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
