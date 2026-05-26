import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-user";
import { findById as findLesson } from "@/lib/db/lessons";
import { findById as findCourse, canAccessCourse } from "@/lib/db/courses";
import { signedVideoUrl } from "@/lib/storage/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lesson = await findLesson(id);
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const course = await findCourse(lesson.courseId);
  if (!course) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  const access = await canAccessCourse(user, course, lesson);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "forbidden", reason: access.reason },
      { status: 403 },
    );
  }

  // Prefer an explicit external URL when present; fall back to a signed
  // storage key. TODO: 签名 URL 防盗链 for remote providers.
  const target = lesson.videoUrl
    ? lesson.videoUrl
    : lesson.videoKey
      ? signedVideoUrl(lesson.videoKey)
      : "";
  if (!target) {
    return NextResponse.json({ error: "no_video" }, { status: 404 });
  }
  return NextResponse.redirect(new URL(target, _req.url), 302);
}
