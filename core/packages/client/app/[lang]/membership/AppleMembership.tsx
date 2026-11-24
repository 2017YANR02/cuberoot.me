'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AppleMembershipProduct, AppleMembershipProductId, AppleMembershipRequest } from '@cuberoot/shared/apple-membership';
import { requestStoreMembership, useStoreMembershipAvailable, type MembershipStore } from '@/lib/store-membership-bridge';
import { useAuthUser, authActions, getAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import AppLink from '@/components/AppLink';
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
  const available = useStoreMembershipAvailable(store);
  const storeName = store === 'apple' ? 'App Store' : 'Google Play';
  const [catalog, setCatalog] = useState<{ uid: number; attempt: number; products: AppleMembershipProduct[] }>();
  const [action, setAction] = useState<AppleMembershipRequest['action']>();
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
  return (
    <section className="mem-store">
      <header className="mem-head">
        <h1 className="mem-title">{manageOnly
          ? tr({ zh: '管理订阅', en: 'Manage subscriptions' })
          : tr({ zh: 'CubeRoot 个人会员', en: 'CubeRoot Personal Membership' })}</h1>
      </header>
      {!manageOnly && uid && available && (products === undefined
        ? <p role="status">{tr({ zh: '正在加载商品…', en: 'Loading products…' })}</p>
        : products.length === 0
          ? <div className="mem-store-catalog-status">
            <p role="status">{tr({ zh: '订阅商品暂不可用。', en: 'Subscriptions are temporarily unavailable.' })}</p>
            <button type="button" className="mem-store-secondary" disabled={!!action} onClick={() => setAttempt(value => value + 1)}>
              {tr({ zh: '重新加载', en: 'Reload' })}
            </button>
          </div>
          : <>
            <div className="mem-plans">{products.map(product => <article key={product.id} className="mem-plan" data-site-surface="panel">
              <h2 className="mem-plan-name">{product.displayName}</h2>
              <p className="mem-plan-price"><span className="mem-plan-amount">{product.displayPrice}</span><span className="mem-plan-unit">/ {tr(product.id.endsWith('.monthly') ? { zh: '月', en: 'month' } : { zh: '年', en: 'year' })}</span></p>
              <button type="button" className="mem-plan-cta" disabled={!!action} onClick={() => void run('purchase', product.id)}>
                {tr(store === 'apple' ? { zh: '自动续费订阅', en: 'Subscribe with auto-renewal' } : { zh: '订阅', en: 'Subscribe' })}
              </button>
            </article>)}</div>
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
      <p className="mem-store-message" role="status">{action ? tr({ zh: '正在处理…', en: 'Processing…' }) : message}</p>
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
