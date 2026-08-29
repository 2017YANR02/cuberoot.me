'use client';

/**
 * 会员管理面板(仅 admin 可见)。
 *  - 手动开通:搜 WCA 选手 → 选套餐 → 开通(给已打赏用户 / 在线支付未开通时用)。
 *  - 会员列表:当前会员 + 到期,可撤销。
 *  - 套餐:改价格(元)/ 启用,免动 migration。
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import BoolToggle from '@/components/BoolToggle';
import { fetchPersonCard, type WcaPersonLite } from '@/lib/wca-api';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fmtDate } from '@/lib/membership-format';
import {
  adminGrant, adminList, adminRevoke, adminUpdatePlan,
  isAutoRenewPlanSlug,
  type MembershipPlan, type Membership,
} from '@/lib/membership-api';

interface Props {
  plans: MembershipPlan[];
  isZh: boolean;
  onPlanUpdated: (plan: MembershipPlan) => void;
}

export default function AdminPanel({ plans, isZh, onPlanUpdated }: Props) {
  const grantablePlans = useMemo(
    () => plans.filter((plan) => !isAutoRenewPlanSlug(plan.slug)),
    [plans],
  );
  const [picked, setPicked] = useState<WcaPersonLite | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [grantPlan, setGrantPlan] = useState(grantablePlans[0]?.slug ?? '');
  const [granting, setGranting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [members, setMembers] = useState<Membership[]>([]);
  const [adminPlans, setAdminPlans] = useState<MembershipPlan[]>(plans);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [planSaved, setPlanSaved] = useState<string | null>(null);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!grantablePlans.some((plan) => plan.slug === grantPlan)) setGrantPlan(grantablePlans[0]?.slug ?? '');
  }, [grantablePlans, grantPlan]);
  useEffect(() => {
    if (adminPlans.length === 0 && plans.length > 0) setAdminPlans(plans);
  }, [adminPlans.length, plans]);

  function loadList() {
    adminList().then((r) => {
      setMembers(r.members);
      const listedPlans = r.plans ?? plans;
      setAdminPlans(listedPlans);
      setPriceDraft(Object.fromEntries(listedPlans.map((p) => [p.slug, String(p.priceCents / 100)])));
    }).catch(() => {});
  }
  useEffect(() => { loadList(); }, []);

  function applyPlanUpdate(updatedPlan: MembershipPlan) {
    setAdminPlans((current) => current
      .map((plan) => plan.slug === updatedPlan.slug ? updatedPlan : plan)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.priceCents - b.priceCents));
    setPriceDraft((current) => ({ ...current, [updatedPlan.slug]: String(updatedPlan.priceCents / 100) }));
    onPlanUpdated(updatedPlan);
  }

  async function handlePick(c: WcaPersonLite | null) {
    setPicked(c);
    setAvatar(null);
    if (c) {
      const card = await fetchPersonCard(c.id);
      if (card?.avatar) setAvatar(card.avatar);
    }
  }

  async function grant() {
    if (!picked?.id || !grantPlan) return;
    setGranting(true); setErr(null);
    try {
      await adminGrant({ wcaId: picked.id, plan: grantPlan, name: picked.name, avatarUrl: avatar });
      setPicked(null); setAvatar(null);
      loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGranting(false);
    }
  }

  async function revoke(wcaId: string) {
    if (!window.confirm(tr({ zh: '撤销 {n} 的会员?', en: 'Revoke membership of {n}?'
    }).replace('{n}', wcaId))) return;
    try { await adminRevoke(wcaId); setMembers((m) => m.filter((x) => x.wcaId !== wcaId)); }
    catch (e) { window.alert(e instanceof Error ? e.message : String(e)); }
  }

  async function savePlan(p: MembershipPlan) {
    const yuan = Number(priceDraft[p.slug]);
    if (!Number.isFinite(yuan) || yuan < 0) return;
    setPlanUpdating(p.slug);
    try {
      const updatedPlan = await adminUpdatePlan(p.slug, { priceCents: Math.round(yuan * 100) });
      applyPlanUpdate({ ...p, ...updatedPlan, active: updatedPlan.active ?? p.active ?? true });
      setPlanSaved(p.slug);
      window.setTimeout(() => setPlanSaved((s) => (s === p.slug ? null : s)), 1500);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanUpdating((slug) => slug === p.slug ? null : slug);
    }
  }

  async function updateVisibility(p: MembershipPlan, active: boolean) {
    setPlanUpdating(p.slug);
    try {
      const updatedPlan = await adminUpdatePlan(p.slug, { active });
      applyPlanUpdate({ ...p, ...updatedPlan, active });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanUpdating((slug) => slug === p.slug ? null : slug);
    }
  }

  return (
    <section className="mem-admin">
      <h3 className="mem-admin-title">{tr({ zh: '会员管理', en: 'Membership admin'
    })}</h3>

      {/* 手动开通 */}
      <div className="mem-admin-block">
        <div className="mem-admin-grant">
          <WcaPersonPicker
            value={picked}
            onChange={(c) => void handlePick(c)}
            isZh={isZh}
            className="mem-admin-picker"
            placeholder={tr({ zh: '搜索 WCA 选手开通', en: 'Search a WCA cuber to grant'
            })}
          />
          <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} className="mem-admin-plansel">
            {grantablePlans.map((p) => <option key={p.slug} value={p.slug}>{isZh ? p.nameZh : p.nameEn}</option>)}
          </select>
          <button className="mem-admin-grant-btn" onClick={() => void grant()} disabled={!picked?.id || granting}>
            <Plus size={14} /> {granting ? '…' : tr({ zh: '开通', en: 'Grant'
            })}
          </button>
        </div>
        {err && <div className="mem-pay-err">{err}</div>}
      </div>

      {/* 套餐价格 */}
      <div className="mem-admin-block">
        <div className="mem-admin-subtitle">{tr({ zh: '套餐价格(元)', en: 'Plan prices (yuan)'
        })}</div>
        {adminPlans.map((p) => (
          <div key={p.slug} className="mem-admin-planrow">
            <span className="mem-admin-planname">{isZh ? p.nameZh : p.nameEn}</span>
            <input
              type="number" min="0" step="0.01"
              className="mem-admin-priceinput"
              value={priceDraft[p.slug] ?? ''}
              onChange={(e) => setPriceDraft((d) => ({ ...d, [p.slug]: e.target.value }))}
            />
            <button className="mem-admin-plansave" onClick={() => void savePlan(p)} disabled={planUpdating === p.slug}>
              {planSaved === p.slug ? <Check size={13} /> : tr({ zh: '保存', en: 'Save'
            })}
            </button>
            <BoolToggle
              value={p.active !== false}
              onChange={(active) => void updateVisibility(p, active)}
              label={tr({ zh: '公开', en: 'Public' })}
              disabled={planUpdating === p.slug}
            />
          </div>
        ))}
      </div>

      {/* 会员列表 */}
      <div className="mem-admin-block">
        <div className="mem-admin-subtitle">{tr({ zh: '会员 ({n})', en: 'Members ({n})'
        }).replace('{n}', String(members.length))}</div>
        <div className="mem-admin-list">
          {members.map((m) => (
            <div key={m.wcaId} className="mem-admin-member">
              <span className="mem-admin-mname">{displayCuberName(m.name, isZh)}</span>
              <span className="mem-admin-mwca">{m.wcaId}</span>
              <span className="mem-admin-mexp">
                {m.lifetime ? tr({ zh: '永久', en: 'Lifetime' }) : `→ ${fmtDate(m.expiresAt)}`}
                {!m.active && ` (${tr({ zh: '已过期', en: 'expired'
                })})`}
              </span>
              <button className="mem-admin-revoke" onClick={() => void revoke(m.wcaId)} aria-label="revoke">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {members.length === 0 && <div className="mem-admin-empty">{tr({ zh: '暂无会员', en: 'No members yet'
        })}</div>}
        </div>
      </div>
    </section>
  );
}
