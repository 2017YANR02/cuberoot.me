'use client';

import { useEffect } from 'react';
import { ChevronDown, ListChecks, Users } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useCopy } from '@/hooks/useCopy';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';

export default function StaffSopPage() {
  const t = useT();
  const user = useAuthUser();
  const { copy, copiedKey } = useCopy();
  useEffect(() => {
    if (!useAuthStore.getState().user) useAuthStore.getState().login();
  }, [user]);
  const steps = [
    [t('明确任务', 'Define'), t('写清目标、范围、资料和验收标准。', 'State the goal, scope, inputs and acceptance criteria.')],
    [t('查阅资料', 'Read'), t('以文件和已确认需求为依据，集中确认缺项与冲突。', 'Use supplied files and confirmed requirements; batch gaps and conflicts for clarification.')],
    [t('复用实现', 'Reuse'), t('查找现有组件、样式与工具，选择假设最少、改动最小的方案。', 'Find existing components, styles and tools; choose the fewest assumptions and smallest sufficient change.')],
    [t('验证结果', 'Verify'), t('对照验收标准检查实际效果，保留必要证据。', 'Check actual behavior against acceptance criteria and keep relevant evidence.')],
    [t('交付成果', 'Deliver'), t('给出结果入口、完成状态、剩余事项和下一步。', 'Provide the result location, completion status, remaining work and next step.')],
  ];
  const standards = [
    [t('内容准确', 'Accurate content'), t('区分事实、推断和建议，保留来源。', 'Distinguish facts, inferences and suggestions; retain sources.')],
    [t('表达简洁', 'Concise wording'), t('每句一个意思，直接说明做什么，同一信息只保留一处。', 'One idea per sentence; state the action and give each piece of information one home.')],
    [t('结构清晰', 'Clear structure'), t('步骤用流程，比较用表格，关系用图，简单信息用短句。', 'Use flows for steps, tables for comparisons, diagrams for relationships and short sentences for simple information.')],
    [t('按需展开', 'Progressive detail'), t('优先展示操作与结论，详细说明折叠；用分组和留白组织密度。', 'Show actions and conclusions first; collapse detail and use grouping and spacing to manage density.')],
  ];
  const collaboration = [
    [t('一个聊天，一个目标', 'One chat, one goal'), t('并行任务明确负责人、文件范围和依赖。', 'Assign an owner, file scope and dependencies to each parallel task.')],
    [t('换聊天先交接', 'Hand off context'), t('记录目标、约束、进度、关键文件和验证结果。', 'Record the goal, constraints, progress, key files and verification results.')],
    [t('完成以验收为准', 'Completion means acceptance'), t('分别记录本地完成、已提交、已发布、已验收，按任务要求判断完成。', 'Track local completion, commit, release and acceptance separately; use the task requirements to decide completion.')],
  ];
  const naming = t('状态 员工姓名 任务', 'Status Employee name Task');
  const statuses = t('进行中 → 待验收 → 已完成；受阻时写明原因和处理人。', 'In progress → Awaiting review → Done; when blocked, name the cause and who can resolve it.');
  const prompt = [t('请按以下 AI 协作 SOP 完成本次任务。', 'Follow this AI collaboration SOP for this task.'), ...steps.map(([title, text], index) => `${index + 1}. ${title}：${text}`), ...standards.map(([title, text]) => `${title}：${text}`), ...collaboration.map(([title, text]) => `${title}：${text}`), naming, statuses].join('\n\n');
  if (!user) return null;
  return <section>
    <div className="staff-start-modules">
      <article className="staff-start-module" data-site-surface="panel" aria-labelledby="sop-flow">
        <div className="staff-start-module-heading">
          <ListChecks className="staff-start-module-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="sop-flow" className="staff-start-module-title">{t('工作流程', 'Workflow')}</h2>
        </div>
        <ol className="staff-start-knowledge">
          {steps.map(([title, text], index) => <li key={title}><strong>{index + 1}. {title}</strong><p>{text}</p></li>)}
        </ol>
        <button type="button" className="staff-start-action" onClick={() => copy(prompt, 'sop')}>{copiedKey === 'sop' ? t('已复制', 'Copied') : t('复制给 AI', 'Copy for AI')}</button>
      </article>
      <article className="staff-start-module" data-site-surface="panel" aria-labelledby="sop-standards">
        <div className="staff-start-module-heading">
          <Users className="staff-start-module-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="sop-standards" className="staff-start-module-title">{t('质量标准', 'Quality standards')}</h2>
        </div>
        <ul className="staff-start-knowledge">{standards.map(([title, text]) => <li key={title}><strong>{title}</strong><p>{text}</p></li>)}</ul>
        <details className="staff-start-disclosure"><summary>{t('协作与交接', 'Collaboration and handoff')}<ChevronDown size={18} aria-hidden="true" /></summary>
          <ul className="staff-start-knowledge">{collaboration.map(([title, text]) => <li key={title}><strong>{title}</strong><p>{text}</p></li>)}</ul>
        </details>
        <details className="staff-start-disclosure"><summary>{t('聊天命名', 'Chat titles')}<ChevronDown size={18} aria-hidden="true" /></summary>
          <p>{naming}</p><p className="staff-start-note">{t('例如：进行中 晨宇 简化入职页面', 'Example: In progress Chenyu Simplify onboarding')}</p><p className="staff-start-note">{statuses}</p>
        </details>
      </article>
    </div>
  </section>;
}
