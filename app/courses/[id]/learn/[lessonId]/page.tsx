import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Lock, PlayCircle, CheckCircle2 } from "lucide-react";
import {
  findById as findCourse,
  canAccessCourse,
} from "@/lib/db/courses";
import { findById as findLesson, listByCourse } from "@/lib/db/lessons";
import { findByUserLesson, listByUserCourse } from "@/lib/db/progress";
import { listByLesson as listNotesByLesson } from "@/lib/db/notes";
import { getCurrentUser } from "@/lib/auth-user";
import { LessonPlayer } from "@/components/LessonPlayer";

export const dynamic = "force-dynamic";

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const [course, lesson] = await Promise.all([findCourse(id), findLesson(lessonId)]);
  if (!course || !lesson) return { title: "课程章节" };
  return {
    title: `${lesson.title} — ${course.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id, lessonId } = await params;
  const { t } = await searchParams;
  // ?t=<sec> 深链(来自「我的笔记」),手动钳制为非负整数;非纯 nuqs 状态。
  const seekParam = (() => {
    if (typeof t !== "string") return null;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const course = await findCourse(id);
  if (!course) notFound();
  const lesson = await findLesson(lessonId);
  if (!lesson || lesson.courseId !== course.id) notFound();

  const user = await getCurrentUser();
  const access = await canAccessCourse(user, course, lesson);
  if (!access.allowed) {
    if (access.reason === "not_logged_in") {
      redirect(`/login?next=${encodeURIComponent(`/courses/${course.id}/learn/${lesson.id}`)}`);
    }
    redirect(`/courses/${course.id}?toast=need_purchase`);
  }

  const [lessons, progressList, notes] = await Promise.all([
    listByCourse(course.id),
    user ? listByUserCourse(user.id, course.id) : Promise.resolve([]),
    user ? listNotesByLesson(user.id, lesson.id) : Promise.resolve([]),
  ]);
  const progressMap = new Map(progressList.map((p) => [p.lessonId, p]));
  const myProgress = user ? await findByUserLesson(user.id, lesson.id) : undefined;

  const hasVideo = Boolean(lesson.videoUrl || lesson.videoKey);
  const videoSrc = `/api/lessons/${lesson.id}/video`;

  return (
    <section className="container-page py-10 md:py-12">
      <Link
        href={`/courses/${course.id}`}
        className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-brand transition"
      >
        <ChevronLeft size={14} />
        返回 {course.title}
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.6fr_1fr] items-start">
        <div>
          <div className="text-[12px] text-ink-3 font-mono">
            第 {String(lesson.idx).padStart(2, "0")} 节
          </div>
          <h1 className="mt-1 text-[22px] md:text-[26px] font-semibold text-ink leading-tight">
            {lesson.title}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-3">
            <span>{formatDuration(lesson.durationSec)}</span>
            {lesson.free ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">
                试看
              </span>
            ) : null}
            {myProgress?.completed ? (
              <span className="inline-flex items-center gap-1 text-brand">
                <CheckCircle2 size={12} /> 已完成
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            {hasVideo ? (
              <LessonPlayer
                lessonId={lesson.id}
                src={videoSrc}
                poster={course.coverUrl ?? null}
                initialPositionSec={seekParam ?? myProgress?.positionSec ?? 0}
                initialCompleted={myProgress?.completed ?? false}
                initialNotes={notes}
              />
            ) : (
              <div className="rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-10 text-center text-[14px] text-ink-3">
                本节暂未上传视频。
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20">
          <div className="text-[12px] text-ink-3 mb-3">课程目录</div>
          <ol className="border border-line rounded-[14px] divide-y divide-line bg-white">
            {lessons.map((l) => {
              const active = l.id === lesson.id;
              const p = progressMap.get(l.id);
              const done = p?.completed ?? false;
              const isFree = l.free;
              return (
                <li key={l.id}>
                  <Link
                    href={`/courses/${course.id}/learn/${l.id}`}
                    className={
                      "flex items-center gap-3 px-4 py-3 transition " +
                      (active
                        ? "bg-brand-tint text-ink"
                        : "hover:bg-brand-tint/60 text-ink-2")
                    }
                  >
                    <span className="w-7 shrink-0 font-mono text-[11px] text-ink-3">
                      {String(l.idx).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[13px] leading-5">{l.title}</span>
                    {done ? (
                      <CheckCircle2 size={13} className="text-brand shrink-0" />
                    ) : isFree && !active ? (
                      <PlayCircle size={13} className="text-ink-3 shrink-0" />
                    ) : !isFree && course.price > 0 && !done && !active ? (
                      <Lock size={12} className="text-ink-3 shrink-0" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </section>
  );
}
