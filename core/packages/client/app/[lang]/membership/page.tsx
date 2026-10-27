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
import { MEMBERSHIP_COPY } from '@/lib/membership-copy';
import { CompactSelect } from '@/components/CompactSelect';
import CubeRootLogo from '@/components/CubeRootLogo';
import { Spinner } from '@/components/Spinner/Spinner';
import {
  listPlans, getMyMembership, getOrderStatus, membershipExpiry,
  reconcileVisiblePlan, isAutoRenewPlanSlug,
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
  const [payEnabled, setPayEnabled] = useState(false);
  const [channels, setChannels] = useState<PayChannels>();
  const [buyPlan, setBuyPlan] = useState<MembershipPlan | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [enterpriseBuyer, setEnterpriseBuyer] = useState<{ owner: typeof user; eligible: boolean } | null>(null);
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
    getMyMembership().then((r) => {
      setMembership(r.membership);
      setEnterpriseBuyer({ owner: user, eligible: r.canPurchaseEnterprise === true });
    }).catch(() => setEnterpriseBuyer(null));
  }, [user]);

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
        {group === 'enterprise' && <li><Check size={13} /> {tr({ zh: '包含以上个人用户权益，以及以下企业专属权益。', en: 'Includes all individual benefits above, plus these enterprise benefits.' })}</li>}
        {perks.map((perk) => (
          <li key={perk}><Check size={13} /> {tr(benefitMap.has(perk) ? benefitCopy(benefitMap.get(perk)!) : { zh: perk, en: perk })}</li>
        ))}
      </ul>
    );
    return admin && (group || perks.some(perk => benefitMap.has(perk))) ? <BenefitsEditor onSaved={setBenefits} group={group} benefitIds={perks} language={isZh ? 'zh' : 'en'} heading={heading}>{list}</BenefitsEditor> : <>{heading && <h2 id={heading.id} className="mem-plan-section-title">{heading.text}</h2>}{list}</>;
  }

  function renderPaymentChoice() {
    const items = [
      { value: 'renewal' as const, label: tr(MEMBERSHIP_COPY.renewal) },
      { value: 'manual' as const, label: tr(MEMBERSHIP_COPY.manual) },
    ];
    return <CompactSelect className="mem-plan-tag" triggerClassName="mem-plan-mode-trigger" unstyledTrigger
      ariaLabel={tr({ zh: '付费方式', en: 'Payment method' })}
      label={items.find(item => item.value === paymentMode)!.label} items={items} value={paymentMode}
      onChange={setPaymentMode} />;
  }

  function renderPlan(plan: MembershipPlan, enterprise = false) {
    const renewal = paymentMode === 'renewal';
    const annual = plan.period === 'year';
    // Keep checkout disabled until the deployed price matches the reviewed offer.
    const monthly = enterprise ? (renewal ? 29900 : 39900) : (renewal ? 2999 : 3999);
    const yearly = enterprise ? (renewal ? 299900 : 399900) : (renewal ? 29900 : 39900);
    const priceCents = annual ? yearly : monthly;
    const priceReady = priceCents === plan.priceCents;
    const saving = annual ? monthly * 12 - yearly : (enterprise ? 10000 : 1000);
    // Account-specific signing availability is checked in AutoRenewModal after login.
    const enterpriseEligible = !enterprise || (loggedIn && enterpriseBuyer?.owner === user && enterpriseBuyer.eligible);
    const available = enterpriseEligible && (renewal ? isAutoRenewPlanSlug(plan.slug) && priceReady : payEnabled && priceReady);
    const extraPerks = plan.perks.filter(perk => !universalPerkSet.has(perk) && (!enterprise || !enterpriseSharedPerkSet.has(perk)));
    const unavailable = tr({ zh: '暂不可购买', en: 'Currently unavailable' });
    return (
      <div key={plan.slug} className={'mem-plan' + (renewal ? ' is-autorenew' : '')}>
        {renderPaymentChoice()}
        <div className="mem-plan-heading">
        <div className="mem-plan-name">{tr(annual
          ? (enterprise ? MEMBERSHIP_COPY.enterpriseAnnual : MEMBERSHIP_COPY.annual)
          : (enterprise ? MEMBERSHIP_COPY.enterpriseMonthly : MEMBERSHIP_COPY.monthly))}</div>
        <p className="mem-plan-saving">{annual || renewal
          ? tr({ zh: '怒省 {amount}', en: 'Save {amount}' }).replace('{amount}', fmtPrice(saving, plan.currency))
            : tr({ zh: '灵活购买，无后续扣款', en: 'Flexible purchase. No recurring charges.' })}</p>
        </div>
        <div className="mem-plan-price">
          <span className="mem-plan-amount">{fmtPrice(priceCents, plan.currency)}</span>
          <span className="mem-plan-unit">/ {planUnit(plan, isZh)}</span>
        </div>
        <ul className="mem-plan-perks">
          {extraPerks.map(perk => <li key={perk}><Check size={13} />{tr(benefitMap.has(perk) ? benefitCopy(benefitMap.get(perk)!) : { zh: perk, en: perk })}</li>)}
        </ul>
        <button data-corner-shape="native" className="mem-plan-cta" disabled={!available} onClick={() => {
          if (!loggedIn) { login(); return; }
          if (renewal) setSelectedAutoRenewPlan(plan);
          else if (priceReady) setBuyPlan(plan);
        }}>
          {!enterpriseEligible ? tr({ zh: '仅限已认证企业', en: 'Verified enterprises only' }) : !available ? unavailable : tr(MEMBERSHIP_COPY.subscribe)}
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

      {directApp && <p className="mem-sub" role="status">
        {tr({ zh: '支付成功后开通会员，订阅周期与续费规则以确认页面为准。', en: 'Membership starts after successful payment. See the confirmation page for the subscription period and renewal terms.' })}
      </p>}
      {directApp && <p className="mem-note">
        {tr({ zh: '已有商店订阅仍由原商店自动续费，切换安装渠道不会取消。网站、Apple 与 Google Play 会员期并存，取较晚到期日，不叠加时长；购买前请核对原订阅。', en: 'Existing store subscriptions continue renewing in their original store; switching app distribution does not cancel them. Website, Apple and Google Play memberships run concurrently, using the latest expiry without adding durations. Check existing subscriptions before buying.' })}
        {' '}<a href="https://play.google.com/store/account/subscriptions?package=me.cuberoot.app" target="_blank" rel="noopener noreferrer">{tr({ zh: '管理 Google Play 订阅', en: 'Manage Google Play subscriptions' })}</a>
      </p>}

      <nav className="mem-service-links" aria-label={tr({ zh: '会员服务', en: 'Membership services' })}>
        <AppLink href="/membership/subscription" prefetch={false}>{tr(MEMBERSHIP_COPY.manage)}</AppLink>
        <AppLink href="/membership/renewal-terms" prefetch={false}>{tr(MEMBERSHIP_COPY.agreement)}</AppLink>
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
            {renderPerks(universalPerks, 'common', { id: 'universal-perks-title', text: tr({ zh: '个人', en: 'Individual' }) })}
          </section>
          <section id="personal-plans-title" className="mem-plan-section" aria-labelledby="universal-perks-title">
            <div className="mem-plans">
              {(paymentMode === 'renewal' ? autoRenewPlans : personalPlans).map(plan => renderPlan(plan))}
              {paymentMode === 'renewal' && autoRenewPlans.length === 0 && <p role="status">{tr({ zh: '自动续费暂不可用，请稍后重试。', en: 'Auto-renewal is temporarily unavailable. Please try again later.' })}</p>}
            </div>
          </section>
          <section className="mem-plan-section" aria-labelledby="enterprise-perks-title">
            {renderPerks(enterpriseSharedPerks, 'enterprise', { id: 'enterprise-perks-title', text: tr({ zh: '企业', en: 'Enterprise' }) })}
          </section>
          <section id="enterprise-plans-title" className="mem-plan-section" aria-labelledby="enterprise-perks-title">
            <div className="mem-plans">{(paymentMode === 'renewal' && enterpriseRenewalPlans.length === 1 ? enterpriseRenewalPlans : enterprisePlans).map(plan => renderPlan(plan, true))}</div>
          </section>
        </div>
      )}





      <p className="mem-foot-note">
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
