import Link from "next/link";
import { requireInstructor } from "@/lib/auth/instructor";
import { listByInstructor } from "@/lib/db/courses";
import { db, schema } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type RevenueRow = { courseId: string; revenue: number; students: number };

function loadCourseRevenue(courseIds: string[]): Map<string, RevenueRow> {
  if (courseIds.length === 0) return new Map();
  const rows = db
    .select({
      refId: schema.orders.refId,
      revenue: sql<number>`COALESCE(SUM(${schema.orders.amount}), 0)`,
      students: sql<number>`COUNT(DISTINCT ${schema.orders.userId})`,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.type, "course"),
        eq(schema.orders.status, "paid"),
        inArray(schema.orders.refId, courseIds),
      ),
    )
    .groupBy(schema.orders.refId)
    .all();
  const map = new Map<string, RevenueRow>();
  for (const r of rows) {
    map.set(r.refId, { courseId: r.refId, revenue: r.revenue, students: r.students });
  }
  return map;
}

export default async function InstructorCoursesPage() {
  const { instructor } = await requireInstructor();
  const { items } = await listByInstructor(instructor.id, { pageSize: 100 });
  const revenueMap = loadCourseRevenue(items.map((c) => c.id));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-ink">我的课程</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            共 {items.length} 门 · 仅显示已关联到你账户的课
          </p>
        </div>
      </div>

      <div className="rounded-[14px] border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>标题</Th>
                <Th>等级</Th>
                <Th>形式</Th>
                <Th className="text-right">价格</Th>
                <Th className="text-right">付费学员</Th>
                <Th className="text-right">销售额</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((c) => {
                const r = revenueMap.get(c.id);
                return (
                  <tr key={c.id}>
                    <Td>
                      <div className="text-ink">{c.title}</div>
                      <div className="text-[12px] text-ink-3 font-mono">{c.id}</div>
                    </Td>
                    <Td>{c.level}</Td>
                    <Td>{c.format}</Td>
                    <Td className="text-right">¥{c.price}</Td>
                    <Td className="text-right">{r?.students ?? 0}</Td>
                    <Td className="text-right">¥{r?.revenue ?? 0}</Td>
                    <Td className="text-right">
                      <Link
                        href={`/instructor/courses/${c.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
                      >
                        编辑
                      </Link>
                    </Td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="text-center text-ink-3 py-8">
                    还没有关联到你账户的课程,请联系管理员
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"px-4 py-3 text-left font-medium " + className}>{children}</th>;
}
function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={"px-4 py-3 align-middle " + className} colSpan={colSpan}>
      {children}
    </td>
  );
}
