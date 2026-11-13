'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { loadPlatformMembershipPlans, loadPlatformMemberships } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformMembership, PlatformMembershipPlan } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { type CommonProps } from './PlatformActionTypes';

const EMPTY_ENTITIES: PlatformEntity[] = [];

function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function membershipPlanFromEntity(entity: PlatformEntity): PlatformMembershipPlan | null {
  const data = entity.data;
  if (!data || typeof data.id !== 'string' || typeof data.slug !== 'string'
    || typeof data.nameZh !== 'string' || typeof data.nameEn !== 'string'
    || !['day', 'month', 'year', 'lifetime'].includes(String(data.periodUnit))
    || typeof data.periodCount !== 'number' || typeof data.amountMinor !== 'number'
    || typeof data.currency !== 'string' || data.status !== 'active') return null;
  return {
    id: data.id,
    slug: data.slug,
    nameZh: data.nameZh,
    nameEn: data.nameEn,
    descriptionZh: typeof data.descriptionZh === 'string' ? data.descriptionZh : null,
    descriptionEn: typeof data.descriptionEn === 'string' ? data.descriptionEn : null,
    periodUnit: data.periodUnit as PlatformMembershipPlan['periodUnit'],
    periodCount: data.periodCount,
    amountMinor: data.amountMinor,
    currency: data.currency,
    status: 'active',
  };
}

function membershipFromEntity(entity: PlatformEntity): PlatformMembership | null {
  const data = entity.data;
  if (!data || typeof data.id !== 'string' || typeof data.planId !== 'string'
    || typeof data.planSlug !== 'string' || typeof data.planNameZh !== 'string'
    || typeof data.planNameEn !== 'string' || typeof data.isActive !== 'boolean'
    || typeof data.validFrom !== 'string'
    || !['active', 'expired', 'cancelled', 'revoked'].includes(String(data.status))) return null;
  return {
    id: data.id,
    planId: data.planId,
    planSlug: data.planSlug,
    planNameZh: data.planNameZh,
    planNameEn: data.planNameEn,
    status: data.status as PlatformMembership['status'],
    isActive: data.isActive,
    validFrom: data.validFrom,
    validUntil: typeof data.validUntil === 'string' ? data.validUntil : null,
  };
}

export function PlatformMembershipCatalog({ definition, entities, busy, runAction }: CommonProps) {
  const t = useT();
  const user = useAuthUser();
  const routeEntities = entities ?? EMPTY_ENTITIES;
  const [plans, setPlans] = useState<PlatformMembershipPlan[] | null>(null);
  const [memberships, setMemberships] = useState<PlatformMembership[] | null>(null);
  const [planError, setPlanError] = useState<Error | null>(null);
  const [membershipError, setMembershipError] = useState<Error | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPlanError(null);
    if (definition.id === 'membership') {
      setPlans(routeEntities.map(membershipPlanFromEntity).filter((plan): plan is PlatformMembershipPlan => plan !== null));
    } else {
      setPlans(null);
      void loadPlatformMembershipPlans(controller.signal)
        .then(value => { if (!controller.signal.aborted) setPlans(value); })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setPlanError(reason instanceof Error ? reason : new Error(String(reason)));
        });
    }
    return () => controller.abort();
  }, [definition.id, revision, routeEntities]);
  useEffect(() => {
    setMembershipError(null);
    if (definition.id === 'me-membership') {
      setMemberships(routeEntities.map(membershipFromEntity).filter((membership): membership is PlatformMembership => membership !== null));
      return;
    }
    if (!user) {
      setMemberships([]);
      return;
    }
    const controller = new AbortController();
    setMemberships(null);
    void loadPlatformMemberships(controller.signal)
      .then(value => { if (!controller.signal.aborted) setMemberships(value); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setMembershipError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, [definition.id, revision, routeEntities, user]);
  const activePlanIds = new Set((memberships ?? []).filter((membership) => membership.isActive).map((membership) => membership.planId));
  const purchase = async (plan: PlatformMembershipPlan) => {
    const response = await runAction('create-order', undefined, {
      sellableType: 'platform_membership',
      sellableId: plan.id,
      quantity: 1,
    });
    if (typeof response?.id === 'string') setCreatedOrderId(response.id);
  };
  return (
    <div className="platform-domain-stack">
      {definition.id === 'me-membership' ? (
        <section className="platform-domain-actions">
          <h2>{t('当前课程会员', 'Current course memberships')}</h2>
          {memberships === null ? <PlatformState kind="loading" /> : memberships.length === 0 ? <PlatformState kind="empty" message={t('当前没有课程会员，可从下面的套餐开始购买。', 'You do not have a course membership yet. Choose a plan below to get started.')} /> : (
            <div className="platform-detail-list">
              {memberships.map((membership) => (
                <div key={membership.id}>
                  <strong>{t(membership.planNameZh, membership.planNameEn)}</strong>
                  <span>{membership.isActive ? t('生效中', 'Active') : membership.status === 'active' && Date.parse(membership.validFrom) > Date.now() ? t('尚未生效', 'Not active yet') : t('已失效', 'Inactive')}</span>
                  <span>{t('有效期', 'Validity')}: {membership.validFrom.slice(0, 10)} – {membership.validUntil?.slice(0, 10) ?? t('永久', 'Lifetime')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
      <section className="platform-domain-actions">
        {definition.id !== 'membership' ? <h2>{t('课程权益套餐', 'Course entitlement plans')}</h2> : null}
        {membershipError ? <PlatformState kind="error" message={t('暂时无法确认现有会员状态，购买操作已停用。', 'Your current membership status could not be confirmed, so purchasing is temporarily disabled.')} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {planError ? <PlatformState kind="error" message={planError.message} onRetry={() => setRevision((value) => value + 1)} /> : plans === null ? <PlatformState kind="loading" /> : plans.length === 0 ? <PlatformState kind="empty" message={t('当前没有在售课程权益套餐。', 'There are no course entitlement plans on sale.')} /> : (
          <div className="platform-detail-list">
            {plans.map((plan) => {
              const active = activePlanIds.has(plan.id);
              const name = t(plan.nameZh, plan.nameEn);
              const description = t(plan.descriptionZh ?? '', plan.descriptionEn ?? '');
              const period = plan.periodUnit === 'lifetime'
                ? t('永久', 'Lifetime')
                : plan.periodUnit === 'day'
                  ? t(`${plan.periodCount} 天`, `${plan.periodCount} day${plan.periodCount === 1 ? '' : 's'}`)
                  : plan.periodUnit === 'month'
                    ? t(`${plan.periodCount} 个月`, `${plan.periodCount} month${plan.periodCount === 1 ? '' : 's'}`)
                    : t(`${plan.periodCount} 年`, `${plan.periodCount} year${plan.periodCount === 1 ? '' : 's'}`);
              return (
                <div key={plan.id}>
                  <strong>{name}</strong>
                  {description ? <span>{description}</span> : null}
                  <span>{period}　{formatMinor(plan.amountMinor, plan.currency)}</span>
                  {user ? (
                    <button
                      type="button"
                      className="platform-button platform-button-primary"
                      disabled={busy === 'create-order' || memberships === null || membershipError !== null}
                      onClick={() => { void purchase(plan); }}
                    >
                      {busy === 'create-order' ? t('处理中…', 'Working…') : active ? t('续期', 'Renew') : t('购买', 'Purchase')}
                    </button>
                  ) : <AppLink className="platform-button platform-button-primary" href="/platform/login" prefetch={false}>{t('登录后购买', 'Sign in to purchase')}</AppLink>}
                </div>
              );
            })}
          </div>
        )}
        {createdOrderId ? <AppLink className="platform-button" href={`/platform/orders/${encodeURIComponent(createdOrderId)}`} prefetch={false}>{t('继续支付新订单', 'Continue to payment')}</AppLink> : null}
      </section>
    </div>
  );
}
