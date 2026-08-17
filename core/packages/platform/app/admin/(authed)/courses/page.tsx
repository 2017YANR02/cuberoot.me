import { list } from "@/lib/db/courses";
import { PageHeader, PrimaryLink, Card, GhostLink, Th, Td } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { deleteCourse } from "./actions";

export const dynamic = "force-dynamic";

export default async function CoursesAdminPage() {
  const rows = await list();

  return (
    <div>
      <PageHeader
        title="课程"
        subtitle={`共 ${rows.length} 个课程`}
        actions={<PrimaryLink href="/admin/courses/new">新建课程</PrimaryLink>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>ID</Th>
                <Th>标题</Th>
                <Th>等级</Th>
                <Th>形式</Th>
                <Th>讲师</Th>
                <Th className="text-right">价格</Th>
                <Th className="text-right">学员</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td className="font-mono text-ink-3">{c.id}</Td>
                  <Td className="text-ink">{c.title}</Td>
                  <Td>{c.level}</Td>
                  <Td>{c.format}</Td>
                  <Td>{c.instructor}</Td>
                  <Td className="text-right">¥{c.price}</Td>
                  <Td className="text-right">{c.studentsEnrolled}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <GhostLink href={`/admin/courses/${c.id}`}>编辑</GhostLink>
                      <DeleteButton id={c.id} action={deleteCourse} />
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="text-center text-ink-3 py-8">
                    暂无数据
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
