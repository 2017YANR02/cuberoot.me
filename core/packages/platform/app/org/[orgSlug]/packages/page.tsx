import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingOrganization,
  listTeachingPackageProducts,
} from "@/lib/teaching-api";
import {
  teachingCreditLabel,
  teachingMoneyLabel,
  teachingPackageStatusLabel,
} from "@/lib/teaching-stage2";
import { loadPageParams, serializePageParams } from "@/lib/search-params";
import { CreatePackageProductForm } from "../../_components/CreatePackageProductForm";

export default async function OrganizationPackagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug } = await params;
  const { page } = await loadPageParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/packages`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "package:read")) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-[19px] font-semibold text-ink">课包</h2>
        <p className="mt-2 text-[14px] text-ink-2">你当前的机构角色不能查看课包。</p>
      </div>
    );
  }
  const result = await listTeachingPackageProducts(user, orgSlug, { page });
  if (result.page > result.totalPages) {
    redirect(serializePageParams(`/org/${orgSlug}/packages`, { page: result.totalPages }));
  }
  const canManage = organization.status === "active" &&
    hasTeachingPermission(organization.role, "package:manage");

  return (
    <div className="max-w-5xl">
      <h2 className="text-[19px] font-semibold text-ink">课包</h2>
      <p className="mt-1 text-[13px] text-ink-3">先定义可售或可发放的课包，再进入学员档案发放。</p>
      {canManage ? <CreatePackageProductForm orgSlug={organization.slug} /> : null}

      <div className="mt-7 divide-y divide-line border-y border-line">
        {result.items.length ? result.items.map((product) => (
          <div key={product.id} className="grid min-w-0 gap-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-5">
            <div className="min-w-0">
              <p className="[overflow-wrap:anywhere] text-[14px] font-medium text-ink">{product.name}</p>
              <p className="mt-0.5 break-all font-mono text-[12px] text-ink-3">{product.code} / {product.creditType}</p>
            </div>
            <div className="min-w-0 text-[12px] text-ink-2 sm:text-right">
              <p>{teachingCreditLabel(product.totalCredits, product.creditUnit)}</p>
              <p>{product.validityDays ? `${product.validityDays} 天有效` : "长期有效"}，{teachingMoneyLabel(product.priceAmountMinor, product.currency)}</p>
            </div>
            <div><Badge tone={product.status === "active" ? "success" : "muted"}>{teachingPackageStatusLabel(product.status)}</Badge></div>
          </div>
        )) : (
          <p className="py-5 text-[14px] text-ink-3">暂无课包产品。</p>
        )}
      </div>
      <Pagination page={result.page} totalPages={result.totalPages} basePath={`/org/${orgSlug}/packages`} prefetch={false} />
    </div>
  );
}
