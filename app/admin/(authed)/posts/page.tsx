import Link from "next/link";
import { CIRCLE_META, listPosts } from "@/lib/db/posts";
import { PageHeader, Card, GhostLink } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { deletePost } from "./actions";

export const dynamic = "force-dynamic";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function PostsAdminPage() {
  const rows = await listPosts();

  return (
    <div>
      <PageHeader title="帖子" subtitle={`共 ${rows.length} 条帖子`} />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>标题</Th>
                <Th>圈子</Th>
                <Th>作者</Th>
                <Th>赞 / 评</Th>
                <Th>创建时间</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td className="text-ink">
                    <Link
                      href={`/community/posts/${p.id}`}
                      className="hover:text-brand transition"
                    >
                      {p.title}
                    </Link>
                  </Td>
                  <Td>{CIRCLE_META[p.circleId].name}</Td>
                  <Td>{p.authorNickname}</Td>
                  <Td>
                    {p.likes} / {p.commentCount}
                  </Td>
                  <Td className="text-ink-3">{formatTime(p.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <GhostLink href={`/community/posts/${p.id}`}>查看</GhostLink>
                      <DeleteButton id={p.id} action={deletePost} />
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
