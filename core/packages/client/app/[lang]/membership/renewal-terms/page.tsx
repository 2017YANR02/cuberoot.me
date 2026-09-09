'use client';

import AppLink from '@/components/AppLink';
import { CONTACT_EMAIL } from '@cuberoot/shared/contact';
import { useT } from '@/hooks/useT';
import '../membership.css';

export default function RenewalTermsPage() {
  const t = useT();
  return (
    <main className="mem-page mem-service-document">
      <h1>{t('自动续费服务协议', 'Auto-renewal Agreement')}</h1>
      <p className="mem-note">{t('当前自动续费尚未开放。本页说明拟提供的服务规则，不代表已经获得扣款授权；只有在微信正式签约成功后，自动续费约定才对该笔订阅生效。', 'Auto-renewal is not available yet. This page describes the proposed service rules and does not establish a debit authorization. The auto-renewal agreement for a subscription takes effect only after successful authorization in WeChat.')}</p>

      <h2>{t('服务内容与提供方', 'Service and provider')}</h2>
      <p>{t('本服务由上海魔方根教育科技工作室（个人独资）为 CubeRoot 魔方根会员提供，用于按照你选择的周期持续购买会员服务，不用于打赏或其他未授权消费。', 'This service is provided to CubeRoot members by 上海魔方根教育科技工作室（个人独资） to renew membership for the period you select. It does not authorize donations or unrelated purchases.')}</p>
      <p>{t('会员权益、适用项目和每期额度见会员页所选套餐。获取高手解法复盘与提交个人视频进行复盘是不同服务，按页面各自列明的额度提供；群服务与人工复盘可通过会员客服联系办理。', 'Benefits, supported puzzles, and allowances are listed with the selected membership plan. Access to expert reconstructions and reviews of your own solve videos are separate services with separate stated allowances. Contact membership support for group services and personal video reviews.')}</p>
      <AppLink href="/membership#universal-perks-title" prefetch={false}>{t('查看会员权益和当前公开价格', 'View membership benefits and current public prices')}</AppLink>

      <h2>{t('金额、周期与主动授权', 'Amount, billing period, and consent')}</h2>
      <p>{t('连续包月按月续费，连续包年按年续费。首次和后续每期金额将在签约确认页逐项显示，并须与微信签约页的扣费模板一致。未单独标示首期优惠时，首期与后续每期价格相同。具体扣费日期在正式签约流程和扣费通知中明确展示。', 'Monthly plans renew each month and annual plans renew each year. The confirmation page will show the first and subsequent charges, matching the billing template in WeChat. Unless a first-period discount is explicitly stated, both prices are the same. Specific charge dates will be displayed during authorization and in billing notices.')}</p>
      <p>{t('你需要主动阅读并同意本协议，再在微信原生签约页面确认。浏览本页、勾选协议、登录或单次购买均不会自动建立扣款授权。签约成功也不等于支付成功，会员服务期以支付成功后的账户记录为准。', 'You must actively agree to these terms and confirm authorization on WeChat’s native signing page. Visiting this page, checking the agreement, signing in, or making a one-time purchase does not authorize recurring debits. Successful authorization is not successful payment; the paid service period is shown in your account after payment succeeds.')}</p>
      <p>{t('单次月度或年度会员无需签订自动续费协议，不会自动扣款。套餐价格或其他扣费条件变更不会因后台修改而自动改变你已授权的约定，须按微信要求通知并取得你的明示同意。', 'One-time monthly and annual memberships do not require an auto-renewal agreement and do not auto-charge. An administrative price change does not alter an existing authorization; changes require notice and your explicit consent in accordance with WeChat requirements.')}</p>

      <h2>{t('扣费通知与支付失败', 'Billing notices and failed payments')}</h2>
      <p>{t('每次续费扣款前会按微信审核通过的模式通知金额、预计扣费时间与周期。扣费请求处理中不等于付款成功；支付失败不会凭空延长服务期，也不会对同一期重复收取费用。请保持付款账户与接收通知的联系方式可用。', 'Before each renewal charge, you will receive the amount, expected charge time, and billing period through the mode approved by WeChat. A pending debit is not a successful payment. Failed payment does not extend membership, and the same period will not be charged twice. Keep your payment account and notification contact available.')}</p>

      <h2>{t('取消自动续费', 'Cancel auto-renewal')}</h2>
      <p>{t('服务开放后，网站取消入口为“会员 → 管理自动续费”。取消须由微信解约结果确认，页面不能仅凭点击按钮显示取消成功。你也可在微信支付的相应扣费服务中关闭授权。取消后不再发起续费扣款，不收取取消费用。', 'Once the service is available, the website cancellation entry will be Membership → Manage auto-renewal. Cancellation must be confirmed by WeChat, not simply by a button click. You may also revoke authorization in the corresponding WeChat Pay debit service. No further renewal charges will be initiated after cancellation, and there is no cancellation fee.')}</p>
      <p>{t('取消自动续费不等于退款，已经购买的会员权益可使用至已付服务期结束。若取消时已有扣费处理中、取消结果不明确或取消后仍出现扣费，请及时联系客服核对处理；不要把关闭网页或退出账号当作取消授权。', 'Cancellation is separate from a refund; paid benefits remain available until the paid service period ends. If a debit is pending, cancellation is unclear, or a charge appears after cancellation, contact support for reconciliation. Closing a webpage or signing out does not revoke authorization.')}</p>
      <AppLink href="/membership/subscription" prefetch={false}>{t('管理自动续费', 'Manage auto-renewal')}</AppLink>

      <h2>{t('售后、退款与联系', 'Support, refunds, and contact')}</h2>
      <p>{t('如需查询订单、申请退款、开具发票或反馈服务问题，请提供 CubeRoot 账号、订单号和问题说明，由客服核对实际支付及服务履行情况处理。你的法定消费者权益不因本协议受到排除或限制。请勿发送支付密码、验证码或密钥。', 'For order enquiries, refund requests, invoices, or service issues, provide your CubeRoot account, order number, and a description. Support will review the payment and service delivery. These terms do not exclude or limit your statutory consumer rights. Never send payment passwords, verification codes, or secret keys.')}</p>
      <div className="mem-service-links">
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        <AppLink href="/contact" prefetch={false}>{t('其他联系方式', 'Other contact methods')}</AppLink>
      </div>
    </main>
  );
}
