import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingOrganization,
  listTeachingPackageProducts,
  listTeachingStudentPackageLedger,
  listTeachingStudentPackages,
  TeachingApiError,
} from "@/lib/teaching-api";
import {
  teachingCreditLabel,
  teachingDateTimeLabel,
  teachingLedgerEntryLabel,
  teachingLedgerReasonLabel,
  teachingPackageStatusLabel,
} from "@/lib/teaching-stage2";
import {
  loadStudentCreditsParams,
  serializeStudentCreditsParams,
} from "@/lib/search-params";
import { GrantStudentPackageForm } from "../../../../_components/GrantStudentPackageForm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function StudentCreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; studentId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug, studentId } = await params;
  const { page, packageId, ledgerPage } = await loadStudentCreditsParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/students/${studentId}/credits`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "package:read")) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-[19px] font-semibold text-ink">学员课时</h2>
        <p className="mt-2 text-[14px] text-ink-2">你当前的机构角色不能查看学员课时。</p>
      </div>
    );
  }

  const [packages, products] = await Promise.all([
    listTeachingStudentPackages(user, orgSlug, studentId, { page }),
    listTeachingPackageProducts(user, orgSlug, { page: 1, pageSize: 100 }),
  ]).catch((error: unknown) => {
    if (
      error instanceof TeachingApiError &&
      (error.code === "RESOURCE_NOT_FOUND" || error.code === "INVALID_INPUT")
    ) notFound();
    throw error;
  });
  if (packages.page > packages.totalPages) {
    redirect(serializeStudentCreditsParams(`/org/${orgSlug}/students/${studentId}/credits`, {
      page: packages.totalPages,
      packageId: null,
      ledgerPage: 1,
    }));
  }
  const requestedPackageId = packageId && UUID_PATTERN.test(packageId) ? packageId : null;
  const selectedPackage = packages.items.find((item) => item.id === requestedPackageId) ?? packages.items[0] ?? null;
  const ledger = selectedPackage
    ? await listTeachingStudentPackageLedger(user, orgSlug, selectedPackage.id, { page: ledgerPage })
    : null;
  if (ledger && ledger.page > ledger.totalPages) {
    redirect(serializeStudentCreditsParams(`/org/${orgSlug}/students/${studentId}/credits`, {
      page: packages.page,
      packageId: selectedPackage?.id ?? null,
      ledgerPage: ledger.totalPages,
    }));
  }
  const canManage = organization.status === "active" &&
    hasTeachingPermission(organization.role, "package:manage");
  const activeProducts = products.items.filter((item) => item.status === "active");

  return (
    <div className="max-w-5xl">
      <Link href={`/org/${orgSlug}/students`} prefetch={false} className="text-[13px] text-ink-3 hover:text-ink">全部学员</Link>
      <h2 className="mt-2 text-[19px] font-semibold text-ink">学员课时</h2>
      <p className="mt-1 break-all font-mono text-[12px] text-ink-3">{studentId}</p>
      {canManage ? (
        <GrantStudentPackageForm
          orgSlug={orgSlug}
          studentId={studentId}
          timezone={organization.timezone}
          products={activeProducts.map((product) => ({
            id: product.id,
            name: product.name,
            totalCredits: product.totalCredits,
            unitLabel: product.creditUnit === "minute" ? "分钟" : "课时",
          }))}
        />
      ) : null}
      {canManage && products.total > products.items.length ? (
        <p className="mt-2 text-[12px] text-ink-3">课包产品超过 100 个，此处仅显示前 100 个；可停用旧课包后再发放。</p>
      ) : null}

      <section className="mt-8" aria-labelledby="student-package-heading">
        <h3 id="student-package-heading" className="text-[15px] font-semibold text-ink">已发放课包</h3>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {packages.items.length ? packages.items.map((item) => {
            const selected = selectedPackage?.id === item.id;
            return (
              <Link
                key={item.id}
                href={serializeStudentCreditsParams(`/org/${orgSlug}/students/${studentId}/credits`, {
                  page: packages.page,
                  packageId: item.id,
                  ledgerPage: 1,
                })}
                prefetch={false}
                aria-current={selected ? "true" : undefined}
                className="grid min-w-0 gap-1.5 py-3 hover:text-brand-dark sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-5"
              >
                <span className={`min-w-0 [overflow-wrap:anywhere] text-[14px] font-medium ${selected ? "text-brand-dark" : "text-ink"}`}>{item.productNameSnapshot}</span>
                <span className="text-[12px] text-ink-2">剩余 {teachingCreditLabel(item.remainingCredits, item.creditUnit)} / 共 {teachingCreditLabel(item.totalCredits, item.creditUnit)}</span>
                <span><Badge tone={item.status === "active" ? "success" : "muted"}>{teachingPackageStatusLabel(item.status)}</Badge></span>
              </Link>
            );
          }) : <p className="py-5 text-[14px] text-ink-3">尚未发放课包。</p>}
        </div>
        <Pagination
          page={packages.page}
          totalPages={packages.totalPages}
          basePath={`/org/${orgSlug}/students/${studentId}/credits`}
          prefetch={false}
        />
      </section>

      {selectedPackage && ledger ? (
        <section className="mt-9" aria-labelledby="ledger-heading">
          <div className="min-w-0">
            <h3 id="ledger-heading" className="[overflow-wrap:anywhere] text-[15px] font-semibold text-ink">课时流水：{selectedPackage.productNameSnapshot}</h3>
            <p className="mt-1 text-[13px] text-ink-3">当前余额 {teachingCreditLabel(selectedPackage.remainingCredits, selectedPackage.creditUnit)}</p>
          </div>
          <div className="mt-3 divide-y divide-line border-y border-line">
            {ledger.items.length ? ledger.items.map((entry) => (
              <div key={entry.id} className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-5">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">{teachingLedgerEntryLabel(entry.entryType)}</p>
                  <p className="mt-0.5 [overflow-wrap:anywhere] text-[12px] text-ink-3">{teachingLedgerReasonLabel(entry.reason)}</p>
                </div>
                <p className={`text-[14px] font-semibold ${entry.delta >= 0 ? "text-brand-dark" : "text-ink"}`}>
                  {entry.delta > 0 ? "+" : ""}{teachingCreditLabel(entry.delta, selectedPackage.creditUnit)}
                </p>
                <div className="min-w-0 text-[12px] text-ink-3 sm:text-right">
                  <p>{teachingDateTimeLabel(entry.createdAt, organization.timezone)}</p>
                  {entry.balanceAfter !== null ? <p>余额 {teachingCreditLabel(entry.balanceAfter, selectedPackage.creditUnit)}</p> : null}
                  {entry.sessionId ? (
                    <Link href={`/org/${orgSlug}/sessions/${entry.sessionId}`} prefetch={false} className="font-medium text-brand-dark hover:text-brand">查看课堂</Link>
                  ) : null}
                </div>
              </div>
            )) : <p className="py-5 text-[14px] text-ink-3">暂无课时流水。</p>}
          </div>
          <Pagination
            page={ledger.page}
            totalPages={ledger.totalPages}
            basePath={`/org/${orgSlug}/students/${studentId}/credits`}
            pageParam="ledgerPage"
            params={{
              page: packages.page > 1 ? String(packages.page) : undefined,
              packageId: selectedPackage.id,
            }}
            prefetch={false}
          />
        </section>
      ) : null}
    </div>
  );
}
