import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-user";
import {
  listTeachingOrganizations,
  type TeachingOrganization,
} from "@/lib/teaching-api";
import {
  teachingErrorMessage,
  teachingRoleLabel,
  teachingStatusLabel,
} from "@/lib/teaching-labels";
import { CreateOrganizationForm } from "./_components/CreateOrganizationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "教学机构",
  robots: { index: false, follow: false },
};

export default async function OrganizationsPage() {
  const user = await requireUser("/org");
  let organizations: TeachingOrganization[] = [];
  let loadError: string | null = null;
  try {
    organizations = await listTeachingOrganizations(user);
  } catch (error) {
    loadError = teachingErrorMessage(error);
  }

  return (
    <div className="container-page py-8 md:py-12">
      <div className="max-w-3xl">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">教学机构</h1>
        <p className="mt-2 text-[14px] leading-6 text-ink-2">
          为个人老师、工作室或培训机构管理成员、学员和后续教学业务。一个账号可以加入多个机构。
        </p>
      </div>

      <section aria-labelledby="joined-orgs" className="mt-8 max-w-4xl">
        <h2 id="joined-orgs" className="text-[17px] font-semibold text-ink">我的机构</h2>
        {loadError ? (
          <div className="mt-3">
            <p role="alert" className="break-words text-[14px] text-red-600">{loadError}</p>
            <a
              href="/org"
              className="mt-3 inline-block text-[13px] font-medium text-brand-dark hover:underline"
            >
              重新加载
            </a>
          </div>
        ) : organizations.length ? (
          <div className="mt-3 divide-y divide-line border-y border-line">
            {organizations.map((org) => (
              <Link
                key={org.id}
                href={`/org/${org.slug}`}
                prefetch={false}
                className="grid min-w-0 gap-1 py-4 transition hover:text-brand-dark sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="min-w-0">
                  <span className="block [overflow-wrap:anywhere] text-[15px] font-medium">{org.name}</span>
                  <span className="mt-1 block break-all font-mono text-[12px] text-ink-3">/{org.slug}</span>
                </span>
                <span className="text-[12px] text-ink-3">
                  {teachingRoleLabel(org.role)}　{teachingStatusLabel(org.status)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-ink-3">你还没有加入任何教学机构。</p>
        )}
      </section>

      {!loadError ? (
        <section aria-labelledby="create-org" className="mt-10 border-t border-line pt-8">
          <h2 id="create-org" className="text-[17px] font-semibold text-ink">创建新机构</h2>
          <p className="mt-1 text-[13px] text-ink-3">创建者自动成为机构所有者。</p>
          <CreateOrganizationForm />
        </section>
      ) : null}
    </div>
  );
}
