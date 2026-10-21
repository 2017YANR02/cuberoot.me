'use client';

/**
 * 会员管理面板(仅 admin 可见)。
 *  - 手动开通:搜 WCA 选手 → 选套餐 → 开通(给已打赏用户 / 在线支付未开通时用)。
 *  - 会员名单与撤销操作位于 /admin/users。
 *  - 套餐:改价格(元)/ 启用,免动 migration。
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Check } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import BoolToggle from '@/components/BoolToggle';
import AppLink from '@/components/AppLink';
import { fetchPersonCard, type WcaPersonLite } from '@/lib/wca-api';
import {
  adminGrant, adminList, adminUpdatePlan, adminRenewalReadiness,
  isAutoRenewPlanSlug,
  type MembershipPlan,
  type RenewalReadiness,
} from '@/lib/membership-api';

interface Props {
  plans: MembershipPlan[];
  isZh: boolean;
  onPlanUpdated: (plan: MembershipPlan) => void;
  onViewRenewal: (plan: MembershipPlan) => void;
}

export default function AdminPanel({ plans, isZh, onPlanUpdated, onViewRenewal }: Props) {
  const grantablePlans = useMemo(
    () => plans.filter((plan) => !isAutoRenewPlanSlug(plan.slug)),
    [plans],
  );
  const [picked, setPicked] = useState<WcaPersonLite | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [grantPlan, setGrantPlan] = useState(grantablePlans[0]?.slug ?? '');
  const [granting, setGranting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [adminPlans, setAdminPlans] = useState<MembershipPlan[]>(plans);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [planSaved, setPlanSaved] = useState<string | null>(null);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<RenewalReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [readinessFailed, setReadinessFailed] = useState(false);
  const [readinessRevision, setReadinessRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setReadinessLoading(true);
    setReadinessFailed(false);
    setReadiness(null);
    void adminRenewalReadiness(controller.signal).then((result) => {
      if (!controller.signal.aborted) setReadiness(result);
    }).catch(() => {
      if (!controller.signal.aborted) setReadinessFailed(true);
    }).finally(() => {
      if (!controller.signal.aborted) setReadinessLoading(false);
    });
    return () => controller.abort();
  }, [readinessRevision]);

  useEffect(() => {
    if (!grantablePlans.some((plan) => plan.slug === grantPlan)) setGrantPlan(grantablePlans[0]?.slug ?? '');
  }, [grantablePlans, grantPlan]);
  useEffect(() => {
    if (adminPlans.length === 0 && plans.length > 0) setAdminPlans(plans);
  }, [adminPlans.length, plans]);

  function loadList() {
    adminList().then((r) => {
      const listedPlans = (r.plans ?? plans).filter(p => !['enterprise_yearly', 'enterprise_yearly_auto_renew'].includes(p.slug));
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
    if (active && isAutoRenewPlanSlug(p.slug) && !(readiness?.releaseEnabled && readiness.debitEnabled && readiness.managementConfigured && readiness.syncEnabled)) return;
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

      <section className="mem-admin-block mem-service-document" aria-labelledby="mem-renewal-setup-title">
        <h4 id="mem-renewal-setup-title">{tr({ zh: '微信自动续费接入', en: 'WeChat auto-renewal setup' })}</h4>
        <p>{tr({ zh: '委托代扣产品开通后，还需审核通过的自动续费模板、网站签约权限和交易联调。单次微信支付可用，不代表自动续费可用。', en: 'Product activation must be followed by approved recurring-payment templates, website authorization access, and transaction verification. One-time WeChat payments do not establish auto-renewal availability.' })}</p>
        <button type="button" className="mem-admin-plansave" disabled={readinessLoading} onClick={() => setReadinessRevision((value) => value + 1)}>
          {readinessLoading ? tr({ zh: '检查配置中…', en: 'Checking configuration…' }) : tr({ zh: '重新检查配置', en: 'Check configuration again' })}
        </button>
        {readinessFailed && <p role="alert">{tr({ zh: '无法读取接入状态。请确认接口已部署并重试；不能据此判断配置缺失。', en: 'Setup status could not be loaded. Ensure the endpoint is deployed and retry; this does not establish that configuration is missing.' })}</p>}
        {readiness && <div role="status">
          <ul>
            {readiness.checks.map((check) => <li key={check.name}>
              <code>{check.name}</code>：{check.status === 'present'
                ? tr({ zh: '已配置，格式检查通过', en: 'Present; format valid' })
                : check.status === 'missing' ? tr({ zh: '未配置', en: 'Missing' })
                  : tr({ zh: '格式不正确', en: 'Invalid format' })}
            </li>)}
            <li>{tr({ zh: '合约后台同步：', en: 'Background contract synchronization: ' })}{readiness.syncEnabled
              ? tr({ zh: '开关已开启', en: 'Switch enabled' }) : tr({ zh: '开关未开启', en: 'Switch disabled' })}</li>
            {readiness.templates?.map(template => <li key={template.slug}>
              {tr({ zh: '模板', en: 'Template' })} {template.templateId}：{template.approved
                ? tr({ zh: '已登记审核通过', en: 'Approval recorded' }) : tr({ zh: '等待审核通过', en: 'Awaiting approval' })}
            </li>)}
          </ul>
          <p className="mem-note">{tr({ zh: '这里只核对当前 API 服务的配置格式，不验证微信权限、模板、数据库或实际交易。签约与周期扣款代码已接入，仍须完成模板审核、商户配置和交易联调后开放。', en: 'This checks configuration format only, not WeChat permissions, templates, database readiness, or transactions. Enrollment and recurring debit code is integrated; template approval, merchant configuration, and transaction verification are still required before release.' })}</p>
        </div>}
        <details>
        <summary>{tr({ zh: '接入步骤与配置地址', en: 'Integration steps and configuration URLs' })}</summary>
        <ol>
          <li>{tr({ zh: '商户平台 → 交易中心 → 高级业务 → 委托代扣模板管理：核对连续包月、连续包年模板的审核状态、模板 ID、金额、周期及扣费通知模式。“签约管理”用于查用户授权，不是申请模板的入口。', en: 'In the merchant portal, open Transaction Center → Advanced Business → Entrusted Payment Template Management. Check approval, template IDs, amounts, periods, and notification mode for monthly and annual plans. Contract Management searches customer authorizations; it does not create templates.' })}</li>
          <li>{tr({ zh: '确认网站获批的签约方式及其 AppID。H5 支付权限和 H5 纯签约权限不同；不能拿一次性付款二维码代替续费签约。', en: 'Confirm the approved website authorization method and its AppID. H5 payments and H5 contract authorization require different access; a one-time payment QR code cannot authorize renewals.' })}</li>
          <li>{tr({ zh: '在服务器安全配置中填写对应商户的代扣配置。APIv2 密钥只保存在服务器，不填入网页或聊天，也不复制普通支付的 APIv3 密钥代替。', en: 'Set the matching merchant configuration securely on the server. Keep the APIv2 key on the server, never in this page or chat. Do not substitute a regular payment APIv3 key.' })}</li>
          <li>{tr({ zh: '按获批通知模式接通签约、扣款、入账和对账，并验证拒绝签约、支付失败、重复通知、取消及退款，再开放连续套餐。签约成功本身不发放会员权益。', en: 'Integrate authorization, debits, fulfillment, and reconciliation for the approved notification mode. Verify declined authorization, payment failures, duplicate notifications, cancellation, and refunds before offering recurring plans. Authorization alone does not grant membership.' })}</li>
        </ol>
        <p>{tr({ zh: '现有合约通知接口（签约 / 解约结果，配置前核对正式部署）：', en: 'Existing contract notification endpoint (authorization / cancellation; verify deployment before configuring): ' })}<code>https://api.cuberoot.me/v1/membership/subscriptions/wechat/notify</code></p>
        <p>{tr({ zh: '网站退订入口：', en: 'Website cancellation page: ' })}<AppLink href="/membership/subscription" prefetch={false}>https://cuberoot.me/zh/membership/subscription</AppLink></p>
        <div className="mem-service-links">
          <a href="https://pay.wechatpay.cn/doc/v2/merchant/4011986709" target="_blank" rel="noopener noreferrer">{tr({ zh: '微信官方接入流程', en: 'Official WeChat integration guide' })}</a>
          <AppLink href="/membership/renewal-terms" prefetch={false}>{tr({ zh: '核对自动续费协议', en: 'Review renewal terms' })}</AppLink>
        </div>
        </details>
      </section>

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
        <div className="mem-admin-planrows">
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
                disabled={planUpdating === p.slug || (isAutoRenewPlanSlug(p.slug) && p.active === false && !(readiness?.releaseEnabled && readiness.debitEnabled && readiness.managementConfigured && readiness.syncEnabled))}
              />
            </div>
          ))}
        </div>
        <div className="mem-service-links">
          {adminPlans.filter((plan) => isAutoRenewPlanSlug(plan.slug)).map((plan) => (
            <button key={plan.slug} type="button" className="mem-link-btn" onClick={() => onViewRenewal(plan)}>
              {tr({ zh: '查看 {name} 签约说明', en: 'View {name} authorization details' }).replace('{name}', tr({ zh: plan.nameZh, en: plan.nameEn }))}
            </button>
          ))}
        </div>
        <p className="mem-note">{tr({ zh: '自动续费等待审核与联调，暂不能公开；仍可查看签约说明或关闭已公开的套餐。月度模板 225492，年度模板 225493；签约说明不代表已开通代扣。', en: 'Auto-renewal awaits approval and verification. You can view authorization details or hide active plans. Monthly template: 225492; annual template: 225493. These details do not mean recurring billing is available.' })}</p>
      </div>

    </section>
  );
}
