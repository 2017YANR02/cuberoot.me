'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AppleMembershipProduct, AppleMembershipProductId, AppleMembershipRequest } from '@cuberoot/shared/apple-membership';
import { requestStoreMembership, useStoreMembershipAvailable, type MembershipStore } from '@/lib/store-membership-bridge';
import { useAuthUser, authActions, getAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import AppLink from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
import { annualStoreSavings } from '@/lib/membership-format';
import { useInstalledAccountDetailNavigation } from '@/lib/installed-shell-navigation';
import MembershipSkeleton from './MembershipSkeleton';
import PlanPicker from './PlanPicker';
import MoreToggle from '@/components/MoreToggle';

export const storeSubscriptionUrls = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: 'https://play.google.com/store/account/subscriptions?package=me.cuberoot.app',
};

export default function StoreMembership({ store, refresh, benefits, manageOnly = false }: {
  store: MembershipStore;
  refresh?: () => void;
  benefits?: ReactNode;
  manageOnly?: boolean;
}) {
  const user = useAuthUser();
  const hasAppBack = useInstalledAccountDetailNavigation() && !manageOnly;
  const available = useStoreMembershipAvailable(store);
  const storeName = store === 'apple' ? 'App Store' : 'Google Play';
  const [catalog, setCatalog] = useState<{ uid: number; attempt: number; products: AppleMembershipProduct[] }>();
  const [action, setAction] = useState<AppleMembershipRequest['action']>();
  const [selectedId, setSelectedId] = useState<AppleMembershipProductId>();
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const uid = user?.uid;

  useEffect(() => {
    if (manageOnly || !available || !uid) return;
    let current = true;
    async function loadProducts(userId: number) {
      let products: AppleMembershipProduct[] = [];
      try {
        const result = await requestStoreMembership(store, 'products', userId);
        if (result.status === 'success') products = result.products ?? [];
      } catch { /* Products can be retried independently of subscription actions. */ }
      if (current) setCatalog({ uid: userId, attempt, products });
    }
    void loadProducts(uid);
    return () => { current = false; };
  }, [available, uid, attempt, store, manageOnly]);

  async function run(nextAction: AppleMembershipRequest['action'], productId?: AppleMembershipProductId) {
    if (action || !uid) return;
    setAction(nextAction);
    setMessage('');
    try {
      const result = await requestStoreMembership(store, nextAction, uid, productId);
      if (getAuthUser()?.uid !== uid) return;
      if (result.status === 'success' && nextAction !== 'manage') {
        refresh?.();
        setMessage(nextAction === 'restore'
          ? tr({ zh: '已检查可恢复的购买。', en: 'Checked for purchases to restore.' })
          : tr({ zh: '购买已确认。', en: 'Purchase confirmed.' }));
      }
      if (result.status === 'pending') setMessage(tr({ zh: '购买待批准。', en: 'Purchase awaiting approval.' }));
      if (result.status === 'error') throw new Error('Store request failed');
    } catch {
      if (getAuthUser()?.uid !== uid) return;
      if (nextAction === 'manage') setMessage(tr({ zh: '无法打开订阅管理，请重试。', en: 'Could not open subscriptions. Try again.' }));
      else if (nextAction === 'restore') setMessage(tr({ zh: '恢复失败，请稍后重试。', en: 'Could not restore purchases. Try again later.' }));
      else setMessage(tr({ zh: '购买暂未确认。请先恢复购买，避免重复付款。', en: 'Purchase unconfirmed. Restore purchases before paying again.' }));
    } finally {
      setAction(undefined);
    }
  }

  const products = catalog && catalog.uid === uid && catalog.attempt === attempt ? catalog.products : undefined;
  const selected = products?.find(product => product.id === selectedId)
    ?? products?.find(product => product.id.endsWith('.monthly'))
    ?? products?.[0];
  const annualSavings = annualStoreSavings(
    products?.find(product => product.id.endsWith('.monthly'))?.displayPrice,
    products?.find(product => product.id.endsWith('.yearly'))?.displayPrice,
  );
  return (
    <section className="mem-store">
      <header className="mem-head">
        <div className="page-back-heading">
          {!hasAppBack && <PageBackLink label={tr({ zh: '返回', en: 'Back' })} fallback={manageOnly ? '/membership' : '/account'} />}
          <h1 className="mem-title">{manageOnly
            ? tr({ zh: '管理 Pro 订阅', en: 'Manage Pro subscriptions' })
            : 'CubeRoot Pro'}</h1>
        </div>
      </header>
      {!manageOnly && uid && available && (products === undefined
        ? <MembershipSkeleton store />
        : products.length === 0
          ? <div className="mem-store-catalog-status">
            <p role="status">{tr({ zh: '订阅商品暂不可用。', en: 'Subscriptions are temporarily unavailable.' })}</p>
            <button type="button" className="mem-store-secondary" disabled={!!action} onClick={() => setAttempt(value => value + 1)}>
              {tr({ zh: '重新加载', en: 'Reload' })}
            </button>
          </div>
          : <>
            <PlanPicker options={products.map(product => ({
              id: product.id, price: product.displayPrice,
              caption: tr(product.id.endsWith('.monthly') ? { zh: '按月计费', en: 'Billed monthly' } : { zh: '按年计费', en: 'Billed annually' }),
              savings: product.id.endsWith('.yearly') ? annualSavings : null,
            }))} selected={selected?.id} onSelect={setSelectedId} busy={!!action}
              onSubmit={() => selected && void run('purchase', selected.id)}
              submitLabel={action === 'purchase' ? tr({ zh: '正在处理…', en: 'Processing…' }) : tr({ zh: '订阅 Pro', en: 'Subscribe to Pro' })} />
            <p className="mem-foot-note">{store === 'apple'
              ? tr({ zh: '由 Apple 扣款，自动续费。请至少提前 24 小时取消，取消后权益保留至到期。', en: 'Billed by Apple and auto-renewed. Cancel at least 24 hours before renewal. Access continues through the paid period.' })
              : tr({ zh: '由 Google Play 扣款，自动续费。取消后权益保留至到期。', en: 'Billed by Google Play and auto-renewed. Access continues through the paid period after cancellation.' })}</p>
          </>)}
      {!uid && <button type="button" className="mem-store-secondary" onClick={() => authActions.login()}>{manageOnly
        ? tr({ zh: '登录以恢复购买', en: 'Sign in to restore purchases' })
        : tr({ zh: '登录后查看订阅', en: 'Sign in to view plans' })}</button>}
      {!available && uid && !manageOnly && <p role="status">{tr({ zh: '当前版本暂不支持内购。', en: 'In-app purchases are unavailable in this version.' })}</p>}
      <div className="mem-store-actions" aria-busy={!!action}>
        {available && uid && <button type="button" className="mem-store-secondary" disabled={!!action} onClick={() => void run('restore')}>{tr({ zh: '恢复购买', en: 'Restore purchases' })}</button>}
        {available && uid
          ? <button type="button" className="mem-store-secondary" disabled={!!action} onClick={() => void run('manage')}>{tr({ zh: '管理订阅', en: 'Manage subscriptions' })}</button>
          : <a className="mem-store-secondary" href={storeSubscriptionUrls[store]} target="_blank" rel="noreferrer">{storeName} · {tr({ zh: '管理订阅', en: 'Manage subscriptions' })}</a>}
      </div>
      <p className="mem-store-message" role="status">{action && action !== 'purchase' ? tr({ zh: '正在处理…', en: 'Processing…' }) : message}</p>
      {benefits && <details className="mem-store-benefits">
        <MoreToggle as="summary">{tr({ zh: '会员权益', en: 'Membership benefits' })}</MoreToggle>
        {benefits}
      </details>}
      <nav className="mem-service-links" aria-label={tr({ zh: '会员服务', en: 'Membership services' })}>
        {manageOnly && <AppLink href="/membership">{tr({ zh: '会员页', en: 'Membership' })}</AppLink>}
        <AppLink href="/privacy">{tr({ zh: '隐私政策', en: 'Privacy Policy' })}</AppLink>
        <a href={store === 'google' ? 'https://play.google.com/about/play-terms/' : 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'} target="_blank" rel="noreferrer">{tr({ zh: '使用条款', en: 'Terms of Use' })}</a>
        <AppLink href="/contact">{tr({ zh: '客服支持', en: 'Support' })}</AppLink>
      </nav>
    </section>
  );
}
