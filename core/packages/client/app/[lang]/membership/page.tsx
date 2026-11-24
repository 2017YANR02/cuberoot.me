'use client';
import { Tooltip } from '@/components/Tooltip';
import PageBackLink from '@/components/PageBackLink';

/**
 * /membership — 会员订阅。
 * 站内工具保持免费,会员是「支持本站 + 专属权益」(徽章 / 抢先体验 / 致谢署名)。
 * 自动续费与主动付款明确分开，签约不可用时不回退普通支付。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, AlertTriangle, Heart, UsersRound } from '@app-foundation/icons/lucide';
import { useQueryState } from 'nuqs';
import { useEntryRouter as useRouter } from '@/hooks/useEntryRouter';
import { clearMembershipReturn, membershipReturnRequiresActive, membershipReturnPath, readMembershipReturn, rememberMembershipReturn } from '@/lib/membership-return';
import { tr, useLang } from '@/i18n/tr';
import { hasAdminAccess, getSessionToken, getWcaToken, useAuthUser, authActions, getAuthUser } from '@/lib/auth-store';
import { isMiniProgramCommerceRestricted } from '@/lib/miniprogram-bridge';
import { fmtPrice, fmtDate, fmtVipId } from '@/lib/membership-format';
import { benefitCopy } from '@cuberoot/shared/membership-benefits';
import { useMembershipBenefits } from '@/hooks/useMembershipBenefits';
import BoolToggle from '@/components/BoolToggle';
import PlanPicker from './PlanPicker';
import BenefitsEditor from './BenefitsEditor';
import AppLink from '@/components/AppLink';
import { MEMBERSHIP_COPY } from '@/lib/membership-copy';
import CubeRootLogo from '@/components/CubeRootLogo';
import DonateModal from '@/components/DonateModal';
import MembershipSkeleton from './MembershipSkeleton';
import {
  listPlans, getMyMembership, getOrderStatus, membershipExpiry,
  isAutoRenewPlanSlug, renewalAvailability,
  type MembershipPlan, type Membership, type PayChannels,
} from '@/lib/membership-api';
import MemberContact from './MemberContact';
import MemberProfileEditor from '@/components/MemberProfileEditor';
import MoreToggle from '@/components/MoreToggle';
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
  const router = useRouter();
  const lang = useLang();
  const isZh = lang !== 'en';

  const user = useAuthUser();
  const login = authActions.login;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [desktopLayout, setDesktopLayout] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 900px)');
    if (!desktop) return;
    const syncLayout = () => setDesktopLayout(desktop.matches);
    syncLayout();
    desktop.addEventListener('change', syncLayout);
    return () => desktop.removeEventListener('change', syncLayout);
  }, []);
  const BenefitsContainer = desktopLayout ? 'div' : 'details';
  const appleAvailable = useAppleMembershipAvailable();
  const appleSurface = mounted && (appleAvailable || isIosMembershipSurface());
  const googleAvailable = useStoreMembershipAvailable('google');
  const googleSurface = mounted && (googleAvailable || installedMembershipStore() === 'google');
  const directApp = useWebMembershipAvailable();
  const store = googleSurface ? 'google' : appleSurface ? 'apple' : null;
  const admin = mounted && hasAdminAccess(user);
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
  const [webPaymentMode, setPaymentMode] = useState<'renewal' | 'manual'>('renewal');
  const paymentMode = directApp ? 'manual' : webPaymentMode;
  const [personalPeriod, setPersonalPeriod] = useState('month');
  const [enterprisePeriod, setEnterprisePeriod] = useState('month');
  const [payEnabled, setPayEnabled] = useState(false);
  const [channels, setChannels] = useState<PayChannels>();
  const [buyPlan, setBuyPlan] = useState<MembershipPlan | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [enterpriseBuyer, setEnterpriseBuyer] = useState<{ owner: typeof user; eligible: boolean } | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [paid, setPaid] = useQueryState('paid');
  const [renew, setRenew] = useQueryState('renew');
  const [selectedAutoRenewPlan, setSelectedAutoRenewPlan] = useState<MembershipPlan | null>(null);
  const [renewalSetup, setRenewalSetup] = useState<{ owner: typeof user; value: Awaited<ReturnType<typeof renewalAvailability>> } | null>(null);

  // Resolve the signing channel while browsing, before mounting its checkout UI.
  useEffect(() => {
    if (!loggedIn || directApp || store || commerceRestricted !== false) return;
    let cancelled = false;
    void renewalAvailability().then(value => {
      if (!cancelled) setRenewalSetup({ owner: user, value });
    }).catch(() => {}); // The modal can retry if preloading fails.
    return () => { cancelled = true; };
  }, [loggedIn, directApp, store, commerceRestricted, user]);

  const refreshMembership = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!getSessionToken() && !getWcaToken()) {
      setMembership(null);
      return;
    }
    const uid = user?.uid;
    const queryNext = membershipReturnPath(new URLSearchParams(window.location.search).get('next'));
    const requireActive = queryNext
      ? new URLSearchParams(window.location.search).get('requireActive') === '1'
      : !!(uid && membershipReturnRequiresActive(uid));
    if (uid && queryNext) rememberMembershipReturn(queryNext, uid, requireActive);
    getMyMembership().then((r) => {
      if (getAuthUser()?.uid !== uid) return;
      const destination = queryNext ?? (uid ? readMembershipReturn(uid) : null);
      if ((requireActive ? r.membership?.active : (r.isMember ?? r.membership?.active)) && destination) {
        clearMembershipReturn();
        router.replace(destination);
        return;
      }
      setMembership(r.membership);
      setEnterpriseBuyer({ owner: user, eligible: r.canPurchaseEnterprise === true });
    }).catch(() => setEnterpriseBuyer(null));
  }, [user, router]);

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

  // Also reconcile after returning from an external signing app or another payment tab.
  useEffect(() => {
    if (!mounted || !loggedIn || commerceRestricted !== false) return;
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') refreshMembership(); };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [mounted, loggedIn, commerceRestricted, refreshMembership]);

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

  // 官网直装 Android 只提供单次购买。
  const renewMembership = useCallback(() => {
    if (!loggedIn) { login(); return; }
    if (membership?.planSlug?.startsWith('enterprise_')) return;
    if (directApp) {
      document.getElementById('personal-plans-title')?.scrollIntoView();
      return;
    }
    const list = renewalPrices.filter((plan) => isAutoRenewPlanSlug(plan.slug) && !plan.slug.startsWith('enterprise_'));
    const target = list.find((plan) => plan.slug === membership?.planSlug)
      ?? list.find((plan) => plan.period === (membership?.planSlug?.includes('year') ? 'year' : 'month'))
      ?? list[0];
    if (target) setSelectedAutoRenewPlan(target);
  }, [loggedIn, login, directApp, renewalPrices, membership?.planSlug]);

  // 全局到期提醒 banner 深链 ?renew=1 → 自动打开续费弹窗(永久会员忽略)。
  useEffect(() => {
    if (store || commerceRestricted !== false || !renew || !mounted || !plans || !membership || membership.lifetime) return;
    renewMembership();
    setRenew(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, directApp, commerceRestricted, renew, mounted, plans, membership, renewalPrices]);

  const sortedPlans = useMemo(() => plans ?? [], [plans]);
  const autoRenewPlans = renewalPrices.filter((plan) => isAutoRenewPlanSlug(plan.slug) && !plan.slug.startsWith('enterprise_'));
  const oneTimePlans = sortedPlans.filter((plan) => !isAutoRenewPlanSlug(plan.slug));
  const enterpriseRenewalPlans = renewalPrices.filter(plan => plan.slug === 'enterprise_monthly_auto_renew');
  const enterprisePlans = oneTimePlans.filter((plan) => plan.slug === 'enterprise_monthly');
  const personalPlans = oneTimePlans.filter((plan) => !plan.slug.startsWith('enterprise_'));
  const universalPerks = benefits.items.filter(item => item.group === 'common').map(item => item.id);
  const enterpriseSharedPerks = benefits.items.filter(item => item.group === 'enterprise').map(item => item.id);

  const visiblePersonal = paymentMode === 'renewal' ? autoRenewPlans : personalPlans;
  const visibleEnterprise = paymentMode === 'renewal' ? enterpriseRenewalPlans : enterprisePlans;
  const selectedPersonal = visiblePersonal.find(plan => plan.period === personalPeriod) ?? visiblePersonal[0];
  const selectedEnterprise = visibleEnterprise.find(plan => plan.period === enterprisePeriod) ?? visibleEnterprise[0];

  if (store) return <main className="mem-page"><AppleMembership key={`${store}:${user?.uid ?? ''}`} store={store} refresh={refreshMembership} benefits={renderPerks([...new Set([...universalPerks, ...intersectPerks(personalPlans)])].filter(perk => perk !== 'lifetime'))} /></main>;

  if (commerceRestricted === null) return (
    <div className="mem-page mem-comparison"><MembershipSkeleton header /></div>
  );

  if (commerceRestricted) {
    return (
      <div className="mem-page">
        <header className="mem-head">
          <div className="page-back-heading"><PageBackLink label={tr({ zh: '返回', en: 'Back' })} fallback="/account" /><h1 className="mem-title">
            <CubeRootLogo className="mem-title-logo" height={22} variant="mark" />
            CubeRoot Pro
          </h1></div>
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

  function renderPerks(ids: string[], group?: 'common' | 'enterprise') {
    const perks = [...new Set(ids)].filter(id => benefitMap.get(id)?.enabled);
    if (perks.length === 0 && !(admin && group)) return null;
    const list = (
      <ul className="mem-plan-perks">
        {group === 'enterprise' && <li><Check size={13} /> {tr({ zh: '包含全部 Pro 权益', en: 'Includes all Pro benefits' })}</li>}
        {perks.map((perk) => (
          <li key={perk}><Check size={13} /> {tr(benefitCopy(benefitMap.get(perk)!))}</li>
        ))}
      </ul>
    );
    return admin && (group || perks.some(perk => benefitMap.has(perk)))
      ? <BenefitsEditor onSaved={setBenefits} group={group} benefitIds={perks} language={isZh ? 'zh' : 'en'}>{list}</BenefitsEditor>
      : list;
  }

  function renderPlans(options: MembershipPlan[], selected: MembershipPlan | undefined, enterprise = false) {
    const renewal = paymentMode === 'renewal';
    if (!selected) return <p role="status">{tr({ zh: '暂无可选套餐', en: 'No plans available' })}</p>;
    const monthly = options.find(plan => plan.period === 'month' && plan.periodCount === 1);
    const eligible = !enterprise || (loggedIn && enterpriseBuyer?.owner === user && enterpriseBuyer.eligible);
    const reviewedMonthly = enterprise ? (renewal ? 29900 : 39900) : (renewal ? 2999 : 3999);
    const reviewedAnnual = enterprise ? (renewal ? 299900 : 399900) : (renewal ? 29900 : 39900);
    const reviewedPrice = selected.period === 'year' ? reviewedAnnual : reviewedMonthly;
    const available = eligible && selected.currency === 'CNY' && selected.periodCount === 1
      && (selected.period === 'month' || selected.period === 'year') && reviewedPrice === selected.priceCents
      && (renewal ? isAutoRenewPlanSlug(selected.slug) : payEnabled);
    return <>
      <PlanPicker desktopPricing selected={selected.slug} options={options.map(plan => {
        const annual = plan.period === 'year';
        const savings = annual && plan.periodCount === 1 && monthly && monthly.currency === plan.currency && monthly.priceCents > 0
          ? Math.round(100 * (1 - plan.priceCents / (12 * monthly.priceCents))) : 0;
        return { id: plan.slug, price: fmtPrice(plan.priceCents, plan.currency),
          shortCaption: plan.periodCount === 1 && (annual || plan.period === 'month')
            ? tr(annual ? { zh: '年付', en: 'Yearly' } : { zh: '月付', en: 'Monthly' }) : planUnit(plan, isZh),
          caption: plan.periodCount === 1 && (annual || plan.period === 'month')
            ? renewal ? tr(annual ? { zh: '按年计费', en: 'Billed annually' } : { zh: '按月计费', en: 'Billed monthly' })
              : tr(annual ? { zh: '一年', en: 'One year' } : { zh: '一个月', en: 'One month' })
            : planUnit(plan, isZh),
          savings: savings > 0 && savings < 100 ? savings : null };
      })} onSelect={slug => {
        const plan = options.find(option => option.slug === slug);
        if (plan) (enterprise ? setEnterprisePeriod : setPersonalPeriod)(plan.period);
      }} disabled={!available} onSubmit={() => {
        if (!loggedIn) { login(); return; }
        if (renewal) setSelectedAutoRenewPlan(selected);
        else setBuyPlan(selected);
      }} submitLabel={!eligible ? tr({ zh: '仅限已认证企业', en: 'Verified enterprises only' })
        : !available ? tr({ zh: '暂不可购买', en: 'Currently unavailable' }) : tr(MEMBERSHIP_COPY.subscribe)} />
      {!renewal && <p className="mem-payment-note">{tr({ zh: '单次购买，无后续扣款。', en: 'One-time purchase. No recurring charges.' })}</p>}
    </>;
  }

  const manageMembersLabel = tr({ zh: '会员管理', en: 'Manage memberships' });
  const personalSettings = activeMember && membership && (
    <>
      <MemberProfileEditor profile={membership}
        onSaved={(profileIntro, profileImageIds) => setMembership({ ...membership, profileIntro, profileImageIds })} />
      <MemberContact membership={membership} onSaved={setMembership} isZh={isZh} />
    </>
  );

  return (
    <div className="mem-page mem-comparison">
      <header className="mem-head">
        <div className="page-back-heading"><PageBackLink label={tr({ zh: '返回', en: 'Back' })} fallback="/account" /><h1 className="mem-title">
          <CubeRootLogo className="mem-title-logo" height={22} variant="mark" />
          CubeRoot Pro
        </h1></div>
        <div className="mem-head-actions">
          {admin && <Tooltip content={manageMembersLabel}>{tip =>
            <AppLink {...tip} href="/admin/users?tab=memberships" prefetch={false} className="mem-admin-entry" aria-label={manageMembersLabel}>
              <UsersRound size={20} aria-hidden="true" />
            </AppLink>}
          </Tooltip>}
          <button type="button" className="mem-donate" onClick={() => {
            if (!loggedIn) { login(); return; }
            setDonateOpen(true);
          }}>
            <Heart className="site-support-heart" size={18} aria-hidden="true" />
            {tr({ zh: '赞赏', en: 'Donate' })}
          </button>
        </div>
      </header>

      {directApp && <p className="mem-note">
        {tr({ zh: '单次购买。已有订阅请在原渠道管理。', en: 'One-time purchases. Manage existing subscriptions in their original channel.' })}
      </p>}

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
        <MembershipSkeleton />
      ) : isLifetime ? (
        <div className="mem-empty">{tr({ zh: '你已经是永久会员,无需再次购买。', en: 'You already have lifetime membership — nothing to buy.'
        })}</div>
      ) : (
        <div className="mem-plan-sections">
          {!directApp && <div className="mem-payment-choice">
            <BoolToggle value={paymentMode === 'renewal'} label={tr({ zh: '自动续费', en: 'Auto-renew' })}
              onChange={enabled => setPaymentMode(enabled ? 'renewal' : 'manual')} />
          </div>}
          <section className="mem-plan-section mem-free-tier" aria-labelledby="free-plan-title">
            <h2 id="free-plan-title" className="mem-plan-section-title">Free</h2>
            <div className="mem-tier-price"><strong>{fmtPrice(0, 'CNY')}</strong></div>
            <AppLink href="/" className="mem-free-link">{tr({ zh: '免费使用 CubeRoot', en: 'Use CubeRoot for free' })}</AppLink>
            <BenefitsContainer className="mem-store-benefits">
              {!desktopLayout && <MoreToggle as="summary">{tr({ zh: 'Free 权益', en: 'Free benefits' })}</MoreToggle>}
              <ul className="mem-plan-perks">
                {[
                  { zh: '用计时器记录成绩，查看个人平均成绩', en: 'Time solves and track your averages' },
                  { zh: '为不同项目生成练习打乱', en: 'Generate practice scrambles for different events' },
                  { zh: '在虚拟魔方上演练转动和公式', en: 'Try moves and algorithms on a virtual cube' },
                  { zh: '浏览公式库，按解法和情形查找公式', en: 'Browse algorithms by method and case' },
                  { zh: '跟随分步教程学习还原', en: 'Learn to solve with step-by-step tutorials' },
                  { zh: '查看公开复盘，逐步回看选手解法', en: 'Follow public solve reconstructions move by move' },
                  { zh: '在比赛日历中查找 WCA 比赛', en: 'Find WCA competitions in the calendar' },
                  { zh: '查询 WCA 比赛成绩、排名和纪录', en: 'Look up WCA results, rankings and records' },
                ].map(perk => <li key={perk.en}><Check size={13} />{tr(perk)}</li>)}
              </ul>
            </BenefitsContainer>
          </section>
          <section id="personal-plans-title" className="mem-plan-section" aria-labelledby="universal-perks-title">
            <h2 id="universal-perks-title" className="mem-plan-section-title">Pro</h2>
            {renderPlans(visiblePersonal, selectedPersonal)}
            <BenefitsContainer className="mem-store-benefits">
              {!desktopLayout && <MoreToggle as="summary">{tr({ zh: 'Pro 权益', en: 'Pro benefits' })}</MoreToggle>}
              {renderPerks([...universalPerks, ...(selectedPersonal?.perks ?? [])], 'common')}
            </BenefitsContainer>
          </section>
          <section id="enterprise-plans-title" className="mem-plan-section" aria-labelledby="enterprise-perks-title">
            <h2 id="enterprise-perks-title" className="mem-plan-section-title">{tr({ zh: '企业 Pro', en: 'Enterprise Pro' })}</h2>
            {renderPlans(visibleEnterprise, selectedEnterprise, true)}
            <BenefitsContainer className="mem-store-benefits">
              {!desktopLayout && <MoreToggle as="summary">{tr({ zh: '企业 Pro 权益', en: 'Enterprise Pro benefits' })}</MoreToggle>}
              {renderPerks([...enterpriseSharedPerks, ...(selectedEnterprise?.perks ?? []).filter(id => !universalPerks.includes(id))], 'enterprise')}
            </BenefitsContainer>
          </section>
        </div>
      )}

      {/* 会员联系方式(续费提醒 / 账号找回) */}
      {personalSettings && (admin ? <details className="mem-personal-settings mem-admin-fold">
        <MoreToggle as="summary">{tr({ zh: '个人资料与续费提醒', en: 'Personal profile and renewal reminders' })}</MoreToggle>
        {personalSettings}
      </details> : personalSettings)}

      <nav className="mem-service-links mem-service-links--main" aria-label={tr({ zh: '会员服务', en: 'Membership services' })}>
        <AppLink href="/membership/subscription" prefetch={false}>{tr(MEMBERSHIP_COPY.manage)}</AppLink>
        {!directApp && <AppLink href="/membership/renewal-terms" prefetch={false}>{tr(MEMBERSHIP_COPY.agreement)}</AppLink>}
      </nav>

      {loggedIn && donateOpen && <DonateModal lang={lang} onClose={() => setDonateOpen(false)} />}
      {buyPlan && <PayModal plan={buyPlan} channels={channels} isZh={isZh}
        onClose={() => setBuyPlan(null)} onPaid={() => { setBuyPlan(null); setJustPaid(true); refreshMembership(); }} />}
      {!directApp && selectedAutoRenewPlan && (selectedAutoRenewPlan.period === 'month' || selectedAutoRenewPlan.period === 'year') && (
        <AutoRenewModal
          key={user?.uid}
          plan={selectedAutoRenewPlan}
          initialAvailability={renewalSetup && renewalSetup.owner === user ? renewalSetup.value : undefined}
          isZh={isZh}
          onPaid={refreshMembership}
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
