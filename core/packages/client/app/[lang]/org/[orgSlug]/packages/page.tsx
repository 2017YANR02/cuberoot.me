'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import { createTeachingPackageProduct, listTeachingPackageProducts } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  TeachingPagination,
  teachingErrorMessage,
  useOperationKey,
  useTeachingPage,
} from '../../_components/OrgUi';

const PAGE_SIZE = 25;

function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

export default function OrganizationPackagesPage() {
  const params = useParams<{ orgSlug: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => <PackagesContent orgSlug={params.orgSlug} page={page} role={organization.role} />}
    </OrgWorkspace>
  );
}

function PackagesContent({ orgSlug, page, role }: { orgSlug: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const loader = useCallback(() => listTeachingPackageProducts(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const products = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'package:manage');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const code = String(data.get('code') ?? '').trim().toLowerCase();
    const name = String(data.get('name') ?? '').trim();
    const creditType = String(data.get('creditType') ?? '').trim().toLowerCase();
    const totalCredits = Number(data.get('totalCredits'));
    const rawValidityDays = String(data.get('validityDays') ?? '').trim();
    const validityDays = rawValidityDays ? Number(rawValidityDays) : null;
    const price = Number(data.get('price'));
    const priceAmountMinor = Math.round(price * 100);
    const currency = String(data.get('currency') ?? '').trim().toUpperCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code) || !name || name.length > 160 || !/^[a-z][a-z0-9_-]{0,63}$/.test(creditType)) {
      setMutationError(t('请填写有效的产品代码、名称和课时类型。', 'Enter a valid product code, name, and credit type.'));
      return;
    }
    if (!Number.isInteger(totalCredits) || totalCredits < 1 || totalCredits > 1_000_000
      || (validityDays !== null && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 36_500))
      || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(priceAmountMinor)
      || !/^[A-Z]{3}$/.test(currency)) {
      setMutationError(t('请检查课时数、有效期、价格和币种。', 'Check the credit count, validity, price, and currency.'));
      return;
    }
    setSubmitting(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingPackageProduct(orgSlug, {
        code,
        name,
        creditUnit: data.get('creditUnit') === 'minute' ? 'minute' : 'lesson',
        creditType,
        totalCredits,
        validityDays,
        priceAmountMinor,
        currency,
      }, operationKey.get());
      form.reset();
      operationKey.reset();
      products.reload();
      setMessage(t('课包产品已创建。', 'Package product created.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2>{t('课包', 'Packages')}</h2>
      <p className="org-lead">{t('在这里定义可发放给学员的课时产品。实际余额以学员课包和服务端流水为准。', 'Define credit products here. Student balances and the server ledger remain authoritative.')}</p>

      {products.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : products.error ? (
        <MutationMessage message={products.error} error />
      ) : !products.result?.items.length ? (
        <p className="org-empty">{t('还没有课包产品。', 'No package products yet.')}</p>
      ) : (
        <div className="org-list">
          {products.result.items.map((product) => (
            <div className="org-row" key={product.id}>
              <div className="org-row-main">
                <div className="org-row-title">{product.name}</div>
                <div className="org-row-meta">
                  {product.code} / {product.totalCredits} {product.creditUnit === 'minute' ? t('分钟', 'minutes') : t('课时', 'lessons')} / {formatMoney(product.priceAmountMinor, product.currency)}
                  {product.validityDays ? ` / ${product.validityDays} ${t('天有效', 'days valid')}` : ` / ${t('长期有效', 'no expiry')}`}
                </div>
              </div>
              <span className="org-status">{entityStatusLabel(product.status, t)}</span>
            </div>
          ))}
        </div>
      )}
      {products.result && <TeachingPagination page={products.result.page} pageSize={products.result.pageSize} total={products.result.total} baseHref={`/org/${orgSlug}/packages`} />}

      {canManage && (
        <section className="org-section">
          <h2>{t('新建课包产品', 'Create package product')}</h2>
          <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
            <fieldset disabled={submitting}>
              <label>{t('产品代码', 'Product code')}<input className="org-form-control" name="code" required maxLength={64} pattern="[a-z0-9][a-z0-9_-]{0,63}" autoCapitalize="none" /></label>
              <label>{t('产品名称', 'Product name')}<input className="org-form-control" name="name" required maxLength={160} /></label>
              <label>{t('计量单位', 'Credit unit')}
                <select className="org-form-control" name="creditUnit" defaultValue="lesson">
                  <option value="lesson">{t('课时', 'Lesson')}</option>
                  <option value="minute">{t('分钟', 'Minute')}</option>
                </select>
              </label>
              <label>{t('课时类型', 'Credit type')}<input className="org-form-control" name="creditType" required defaultValue="lesson" maxLength={64} pattern="[a-z][a-z0-9_-]{0,63}" autoCapitalize="none" /></label>
              <label>{t('总额度', 'Total credits')}<input className="org-form-control" name="totalCredits" type="number" required min={1} max={1_000_000} step={1} /></label>
              <label>{t('有效天数（留空为长期）', 'Validity days (blank for none)')}<input className="org-form-control" name="validityDays" type="number" min={1} max={36_500} step={1} /></label>
              <label>{t('售价', 'Price')}<input className="org-form-control" name="price" type="number" required min={0} max={9_000_000_000_000} step="0.01" /></label>
              <label>{t('币种', 'Currency')}<input className="org-form-control" name="currency" required defaultValue="CNY" minLength={3} maxLength={3} pattern="[A-Za-z]{3}" autoCapitalize="characters" /></label>
              <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('创建中…', 'Creating…') : t('新建课包', 'Create package')}</button></div>
            </fieldset>
            <MutationMessage message={mutationError || message} error={!!mutationError} />
          </form>
        </section>
      )}
    </>
  );
}
