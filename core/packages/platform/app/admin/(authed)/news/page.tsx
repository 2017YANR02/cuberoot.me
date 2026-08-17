import { list } from "@/lib/db/news";
import { PageHeader, PrimaryLink, Card, GhostLink, Th, Td } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { deleteNews } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewsAdminPage() {
  const rows = await list();

  return (
    <div>
      <PageHeader
        title="资讯"
        subtitle={`共 ${rows.length} 条资讯`}
        actions={<PrimaryLink href="/admin/news/new">新建资讯</PrimaryLink>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>ID</Th>
                <Th>标题</Th>
                <Th>分类</Th>
                <Th>日期</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((n) => (
                <tr key={n.id}>
                  <Td className="font-mono text-ink-3">{n.id}</Td>
                  <Td className="text-ink">{n.title}</Td>
                  <Td>{n.category}</Td>
                  <Td>{n.date}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <GhostLink href={`/admin/news/${n.id}`}>编辑</GhostLink>
                      <DeleteButton id={n.id} action={deleteNews} />
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-center text-ink-3 py-8">
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
