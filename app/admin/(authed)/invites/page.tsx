import { list } from "@/lib/db/invites";
import { db, schema } from "@/db";
import { Card, PageHeader } from "../../_components/Shell";
import { Field, FormActions, Input, Submit } from "../../_components/Form";
import { DeleteButton } from "../../_components/DeleteButton";
import { createInvite, deleteInvite } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ERR: Record<string, string> = {
  missing_owner: "请输入用户 ID",
  user_not_found: "未找到对应用户",
};

export default async function AdminInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [rows, sp] = await Promise.all([list(), searchParams]);

  const ownerIds = Array.from(new Set(rows.map((r) => r.ownerId)));
  let nicknames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const userRows = db
      .select({ id: schema.users.id, nickname: schema.users.nickname, phone: schema.users.phone })
      .from(schema.users)
      .all();
    nicknames = Object.fromEntries(
      userRows
        .filter((u) => ownerIds.includes(u.id))
        .map((u) => [u.id, `${u.nickname} (${u.phone})`]),
    );
  }

  return (
    <div>
      <PageHeader title="邀请码" subtitle={`共 ${rows.length} 个邀请码`} />

      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-4">为指定用户生成邀请码</h2>
        {sp.error && ERR[sp.error] ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
            {ERR[sp.error]}
          </div>
        ) : null}
        <form action={createInvite} className="grid gap-4 md:grid-cols-2">
          <Field label="用户 ID" hint="格式 u_xxx,可从订单 / 用户列表复制">
            <Input name="ownerId" required placeholder="u_xxxxxxxx" />
          </Field>
          <Field label="注册奖励券 code(可选)">
            <Input name="rewardCoupon" placeholder="WELCOME10" />
          </Field>
          <FormActions>
            <Submit>生成邀请码</Submit>
          </FormActions>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>Code</Th>
                <Th>所属用户</Th>
                <Th>奖励券</Th>
                <Th className="text-right">使用次数</Th>
                <Th>创建时间</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.code}>
                  <Td className="font-mono text-ink">{r.code}</Td>
                  <Td className="text-ink-2">
                    <div>{nicknames[r.ownerId] ?? "—"}</div>
                    <div className="text-[12px] text-ink-3 font-mono">{r.ownerId}</div>
                  </Td>
                  <Td className="font-mono text-ink-2">{r.rewardCoupon ?? "—"}</Td>
                  <Td className="text-right">{r.uses}</Td>
                  <Td className="text-ink-3">{fmtDate(r.createdAt)}</Td>
                  <Td className="text-right">
                    <DeleteButton id={r.code} action={deleteInvite} />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-center text-ink-3 py-8">
                    暂无邀请码
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
