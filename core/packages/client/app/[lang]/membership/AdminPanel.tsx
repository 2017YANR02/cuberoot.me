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
          <p className="mem-note">{tr({ zh: '这里只显示服务器配置状态，不代表实际签约、到账与取消流程已验收。', en: 'This reports server configuration, not verification of real authorization, payment, or cancellation.' })}</p>
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
      </div>

    </section>
  );
}
