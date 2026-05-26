import { list } from "@/lib/db/products";
import { PageHeader, PrimaryLink, Card, GhostLink } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsAdminPage() {
  const rows = await list();

  return (
    <div>
      <PageHeader
        title="商品"
        subtitle={`共 ${rows.length} 件商品`}
        actions={<PrimaryLink href="/admin/products/new">新建商品</PrimaryLink>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>ID</Th>
                <Th>名称</Th>
                <Th>分类</Th>
                <Th>品牌</Th>
                <Th className="text-right">价格</Th>
                <Th>库存</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td className="font-mono text-ink-3">{p.id}</Td>
                  <Td className="text-ink">{p.name}</Td>
                  <Td>{p.category}</Td>
                  <Td>{p.brand}</Td>
                  <Td className="text-right">¥{p.price}</Td>
                  <Td>{p.inStock ? "有货" : "无货"}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <GhostLink href={`/admin/products/${p.id}`}>编辑</GhostLink>
                      <DeleteButton id={p.id} action={deleteProduct} />
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="text-center text-ink-3 py-8">
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
