'use client';

/**
 * /membership — 会员订阅。
 * 站内工具保持免费,会员是「支持本站 + 专属权益」(徽章 / 抢先体验 / 致谢署名)。
 * 月 / 年 / 永久三档,WCA 登录后下单,聚合支付(支付宝 / 微信)扫码付款,手动续费。
 * 在线支付未开通时引导走打赏 + 联系站长手动开通。admin 登录后见管理面板。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, AlertTriangle, CalendarClock } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore, isAdmin } from '@/lib/auth-store';
import { fmtPrice, fmtDate } from '@/lib/membership-format';
import AppLink from '@/components/AppLink';
import CubeRootLogo from '@/components/CubeRootLogo';
import DonateModal from '@/components/DonateModal';
import { Spinner } from '@/components/Spinner/Spinner';
import {
  listPlans, getMyMembership, getOrderStatus, membershipExpiry,
  reconcileVisiblePlan, isAutoRenewPlanSlug,
  type MembershipPlan, type Membership, type PayChannels,
} from '@/lib/membership-api';
import PayModal from './PayModal';
import AdminPanel from './AdminPanel';
import MemberContact from './MemberContact';
import MemberProfileIntro from './MemberProfileIntro';
import AutoRenewModal from './AutoRenewModal';
import './membership.css';

const PERK_LABEL: Record<string, { zh: string; en: string }> = {
  unlimited_333_cloud_optimal: {
    zh: '不限量三阶魔方云端最少步快速求解',
    en: 'Unlimited cloud-based 3×3 optimal solving',
  },
  expert_recon_10_monthly: {
    zh: '获取高手的解法复盘（每月 10 把）',
    en: 'Expert solve reconstructions (10 per month)',
  },
  badge: { zh: '专属会员徽章', en: 'Exclusive member badge' },
  early: { zh: '新功能抢先体验', en: 'Early access to new features' },
  thanks: { zh: '致谢名单署名', en: 'Listed in the acknowledgments' },
  platform_follow: { zh: '获得魔方根在各平台的关注', en: 'Get followed by CubeRoot across platforms' },
  vip_group: { zh: '进入魔方根 VIP 群', en: 'Join the CubeRoot VIP group' },
  lifetime: { zh: '一次付费,永久有效', en: 'Pay once, valid forever' },
  teacher_student_profile_ranking: {
    zh: '老师主页展示学生，学生主页展示老师，排名页展示老师',
    en: 'Show students on teacher profiles, teachers on student profiles, and teachers in rankings',
  },
  enterprise_profile: {
    zh: '企业专属介绍页面',
    en: 'Dedicated enterprise profile page',
  },
  enterprise_content_storage_custom_course: {
    zh: '教程、图文资料和视频等云端存储，以及企业课程方案定制',
    en: 'Cloud storage for tutorials, articles, images, and videos, plus customized enterprise course plans',
  },
};

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
  const lang = useLang();
  const isZh = lang !== 'en';

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdmin();
  const loggedIn = mounted && !!user;

  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [payEnabled, setPayEnabled] = useState(false);
  const [channels, setChannels] = useState<PayChannels | undefined>(undefined);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [buyPlan, setBuyPlan] = useState<MembershipPlan | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [paid, setPaid] = useQueryState('paid');
  const [renew, setRenew] = useQueryState('renew');
  const [selectedAutoRenewPlan, setSelectedAutoRenewPlan] = useState<MembershipPlan | null>(null);

  const refreshMembership = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('cuberoot_jwt') && !localStorage.getItem('wca_access_token')) {
      setMembership(null);
      return;
    }
    getMyMembership().then((r) => setMembership(r.membership)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    listPlans()
      .then((r) => { if (!cancel) { setPlans(r.plans); setPayEnabled(r.payEnabled); setChannels(r.channels); } })
      .catch((e) => { if (!cancel) setLoadErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancel = true; };
  }, []);

  useEffect(() => { if (mounted) refreshMembership(); }, [mounted, user?.wcaId, refreshMembership]);

  // 支付返回(return_url 带 ?paid=<单号>):轮询查单几次,确认入账后刷新状态。
  useEffect(() => {
    if (!paid || !mounted) return;
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
  }, [paid, mounted]);

  const isLifetime = membership?.lifetime && membership.active;
  const activeMember = membership?.active;
  const expiry = useMemo(() => membershipExpiry(membership), [membership]);

  function handleChoose(plan: MembershipPlan) {
    if (!loggedIn) { login(); return; }
    if (payEnabled) setBuyPlan(plan);
    else setDonateOpen(true);
  }

  // 便捷续费:默认续上当前 / 上次的套餐(过期会员的 planSlug 即上次套餐),回落月度 → 第一档。
  const renewMembership = useCallback(() => {
    if (!loggedIn) { login(); return; }
    if (!payEnabled) { setDonateOpen(true); return; }
    const list = (plans ?? []).filter((plan) => !isAutoRenewPlanSlug(plan.slug));
    const target =
      list.find((p) => p.slug === membership?.planSlug) ??
      list.find((p) => p.period === 'month') ??
      list[0];
    if (target) setBuyPlan(target);
  }, [loggedIn, login, payEnabled, plans, membership?.planSlug]);

  // 全局到期提醒 banner 深链 ?renew=1 → 自动打开续费弹窗(永久会员忽略)。
  useEffect(() => {
    if (!renew || !mounted || !plans || !membership || membership.lifetime) return;
    renewMembership();
    setRenew(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renew, mounted, plans, membership]);

  const sortedPlans = useMemo(() => plans ?? [], [plans]);
  const autoRenewPlans = sortedPlans.filter((plan) => isAutoRenewPlanSlug(plan.slug));
  const oneTimePlans = sortedPlans.filter((plan) => !isAutoRenewPlanSlug(plan.slug));
  const enterprisePlans = oneTimePlans.filter((plan) => plan.slug.startsWith('enterprise_'));
  const personalPlans = oneTimePlans.filter((plan) => !plan.slug.startsWith('enterprise_'));
  const showAutoRenew = autoRenewPlans.length > 0;
  const universalPerks = intersectPerks(sortedPlans);
  if (!universalPerks.includes('platform_follow')) universalPerks.push('platform_follow');
  if (!universalPerks.includes('vip_group')) universalPerks.push('vip_group');
  const universalPerkSet = new Set(universalPerks);
  const enterpriseSharedPerks = intersectPerks(enterprisePlans)
    .filter((perk) => !universalPerkSet.has(perk));
  const enterpriseSharedPerkSet = new Set(enterpriseSharedPerks);

  const handlePlanUpdated = useCallback((updatedPlan: MembershipPlan) => {
    setPlans((current) => current ? reconcileVisiblePlan(current, updatedPlan) : current);
  }, []);

  function renderPerks(perks: string[]) {
    if (perks.length === 0) return null;
    return (
      <ul className="mem-plan-perks">
        {perks.map((perk) => (
          <li key={perk}><Check size={13} /> {tr(PERK_LABEL[perk] ?? { zh: perk, en: perk })}</li>
        ))}
      </ul>
    );
  }

  function renderOneTimePlan(plan: MembershipPlan, sectionPerks: Set<string> = new Set()) {
    const current = activeMember && membership?.planSlug === plan.slug && !membership.lifetime;
    const planOnlyPerks = plan.perks.filter((perk) =>
      !universalPerkSet.has(perk) && !sectionPerks.has(perk));
    return (
      <div key={plan.slug} className={`mem-plan${plan.period === 'lifetime' ? ' is-feature' : ''}`}>
        {plan.period === 'lifetime' && (
          <span className="mem-plan-tag">{tr({ zh: '最超值', en: 'Best value' })}</span>
        )}
        <div className="mem-plan-name">{isZh ? plan.nameZh : plan.nameEn}</div>
        <div className="mem-plan-price">
          <span className="mem-plan-amount">{fmtPrice(plan.priceCents, plan.currency)}</span>
          <span className="mem-plan-unit">/ {planUnit(plan, isZh)}</span>
        </div>
        {renderPerks(planOnlyPerks)}
        <button className="mem-plan-cta" onClick={() => handleChoose(plan)}>
          {!loggedIn
            ? tr({ zh: '登录后开通', en: 'Sign in to join' })
            : current
              ? tr({ zh: '续费', en: 'Renew' })
              : tr({ zh: '开通', en: 'Subscribe' })}
        </button>
      </div>
    );
  }

  return (
    <div className="mem-page">
      <header className="mem-head">
        <h1 className="mem-title">
          <CubeRootLogo className="mem-title-logo" height={22} variant="mark" />
          {tr({ zh: '成为 CubeRoot 会员', en: 'Become a CubeRoot member'
        })}
        </h1>
      </header>

      {/* 当前会员状态 / 到期提醒 */}
      {membership && (activeMember || expiry?.expired) && (
        <div className={`mem-status${expiry?.expiringSoon ? ' is-warning' : ''}${expiry?.expired ? ' is-expired' : ''}`}>
          {expiry?.expired && <AlertTriangle size={16} className="mem-status-icon" />}
          <span className="mem-status-text">
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
          {!membership.lifetime && (expiry?.expiringSoon || expiry?.expired) && (
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
            <h2 id="universal-perks-title" className="mem-plan-section-title">
              {tr({ zh: '所有会员共有权益', en: 'Benefits included with every membership' })}
            </h2>
            {renderPerks(universalPerks)}
          </section>

          <section className="mem-plan-section" aria-labelledby="personal-plans-title">
            <h2 id="personal-plans-title" className="mem-plan-section-title">
              {tr({ zh: '个人用户', en: 'Individual' })}
            </h2>
            <div className="mem-plans">
              {autoRenewPlans.map((plan) => {
                const copy = plan.period === 'year'
                  ? {
                      name: { zh: '连续包年', en: 'Annual auto-renewal' },
                      unit: { zh: '年', en: 'year' },
                      cadence: { zh: '每年自动延长会员', en: 'Membership renews annually' },
                      cta: { zh: '开通连续包年', en: 'Start annual auto-renewal' },
                    }
                  : {
                      name: { zh: '连续包月', en: 'Monthly auto-renewal' },
                      unit: { zh: '月', en: 'month' },
                      cadence: { zh: '每月自动延长会员', en: 'Membership renews monthly' },
                      cta: { zh: '开通连续包月', en: 'Start monthly auto-renewal' },
                    };
                return (
                  <div key={plan.slug} className="mem-plan is-autorenew">
                    <span className="mem-plan-tag">{tr({ zh: '自动续费', en: 'Auto-renew' })}</span>
                    <div className="mem-plan-name">{tr(copy.name)}</div>
                    <div className="mem-plan-price">
                      <span className="mem-plan-amount">{fmtPrice(plan.priceCents, plan.currency)}</span>
                      <span className="mem-plan-unit">/ {tr(copy.unit)}</span>
                    </div>
                    <ul className="mem-plan-perks">
                      <li><CalendarClock size={13} /> {tr(copy.cadence)}</li>
                      <li><Check size={13} /> {tr({ zh: '扣费前发送通知', en: 'Notice before every charge' })}</li>
                      <li><Check size={13} /> {tr({ zh: '可随时关闭自动续费', en: 'Cancel anytime' })}</li>
                      {plan.perks.filter((perk) => !universalPerkSet.has(perk)).map((p) => (
                        <li key={p}><Check size={13} /> {tr(PERK_LABEL[p] ?? { zh: p, en: p })}</li>
                      ))}
                    </ul>
                    <button className="mem-plan-cta" onClick={() => setSelectedAutoRenewPlan(plan)}>
                      {tr(copy.cta)}
                    </button>
                  </div>
                );
              })}
              {personalPlans.map((plan) => renderOneTimePlan(plan))}
            </div>
          </section>

          <section className="mem-plan-section" aria-labelledby="enterprise-plans-title">
            <h2 id="enterprise-plans-title" className="mem-plan-section-title">
              {tr({ zh: '企业用户', en: 'Enterprise' })}
            </h2>
            {renderPerks(enterpriseSharedPerks)}
            <div className="mem-plans">
              {enterprisePlans.map((plan) => renderOneTimePlan(plan, enterpriseSharedPerkSet))}
            </div>
          </section>
        </div>
      )}

      {/* 在线支付未开通提示 */}
      {plans && !payEnabled && !isLifetime && (
        <p className="mem-note">
          {tr({
            zh: '在线支付正在接入中。你可以先通过',
            en: 'Online payment is being set up. For now you can '
        })}
          <button className="mem-link-btn" onClick={() => setDonateOpen(true)}>{tr({ zh: '打赏', en: 'donate'
        })}</button>
          {tr({
            zh: '支持本站,并备注 WCA ID,站长会为你手动开通会员。',
            en: ' to support the site (note your WCA ID) and membership will be granted manually.'
        })}
        </p>
      )}

      <p className="mem-foot-note">
        {showAutoRenew
          ? tr({
              zh: '单次套餐不会自动扣款；自动续费套餐将在扣费前通知，并支持随时关闭。',
              en: 'One-time plans never auto-charge. Auto-renewal plans include notice before charging and can be cancelled anytime.'
            })
          : tr({
              zh: '会员为按周期一次性付款,不会自动扣款。到期前我们会提醒你,一键即可续费。',
              en: "Membership is a one-time payment per period — no auto-charge. We'll remind you before it expires, and renewing takes one click."
            })}
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
          <MemberProfileIntro
            membership={membership}
            onSaved={(profileIntro, profileImageIds) => setMembership({ ...membership, profileIntro, profileImageIds })}
          />
          <MemberContact membership={membership} onSaved={setMembership} isZh={isZh} />
        </>
      )}

      {/* admin 面板 */}
      {admin && <AdminPanel plans={plans ?? []} isZh={isZh} onPlanUpdated={handlePlanUpdated} />}

      {buyPlan && (
        <PayModal
          plan={buyPlan}
          channels={channels}
          isZh={isZh}
          onClose={() => setBuyPlan(null)}
          onPaid={() => { setBuyPlan(null); setJustPaid(true); refreshMembership(); }}
        />
      )}
      {donateOpen && <DonateModal lang={isZh ? 'zh' : 'en'} onClose={() => setDonateOpen(false)} />}
      {selectedAutoRenewPlan && (selectedAutoRenewPlan.period === 'month' || selectedAutoRenewPlan.period === 'year') && (
        <AutoRenewModal
          price={fmtPrice(selectedAutoRenewPlan.priceCents, selectedAutoRenewPlan.currency)}
          period={selectedAutoRenewPlan.period}
          onClose={() => setSelectedAutoRenewPlan(null)}
        />
      )}
    </div>
  );
}
