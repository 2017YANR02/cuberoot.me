'use client';

/**
 * /membership — 会员订阅。
 * 站内工具保持免费,会员是「支持本站 + 专属权益」(徽章 / 抢先体验 / 致谢署名)。
 * 月 / 年 / 永久三档,WCA 登录后下单,聚合支付(支付宝 / 微信)扫码付款,手动续费。
 * 在线支付未开通时引导走打赏 + 联系站长手动开通。admin 登录后见管理面板。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Check, Loader2, RefreshCw } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { tr, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore, isAdmin } from '@/lib/auth-store';
import AppLink from '@/components/AppLink';
import DonateModal from '@/components/DonateModal';
import MembershipBadge from '@/components/MembershipBadge';
import {
  listPlans, getMyMembership, getOrderStatus,
  type MembershipPlan, type Membership,
} from '@/lib/membership-api';
import PayModal from './PayModal';
import AdminPanel from './AdminPanel';
import MemberContact from './MemberContact';
import './membership.css';

const PERK_LABEL: Record<string, { zh: string; en: string }> = {
  badge: { zh: '专属会员徽章', en: 'Exclusive member badge' },
  early: { zh: '新功能抢先体验', en: 'Early access to new features' },
  thanks: { zh: '致谢名单署名', en: 'Listed in the acknowledgments' },
  lifetime: { zh: '一次付费,永久有效', en: 'Pay once, valid forever' },
};

function fmtPrice(cents: number, currency: string): string {
  const sym = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  const n = cents / 100;
  return sym + (Number.isInteger(n) ? String(n) : n.toFixed(2));
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

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export default function MembershipPage() {
  const lang = useLang();
  const isZh = lang !== 'en';
  useDocumentTitle('会员', 'Membership');

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdmin();
  const loggedIn = mounted && !!user;

  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [payEnabled, setPayEnabled] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [buyPlan, setBuyPlan] = useState<MembershipPlan | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [paid, setPaid] = useQueryState('paid');

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
      .then((r) => { if (!cancel) { setPlans(r.plans); setPayEnabled(r.payEnabled); } })
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

  function handleChoose(plan: MembershipPlan) {
    if (!loggedIn) { login(); return; }
    if (payEnabled) setBuyPlan(plan);
    else setDonateOpen(true);
  }

  const sortedPlans = useMemo(() => plans ?? [], [plans]);

  return (
    <div className="mem-page">
      <header className="mem-head">
        <h1 className="mem-title">
          <Crown size={22} strokeWidth={2} className="mem-title-icon" />
          {tr({ zh: '成为 CubeRoot 会员', en: 'Become a CubeRoot member',
              zhHant: "成為 CubeRoot 會員"
        })}
        </h1>
        <p className="mem-sub">
          {tr({
            zh: '所有工具始终免费。开通会员是为了支持本站的服务器与日常维护,并解锁一些专属权益。',
            en: 'All tools stay free. Membership supports the servers and upkeep, and unlocks a few member-only perks.',
              zhHant: "所有工具始終免費。開通會員是為了支援本站的伺服器與日常維護,並解鎖一些專屬權益。"
        })}
        </p>
      </header>

      {/* 当前会员状态 */}
      {activeMember && membership && (
        <div className="mem-status">
          <MembershipBadge lifetime={membership.lifetime} size={15} />
          <span className="mem-status-text">
            {membership.lifetime
              ? tr({ zh: '你是永久会员,感谢长期的支持 ♡', en: "You're a lifetime member — thank you for the support ♡",
                  zhHant: "你是永久會員,感謝長期的支援 ♡"
            })
              : tr({ zh: '会员有效期至 {d}', en: 'Member until {d}',
                  zhHant: "會員有效期至 {d}"
            }).replace('{d}', fmtDate(membership.expiresAt))}
          </span>
          <button className="mem-status-refresh" onClick={refreshMembership} aria-label={tr({ zh: '刷新', en: 'Refresh',
              zhHant: "重新整理"
        })}>
            <RefreshCw size={13} />
          </button>
        </div>
      )}

      {justPaid && (
        <div className="mem-paid-banner">
          <Check size={15} /> {tr({ zh: '支付成功,会员已开通!', en: 'Payment received — your membership is active!',
              zhHant: "支付成功,會員已開通!"
        })}
        </div>
      )}

      {/* 套餐 */}
      {loadErr ? (
        <div className="mem-empty">{tr({ zh: '加载失败', en: 'Failed to load',
            zhHant: "載入失敗"
        })}: {loadErr}</div>
      ) : !plans ? (
        <div className="mem-empty"><Loader2 size={16} className="mem-spin" /> {tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>
      ) : isLifetime ? (
        <div className="mem-empty">{tr({ zh: '你已经是永久会员,无需再次购买。', en: 'You already have lifetime membership — nothing to buy.',
            zhHant: "你已經是永久會員,無需再次購買。"
        })}</div>
      ) : (
        <div className="mem-plans">
          {sortedPlans.map((plan) => {
            const current = activeMember && membership?.planSlug === plan.slug && !membership.lifetime;
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
                <ul className="mem-plan-perks">
                  {plan.perks.map((p) => (
                    <li key={p}><Check size={13} /> {tr(PERK_LABEL[p] ?? { zh: p, en: p })}</li>
                  ))}
                </ul>
                <button className="mem-plan-cta" onClick={() => handleChoose(plan)}>
                  {!loggedIn
                    ? tr({ zh: '登录后开通', en: 'Sign in to join',
                        zhHant: "登入後開通"
                    })
                    : current
                      ? tr({ zh: '续费', en: 'Renew',
                          zhHant: "續費"
                    })
                      : tr({ zh: '开通', en: 'Subscribe',
                          zhHant: "開通"
                    })}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 在线支付未开通提示 */}
      {plans && !payEnabled && !isLifetime && (
        <p className="mem-note">
          {tr({
            zh: '在线支付正在接入中。你可以先通过',
            en: 'Online payment is being set up. For now you can ',
              zhHant: "線上支付正在接入中。你可以先透過"
        })}
          <button className="mem-link-btn" onClick={() => setDonateOpen(true)}>{tr({ zh: '打赏', en: 'donate',
              zhHant: "打賞"
        })}</button>
          {tr({
            zh: '支持本站,并备注 WCA ID,站长会为你手动开通会员。',
            en: ' to support the site (note your WCA ID) and membership will be granted manually.',
              zhHant: "支援本站,並備註 WCA ID,站長會為你手動開通會員。"
        })}
        </p>
      )}

      <p className="mem-foot-note">
        {tr({
          zh: '会员为一次性按周期付款,不会自动续费、不会自动扣款,到期后需手动续费。',
          en: 'Membership is a one-time payment per period — no auto-renewal, no auto-charge. Renew manually when it expires.',
            zhHant: "會員為一次性按週期付款,不會自動續費、不會自動扣款,到期後需手動續費。"
        })}
        {' '}
        <AppLink href="/support">{tr({ zh: '查看致谢名单 →', en: 'See supporters →',
            zhHant: "檢視致謝名單 →"
        })}</AppLink>
      </p>

      {/* 会员联系方式(续费提醒 / 账号找回) */}
      {activeMember && membership && (
        <MemberContact membership={membership} onSaved={setMembership} isZh={isZh} />
      )}

      {/* admin 面板 */}
      {admin && <AdminPanel plans={plans ?? []} isZh={isZh} />}

      {buyPlan && (
        <PayModal
          plan={buyPlan}
          isZh={isZh}
          onClose={() => setBuyPlan(null)}
          onPaid={() => { setBuyPlan(null); setJustPaid(true); refreshMembership(); }}
        />
      )}
      {donateOpen && <DonateModal lang={isZh ? 'zh' : 'en'} onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
