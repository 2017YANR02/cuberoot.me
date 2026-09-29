'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { AppleMembershipProduct, AppleMembershipProductId, AppleMembershipRequest } from '@cuberoot/shared/apple-membership';
import { requestAppleMembership, useAppleMembershipAvailable } from '@/lib/apple-membership-bridge';
import { useAuthStore } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import AppLink from '@/components/AppLink';

export default function AppleMembership({ refresh, benefits }: { refresh: () => void; benefits: ReactNode }) {
  const available = useAppleMembershipAvailable();
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const [products, setProducts] = useState<AppleMembershipProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setProducts([]);
    if (!available || !user?.uid) return;
    let current = true;
    requestAppleMembership('products', user.uid).then(result => {
      if (!current) return;
      if (result.status === 'success') setProducts(result.products ?? []);
      else setMessage(tr({ zh: 'App Store 商品暂不可用，请稍后重试。', en: 'App Store products are unavailable. Please retry later.' }));
    }).catch(() => { if (current) setMessage(tr({ zh: '未能连接 App Store，请稍后重试。', en: 'Could not connect to the App Store. Please retry.' })); });
    return () => { current = false; };
  }, [available, user?.uid, attempt]);
  async function run(action: AppleMembershipRequest['action'], productId?: AppleMembershipProductId) {
    if (busy || !user?.uid) return;
    setBusy(true); setMessage('');
    try {
      const result = await requestAppleMembership(action, user.uid, productId);
      if (result.status === 'success') { refresh(); setMessage(tr({ zh: '已更新购买状态。', en: 'Purchase status updated.' })); }
      if (result.status === 'pending') setMessage(tr({ zh: '购买等待批准，批准后会自动更新权益。', en: 'Purchase is awaiting approval. Membership will update after approval.' }));
      if (result.status === 'error') throw new Error('Purchase not verified');
    } catch { setMessage(tr({ zh: '购买状态暂未确认。请使用恢复购买或稍后重试，无需再次付款。请确认 App 与网页登录的是同一个账号。', en: 'Purchase status is not confirmed. Restore purchases or retry later; do not pay again. Check that the app and this page use the same account.' })); }
    finally { setBusy(false); }
  }
  return <section>
    <h1>{tr({ zh: 'CubeRoot 个人会员', en: 'CubeRoot Personal Membership' })}</h1>
    <p>{tr({ zh: '月卡与年卡均为自动续费订阅，享有相同个人会员权益。', en: 'Monthly and yearly plans renew automatically and provide the same personal membership benefits.' })}</p>
    {benefits}
    <p>{tr({ zh: '包括会员徽章、会员功能及服务。网站与 Apple 的有效会员期并存，取较晚到期日，不叠加时长；已有会员请先核对到期时间，避免重复订阅。', en: 'Includes the member badge, member features and services. Website and Apple memberships run concurrently; access lasts until the later expiry date, without adding their durations. Check existing membership before subscribing.' })}</p>
    {!user ? <button className="mem-plan-cta" onClick={() => login()}>{tr({ zh: '登录后订阅', en: 'Sign in to subscribe' })}</button> : <>
      {!available && <p>{tr({ zh: '请更新 App 后使用 Apple 内购。', en: 'Update the app to use Apple purchases.' })}</p>}
      {available && products.length === 0 && <button disabled={busy} onClick={() => setAttempt(value => value + 1)}>{tr({ zh: '重新加载 App Store 商品', en: 'Reload App Store products' })}</button>}
      <div className="mem-plans">{products.map(product => <article key={product.id} className="mem-plan">
        <h2>{product.displayName}</h2><p>{product.displayPrice} / {tr(product.id.endsWith('.monthly') ? { zh: '月', en: 'month' } : { zh: '年', en: 'year' })}</p>
        <button className="mem-plan-cta" disabled={busy} onClick={() => void run('purchase', product.id)}>{tr({ zh: '自动续费订阅', en: 'Subscribe with auto-renewal' })}</button>
      </article>)}</div>
      <button disabled={busy || !available} onClick={() => void run('restore')}>{tr({ zh: '恢复购买', en: 'Restore purchases' })}</button>{' '}
      <button disabled={busy || !available} onClick={() => void run('manage')}>{tr({ zh: '管理／取消 Apple 订阅', en: 'Manage / cancel Apple subscriptions' })}</button>
    </>}
    <p role="status">{message}</p>
    <p>{tr({ zh: '费用由 Apple 账户收取。除非在当前周期结束至少 24 小时前取消，否则订阅将自动续费。取消后可使用至已付费周期结束。删除 CubeRoot 账号不会取消 Apple 订阅，请先在系统订阅管理中取消。', en: 'Payment is charged to your Apple account. Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends. Access continues through the paid period after cancellation. Deleting your CubeRoot account does not cancel your Apple subscription; cancel it in subscription management first.' })}</p>
    <nav className="mem-service-links"><AppLink href="/privacy">{tr({ zh: '隐私政策', en: 'Privacy Policy' })}</AppLink><a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer">{tr({ zh: '使用条款', en: 'Terms of Use' })}</a><AppLink href="/contact">{tr({ zh: '客服支持', en: 'Support' })}</AppLink></nav>
  </section>;
}
