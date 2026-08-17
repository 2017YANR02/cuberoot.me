import Link from "next/link";
import { NotebookPen, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { listByUser, type LessonNoteWithCourse } from "@/lib/db/notes";
import { Markdown } from "@/components/Markdown";

export const metadata = {
  title: "我的笔记 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

function formatDate(unixSec: number): string {
  // 时间戳来自 db(unix 秒),用本地 getter 取年月日,避免 new Date("YYYY-MM-DD") 的时区偏移。
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type LessonGroup = {
  lessonId: string;
  courseId: string;
  lessonTitle: string | null;
  lessonIdx: number | null;
  notes: LessonNoteWithCourse[];
};

type CourseGroup = {
  courseId: string;
  courseTitle: string | null;
  lessons: LessonGroup[];
};

// 按课程 → 章节两级分组;两级都保持 listByUser 的 createdAt desc 出场顺序。
function groupNotes(notes: LessonNoteWithCourse[]): CourseGroup[] {
  const courseOrder: string[] = [];
  const courseMap = new Map<string, CourseGroup>();

  for (const note of notes) {
    let course = courseMap.get(note.courseId);
    if (!course) {
      course = {
        courseId: note.courseId,
        courseTitle: note.courseTitle,
        lessons: [],
      };
      courseMap.set(note.courseId, course);
      courseOrder.push(note.courseId);
    }
    let lesson = course.lessons.find((l) => l.lessonId === note.lessonId);
    if (!lesson) {
      lesson = {
        lessonId: note.lessonId,
        courseId: note.courseId,
        lessonTitle: note.lessonTitle,
        lessonIdx: note.lessonIdx,
        notes: [],
      };
      course.lessons.push(lesson);
    }
    lesson.notes.push(note);
  }

  return courseOrder.map((id) => courseMap.get(id)!);
}

export default async function MyNotesPage() {
  const user = await requireUser("/me/notes");
  const notes = await listByUser(user.id);
  const groups = groupNotes(notes);

  return (
    <section className="container-page py-12">
      <h1 className="text-[24px] font-semibold text-ink">我的笔记</h1>
      <p className="mt-1 text-[13px] text-ink-3">共 {notes.length} 条课程笔记</p>

      {notes.length === 0 ? (
        <div className="mt-10 rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-12 text-center text-[14px] text-ink-3">
          还没有笔记。学习课程时在任意时间点
          <Link href="/me/courses" className="mx-1 text-brand hover:underline">
            记一笔
          </Link>
          ,之后可在此回看并跳回视频对应位置。
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((course) => (
            <div key={course.courseId}>
              <h2 className="mb-4 flex items-baseline gap-2 text-[16px] font-semibold text-ink">
                <Link
                  href={`/courses/${course.courseId}`}
                  className="hover:text-brand transition"
                >
                  {course.courseTitle ?? "未命名课程"}
                </Link>
              </h2>

              <div className="space-y-6">
                {course.lessons.map((lesson) => {
                  const lessonHref = `/courses/${lesson.courseId}/learn/${lesson.lessonId}`;
                  return (
                    <div key={lesson.lessonId}>
                      <div className="mb-2 flex items-center gap-2 text-[13px] text-ink-3">
                        {lesson.lessonIdx != null ? (
                          <span className="font-mono text-[11px]">
                            第 {String(lesson.lessonIdx).padStart(2, "0")} 节
                          </span>
                        ) : null}
                        <Link
                          href={lessonHref}
                          className="inline-flex items-center gap-1 hover:text-brand transition"
                        >
                          {lesson.lessonTitle ?? "未命名章节"}
                          <ArrowRight size={12} />
                        </Link>
                      </div>

                      <ul className="space-y-2">
                        {lesson.notes.map((note) => (
                          <li
                            key={note.id}
                            className="rounded-[14px] border border-line bg-white p-4"
                          >
                            <div className="flex items-start gap-3">
                              <Link
                                href={`${lessonHref}?t=${note.positionSec}`}
                                title="跳到视频该时间点"
                                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-tint px-2 py-0.5 font-mono text-[12px] text-brand transition hover:bg-brand-soft"
                              >
                                <NotebookPen size={12} />
                                {formatTimestamp(note.positionSec)}
                              </Link>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] leading-6 text-ink-2">
                                  <Markdown source={note.body} />
                                </div>
                                <div className="mt-1 text-[11px] text-ink-3">
                                  {formatDate(note.createdAt)}
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
