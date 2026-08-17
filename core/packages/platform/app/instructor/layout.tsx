import type { Metadata } from "next";
import Link from "next/link";
import { requireInstructor } from "@/lib/auth/instructor";

export const metadata: Metadata = {
  title: "讲师后台 — 魔方开放社群",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/instructor", label: "概览" },
  { href: "/instructor/courses", label: "我的课程" },
  { href: "/instructor/students", label: "学员" },
  { href: "/instructor/earnings", label: "分成报表" },
];

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { instructor } = await requireInstructor();
  return (
    <div className="bg-bg-soft min-h-[80vh]">
      <div className="flex flex-col md:grid md:grid-cols-[220px_minmax(0,1fr)] min-h-[80vh]">
        <aside className="border-b md:border-b-0 md:border-r border-line bg-white md:flex md:flex-col">
          <div className="p-5">
            <Link
              href="/instructor"
              className="block text-[15px] font-semibold text-ink"
            >
              讲师后台
            </Link>
            <div className="mt-1 text-[12px] text-ink-3">{instructor.name}</div>
          </div>
          <nav className="px-3 pb-4 flex md:flex-col gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:bg-bg-soft transition whitespace-nowrap"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="px-3 pb-4 md:mt-auto">
            <Link
              href="/"
              className="block w-full text-center rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
            >
              返回站点
            </Link>
          </div>
        </aside>
        <main className="min-w-0 px-5 md:px-8 py-8 bg-bg-soft">{children}</main>
      </div>
    </div>
  );
}
