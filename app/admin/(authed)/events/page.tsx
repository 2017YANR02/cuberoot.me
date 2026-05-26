import { list } from "@/lib/db/events";
import { PageHeader, PrimaryLink, Card, GhostLink } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { deleteEvent } from "./actions";

export const dynamic = "force-dynamic";

export default async function EventsAdminPage() {
  const rows = await list();

  return (
    <div>
      <PageHeader
        title="赛事"
        subtitle={`共 ${rows.length} 个赛事`}
        actions={<PrimaryLink href="/admin/events/new">新建赛事</PrimaryLink>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>ID</Th>
                <Th>标题</Th>
                <Th>类型</Th>
                <Th>状态</Th>
                <Th>城市</Th>
                <Th>日期</Th>
                <Th className="text-right">报名</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id}>
                  <Td className="font-mono text-ink-3">{e.id}</Td>
                  <Td className="text-ink">{e.title}</Td>
                  <Td>{e.type}</Td>
                  <Td>{e.status}</Td>
                  <Td>{e.city}</Td>
                  <Td>{e.startDate}</Td>
                  <Td className="text-right">
                    {e.registered}/{e.capacity}
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <GhostLink href={`/admin/events/${e.id}`}>编辑</GhostLink>
                      <DeleteButton id={e.id} action={deleteEvent} />
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
