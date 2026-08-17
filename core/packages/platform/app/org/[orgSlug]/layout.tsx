import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-user";
import { getTeachingOrganization, TeachingApiError } from "@/lib/teaching-api";
import { teachingRoleLabel, teachingStatusLabel } from "@/lib/teaching-labels";
import { OrgNav } from "../_components/OrgNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "机构工作台",
  robots: { index: false, follow: false },
};

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser(`/org/${orgSlug}`);
  let organization;
  try {
    organization = await getTeachingOrganization(user, orgSlug);
  } catch (error) {
    if (error instanceof TeachingApiError && error.code === "ORGANIZATION_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <div className="min-h-[75vh] bg-white">
      <div className="container-page pt-7">
        <Link href="/org" prefetch={false} className="text-[13px] text-ink-3 hover:text-ink">全部机构</Link>
        <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="min-w-0 max-w-full [overflow-wrap:anywhere] text-[22px] font-semibold tracking-tight text-ink">{organization.name}</h1>
          <span className="text-[12px] text-ink-3">
            {teachingRoleLabel(organization.role)}　{teachingStatusLabel(organization.status)}
          </span>
        </div>
        <div className="mt-4 border-b border-line">
          <OrgNav
            orgSlug={organization.slug}
            canReadStudents={hasTeachingPermission(organization.role, "student:read")}
          />
        </div>
      </div>
      <div className="container-page py-7 md:py-9">{children}</div>
    </div>
  );
}
