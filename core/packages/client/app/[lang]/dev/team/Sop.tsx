'use client';

import { useEffect } from 'react';
import { useT } from '@/hooks/useT';
import { useCopy } from '@/hooks/useCopy';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import './sop.css';
import AppLink from '@/components/AppLink';

export default function StaffSopPage() {
  const t = useT();
  const user = useAuthUser();
  const { copy, copiedKey } = useCopy();
  useEffect(() => {
    if (!useAuthStore.getState().user) useAuthStore.getState().login();
  }, [user]);
  const steps = [
    [t('明确任务', 'Define'), t('写清目标、范围、资料和验收标准。', 'State the goal, scope, inputs and acceptance criteria.')],
    [t('查阅资料', 'Read'), t('核对资料和已确认的需求，一次列清缺失信息与冲突。', 'Use supplied files and confirmed requirements; batch gaps and conflicts for clarification.')],
    [t('复用实现', 'Reuse'), t('优先复用现有组件、样式与工具，只做必要改动。', 'Reuse existing components, styles and tools; make only the changes needed.')],
    [t('验证结果', 'Verify'), t('对照验收标准检查实际效果，保留必要证据。', 'Check actual behavior against acceptance criteria and keep relevant evidence.')],
    [t('交付成果', 'Deliver'), t('提供成果链接或文件，说明完成情况、剩余事项和下一步。', 'Provide the result location, completion status, remaining work and next step.')],
  ];
  const collaboration = [
    [t('一个聊天，一个目标', 'One chat, one goal'), t('并行任务明确负责人、文件范围和依赖。', 'Assign an owner, file scope and dependencies to each parallel task.')],
    [t('换聊天先交接', 'Hand off context'), t('记录目标、约束、进度、关键文件和验证结果。', 'Record the goal, constraints, progress, key files and verification results.')],
    [t('完成以验收为准', 'Completion means acceptance'), t('分别记录本地完成、已提交、已发布、已验收，按任务要求判断完成。', 'Track local completion, commit, release and acceptance separately; use the task requirements to decide completion.')],
  ];
  const naming = t('状态 员工 任务', 'Status Employee Task');
  const statuses = [
    ['todo', t('待开始', 'Not started')],
    ['wip', t('进行中', 'In progress')],
    ['review', t('待验收', 'Awaiting review')],
    ['done', t('已完成', 'Completed')],
    ['blocked', t('受阻', 'Blocked')],
    ['paused', t('暂停', 'Paused')],
  ];
  const prompt = [t('请按以下 AI 协作 SOP 完成本次任务。', 'Follow this AI collaboration SOP for this task.'), ...steps.map(([title, text], index) => `${index + 1}. ${title}：${text}`), ...collaboration.map(([title, text]) => `${title}：${text}`), naming, t('状态说明', 'Status guide'), ...statuses.map(([status, label]) => `${status}: ${label}`)].join('\n\n');
  if (!user) return null;
  return <section className="staff-sop">
    <div className="staff-sop-sections">
      <article className="staff-sop-section" aria-labelledby="sop-flow">
        <div className="staff-start-module-heading">
          <h2 id="sop-flow" className="staff-start-module-title">{t('工作流程', 'Workflow')}</h2>
        </div>
        <ol className="staff-start-knowledge staff-sop-flow">
          {steps.map(([title, text], index) => <li key={title}><strong>{index + 1}. {title}</strong><p>{text}</p>{index === 3 && <AppLink href="/workspace?section=quality" prefetch={false}>{t('查看质量标准', 'View quality standards')}</AppLink>}</li>)}
        </ol>
        <button type="button" className="staff-start-action" onClick={() => copy(prompt, 'sop')}>{copiedKey === 'sop' ? t('已复制', 'Copied') : t('复制给 AI', 'Copy for AI')}</button>
      </article>
      <div className="staff-sop-secondary">
        <article className="staff-sop-section staff-sop-card" data-site-surface="panel" aria-labelledby="sop-collaboration">
          <h2 id="sop-collaboration" className="staff-start-module-title">{t('协作与交接', 'Collaboration and handoff')}</h2>
          <ul className="staff-start-knowledge">{collaboration.map(([title, text]) => <li key={title}><strong>{title}</strong><p>{text}</p></li>)}</ul>
        </article>
        <article className="staff-sop-section staff-sop-card" data-site-surface="panel" aria-labelledby="sop-naming">
          <h2 id="sop-naming" className="staff-start-module-title">{t('聊天命名', 'Chat titles')}</h2>
          <p className="staff-sop-naming-format">{naming}</p>
          <h3 className="staff-sop-status-heading">{t('状态说明', 'Status guide')}</h3>
          <dl className="staff-sop-statuses">{statuses.map(([status, label]) => <div key={status}><dt>{status}</dt><dd>{label}</dd></div>)}</dl>
        </article>
        <article className="staff-sop-section staff-sop-card" data-site-surface="panel" aria-labelledby="sop-office">
          <h2 id="sop-office" className="staff-start-module-title">{t('线下办公', 'Office rules')}</h2>
          <ol className="staff-start-knowledge">
            <li>{t('1. 不要触摸显示器。', '1. Do not touch monitors.')}</li>
            <li>{t('2. 水杯不要放在桌面上。', '2. Do not place drinking cups on desks.')}</li>
            <li>{t('3. 未经允许，不要移动设备。', '3. Do not move equipment without permission.')}</li>
          </ol>
        </article>
      </div>
    </div>
  </section>;
}
