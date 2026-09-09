'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { nextQuery, useOwnerKey } from '@/lib/auth-store';
import { cancelMySubscription, listMySubscriptions, type MembershipSubscription, type MembershipSubscriptions } from '@/lib/membership-api';
import { fmtDate, fmtPrice } from '@/lib/membership-format';
import '../membership.css';

function CancellationConfirmation({ subscription, onClose, onConfirm }: {
  subscription: MembershipSubscription;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} className="mem-cancel-dialog" aria-labelledby="mem-cancel-title" aria-describedby="mem-cancel-description" onCancel={onClose}>
      <h2 id="mem-cancel-title">{t('确认取消自动续费？', 'Cancel auto-renewal?')}</h2>
      <p>{fmtPrice(subscription.priceCents, subscription.currency)} / {subscription.periodCount} {subscription.period === 'year' ? t('年', 'year(s)') : t('个月', 'month(s)')}</p>
      <p id="mem-cancel-description">{t('确认后将向微信申请解除此扣款授权。以微信确认结果为准，确认取消后不再发起后续续费扣款。已购买权益保留至已付服务期结束，本操作不会自动退款。', 'We will ask WeChat to revoke this debit authorization. Cancellation takes effect when WeChat confirms it, and no further renewal charges will be initiated. Paid benefits remain until the paid period ends. This does not issue a refund.')}</p>
      <div className="mem-subscription-actions">
        <button type="button" className="mem-contact-save" onClick={onConfirm}>{t('确认取消自动续费', 'Confirm cancellation')}</button>
        <button type="button" className="mem-contact-save" onClick={onClose}>{t('暂不取消', 'Keep auto-renewal')}</button>
      </div>
    </dialog>
  );
}

// Remounted per authenticated owner: another account never renders the previous account's records.
function SubscriptionManager() {
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
        ...current, subscriptions: current.subscriptions.map((item) => item.id === subscription.id ? result.subscription : item),
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
        <button type="button" className="mem-contact-save" disabled={loading || busyId !== null} onClick={() => void refresh()}>{t('刷新签约状态', 'Refresh authorization status')}</button>
      </div>
      {loading && <p role="status">{t('正在查询签约状态…', 'Checking authorization status…')}</p>}
      {loadFailed && <p role="alert">{t('暂时无法查询最新状态，请重试。当前结果不能用于确认微信授权已取消。', 'The latest status could not be retrieved. Please retry. The current result cannot confirm that WeChat authorization has been cancelled.')}</p>}
      {cancelFailed && <p role="alert">{t('取消请求未得到确认。请以下方最新状态为准；若仍未取消，可刷新或重试取消。', 'The cancellation request was not confirmed. Check the latest status below; if it is still not cancelled, refresh or retry cancellation.')}</p>}
      {data && !data.managementAvailable && <p role="status">{t('本站微信退订服务暂不可用，请稍后重试；也可在微信支付的对应扣费服务中解除授权。', 'WeChat cancellation through this site is temporarily unavailable. Retry later, or revoke authorization in the corresponding WeChat Pay debit service.')}</p>}
      {data?.subscriptions.length === 0 && <p>{t('本站暂无与你当前账号关联的签约记录。这不代表微信中不存在扣款授权；如微信中有相关服务，请在微信核对。', 'There are no subscription records linked to your current account on this site. This does not establish that no debit authorization exists in WeChat. Check any relevant service in WeChat.')}</p>}
      {data?.subscriptions.map((subscription) => (
        <section className="mem-subscription" key={subscription.id} aria-label={subscription.period === 'year' ? t('连续包年', 'Annual auto-renewal') : t('连续包月', 'Monthly auto-renewal')}>
          <h2>{subscription.period === 'year' ? t('连续包年', 'Annual auto-renewal') : t('连续包月', 'Monthly auto-renewal')}</h2>
          <p>{fmtPrice(subscription.priceCents, subscription.currency)} / {subscription.periodCount} {subscription.period === 'year' ? t('年', 'year(s)') : t('个月', 'month(s)')}</p>
          <p role="status">{subscription.state === 'terminated'
            ? t('自动续费已取消', 'Auto-renewal cancelled')
            : subscription.cancellationRequested
              ? t('取消申请已提交，等待微信确认，尚未确认取消成功', 'Cancellation requested. Awaiting WeChat confirmation; cancellation is not yet confirmed.')
              : subscription.state === 'active' ? t('自动续费已签约', 'Auto-renewal authorized') : t('签约待确认', 'Authorization pending confirmation')}</p>
          {subscription.syncStatus === 'unavailable' && <p>{t('暂未取得微信最新状态。以下为本站保留的记录，请刷新核实。', 'The latest WeChat status is unavailable. This is the record retained by the site; refresh to verify.')}</p>}
          {subscription.verifiedAt && <p>{t('最近核实日期：', 'Last verified: ')}{fmtDate(subscription.verifiedAt)}</p>}
          {subscription.state !== 'terminated' && <button type="button" className="mem-contact-save" disabled={loading || busyId !== null || !data.managementAvailable} onClick={() => setConfirm(subscription)}>
            {busyId === subscription.id ? t('正在申请取消…', 'Requesting cancellation…') : subscription.cancellationRequested ? t('重试取消自动续费', 'Retry cancellation') : t('取消自动续费', 'Cancel auto-renewal')}
          </button>}
        </section>
      ))}
      {confirm && <CancellationConfirmation subscription={confirm} onClose={() => setConfirm(null)} onConfirm={() => void cancel(confirm)} />}
    </section>
  );
}

export default function SubscriptionPage() {
  const t = useT();
  const owner = useOwnerKey();
  const pathname = usePathname();
  return (
    <main className="mem-page mem-service-document">
      <h1>{t('管理自动续费', 'Manage auto-renewal')}</h1>
      <p>{t('新签约尚未开放。当前单次购买的月度、年度会员不会自动续费，无需解约。', 'New subscriptions are not available yet. One-time monthly and annual purchases do not auto-renew and require no cancellation.')}</p>
      {owner ? <SubscriptionManager key={owner} /> : <p><AppLink href={`/account${nextQuery(pathname)}`} prefetch={false}>{t('登录后管理自动续费', 'Sign in to manage auto-renewal')}</AppLink></p>}
      <p>{t('取消自动续费与退款分开处理；已购买权益可使用至已付服务期结束。若发现取消后扣款，请保留订单号并联系客服核对。', 'Cancellation and refunds are handled separately. Purchased benefits remain available until the paid service period ends. If a charge appears after cancellation, keep the order number and contact support.')}</p>
      <nav className="mem-service-links" aria-label={t('会员服务', 'Membership services')}>
        <AppLink href="/contact" prefetch={false}>{t('联系会员客服', 'Contact membership support')}</AppLink>
        <AppLink href="/membership/renewal-terms" prefetch={false}>{t('自动续费服务协议', 'Auto-renewal Agreement')}</AppLink>
        <AppLink href="/membership" prefetch={false}>{t('会员权益与有效期', 'Membership benefits and validity')}</AppLink>
      </nav>
    </main>
  );
}
