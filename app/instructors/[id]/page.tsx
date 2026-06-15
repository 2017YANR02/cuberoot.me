import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Users,
  Trophy,
  BookOpen,
  CalendarClock,
  Clock,
  Star,
  ArrowRight,
} from "lucide-react";
import { list as listInstructors } from "@/lib/db/instructors";
import { findPublicById } from "@/lib/db/instructors-public";
import { Badge } from "@/components/Badge";
import { InstructorAvatar } from "@/components/InstructorAvatar";
import { ogImageUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const all = await listInstructors();
  return all.map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await findPublicById(id);
  if (!data) return { title: "讲师主页" };
  const { instructor } = data;
  const title = `${instructor.name} — ${instructor.title}`;
  const desc = instructor.bio;
  const img = ogImageUrl(instructor.name);
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: instructor.name }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description: desc,
      images: [img],
    },
  };
}

export default async function InstructorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await findPublicById(id);
  if (!data) notFound();

  const { instructor, courses, courseCount, studentsEnrolled } = data;

  const stats = [
    { icon: MapPin, label: "所在城市", value: instructor.city },
    { icon: CalendarClock, label: "执教年限", value: `${instructor.yearsTeaching} 年` },
    { icon: BookOpen, label: "开设课程", value: `${courseCount} 门` },
    { icon: Users, label: "累计教学", value: `${instructor.studentsTaught}` },
  ];

  return (
    <>
      <section className="bg-brand-tint border-b border-line">
        <div className="container-page py-12 md:py-16">
          <Link href="/instructors" className="text-[13px] text-ink-3 hover:text-ink">← 返回讲师列表</Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <InstructorAvatar name={instructor.name} size={88} />
            <div className="min-w-0">
              <h1 className="text-[28px] md:text-[36px] font-semibold text-ink leading-tight">
                {instructor.name}
              </h1>
              <p className="mt-2 text-[15px] text-ink-2">{instructor.title}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {instructor.specialty.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-md bg-white border border-line px-4 py-2 text-[13px] text-ink-2">
                <Trophy size={15} className="text-amber-500 shrink-0" />
                个人最佳 <span className="font-semibold text-ink">{instructor.bestRecord}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-14 grid gap-10 md:grid-cols-[1.4fr_1fr] items-start">
        <div>
          <h2 className="text-[20px] font-semibold text-ink mb-5">讲师简介</h2>
          <div className="rounded-[14px] border border-line bg-white p-6 text-[14px] leading-7 text-ink-2 whitespace-pre-line">
            {instructor.bio}
          </div>

          <h2 className="text-[20px] font-semibold text-ink mt-12 mb-5">
            开设的课程
            {courseCount > 0 ? <span className="text-ink-3 font-normal text-[15px] ml-2">{courseCount} 门</span> : null}
          </h2>
          {courses.length === 0 ? (
            <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
              该讲师暂未上架课程
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="group block rounded-[14px] border border-line bg-white p-6 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Badge tone="brand">{c.level}</Badge>
                    <Badge tone="muted">{c.format}</Badge>
                  </div>
                  <h3 className="text-[16px] font-semibold text-ink mb-2 group-hover:text-brand transition line-clamp-2">
                    {c.title}
                  </h3>
                  <p className="text-[13px] leading-6 text-ink-3 mb-5 line-clamp-2">{c.subtitle}</p>
                  <div className="flex items-center gap-4 text-[12px] text-ink-3 mb-5">
                    <span className="inline-flex items-center gap-1"><Clock size={13} />{c.durationHours}h</span>
                    <span className="inline-flex items-center gap-1"><Users size={13} />{c.studentsEnrolled}</span>
                    <span className="inline-flex items-center gap-1"><Star size={13} className="text-amber-500" />{c.rating}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-4">
                    <div>
                      <span className="text-[18px] font-semibold text-brand">{c.price === 0 ? "免费" : `¥${c.price}`}</span>
                    </div>
                    <span className="text-[13px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                      了解详情 <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[14px] border border-line bg-white p-6">
            <h2 className="text-[15px] font-semibold text-ink mb-4">讲师数据</h2>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
                    <s.icon size={13} className="text-brand" />
                    {s.label}
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-ink">{s.value}</div>
                </div>
              ))}
            </div>
            {studentsEnrolled > 0 ? (
              <div className="mt-4 border-t border-line pt-4 text-[12px] text-ink-3">
                课程累计报名 <span className="text-ink font-medium">{studentsEnrolled.toLocaleString()}</span> 人次
              </div>
            ) : null}
          </div>

          <div className="rounded-[14px] border border-line bg-white p-6">
            <h2 className="text-[15px] font-semibold text-ink mb-2">成为平台讲师</h2>
            <p className="text-[13px] leading-6 text-ink-3 mb-4">
              认证教练享行业领先分成,平台负责收款、售后与流量分发,你只需专注教学。
            </p>
            <Link
              href="/instructors/apply"
              className="inline-flex w-full items-center justify-center rounded-md bg-brand py-2.5 text-[14px] font-medium text-white hover:bg-brand-dark transition"
            >
              申请讲师入驻
            </Link>
          </div>
        </aside>
      </section>
    </>
  );
}
