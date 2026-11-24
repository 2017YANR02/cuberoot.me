'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PageBackLink from '@/components/PageBackLink';
import AppLink from '@/components/AppLink';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { MEMBERSHIP_COPY } from '@/lib/membership-copy';
import { useT } from '@/hooks/useT';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { nextQuery, useAuthUser, useOwnerKey } from '@/lib/auth-store';
import { cancelMySubscription, listMySubscriptions, type MembershipSubscription, type MembershipSubscriptions } from '@/lib/membership-api';
import { fmtDate, fmtPrice } from '@/lib/membership-format';
import { installedMembershipStore, useStoreMembershipAvailable } from '@/lib/store-membership-bridge';
import { useWebMembershipAvailable } from '@/lib/web-membership-bridge';
import { isMiniProgramCommerceRestricted } from '@/lib/miniprogram-bridge';
import StoreMembership, { storeSubscriptionUrls } from '../AppleMembership';
import '../membership.css';

function isPendingCheckout(subscription: MembershipSubscription) {
  return subscription.billingMethod === 'checkout' && subscription.billingStatus === 'submitted' && subscription.state === 'pending';
}

function CancellationConfirmation({ subscription, onClose, onConfirm }: {
  subscription: MembershipSubscription;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const backdrop = useModalBackdrop(onClose);
  const checkout = isPendingCheckout(subscription);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} className="mem-cancel-dialog" aria-labelledby="mem-cancel-title" aria-describedby="mem-cancel-description" onCancel={onClose} {...backdrop}>
      <div className="mem-cancel-body">
      <h2 id="mem-cancel-title">{checkout ? t('关闭未付款订单？', 'Close this unpaid order?') : t('确认取消自动续费？', 'Cancel auto-renewal?')}</h2>
      <p>{fmtPrice(subscription.priceCents, subscription.currency)} / {subscription.periodCount} {subscription.period === 'year' ? t('年', 'year(s)') : t('个月', 'month(s)')}</p>
      <p id="mem-cancel-description">{checkout
        ? t('微信确认关单后可重新购买。新订单可能需等几分钟。', 'You can buy again after WeChat closes the order. New orders may take a few minutes.')
        : t('微信确认后停止续费。权益保留至到期，退款需另行申请。', 'Renewal stops once WeChat confirms. Access lasts through the paid period. Refunds are handled separately.')}</p>
      <div className="mem-subscription-actions">
        <button type="button" className="mem-contact-save" onClick={onConfirm}>{checkout ? t('确认关闭订单', 'Confirm order closure') : t('确认取消自动续费', 'Confirm cancellation')}</button>
        <button type="button" className="mem-contact-save" onClick={onClose}>{checkout ? t('保留订单', 'Keep order') : t('暂不取消', 'Keep auto-renewal')}</button>
      </div>
      </div>
    </dialog>
  );
}

// Remounted per authenticated owner: another account never renders the previous account's records.
function SubscriptionManager({ allowCheckoutLinks = true }: { allowCheckoutLinks?: boolean }) {
  const t = useT();
  const [data, setData] = useState<MembershipSubscriptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<MembershipSubscription | null>(null);
  const alive = useRef(false);
  const lookup = useRef<AbortController | null>(null);
  const cancellation = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setLoading(true);
    setLoadFailed(false);
    try {
      const next = await listMySubscriptions(controller.signal);
      if (alive.current && !controller.signal.aborted) setData(next);
    } catch {
      if (alive.current && !controller.signal.aborted) setLoadFailed(true);
    } finally {
      if (alive.current && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      lookup.current?.abort();
      cancellation.current?.abort();
    };
  }, [refresh]);

  async function cancel(subscription: MembershipSubscription) {
    // Lock before awaiting: duplicate clicks, missing configuration and terminal records cannot submit.
    if (cancellation.current || !data?.managementAvailable || subscription.state === 'terminated') return;
    const controller = new AbortController();
    cancellation.current = controller;
    setConfirm(null);
    setBusyId(subscription.id);
    setCancelFailed(false);
    try {
      const result = await cancelMySubscription(subscription.id, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setData((current) => current && ({
        ...current, subscriptions: current.subscriptions.map((item) => item.id === subscription.id ? { ...item, ...result.subscription } : item),
      }));
    } catch {
      if (alive.current && !controller.signal.aborted) setCancelFailed(true);
    } finally {
      if (alive.current && !controller.signal.aborted) {
        cancellation.current = null;
        setBusyId(null);
        // A timed-out cancellation may still reach WeChat. Query before asking the user to retry.
        void refresh();
      }
    }
  }

  return (
    <section aria-label={t('我的自动续费', 'My subscriptions')} aria-busy={loading || busyId !== null}>
      <div className="mem-subscription-actions">
        <button type="button" className="mem-contact-save" disabled={loading || busyId !== null} onClick={() => void refresh()}>{t('刷新状态', 'Refresh status')}</button>
      </div>
      {loading && <p role="status">{t('正在查询订阅…', 'Checking subscriptions…')}</p>}
      {loadFailed && <p role="alert">{t('最新状态查询失败，请刷新核实。', 'Could not check the latest status. Refresh to verify.')}</p>}
      {cancelFailed && <p role="alert">{t('取消尚未确认，请刷新核实。', 'Cancellation is unconfirmed. Refresh to verify.')}</p>}
      {data && !data.managementAvailable && <p role="status">{t('暂无法在此取消，可在微信支付中解除授权。', 'Cancellation is unavailable here. Manage the authorization in WeChat Pay.')}</p>}
      {data?.subscriptions.length === 0 && <p>{t('当前账号暂无网站订阅记录。扣款授权可在微信支付核对。', 'No website subscriptions for this account. Check debit authorizations in WeChat Pay.')}</p>}
      {data?.subscriptions.map((subscription) => {
        const checkout = isPendingCheckout(subscription);
        const checkoutEnded = subscription.billingMethod === 'checkout' && subscription.billingStatus === 'failed' && subscription.state === 'terminated';
        const label = subscription.period === 'year' ? t('Pro 连续包年', 'Pro annual auto-renewal') : t('Pro 连续包月', 'Pro monthly auto-renewal');
        const status = checkoutEnded ? t('首笔付款未完成，订单已结束', 'Order ended before the first payment completed')
          : checkout ? (subscription.cancellationRequested
            ? t('正在等待微信确认关单', 'Waiting for WeChat to confirm order closure')
            : t('首笔付款待完成', 'First payment pending'))
            : subscription.state === 'terminated' ? t('自动续费已取消', 'Auto-renewal cancelled')
              : subscription.cancellationRequested ? t('等待微信确认取消', 'Awaiting cancellation confirmation from WeChat')
                : subscription.state === 'active' ? t('自动续费已签约', 'Auto-renewal authorized') : t('签约待确认', 'Authorization pending confirmation');
        return <section className="mem-subscription" key={subscription.id} aria-label={label}>
          <h2>{label}</h2>
          <p>{fmtPrice(subscription.priceCents, subscription.currency)} / {subscription.periodCount} {subscription.period === 'year' ? t('年', 'year(s)') : t('个月', 'month(s)')}</p>
          <p role="status">{status}</p>
          {!checkout && subscription.syncStatus === 'unavailable' && <p>{t('暂未取得微信最新状态。以下为本站保留的记录，请刷新核实。', 'The latest WeChat status is unavailable. This is the record retained by the site; refresh to verify.')}</p>}
          {subscription.verifiedAt && <p>{t('最近核实日期：', 'Last verified: ')}{fmtDate(subscription.verifiedAt)}</p>}
          {checkout && (subscription.cancellationRequested
            ? <p>{t('请等微信确认关单后再重新购买。你可以刷新查看结果。', 'Wait for WeChat to confirm closure before starting a new purchase. Refresh to check the result.')}</p>
            : allowCheckoutLinks && <p>{t('返回会员页选择同一套餐继续付款。', 'Select the same plan on the membership page to continue.')} <AppLink href="/membership" prefetch={false}>{t('返回会员页', 'Return to membership')}</AppLink></p>)}
          {!checkout && subscription.billingStatus === 'submitted' && (subscription.billingMethod !== 'checkout' || !subscription.cancellationRequested) && subscription.state !== 'terminated' && <p>{subscription.billingMethod === 'checkout'
            ? t('首笔付款尚未确认，可刷新查看付款结果。', 'The first payment is not confirmed. Refresh to check the payment status.')
            : t('扣款处理中，可能包含微信通知后的 24 小时等待期。到账前不会延长会员，请勿重复购买。', 'Debit pending, possibly within WeChat’s 24-hour notice period. Membership extends after confirmed payment. Avoid purchasing again while this is pending.')}</p>}
          {subscription.billingStatus === 'paid' && <p>{t('本期付款已到账，会员权益已发放。', 'Payment for this period is confirmed and membership benefits have been granted.')}</p>}
          {subscription.billingMethod === 'checkout' && subscription.billingStatus === 'paid' && subscription.state === 'pending' && <p>{t('自动续费尚未确认。若付款时未开启自动续费，本次仅开通已付会员。', 'Auto-renewal is not confirmed. If you left it off at checkout, only the paid membership period is active.')}</p>}
          {checkoutEnded && allowCheckoutLinks && <p><AppLink href="/membership" prefetch={false}>{t('返回会员页重新购买', 'Return to membership to try again')}</AppLink></p>}
          {!checkoutEnded && subscription.billingStatus === 'failed' && <p>{t('本期扣款未成功，未延长会员。请联系客服核对后处理，系统不会重复发起本期扣款。', 'This charge failed and membership was not extended. Contact support to reconcile it; the system will not submit this cycle again automatically.')}</p>}
          {subscription.state !== 'terminated' && <button type="button" className="mem-contact-save" disabled={loading || busyId !== null || !data.managementAvailable} onClick={() => setConfirm(subscription)}>
            {busyId === subscription.id ? t('正在申请取消…', 'Requesting cancellation…')
              : checkout ? (subscription.cancellationRequested ? t('重试关单', 'Retry closing order') : t('关闭付款订单', 'Close payment order'))
                : subscription.cancellationRequested ? t('重试取消自动续费', 'Retry cancellation') : t('取消自动续费', 'Cancel auto-renewal')}
          </button>}
        </section>
      })}
      {confirm && <CancellationConfirmation subscription={confirm} onClose={() => setConfirm(null)} onConfirm={() => void cancel(confirm)} />}
    </section>
  );
}

export default function SubscriptionPage() {
  const t = useT();
  const owner = useOwnerKey();
  const uid = useAuthUser()?.uid;
  const pathname = usePathname();
  const appleAvailable = useStoreMembershipAvailable('apple');
  const googleAvailable = useStoreMembershipAvailable('google');
  const directApp = useWebMembershipAvailable();
  const [websiteOwner, setWebsiteOwner] = useState<string | null>(null);
  const showWebsite = !!owner && websiteOwner === owner;
  const [commerceRestricted, setCommerceRestricted] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    void isMiniProgramCommerceRestricted().then(restricted => {
      if (current) setCommerceRestricted(restricted);
    });
    return () => { current = false; };
  }, []);
  const store = googleAvailable ? 'google' : appleAvailable ? 'apple' : commerceRestricted === false ? installedMembershipStore() : null;
  if (store) return <main className="mem-page">
    <StoreMembership key={`${store}:${uid ?? ''}`} store={store} manageOnly />
    {owner && <div className="mem-store-benefits">
      <MoreToggle expanded={showWebsite} onToggle={() => setWebsiteOwner(showWebsite ? null : owner)} aria-controls="mem-website-subscriptions">
        {t('管理已有的网站订阅', 'Manage existing website subscriptions')}
      </MoreToggle>
      <MoreTogglePanel id="mem-website-subscriptions" expanded={showWebsite}>
        {showWebsite && <SubscriptionManager key={owner} allowCheckoutLinks={false} />}
      </MoreTogglePanel>
    </div>}
  </main>;

  return (
    <main className="mem-page mem-service-document">
      <div className="page-back-heading"><PageBackLink label={t('返回', 'Back')} fallback="/membership" /><h1>{t(MEMBERSHIP_COPY.manage.zh, MEMBERSHIP_COPY.manage.en)}</h1></div>
      {commerceRestricted === null && <p role="status">{t('加载中…', 'Loading…')}</p>}
      {commerceRestricted === true && <p>{t('小程序内暂不提供订阅管理。', 'Subscription management is unavailable in the Mini Program.')}</p>}
      {commerceRestricted === false && <>
        <p>{t('商店订阅：', 'Store subscriptions: ')}
          {!directApp && <><a href={storeSubscriptionUrls.apple} target="_blank" rel="noreferrer">App Store</a>{' · '}</>}
          <a href={storeSubscriptionUrls.google} target="_blank" rel="noreferrer">Google Play</a>
        </p>
        <p>{t('在此管理通过微信支付开通的网站自动续费。', 'Manage website subscriptions billed through WeChat Pay.')}</p>
        {owner ? <SubscriptionManager key={owner} /> : <p><AppLink href={`/account${nextQuery(pathname)}`} prefetch={false}>{t('登录后管理自动续费', 'Sign in to manage auto-renewal')}</AppLink></p>}
      </>}
      {commerceRestricted === false && <p>{t('取消后权益保留至到期。', 'Access continues through the paid period after cancellation.')}</p>}
      <nav className="mem-service-links" aria-label={t('会员服务', 'Membership services')}>
        <AppLink href="/contact" prefetch={false}>{t('联系会员客服', 'Contact membership support')}</AppLink>
        <AppLink href="/membership/renewal-terms" prefetch={false}>{t(MEMBERSHIP_COPY.agreement.zh, MEMBERSHIP_COPY.agreement.en)}</AppLink>
        <AppLink href="/membership" prefetch={false}>{t('会员权益与有效期', 'Membership benefits and validity')}</AppLink>
      </nav>
    </main>
  );
}
