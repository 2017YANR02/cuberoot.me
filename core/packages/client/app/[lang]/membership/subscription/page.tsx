'use client';

import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import '../membership.css';

export default function SubscriptionPage() {
  const t = useT();
  return (
    <main className="mem-page mem-service-document">
      <h1>{t('管理自动续费', 'Manage auto-renewal')}</h1>
      <p role="status">{t('自动续费尚未开放', 'Auto-renewal is not available yet')}</p>
      <p>{t('本站尚未接通微信签约、合约查询及解约接口，因此本页目前不能查询或取消微信扣款授权。当前单次购买的月度、年度会员不会自动续费，无需解约。', 'WeChat authorization, contract lookup, and cancellation are not connected yet, so this page cannot currently query or cancel a WeChat debit authorization. Current one-time monthly and annual purchases do not auto-renew and require no cancellation.')}</p>
      <h2>{t('需要核实或取消已有扣款授权？', 'Need to verify or cancel an existing authorization?')}</h2>
      <p>{t('如你在微信中看到 CubeRoot 的扣费服务，请直接在微信支付的相应服务中核对并关闭授权，或联系客服协助。本页不会把未查询的授权显示为“未签约”，也不会把未完成的解约显示为“取消成功”。', 'If you see a CubeRoot debit service in WeChat, review and revoke it within the corresponding WeChat Pay service, or contact support. This page does not label an unchecked authorization as absent or an unconfirmed cancellation as successful.')}</p>
      <p>{t('取消自动续费与退款分开处理；已购买权益可使用至已付服务期结束。若发现取消后扣款，请保留订单号并联系客服核对。', 'Cancellation and refunds are handled separately. Purchased benefits remain available until the paid service period ends. If a charge appears after cancellation, keep the order number and contact support.')}</p>
      <nav className="mem-service-links" aria-label={t('会员服务', 'Membership services')}>
        <AppLink href="/contact" prefetch={false}>{t('联系会员客服', 'Contact membership support')}</AppLink>
        <AppLink href="/membership/renewal-terms" prefetch={false}>{t('自动续费服务协议', 'Auto-renewal Agreement')}</AppLink>
        <AppLink href="/membership" prefetch={false}>{t('会员权益与有效期', 'Membership benefits and validity')}</AppLink>
      </nav>
    </main>
  );
}
