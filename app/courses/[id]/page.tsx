import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Clock,
  Users,
  Star,
  BookOpen,
  CheckCircle2,
  Clock3,
  Lock,
  PlayCircle,
} from "lucide-react";
import {
  list as listCourses,
  findById as findCourse,
  hasUserPaidForCourse,
} from "@/lib/db/courses";
import { listByCourse as listLessons } from "@/lib/db/lessons";
import { courseProgressPercent } from "@/lib/db/progress";
import { getCurrentUser } from "@/lib/auth-user";
import { Badge } from "@/components/Badge";
import { CourseVideo } from "@/components/CourseVideo";
import { CouponBox } from "@/components/CouponBox";
import { ogImageUrl } from "@/lib/site";
import { placeOrderFromForm } from "@/app/actions/order";

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatLiveTime(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function generateStaticParams() {
  const all = await listCourses();
  return all.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await findCourse(id);
  if (!course) return { title: "课程详情" };
  const desc = course.subtitle;
  const img = ogImageUrl(course.title);
  return {
    title: course.title,
    description: desc,
    openGraph: {
      title: course.title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: course.title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: course.title,
      description: desc,
      images: [img],
    },
  };
}

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await findCourse(id);
  if (!course) notFound();

  const [lessons, user] = await Promise.all([listLessons(id), getCurrentUser()]);
  const isFreeCourse = course.price === 0;
  const paid = user ? await hasUserPaidForCourse(user.id, id) : false;
  const progress =
    user && paid
      ? await courseProgressPercent(user.id, id)
      : { percent: 0, completed: 0, total: lessons.length };

  return (
    <>
      <section className="bg-brand-tint border-b border-line">
        <div className="container-page py-12 md:py-16">
          <Link href="/courses" className="text-[13px] text-ink-3 hover:text-ink">← 返回课程列表</Link>
          <div className="mt-6 grid gap-10 md:grid-cols-[1.4fr_1fr] items-start">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge tone="brand">{course.level}</Badge>
                <Badge tone="muted">{course.format}</Badge>
                {course.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
              </div>
              <h1 className="text-[28px] md:text-[36px] font-semibold text-ink leading-tight">{course.title}</h1>
              <p className="mt-3 text-[15px] leading-7 text-ink-2">{course.subtitle}</p>

              <div className="mt-8 flex flex-wrap gap-6 text-[14px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-brand" />{course.durationHours} 小时</span>
                <span className="inline-flex items-center gap-1.5"><BookOpen size={15} className="text-brand" />{course.lessons} 节课</span>
                <span className="inline-flex items-center gap-1.5"><Users size={15} className="text-brand" />{course.studentsEnrolled.toLocaleString()} 学员</span>
                <span className="inline-flex items-center gap-1.5"><Star size={15} className="text-amber-500" />{course.rating} 评分</span>
              </div>
            </div>

            <aside className="rounded-[14px] border border-line bg-white p-6">
              <div className="text-[13px] text-ink-3">价格</div>
              <div className="mt-1 text-[36px] font-semibold text-brand leading-none">
                {isFreeCourse ? "免费" : `¥${course.price}`}
              </div>
              <div className="text-[12px] text-ink-3 mt-1">
                {course.format === "一对一私教" ? "按节购买,首节可申请试听" : "一次购买,长期回看"}
              </div>
              {paid || isFreeCourse ? (
                <Link
                  href={
                    lessons[0]
                      ? `/courses/${course.id}/learn/${lessons[0].id}`
                      : `/courses/${course.id}`
                  }
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-brand py-2.5 text-[14px] font-medium text-white hover:bg-brand-dark transition"
                >
                  {paid ? "继续学习" : "开始学习"}
                </Link>
              ) : (
                <CouponBox
                  type="course"
                  refId={course.id}
                  amount={course.price}
                  submitLabel="立即报名"
                  action={placeOrderFromForm}
                />
              )}
              <button
                className="mt-2 w-full rounded-md border border-line bg-white py-2.5 text-[14px] font-medium text-ink-2 hover:border-brand hover:text-brand transition"
                type="button"
              >
                咨询教练
              </button>

              {paid && progress.total > 0 ? (
                <div className="mt-5 border-t border-line pt-4">
                  <div className="flex items-center justify-between text-[12px] text-ink-3">
                    <span>学习进度</span>
                    <span className="text-ink">
                      已学 {progress.completed} / {progress.total} 节
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-soft">
                    <div
                      className="h-full bg-brand transition-[width]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-line pt-4 text-[12px] text-ink-3">
                授课老师 · <span className="text-ink">{course.instructor}</span>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="container-page py-14 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          {course.nextLiveAt ? (
            <div className="mb-8 inline-flex items-center gap-2 rounded-md bg-brand-soft px-4 py-2.5 text-[13px] text-brand-dark">
              <Clock3 size={14} />
              下次直播 {formatLiveTime(course.nextLiveAt)}
            </div>
          ) : null}

          {course.videoUrl ? (
            <CourseVideo
              videoUrl={course.videoUrl}
              coverUrl={course.coverUrl ?? null}
              title={course.title}
            />
          ) : null}

          <h2 className="text-[20px] font-semibold text-ink mb-5">课程亮点</h2>
          <ul className="space-y-3">
            {course.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-[14px] leading-6 text-ink-2">
                <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-[20px] font-semibold text-ink mt-12 mb-5">课程大纲</h2>
          <ol className="border border-line rounded-[14px] divide-y divide-line bg-white">
            {course.outline.map((row, i) => (
              <li key={i} className="flex items-baseline gap-4 px-5 py-4">
                <span className="text-[12px] font-medium text-brand w-16 shrink-0">{row.week}</span>
                <span className="text-[14px] text-ink">{row.topic}</span>
              </li>
            ))}
          </ol>

          {lessons.length > 0 ? (
            <>
              <h2 className="text-[20px] font-semibold text-ink mt-12 mb-5">课程目录</h2>
              <ol className="border border-line rounded-[14px] divide-y divide-line bg-white">
                {lessons.map((lesson) => {
                  const unlocked = isFreeCourse || lesson.free || paid;
                  const tag = isFreeCourse
                    ? null
                    : lesson.free && !paid
                      ? { label: "试看", tone: "brand" as const }
                      : paid
                        ? { label: "已购", tone: "muted" as const }
                        : { label: "锁定", tone: "lock" as const };
                  const Inner = (
                    <div className="flex items-center gap-4 px-5 py-4">
                      <span className="w-8 shrink-0 font-mono text-[12px] text-ink-3">
                        {String(lesson.idx).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-[14px] text-ink">
                        {lesson.title}
                      </span>
                      <span className="hidden sm:inline text-[12px] text-ink-3 font-mono">
                        {formatDuration(lesson.durationSec)}
                      </span>
                      {tag ? (
                        <span
                          className={
                            tag.tone === "brand"
                              ? "inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-dark"
                              : tag.tone === "lock"
                                ? "inline-flex items-center gap-1 rounded-full bg-bg-soft px-2 py-0.5 text-[11px] text-ink-3"
                                : "inline-flex items-center gap-1 rounded-full bg-bg-soft px-2 py-0.5 text-[11px] text-ink-2"
                          }
                        >
                          {tag.tone === "lock" ? <Lock size={11} /> : <PlayCircle size={11} />}
                          {tag.label}
                        </span>
                      ) : null}
                    </div>
                  );
                  return (
                    <li key={lesson.id}>
                      {unlocked ? (
                        <Link
                          href={`/courses/${course.id}/learn/${lesson.id}`}
                          className="block hover:bg-brand-tint transition"
                        >
                          {Inner}
                        </Link>
                      ) : (
                        <div className="cursor-not-allowed opacity-70">{Inner}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
        </div>

        <aside>
          <h2 className="text-[20px] font-semibold text-ink mb-5">为什么选这门课</h2>
          <div className="rounded-[14px] border border-line bg-white p-6 text-[14px] leading-7 text-ink-2">
            <p>
              本课程由 <strong>{course.instructor}</strong> 主讲,
              依托平台沉淀的训练数据与社群活跃度,
              提供完整的课前评估、课中互动、课后作业批改与社群答疑闭环。
            </p>
            <p className="mt-3">
              报名后即可加入对应水平的训练社群,与 {course.studentsEnrolled.toLocaleString()}+ 名同阶段学员共同打卡进步。
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
