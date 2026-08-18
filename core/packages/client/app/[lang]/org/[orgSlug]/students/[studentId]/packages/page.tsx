'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingStudentPackage,
  getTeachingStudent,
  listTeachingPackageProducts,
  listTeachingStudentPackageLedger,
  listTeachingStudentPackages,
  type TeachingPackageProduct,
  type TeachingStudent,
  type TeachingStudentPackage,
} from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  TeachingPagination,
  teachingErrorMessage,
  useOperationKey,
  useTeachingPage,
} from '../../../../_components/OrgUi';

const PAGE_SIZE = 25;
const PRODUCT_OPTION_LIMIT = 100;

export default function OrganizationStudentPackagesPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => <StudentPackagesContent orgSlug={params.orgSlug} studentId={params.studentId} page={page} role={organization.role} />}
    </OrgWorkspace>
  );
}

function StudentPackagesContent({ orgSlug, studentId, page, role }: { orgSlug: string; studentId: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const loader = useCallback(() => listTeachingStudentPackages(orgSlug, studentId, page, PAGE_SIZE), [orgSlug, studentId, page]);
  const packages = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [student, setStudent] = useState<TeachingStudent | null>(null);
  const [products, setProducts] = useState<TeachingPackageProduct[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'package:manage');

  useEffect(() => {
    let cancelled = false;
    void getTeachingStudent(orgSlug, studentId).then((value) => {
      if (!cancelled) setStudent(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setLoadError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [orgSlug, studentId, t]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    void listTeachingPackageProducts(orgSlug, 1, PRODUCT_OPTION_LIMIT).then((result) => {
      if (!cancelled) { setProducts(result.items); setProductTotal(result.total); }
    }).catch((reason: unknown) => {
      if (!cancelled) setLoadError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [canManage, orgSlug, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const sourceSystem = String(data.get('sourceSystem') ?? '').trim() || null;
    const sourceRef = String(data.get('sourceRef') ?? '').trim() || null;
    const sourceLineRef = String(data.get('sourceLineRef') ?? '').trim() || null;
    const validFromLocal = String(data.get('validFrom') ?? '').trim();
    const acquisitionTypeValue = String(data.get('acquisitionType') ?? '');
    const acquisitionType = acquisitionTypeValue === 'purchase' || acquisitionTypeValue === 'migration'
      ? acquisitionTypeValue
      : 'grant';
    if ((sourceSystem === null) !== (sourceRef === null)) {
      setMutationError(t('来源系统和来源单号必须同时填写。', 'Source system and source reference must be provided together.'));
      return;
    }
    if (sourceLineRef && !sourceSystem) {
      setMutationError(t('填写来源行号前，请先填写来源系统和来源单号。', 'Provide source system and source reference before a source line reference.'));
      return;
    }
    const validFrom = validFromLocal ? new Date(validFromLocal) : null;
    if (validFrom && Number.isNaN(validFrom.getTime())) {
      setMutationError(t('生效时间无效。', 'Valid-from time is invalid.'));
      return;
    }
    setSubmitting(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingStudentPackage(orgSlug, studentId, {
        productId: String(data.get('productId') ?? ''),
        acquisitionType,
        ...(validFrom ? { validFrom: validFrom.toISOString() } : {}),
        sourceSystem,
        sourceRef,
        sourceLineRef,
      }, operationKey.get());
      form.reset();
      operationKey.reset();
      packages.reload();
      setMessage(t('课包已发放。', 'Package issued.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <MutationMessage message={loadError} error />;
  if (!student) return <p aria-busy="true">{t('正在加载学员…', 'Loading student…')}</p>;

  return (
    <>
      <h2>{t(`${student.displayName}的课包`, `${student.displayName}'s packages`)}</h2>
      <p className="org-lead">{t('余额直接来自服务端课时账本；历史页不会自行推算累计余额。', 'Balances come directly from the server ledger; history pages do not invent running balances.')}</p>
      <AppLink href={`/org/${orgSlug}/students/${studentId}`} prefetch={false}>{t('查看学员资料', 'View student profile')}</AppLink>

      {packages.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : packages.error ? (
        <MutationMessage message={packages.error} error />
      ) : !packages.result?.items.length ? (
        <p className="org-empty">{t('该学员还没有课包。', 'This student has no packages yet.')}</p>
      ) : (
        <div className="org-list">
          {packages.result.items.map((item) => <StudentPackageRow key={item.id} orgSlug={orgSlug} item={item} />)}
        </div>
      )}
      {packages.result && <TeachingPagination page={packages.result.page} pageSize={packages.result.pageSize} total={packages.result.total} baseHref={`/org/${orgSlug}/students/${studentId}/packages`} />}

      {canManage && student.status === 'active' && (
        <section className="org-section">
          <h2>{t('发放课包', 'Issue package')}</h2>
          <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
            <fieldset disabled={submitting}>
              <label className="org-field-wide">{t('课包产品', 'Package product')}
                <select name="productId" required defaultValue="">
                  <option value="" disabled>{t('请选择', 'Select one')}</option>
                  {products.filter((product) => product.status === 'active').map((product) => (
                    <option value={product.id} key={product.id}>{product.name} ({product.totalCredits} {product.creditUnit === 'minute' ? t('分钟', 'minutes') : t('课时', 'lessons')})</option>
                  ))}
                </select>
              </label>
              <label>{t('发放类型', 'Acquisition type')}
                <select name="acquisitionType" defaultValue="grant">
                  <option value="grant">{t('赠送 / 管理员发放', 'Grant')}</option>
                  <option value="purchase">{t('购买登记', 'Purchase')}</option>
                  <option value="migration">{t('历史迁移', 'Migration')}</option>
                </select>
              </label>
              <label>{t('生效时间（可选）', 'Valid from (optional)')}<input name="validFrom" type="datetime-local" /></label>
              <label>{t('来源系统（可选）', 'Source system (optional)')}<input name="sourceSystem" maxLength={80} /></label>
              <label>{t('来源单号（与来源系统成对）', 'Source reference (with source system)')}<input name="sourceRef" maxLength={160} /></label>
              <label className="org-field-wide">{t('来源行号（可选）', 'Source line reference (optional)')}<input name="sourceLineRef" maxLength={160} /></label>
              {productTotal > products.length && <p className="org-help org-field-wide">{t('这里只显示前 100 个产品。', 'Only the first 100 products are shown.')}</p>}
              <div className="org-form-actions"><button type="submit" disabled={!products.some((product) => product.status === 'active')}>{submitting ? t('发放中…', 'Issuing…') : t('发放课包', 'Issue package')}</button></div>
            </fieldset>
            <MutationMessage message={mutationError || message} error={!!mutationError} />
          </form>
        </section>
      )}
    </>
  );
}

function StudentPackageRow({ orgSlug, item }: { orgSlug: string; item: TeachingStudentPackage }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const loader = useCallback(
    () => open
      ? listTeachingStudentPackageLedger(orgSlug, item.id, page, PAGE_SIZE)
      : Promise.resolve({ items: [], total: 0, page, pageSize: PAGE_SIZE }),
    [item.id, open, orgSlug, page],
  );
  const ledger = useTeachingPage(loader);

  return (
    <div className="org-row">
      <div className="org-row-main">
        <div className="org-row-title">{item.productName}</div>
        <div className="org-row-meta">
          {t(`剩余 ${item.remainingCredits} / ${item.entitledCredits}`, `${item.remainingCredits} / ${item.entitledCredits} remaining`)} / {entityStatusLabel(item.status, t)}
          {item.validUntil ? ` / ${t('有效至', 'Valid until')} ${new Date(item.validUntil).toLocaleDateString()}` : ''}
        </div>
        <button type="button" className="org-text-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? t('收起流水', 'Hide ledger') : t('查看流水', 'View ledger')}
        </button>
        {open && (
          <div className="org-stack">
            {ledger.loading ? <p aria-busy="true">{t('正在加载流水…', 'Loading ledger…')}</p> : ledger.error ? (
              <MutationMessage message={ledger.error} error />
            ) : !ledger.result?.items.length ? (
              <p className="org-empty">{t('暂无流水。', 'No ledger entries.')}</p>
            ) : (
              <ol className="org-ledger">
                {ledger.result.items.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</strong> {entry.entryType}
                    <span className="org-row-meta"> {new Date(entry.createdAt).toLocaleString()}{entry.reason ? ` / ${entry.reason}` : ''}</span>
                  </li>
                ))}
              </ol>
            )}
            {ledger.result && Math.ceil(ledger.result.total / ledger.result.pageSize) > 1 && (
              <div className="org-compact-row">
                <button type="button" className="org-text-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t('上一页', 'Previous')}</button>
                <span>{t(`第 ${page} 页`, `Page ${page}`)}</span>
                <button type="button" className="org-text-button" disabled={page * ledger.result.pageSize >= ledger.result.total} onClick={() => setPage((value) => value + 1)}>{t('下一页', 'Next')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
