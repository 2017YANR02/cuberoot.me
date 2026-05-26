import Link from "next/link";
import { list as listCourses } from "@/lib/db/courses";
import { list as listProducts } from "@/lib/db/products";
import { list as listEvents } from "@/lib/db/events";
import { list as listNews } from "@/lib/db/news";
import { list as listInstructors } from "@/lib/db/instructors";
import { list as listOrders } from "@/lib/db/orders";
import { list as listApplications } from "@/lib/db/applications";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [c, p, e, n, i, o, a] = await Promise.all([
    listCourses(),
    listProducts(),
    listEvents(),
    listNews(),
    listInstructors(),
    listOrders(),
    listApplications(),
  ]);

  const pendingApps = a.filter((x) => x.status === "pending").length;
  const paidOrders = o.filter((x) => x.status === "paid").length;

  const stats = [
    { key: "courses", label: "课程", count: c.length },
    { key: "products", label: "商品", count: p.length },
    { key: "events", label: "赛事", count: e.length },
    { key: "news", label: "资讯", count: n.length },
    { key: "instructors", label: "讲师", count: i.length },
    { key: "orders", label: `订单 · 已支付 ${paidOrders}`, count: o.length },
    { key: "applications", label: `讲师申请 · 待审 ${pendingApps}`, count: a.length },
  ];

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink">概览</h1>
      <p className="mt-1 text-[13px] text-ink-3">站点数据总览,从下方进入各资源管理。</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.key}
            href={`/admin/${s.key}`}
            className="block rounded-[14px] border border-line bg-white p-5 transition hover:border-brand/40"
          >
            <div className="text-[13px] text-ink-3">{s.label}</div>
            <div className="mt-1 text-[28px] font-semibold text-ink">{s.count}</div>
            <div className="mt-3 text-[12px] text-brand">进入管理 →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
