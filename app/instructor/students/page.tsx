import Link from "next/link";
import { requireInstructor } from "@/lib/auth/instructor";
import { studentsByInstructor } from "@/lib/db/instructor-stats";
import { Th, Td } from "@/components/DataTable";

export const dynamic = "force-dynamic";

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function maskPhone(p: string): string {
  if (!p || p.length < 7) return p;
  return p.slice(0, 3) + "****" + p.slice(-4);
}

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { instructor } = await requireInstructor();
  const { items, total, totalPages, pageSize } = await studentsByInstructor(
    instructor.id,
    { page, pageSize: 30 },
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-ink">学员</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          来自你课程的付费学员明细 · 共 {total} 条
        </p>
      </div>

      <div className="rounded-[14px] border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>昵称</Th>
                <Th>手机号</Th>
                <Th>购买课程</Th>
                <Th className="text-right">金额</Th>
                <Th>支付时间</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((s, idx) => (
                <tr key={`${s.userId}-${s.courseId}-${s.createdAt}-${idx}`}>
                  <Td className="text-ink">{s.nickname}</Td>
                  <Td className="font-mono text-ink-3">{maskPhone(s.phone)}</Td>
                  <Td className="text-ink">{s.courseTitle}</Td>
                  <Td className="text-right">¥{s.amount}</Td>
                  <Td className="text-ink-3">{fmtDate(s.paidAt)}</Td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-center text-ink-3 py-8">
                    暂无付费学员
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px] text-ink-3">
          <span>
            第 {page} / {totalPages} 页 · 每页 {pageSize}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/instructor/students?page=${page - 1}`}
                className="rounded-md border border-line bg-white px-3 py-1.5 hover:border-brand/40 transition"
              >
                上一页
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={`/instructor/students?page=${page + 1}`}
                className="rounded-md border border-line bg-white px-3 py-1.5 hover:border-brand/40 transition"
              >
                下一页
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
