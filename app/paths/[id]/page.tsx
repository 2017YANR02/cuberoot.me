import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Clock,
  BookOpen,
  CheckCircle2,
  Circle,
  ArrowRight,
  Route,
} from "lucide-react";
import {
  listCollections,
  getCollectionWithCourses,
} from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/auth-user";
import { Badge } from "@/components/Badge";
import { ogImageUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const all = await listCollections();
  return all.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCollectionWithCourses(id);
  if (!detail) return { title: "学习路径" };
  const { collection } = detail;
  const desc =
    collection.subtitle ||
    collection.description ||
    `${collection.title} 学习路径`;
  const img = ogImageUrl(collection.title);
  return {
    title: collection.title,
    description: desc,
    openGraph: {
      title: collection.title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: collection.title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: collection.title,
      description: desc,
      images: [img],
    },
  };
}

export default async function PathDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const detail = await getCollectionWithCourses(id, user?.id);
  if (!detail) notFound();

  const { collection, courses } = detail;

  // 整体进度:全路径累计「已完成节数 / 总节数」
  const totalLessons = courses.reduce((s, c) => s + c.totalLessons, 0);
  const completedLessons = courses.reduce((s, c) => s + c.completedLessons, 0);
  const overallPercent =
    totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;
  // 已学完的课程数(该课所有节都完成且至少 1 节)
  const finishedCourses = courses.filter(
    (c) => c.totalLessons > 0 && c.completedLessons >= c.totalLessons,
  ).length;

  return (
    <>
      <section className="bg-brand-tint border-b border-line">
        <div className="container-page py-12 md:py-16">
          <Link
            href="/paths"
            className="text-[13px] text-ink-3 hover:text-ink"
          >
            ← 返回学习路径
          </Link>
          <div className="mt-6 flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-brand text-white">
              <Route size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[28px] md:text-[36px] font-semibold text-ink leading-tight">
                {collection.title}
              </h1>
              {collection.subtitle ? (
                <p className="mt-3 text-[15px] leading-7 text-ink-2">
                  {collection.subtitle}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-[13px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen size={15} className="text-brand" />
                  共 {courses.length} 门课程
                </span>
                {user ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-brand" />
                    已学完 {finishedCourses} / {courses.length} 门
                  </span>
                ) : null}
              </div>

              {user && totalLessons > 0 ? (
                <div className="mt-5 max-w-md">
                  <div className="flex items-center justify-between text-[12px] text-ink-3">
                    <span>整体进度</span>
                    <span className="text-ink">
                      {completedLessons} / {totalLessons} 节 · {overallPercent}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full bg-brand transition-[width]"
                      style={{ width: `${overallPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12 md:py-14">
        {collection.description ? (
          <p className="mb-10 max-w-3xl text-[14px] leading-7 text-ink-2">
            {collection.description}
          </p>
        ) : null}

        {courses.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
            这条路径暂未添加课程
          </div>
        ) : (
          <ol className="relative space-y-4">
            {courses.map((c, i) => {
              const isFreeCourse = c.price === 0;
              const finished =
                c.totalLessons > 0 && c.completedLessons >= c.totalLessons;
              return (
                <li key={c.itemId}>
                  <Link
                    href={`/courses/${c.id}`}
                    className="group flex items-start gap-4 rounded-[14px] border border-line bg-white p-5 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
                  >
                    {/* 序号 / 完成勾 */}
                    <div className="shrink-0">
                      {user && finished ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white">
                          <CheckCircle2 size={18} />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-[14px] font-semibold text-brand">
                          {i + 1}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge tone="brand">{c.level}</Badge>
                        <Badge tone="muted">{c.format}</Badge>
                      </div>
                      <h3 className="text-[16px] font-semibold text-ink group-hover:text-brand transition">
                        {c.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-6 text-ink-3 line-clamp-2">
                        {c.subtitle}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} />
                          {c.durationHours}h
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BookOpen size={13} />
                          {c.lessons} 节
                        </span>
                        <span className="font-semibold text-brand">
                          {isFreeCourse ? "免费" : `¥${c.price}`}
                        </span>
                      </div>

                      {/* 登录则显示该课完成度 */}
                      {user && c.totalLessons > 0 ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-ink-3">
                            <span className="inline-flex items-center gap-1">
                              {finished ? (
                                <CheckCircle2 size={12} className="text-brand" />
                              ) : (
                                <Circle size={12} />
                              )}
                              已学 {c.completedLessons} / {c.totalLessons} 节
                            </span>
                            <span className="text-ink-2">
                              {c.progressPercent}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bg-soft">
                            <div
                              className="h-full bg-brand transition-[width]"
                              style={{ width: `${c.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-brand"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {!user ? (
          <div className="mt-8 rounded-[14px] border border-line bg-bg-soft px-5 py-4 text-[13px] text-ink-2">
            <Link href="/login" className="text-brand hover:underline">
              登录
            </Link>{" "}
            后可在路线图上看到每门课的学习进度。
          </div>
        ) : null}
      </section>
    </>
  );
}
