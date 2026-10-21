'use client';

/**
 * /membership — 会员订阅。
 * 站内工具保持免费,会员是「支持本站 + 专属权益」(徽章 / 抢先体验 / 致谢署名)。
 * 自动续费与主动付款明确分开，签约不可用时不回退普通支付。
 * admin 登录后见管理面板。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, AlertTriangle } from '@app-foundation/icons/lucide';
import { useQueryState } from 'nuqs';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore, isAdmin, getSessionToken, getWcaToken } from '@/lib/auth-store';
import { isMiniProgramCommerceRestricted } from '@/lib/miniprogram-bridge';
import { fmtPrice, fmtDate, fmtVipId } from '@/lib/membership-format';
import { benefitCopy } from '@cuberoot/shared/membership-benefits';
import { useMembershipBenefits } from '@/hooks/useMembershipBenefits';
import BenefitsEditor from './BenefitsEditor';
import AppLink from '@/components/AppLink';
import CubeRootLogo from '@/components/CubeRootLogo';
import { Spinner } from '@/components/Spinner/Spinner';
import {
  listPlans, getMyMembership, getOrderStatus, membershipExpiry,
  reconcileVisiblePlan, isAutoRenewPlanSlug, renewalAvailability,
  type MembershipPlan, type Membership, type PayChannels,
} from '@/lib/membership-api';
import AdminPanel from './AdminPanel';
import MemberContact from './MemberContact';
import MemberProfileEditor from '@/components/MemberProfileEditor';
import AutoRenewModal from './AutoRenewModal';
import PayModal from './PayModal';
import './membership.css';
import AppleMembership from './AppleMembership';
import { isIosMembershipSurface, useAppleMembershipAvailable } from '@/lib/apple-membership-bridge';
import { installedMembershipStore, useStoreMembershipAvailable } from '@/lib/store-membership-bridge';
import { useWebMembershipAvailable } from '@/lib/web-membership-bridge';


function intersectPerks(plans: MembershipPlan[]): string[] {
  if (plans.length === 0) return [];
  return [...new Set(plans[0].perks)].filter((perk) =>
    plans.slice(1).every((plan) => plan.perks.includes(perk)));
}

function planUnit(plan: MembershipPlan, isZh: boolean): string {
  if (plan.period === 'lifetime') return isZh ? '一次性' : 'one-time';
  const u: Record<string, { zh: string; en: string }> = {
    month: { zh: '月', en: 'mo' }, year: { zh: '年', en: 'yr' },
    week: { zh: '周', en: 'wk' }, day: { zh: '天', en: 'day' },
  };
  const unit = u[plan.period] ?? { zh: plan.period, en: plan.period };
  const n = plan.periodCount;
  if (isZh) return n > 1 ? `${n} ${unit.zh}` : unit.zh;
  return n > 1 ? `${n} ${unit.en}` : unit.en;
}

export default function MembershipPage() {
  const { content: benefits, setContent: setBenefits } = useMembershipBenefits();
  const benefitMap = new Map(benefits.items.map(item => [item.id, item]));
  const lang = useLang();
  const isZh = lang !== 'en';

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const appleAvailable = useAppleMembershipAvailable();
  const appleSurface = mounted && (appleAvailable || isIosMembershipSurface());
  const googleAvailable = useStoreMembershipAvailable('google');
  const directApp = useWebMembershipAvailable();
  const googleSurface = mounted && (googleAvailable || installedMembershipStore() === 'google');
  const admin = mounted && isAdmin();
  const loggedIn = mounted && !!user;
  const [commerceRestricted, setCommerceRestricted] = useState<boolean | null>(null);
  useEffect(() => {
    let cancel = false;
    void isMiniProgramCommerceRestricted().then((restricted) => {
      if (!cancel) setCommerceRestricted(restricted);
    });
    return () => { cancel = true; };
  }, []);

  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [renewalPrices, setRenewalPrices] = useState<MembershipPlan[]>([]);
  const [paymentMode, setPaymentMode] = useState<'renewal' | 'manual'>('renewal');
  const [enterprisePaymentMode, setEnterprisePaymentMode] = useState<'renewal' | 'manual'>('renewal');
  const [payEnabled, setPayEnabled] = useState(false);
  const [channels, setChannels] = useState<PayChannels>();
  const [buyPlan, setBuyPlan] = useState<MembershipPlan | null>(null);
  const [renewalStatus, setRenewalStatus] = useState<Awaited<ReturnType<typeof renewalAvailability>> | null>(null);
  useEffect(() => {
    if (commerceRestricted !== false) return;
    let cancelled = false;
    setRenewalStatus(null);
    void renewalAvailability().then(value => { if (!cancelled) setRenewalStatus(value); })
      .catch(() => { if (!cancelled) setRenewalStatus({ available: false, termsVersion: '' }); });
    return () => { cancelled = true; };
  }, [commerceRestricted, user?.wcaId]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [paid, setPaid] = useQueryState('paid');
  const [renew, setRenew] = useQueryState('renew');
  const [selectedAutoRenewPlan, setSelectedAutoRenewPlan] = useState<MembershipPlan | null>(null);

  const refreshMembership = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!getSessionToken() && !getWcaToken()) {
      setMembership(null);
      return;
    }
    getMyMembership().then((r) => setMembership(r.membership)).catch(() => {});
  }, []);

  useEffect(() => {
    if (commerceRestricted !== false) return;
    let cancel = false;
    listPlans()
      .then((r) => { if (!cancel) { setPlans(r.plans.filter(p => p.slug !== 'enterprise_yearly')); setRenewalPrices((r.renewalPlans ?? []).filter(p => p.slug !== 'enterprise_yearly_auto_renew')); setPayEnabled(r.payEnabled); setChannels(r.channels); } })
      .catch((e) => { if (!cancel) setLoadErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancel = true; };
  }, [commerceRestricted]);

  useEffect(() => {
    if (mounted && commerceRestricted === false) refreshMembership();
  }, [mounted, commerceRestricted, user?.wcaId, refreshMembership]);

  // 支付返回(return_url 带 ?paid=<单号>):轮询查单几次,确认入账后刷新状态。
  useEffect(() => {
    if (!paid || !mounted || commerceRestricted !== false) return;
    let tries = 0;
    let timer: number | undefined;
    const poll = () => {
      getOrderStatus(paid)
        .then((r) => {
          if (r.status === 'paid') {
            setJustPaid(true);
            refreshMembership();
            setPaid(null);
          } else if (tries++ < 8) {
            timer = window.setTimeout(poll, 2000);
          } else {
            setPaid(null);
          }
        })
        .catch(() => setPaid(null));
    };
    poll();
    return () => { if (timer) window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid, mounted, commerceRestricted]);

  const isLifetime = membership?.lifetime && membership.active;
  const activeMember = membership?.active;
  const expiry = useMemo(() => membershipExpiry(membership), [membership]);

  // 到期提醒统一进入签约，不再创建普通付款订单。
  const renewMembership = useCallback(() => {
    if (!loggedIn) { login(); return; }
    if (membership?.planSlug?.startsWith('enterprise_')) return;
    const list = renewalPrices.filter((plan) => isAutoRenewPlanSlug(plan.slug) && !plan.slug.startsWith('enterprise_'));
    const target = list.find((plan) => plan.slug === membership?.planSlug)
      ?? list.find((plan) => plan.period === (membership?.planSlug?.includes('year') ? 'year' : 'month'))
      ?? list[0];
    if (target) setSelectedAutoRenewPlan(target);
  }, [loggedIn, login, renewalPrices, membership?.planSlug]);

  // 全局到期提醒 banner 深链 ?renew=1 → 自动打开续费弹窗(永久会员忽略)。
  useEffect(() => {
    if (commerceRestricted !== false || !renew || !mounted || !plans || !membership || membership.lifetime) return;
    renewMembership();
    setRenew(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commerceRestricted, renew, mounted, plans, membership, renewalPrices]);

  const sortedPlans = useMemo(() => plans ?? [], [plans]);
  const autoRenewPlans = renewalPrices.filter((plan) => isAutoRenewPlanSlug(plan.slug) && !plan.slug.startsWith('enterprise_'));
  const oneTimePlans = sortedPlans.filter((plan) => !isAutoRenewPlanSlug(plan.slug));
  const enterpriseRenewalPlans = renewalPrices.filter(plan => plan.slug === 'enterprise_monthly_auto_renew');
  const enterprisePlans = oneTimePlans.filter((plan) => plan.slug === 'enterprise_monthly');
  const personalPlans = oneTimePlans.filter((plan) => !plan.slug.startsWith('enterprise_'));
  const universalPerks = benefits.items.filter(item => item.group === 'common').map(item => item.id);
  const universalPerkSet = new Set(benefits.items.filter(item => item.group === 'common').map(item => item.id));
  const enterpriseSharedPerks = benefits.items.filter(item => item.group === 'enterprise').map(item => item.id);
  const enterpriseSharedPerkSet = new Set(benefits.items.filter(item => item.group === 'enterprise').map(item => item.id));

  const handlePlanUpdated = useCallback((updatedPlan: MembershipPlan) => {
    setPlans((current) => current ? reconcileVisiblePlan(current, updatedPlan) : current);
    if (isAutoRenewPlanSlug(updatedPlan.slug)) setRenewalPrices((current) => current.map((plan) => plan.slug === updatedPlan.slug ? updatedPlan : plan));
  }, []);

  if (appleSurface || googleSurface) return <div className="mem-page"><AppleMembership store={googleSurface ? 'google' : 'apple'} refresh={refreshMembership} benefits={renderPerks([...new Set([...universalPerks, ...intersectPerks(personalPlans)])].filter(perk => perk !== 'lifetime'))} /></div>;

  if (commerceRestricted === null) return (
    <div className="mem-page"><div className="mem-empty" role="status"><Spinner size={16} /> {tr({ zh: '加载中…', en: 'Loading…' })}</div></div>
  );

  if (commerceRestricted) {
    return (
      <div className="mem-page">
        <header className="mem-head">
          <h1 className="mem-title">
            <CubeRootLogo className="mem-title-logo" height={22} variant="mark" />
            {tr({ zh: '会员服务', en: 'Membership' })}
          </h1>
        </header>
        <p className="mem-empty">
          {tr({
            zh: '小程序内暂不提供会员购买服务。',
            en: 'Membership purchases are not available in the Mini Program.',
          })}
        </p>
      </div>
    );
  }

  function renderPerks(perks: string[], group?: 'common' | 'enterprise', heading?: { id: string; text: string }) {
    if (perks.length === 0 && !(admin && group) && !heading) return null;
    const list = (
      <ul className="mem-plan-perks">
        {perks.map((perk) => (
          <li key={perk}><Check size={13} /> {tr(benefitMap.has(perk) ? benefitCopy(benefitMap.get(perk)!) : { zh: perk, en: perk })}</li>
        ))}
      </ul>
    );
    return admin && (group || perks.some(perk => benefitMap.has(perk))) ? <BenefitsEditor onSaved={setBenefits} group={group} benefitIds={perks} language={isZh ? 'zh' : 'en'} heading={heading}>{list}</BenefitsEditor> : <>{heading && <h2 id={heading.id} className="mem-plan-section-title">{heading.text}</h2>}{list}</>;
  }

  function renderPaymentChoice(enterprise: boolean) {
    const id = enterprise ? 'enterprise-payment-mode' : 'membership-payment-mode';
    return <div className="mem-payment-choice">
      <select id={id} aria-label={tr({ zh: '付费方式', en: 'Payment method' })} className="mem-payment-select" value={enterprise ? enterprisePaymentMode : paymentMode}
        onChange={event => (enterprise ? setEnterprisePaymentMode : setPaymentMode)(event.target.value as 'renewal' | 'manual')}>
        <option value="renewal">{tr({ zh: '自动续费', en: 'Auto-renewal' })}</option>
        <option value="manual">{tr({ zh: '仅购买本期', en: 'One-time purchase' })}</option>
      </select>
    </div>;
  }

  function renderPaymentNote(mode: 'renewal' | 'manual') {
    return <p className="mem-payment-note" role="status">{mode === 'renewal'
      ? tr({ zh: '微信签约后按所选周期自动续费，扣费前通知，可随时取消。', en: 'Authorize in WeChat to renew each billing period. Notice before charging; cancel anytime.' })
      : tr({ zh: '仅支付本期费用，不会自动扣款。', en: 'Pay for this period only; no automatic charges.' })}</p>;
  }

  function renderPlan(plan: MembershipPlan, enterprise = false) {
    const renewal = (enterprise ? enterprisePaymentMode : paymentMode) === 'renewal';
    const annual = plan.period === 'year';
    // Keep checkout disabled until the deployed price matches the reviewed offer.
    const monthly = enterprise ? (renewal ? 29900 : 39900) : (renewal ? 2999 : 3999);
    const yearly = enterprise ? (renewal ? 299900 : 399900) : (renewal ? 29900 : 39900);
    const priceCents = annual ? yearly : monthly;
    const priceReady = priceCents === plan.priceCents;
    const saving = annual ? monthly * 12 - yearly : (enterprise ? 10000 : 1000);
    const available = renewal ? isAutoRenewPlanSlug(plan.slug) && priceReady && Boolean(renewalStatus?.available) && (enterprise ? renewalStatus?.plans?.[plan.slug] === true : renewalStatus?.plans?.[plan.slug] !== false) : payEnabled && priceReady;
    const extraPerks = plan.perks.filter(perk => !universalPerkSet.has(perk) && (!enterprise || !enterpriseSharedPerkSet.has(perk)));
    const unavailable = renewal
      ? enterprise ? tr({ zh: '企业自动续费暂未开放', en: 'Enterprise auto-renewal is not yet available' })
        : renewalStatus === null ? tr({ zh: '正在确认签约状态…', en: 'Checking availability…' })
          : tr({ zh: '自动续费暂未开放', en: 'Auto-renewal is not yet available' })
      : tr({ zh: '暂不可购买', en: 'Currently unavailable' });
    return (
      <div key={plan.slug} className={'mem-plan' + (renewal ? ' is-autorenew' : '')}>
        <span className="mem-plan-tag">{renewal ? tr({ zh: '自动续费', en: 'Auto-renewal' }) : tr({ zh: '仅购买本期', en: 'One-time purchase' })}</span>
        <div className="mem-plan-name">{plan.period === 'year' ? tr({ zh: '年度会员', en: 'Annual membership' }) : tr({ zh: '月度会员', en: 'Monthly membership' })}</div>
        <div className="mem-plan-price">
          <span className="mem-plan-amount">{fmtPrice(priceCents, plan.currency)}</span>
          <span className="mem-plan-unit">/ {planUnit(plan, isZh)}</span>
        </div>
        <p className="mem-plan-saving">{annual
          ? tr({ zh: '比按月购买一年省 {amount}', en: 'Save {amount} versus 12 monthly payments' }).replace('{amount}', fmtPrice(saving, plan.currency))
          : renewal ? tr({ zh: '比仅购买本期每月省 {amount}', en: 'Save {amount} each month versus one-time purchase' }).replace('{amount}', fmtPrice(saving, plan.currency))
            : tr({ zh: '灵活购买，无后续扣款', en: 'Flexible purchase. No recurring charges.' })}</p>
        <ul className="mem-plan-perks">
          {extraPerks.map(perk => <li key={perk}><Check size={13} />{tr(benefitMap.has(perk) ? benefitCopy(benefitMap.get(perk)!) : { zh: perk, en: perk })}</li>)}
        </ul>
        <button data-corner-shape="native" className="mem-plan-cta" disabled={!available} onClick={() => {
          if (!loggedIn) { login(); return; }
          if (renewal) setSelectedAutoRenewPlan(plan);
          else if (priceReady) setBuyPlan(plan);
        }}>
          {!available ? unavailable : !loggedIn ? tr({ zh: '登录后继续', en: 'Sign in to continue' }) : renewal ? tr({ zh: '前往微信签约', en: 'Authorize in WeChat' }) : tr({ zh: '支付本期费用', en: 'Pay for this period' })}
        </button>
      </div>
    );
  }

  return (
    <div className="mem-page">
      <header className="mem-head">
        <h1 className="mem-title">
          <CubeRootLogo className="mem-title-logo" height={22} variant="mark" />
          {tr({ zh: 'CubeRoot 会员', en: 'CubeRoot membership'
        })}
        </h1>
      </header>

      <p className="mem-sub" role="status">
        {directApp
          ? tr({ zh: '支付成功后开通会员，订阅周期与续费规则以确认页面为准。', en: 'Membership starts after successful payment. See the confirmation page for the subscription period and renewal terms.' })
          : tr({ zh: '解锁专属权益，支持魔方根。', en: 'Unlock member benefits. Support CubeRoot.' })}
      </p>
      {directApp && <p className="mem-note">
        {tr({ zh: '已有商店订阅仍由原商店自动续费，切换安装渠道不会取消。网站、Apple 与 Google Play 会员期并存，取较晚到期日，不叠加时长；购买前请核对原订阅。', en: 'Existing store subscriptions continue renewing in their original store; switching app distribution does not cancel them. Website, Apple and Google Play memberships run concurrently, using the latest expiry without adding durations. Check existing subscriptions before buying.' })}
        {' '}<a href="https://play.google.com/store/account/subscriptions?package=me.cuberoot.app" target="_blank" rel="noopener noreferrer">{tr({ zh: '管理 Google Play 订阅', en: 'Manage Google Play subscriptions' })}</a>
      </p>}

      <nav className="mem-service-links" aria-label={tr({ zh: '会员服务', en: 'Membership services' })}>
        <AppLink href="/membership/subscription" prefetch={false}>{tr({ zh: '管理自动续费', en: 'Manage auto-renewal' })}</AppLink>
        <AppLink href="/membership/renewal-terms" prefetch={false}>{tr({ zh: '自动续费服务协议', en: 'Auto-renewal Agreement' })}</AppLink>
        <AppLink href="/contact" prefetch={false}>{tr({ zh: '会员客服', en: 'Membership support' })}</AppLink>
      </nav>

      {/* 当前会员状态 / 到期提醒 */}
      {membership && (activeMember || expiry?.expired) && (
        <div className={`mem-status${expiry?.expiringSoon ? ' is-warning' : ''}${expiry?.expired ? ' is-expired' : ''}`}>
          {expiry?.expired && <AlertTriangle size={16} className="mem-status-icon" />}
          <span className="mem-status-text">
            {membership.vipId && <><strong>{fmtVipId(membership.vipId)}</strong>{' '}</>}
            {membership.lifetime
              ? tr({ zh: '你是永久会员,感谢长期的支持 ♡', en: "You're a lifetime member — thank you for the support ♡"
            })
              : expiry?.expired
              ? tr({ zh: '会员已于 {d} 到期', en: 'Membership expired on {d}'
            }).replace('{d}', fmtDate(membership.expiresAt))
              : expiry?.expiringSoon
              ? tr({ zh: '会员还有 {n} 天到期({d})', en: 'Expires in {n} day(s) — {d}'
            }).replace('{n}', String(Math.max(0, expiry.daysLeft ?? 0))).replace('{d}', fmtDate(membership.expiresAt))
              : tr({ zh: '会员有效期至 {d}', en: 'Member until {d}'
            }).replace('{d}', fmtDate(membership.expiresAt))}
          </span>
          {!membership.lifetime && !membership.planSlug?.startsWith('enterprise_') && (expiry?.expiringSoon || expiry?.expired) && (
            <button className="mem-status-renew" onClick={renewMembership}>
              {tr({ zh: '立即续费', en: 'Renew now'
            })}
            </button>
          )}
          <button className="mem-status-refresh" onClick={refreshMembership} aria-label={tr({ zh: '刷新', en: 'Refresh'
        })}>
            <RefreshCw size={13} />
          </button>
        </div>
      )}

      {justPaid && (
        <div className="mem-paid-banner">
          <Check size={15} /> {tr({ zh: '支付成功,会员已开通!', en: 'Payment received — your membership is active!'
        })}
        </div>
      )}

      {/* 套餐 */}

      {loadErr ? (
        <div className="mem-empty">{tr({ zh: '加载失败', en: 'Failed to load'
        })}: {loadErr}</div>
      ) : !plans ? (
        <div className="mem-empty"><Spinner size={16} /> {tr({ zh: '加载中…', en: 'Loading…'
        })}</div>
      ) : isLifetime ? (
        <div className="mem-empty">{tr({ zh: '你已经是永久会员,无需再次购买。', en: 'You already have lifetime membership — nothing to buy.'
        })}</div>
      ) : (
        <div className="mem-plan-sections">
          <section className="mem-plan-section" aria-labelledby="universal-perks-title">
            {renderPerks(universalPerks, 'common', { id: 'universal-perks-title', text: tr({ zh: '个人用户权益', en: 'Individual benefits' }) })}
          </section>
          <section className="mem-plan-section" aria-labelledby="personal-plans-title">
            <div className="mem-purchase-heading">
              <h2 id="personal-plans-title" className="mem-plan-section-title">{tr({ zh: '个人用户', en: 'Individual' })}</h2>
              {renderPaymentChoice(false)}
            </div>
            <div className="mem-plans">
              {(paymentMode === 'renewal' ? autoRenewPlans : personalPlans).map(plan => renderPlan(plan))}
              {paymentMode === 'renewal' && autoRenewPlans.length === 0 && <p role="status">{tr({ zh: '自动续费暂不可用，请稍后重试。', en: 'Auto-renewal is temporarily unavailable. Please try again later.' })}</p>}
            </div>
            {renderPaymentNote(paymentMode)}
          </section>
          <section className="mem-plan-section" aria-labelledby="enterprise-perks-title">
            <p>{tr({ zh: '包含以上个人用户权益，以及以下企业专属权益。', en: 'Includes all individual benefits above, plus these enterprise benefits.' })}</p>
            {renderPerks(enterpriseSharedPerks, 'enterprise', { id: 'enterprise-perks-title', text: tr({ zh: '企业用户权益', en: 'Enterprise benefits' }) })}
          </section>
          <section className="mem-plan-section" aria-labelledby="enterprise-plans-title">
            <div className="mem-purchase-heading">
              <h2 id="enterprise-plans-title" className="mem-plan-section-title">{tr({ zh: '企业用户', en: 'Enterprise' })}</h2>
              {renderPaymentChoice(true)}
            </div>
            <div className="mem-plans">{(enterprisePaymentMode === 'renewal' && enterpriseRenewalPlans.length === 1 ? enterpriseRenewalPlans : enterprisePlans).map(plan => renderPlan(plan, true))}</div>
            {renderPaymentNote(enterprisePaymentMode)}
          </section>
        </div>
      )}

      <details className="mem-plan-section mem-details">
        <summary id="renewal-disclosure-title">
          {tr({ zh: '续费与取消说明', en: 'Renewal and cancellation' })}
        </summary>
        <p>{tr({ zh: '月度、年度订阅在你确认签约后按所选周期自动续费，可随时取消。', en: 'Monthly and annual subscriptions renew automatically for the selected period after you authorize them. You can cancel anytime.' })}</p>
        {renewalPrices.length > 0 && <div className="mem-service-links" aria-label={tr({ zh: '自动续费价目表', en: 'Auto-renewal prices' })}>
          {renewalPrices.map((plan) => <span key={plan.slug}>
            {tr({ zh: plan.nameZh, en: plan.nameEn })} {fmtPrice(plan.priceCents, plan.currency)} / {planUnit(plan, isZh)}
          </span>)}
        </div>}
        <p>{tr({ zh: '付款与续费：仅在你主动同意协议并在微信确认签约后，才建立扣款授权。首期及后续每期金额、续费周期以签约确认页和微信签约内容为准；续费扣款前会通知金额、预计扣费时间与周期，扣款成功后延长相应会员服务期。', en: 'Payment and renewal: debit authorization is established only after you actively agree to the terms and confirm in WeChat. The first and subsequent charges and billing period are shown on the confirmation and WeChat authorization pages. Renewal notices will state the amount, expected charge time, and period; membership is extended after successful payment.' })}</p>
        <p>{tr({ zh: '退订路径：会员 → 管理自动续费 → 登录 → 对应签约记录 → 取消自动续费 → 确认取消。可查看当前签约状态，随时申请解除委托代扣；以微信确认的解约结果为准，不以点击按钮作为取消成功。也可在微信支付的对应扣费服务中解除授权。', en: 'To cancel: Membership → Manage auto-renewal → Sign in → Select the authorization → Cancel auto-renewal → Confirm cancellation. View your authorization status and request cancellation at any time. Cancellation is effective only when confirmed by WeChat, not simply when a button is clicked. You may also revoke authorization in the corresponding WeChat Pay debit service.' })}</p>
        <p>{tr({ zh: '取消后：不再发起后续续费扣款，不收取取消费用；已购买权益保留至已付服务期结束，不会自动退款。若已有扣费处理中、取消结果不明确或取消后仍出现扣费，请联系会员客服核对。关闭页面或退出账号不会取消自动续费。', en: 'After cancellation: no further renewal charges will be initiated and there is no cancellation fee. Paid benefits remain until the paid period ends; cancellation does not automatically issue a refund. Contact membership support for pending charges, uncertain cancellation results, or charges after cancellation. Closing the page or signing out does not cancel auto-renewal.' })}</p>
        <nav className="mem-service-links" aria-label={tr({ zh: '退订与服务规则', en: 'Cancellation and service rules' })}>
          <AppLink href="/membership/subscription" prefetch={false}>{tr({ zh: '管理自动续费 / 退订', en: 'Manage / cancel auto-renewal' })}</AppLink>
          <AppLink href="/membership/renewal-terms" prefetch={false}>{tr({ zh: '查看完整自动续费协议', en: 'Read the full auto-renewal agreement' })}</AppLink>
          <AppLink href="/contact" prefetch={false}>{tr({ zh: '联系会员客服', en: 'Contact membership support' })}</AppLink>
        </nav>
      </details>

      <details className="mem-details">
        <summary>{tr({ zh: '未来权益规划', en: 'Planned benefits' })}</summary>
      <section className="mem-plan-sections" aria-labelledby="planned-benefits-title">
        <div>
          <h2 id="planned-benefits-title" className="mem-plan-section-title">
            {tr({ zh: '新增权益规划', en: 'Planned membership benefits' })}
          </h2>
          <p className="mem-sub">
            {tr({ zh: '以下为规划中的新增权益，暂不包含在当前购买的套餐内。具体开放时间、适用套餐、额度和服务范围将在上线前公布；现有价格与已包含权益不变。', en: 'These planned additions are not included in current purchases. Availability, eligible plans, allowances, and service scope will be announced before launch. Existing prices and included benefits remain unchanged.' })}
          </p>
        </div>
        <section aria-labelledby="planned-personal-title">
          <h3 id="planned-personal-title" className="mem-plan-section-title">{tr({ zh: '个人用户规划', en: 'Planned for individuals' })}</h3>
          <ul className="mem-plan-perks">
            <li>{tr({ zh: '训练分析报告：查看成绩趋势、稳定性与薄弱公式，了解下一步练什么。', en: 'Training reports: track performance trends, consistency, and weak algorithms to identify what to practice next.' })}</li>
            <li>{tr({ zh: '个性化训练计划：根据目标与每日可用时间，安排训练和复习。', en: 'Personalized practice plans: organize training and reviews around your goals and available time.' })}</li>
            <li>{tr({ zh: '高级公式管理：自建公式集、记录备注与掌握程度，针对薄弱项练习。', en: 'Advanced algorithm management: create sets, add notes, track mastery, and practice weak areas.' })}</li>
            <li>{tr({ zh: '复盘档案：集中保存视频、教练批注和改进建议，对比不同阶段的表现。', en: 'Solve review archive: keep videos, coach feedback, and improvement suggestions together to compare progress over time.' })}</li>
            <li>{tr({ zh: '会员专题课与集体答疑：围绕还原技巧、训练方法和比赛准备开展专题活动。', en: 'Member workshops and group Q&A: focused sessions on solving techniques, practice methods, and competition preparation.' })}</li>
            <li>{tr({ zh: '云端计算扩展：规划优先排队与更多计算任务额度，具体适用任务和上限另行公布，不减少现有求解权益。', en: 'Expanded cloud computing: planned priority queuing and additional task allowances, with eligible tasks and limits to be announced. Existing solving benefits will not be reduced.' })}</li>
          </ul>
        </section>
        <section aria-labelledby="planned-enterprise-title">
          <h3 id="planned-enterprise-title" className="mem-plan-section-title">{tr({ zh: '企业用户规划', en: 'Planned for organizations' })}</h3>
          <ul className="mem-plan-perks">
            <li>{tr({ zh: '班级与学员管理：分班、分配老师，集中查看学员训练情况。', en: 'Class and student management: organize classes, assign teachers, and review student practice in one place.' })}</li>
            <li>{tr({ zh: '布置作业与批改：下发公式训练、计时和视频任务，查看完成情况并反馈。', en: 'Assignments and feedback: assign algorithm practice, timed solves, and video tasks, then track completion and provide feedback.' })}</li>
            <li>{tr({ zh: '学员成长报告：整理阶段成绩和学习进度，便于向学员与家长反馈。', en: 'Student progress reports: summarize results and learning progress for students and parents.' })}</li>
            <li>{tr({ zh: '机构教学资料库：供老师共享机构自有或已获授权的教案、公式集和视频。', en: 'Teaching resource library: share lesson plans, algorithm sets, and videos owned or licensed by the organization.' })}</li>
            <li>{tr({ zh: '教师账号与权限：按角色分配管理范围，支持教学资料与学员交接。', en: 'Teacher accounts and permissions: assign role-based access and support handovers of teaching resources and students.' })}</li>
            <li>{tr({ zh: '机构品牌展示扩展：在现有机构主页基础上，扩展课程介绍与报告中的机构名称、Logo 展示。', en: 'Expanded organization branding: build on existing profile pages with course introductions and organization names and logos on reports.' })}</li>
            <li>{tr({ zh: '集中分配学习权益：由机构统一向学员分配课程或工具额度。', en: 'Centralized learning access: let organizations allocate course access or tool allowances to students.' })}</li>
            <li>{tr({ zh: '入驻指导：规划初始化设置、数据导入或教师培训，服务次数与范围另行公布。', en: 'Onboarding assistance: planned setup, data import, or teacher training, with session limits and scope to be announced.' })}</li>
          </ul>
          <p className="mem-sub">
            {tr({ zh: '教师账号数、学员数、存储空间、人工服务额度及课程定制范围尚待确定，不承诺无限使用或无限定制。', en: 'Teacher seats, student capacity, storage, human-service allowances, and course customization scope are not yet set. Unlimited usage or customization is not promised.' })}
          </p>
        </section>
      </section>

      </details>

      <p className="mem-foot-note">
        {tr({ zh: '订阅将在扣费前通知，可随时在“管理自动续费”中取消。取消后，已付会员权益保留至到期。', en: 'You will be notified before renewal charges. Cancel anytime in Manage auto-renewal; paid benefits remain until expiry.' })}
        {' '}
        <span className="mem-foot-links">
          <AppLink href="/support">{tr({ zh: '查看致谢名单 →', en: 'See supporters →'
          })}</AppLink>
          <AppLink href="/contact">{tr({ zh: '联系我们 →', en: 'Contact us →'
          })}</AppLink>
        </span>
      </p>

      {/* 会员联系方式(续费提醒 / 账号找回) */}
      {activeMember && membership && (
        <>
          <MemberProfileEditor
            profile={membership}
            onSaved={(profileIntro, profileImageIds) => setMembership({ ...membership, profileIntro, profileImageIds })}
          />
          <MemberContact membership={membership} onSaved={setMembership} isZh={isZh} />
        </>
      )}

      {/* admin 面板 */}
      {admin && <AdminPanel key={user?.wcaId} plans={plans ?? []} isZh={isZh} onPlanUpdated={handlePlanUpdated} onViewRenewal={setSelectedAutoRenewPlan} />}

      {buyPlan && <PayModal plan={buyPlan} channels={channels} isZh={isZh}
        onClose={() => setBuyPlan(null)} onPaid={() => { setBuyPlan(null); setJustPaid(true); refreshMembership(); }} />}
      {selectedAutoRenewPlan && (selectedAutoRenewPlan.period === 'month' || selectedAutoRenewPlan.period === 'year') && (
        <AutoRenewModal
          planSlug={selectedAutoRenewPlan.slug}
          priceCents={selectedAutoRenewPlan.priceCents}
          price={fmtPrice(selectedAutoRenewPlan.priceCents, selectedAutoRenewPlan.currency)}
          period={selectedAutoRenewPlan.period}
          onClose={() => setSelectedAutoRenewPlan(null)}
        />
      )}
    </div>
  );
}
