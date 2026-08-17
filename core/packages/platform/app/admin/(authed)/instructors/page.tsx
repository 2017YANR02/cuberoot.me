import { list } from "@/lib/db/instructors";
import { PageHeader, PrimaryLink, Card, GhostLink, Th, Td } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { deleteInstructor } from "./actions";

export const dynamic = "force-dynamic";

export default async function InstructorsAdminPage() {
  const rows = await list();

  return (
    <div>
      <PageHeader
        title="讲师"
        subtitle={`共 ${rows.length} 位讲师`}
        actions={<PrimaryLink href="/admin/instructors/new">新建讲师</PrimaryLink>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>ID</Th>
                <Th>姓名</Th>
                <Th>头衔</Th>
                <Th>城市</Th>
                <Th className="text-right">学员</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((i) => (
                <tr key={i.id}>
                  <Td className="font-mono text-ink-3">{i.id}</Td>
                  <Td className="text-ink">{i.name}</Td>
                  <Td>{i.title}</Td>
                  <Td>{i.city}</Td>
                  <Td className="text-right">{i.studentsTaught}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <GhostLink href={`/admin/instructors/${i.id}`}>编辑</GhostLink>
                      <DeleteButton id={i.id} action={deleteInstructor} />
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-center text-ink-3 py-8">
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
