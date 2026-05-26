import Link from "next/link";
import { PlayCircle, BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { list as listOrders } from "@/lib/db/orders";
import { findById as findCourse } from "@/lib/db/courses";
import { listByCourse as listLessons } from "@/lib/db/lessons";
import {
  courseProgressPercent,
  listByUserCourse,
} from "@/lib/db/progress";

export const metadata = {
  title: "我的课程 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await requireUser("/me/courses");
  const orders = await listOrders({ userId: user.id });
  const paidCourseIds = Array.from(
    new Set(
      orders
        .filter((o) => o.type === "course" && o.status === "paid")
        .map((o) => o.refId),
    ),
  );

  const cards = await Promise.all(
    paidCourseIds.map(async (cid) => {
      const course = await findCourse(cid);
      if (!course) return null;
      const [lessons, progress, progressList] = await Promise.all([
        listLessons(cid),
        courseProgressPercent(user.id, cid),
        listByUserCourse(user.id, cid),
      ]);
      const progressMap = new Map(progressList.map((p) => [p.lessonId, p]));
      const firstUnfinished =
        lessons.find((l) => !progressMap.get(l.id)?.completed) ?? lessons[0] ?? null;
      const lastPlayed = progressList
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const continueLesson =
        lessons.find((l) => l.id === lastPlayed?.lessonId) ?? firstUnfinished;
      return { course, progress, continueLesson, totalLessons: lessons.length };
    }),
  );

  const list = cards.filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <section className="container-page py-12">
      <h1 className="text-[24px] font-semibold text-ink">我的课程</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        共 {list.length} 门已购课程
      </p>

      {list.length === 0 ? (
        <div className="mt-10 rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-12 text-center text-[14px] text-ink-3">
          还没有购买课程,
          <Link href="/courses" className="text-brand hover:underline mx-1">
            去看看
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ course, progress, continueLesson, totalLessons }) => (
            <article
              key={course.id}
              className="rounded-[14px] border border-line bg-white overflow-hidden flex flex-col"
            >
              {course.coverUrl ? (
                <div className="relative aspect-[16/9] bg-bg-soft">
                  <img
                    src={course.coverUrl}
                    alt={course.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-brand-tint flex items-center justify-center">
                  <BookOpen size={32} className="text-brand" />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-[12px] text-ink-3">{course.level} · {course.format}</div>
                <h3 className="mt-1 text-[16px] font-semibold text-ink line-clamp-2">
                  {course.title}
                </h3>
                <div className="mt-3 flex items-center justify-between text-[12px] text-ink-3">
                  <span>
                    已学 {progress.completed} / {progress.total || totalLessons} 节
                  </span>
                  <span className="text-brand font-medium">{progress.percent}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-soft">
                  <div
                    className="h-full bg-brand transition-[width]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="mt-5 flex-1" />
                {continueLesson ? (
                  <Link
                    href={`/courses/${course.id}/learn/${continueLesson.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand py-2 text-[13px] font-medium text-white hover:bg-brand-dark transition"
                  >
                    <PlayCircle size={14} />
                    继续学习
                  </Link>
                ) : (
                  <Link
                    href={`/courses/${course.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-line py-2 text-[13px] font-medium text-ink-2 hover:border-brand hover:text-brand transition"
                  >
                    查看详情
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
