'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Boxes, Check, Coffee, Copy, GitBranch, Monitor, Move, PackageCheck, Search, ShieldCheck, Sparkles, Target, UserRound, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useCopy } from '@/hooks/useCopy';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import AppLink from '@/components/AppLink';
import './sop.css';
import './sop-workflow.css';

export default function StaffSopPage() {
  const t = useT();
  const user = useAuthUser();
  const { copy, copiedKey } = useCopy();
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!useAuthStore.getState().user) useAuthStore.getState().login();
  }, [user]);

  const steps = [
    {
      title: t('定义', 'Define'), icon: Target,
      human: t('说清要解决的问题、改动范围和验收标准。', 'Define the problem, scope and acceptance criteria.'),
      ai: t('整理已知条件，一次列清影响执行的缺失信息。', 'Organize the inputs and group the questions that block progress.'),
      output: t('一份有范围、有验收标准的任务说明', 'A brief with a clear scope and acceptance criteria'),
      avoid: t('“优化一下”，没有说明要解决什么问题。', '“Make it better,” without saying what needs to improve.'),
      prefer: t('“简化入职步骤；保留账户绑定；手机上也能完成。”', '“Simplify onboarding, keep account linking, and make it work on mobile.”'),
    },
    {
      title: t('查阅', 'Read'), icon: Search,
      human: t('提供资料入口和已确认的决定，说明哪些信息不能外传。', 'Provide source materials, confirmed decisions and confidentiality limits.'),
      ai: t('先读项目规范，再查现有实现；区分事实、推测和待确认项。', 'Read project guidance and existing code; separate facts, assumptions and open questions.'),
      output: t('可靠的资料来源和可复用的现有实现', 'Reliable sources and existing implementations to reuse'),
      avoid: t('只看 AI 的回答，就把猜测当成项目事实。', 'Treating an AI answer as a verified project fact.'),
      prefer: t('找到对应源码、文档或实际结果，再决定怎么做。', 'Check the source, documentation or observed behavior before deciding.'),
    },
    {
      title: t('实现', 'Build'), icon: Boxes,
      human: t('确认影响范围；多人并行时分清负责人和文件归属。', 'Confirm the impact; give parallel tasks clear owners and file scopes.'),
      ai: t('先复用，再按需抽取共享组件；小步修改，不覆盖他人工作。', 'Reuse first, extract shared components when needed, and make small changes without overwriting others.'),
      output: t('范围明确、可审阅、可撤回的改动', 'A scoped change that can be reviewed and reversed'),
      avoid: t('复制一套相同组件，顺手改动任务以外的页面。', 'Duplicating a component and changing unrelated pages along the way.'),
      prefer: t('原入口和新入口共用同一实现，只补必要差异。', 'Use one implementation for both entry points, with only the necessary differences.'),
    },
    {
      title: t('验证', 'Verify'), icon: ShieldCheck,
      human: t('按约定验收实际效果，确认是否解决了最初的问题。', 'Review the actual result against the agreed goal.'),
      ai: t('按改动风险选择必要检查，记录结果；未验证的地方明确说明。', 'Run checks suited to the risk, record the results, and identify what remains unverified.'),
      output: t('实际结果、验证证据和已知限制', 'Observed results, verification evidence and known limits'),
      avoid: t('为了全绿修改预期，或反复跑无关测试。', 'Changing expected results to get a pass, or repeatedly running unrelated tests.'),
      prefer: t('检查受影响的行为；失败就找原因，不掩盖问题。', 'Check affected behavior and investigate failures instead of hiding them.'),
    },
    {
      title: t('交付', 'Deliver'), icon: PackageCheck,
      human: t('按本次授权安排发布，并完成最终验收。', 'Authorize release as needed and complete final acceptance.'),
      ai: t('给出成果位置、当前状态、遗留问题和下一步；已获授权的操作直接执行。', 'Provide the result location, current state, remaining issues and next step; carry out actions already authorized.'),
      output: t('成果位置、完成状态和交接记录', 'The result location, delivery state and handoff notes'),
      avoid: t('只说“已完成”，却没有链接、证据或发布状态。', 'Saying “done” without a result link, evidence or release status.'),
      prefer: t('分别说明本地、提交、发布和验收状态。', 'Report local completion, commit, release and acceptance separately.'),
    },
  ];
  const statuses = [
    ['todo', t('待开始', 'Not started')],
    ['wip', t('进行中', 'In progress')],
    ['review', t('待验收', 'Awaiting review')],
    ['done', t('已完成', 'Completed')],
    ['blocked', t('受阻', 'Blocked')],
    ['paused', t('暂停', 'Paused')],
  ];
  const handoffFields = [
    [t('目标与约束', 'Goal and constraints'), t('任务范围、限制与已确认的授权', 'Scope, constraints and permissions already granted')],
    [t('进度与位置', 'Progress and location'), t('已做什么，成果和关键文件在哪里', 'What is complete and where to find the work')],
    [t('证据与风险', 'Evidence and risks'), t('检查了什么，哪些问题还没解决', 'What was checked and what remains unresolved')],
    [t('下一步', 'Next step'), t('谁接手，接下来做什么', 'Who takes over and what they should do next')],
  ];
  const handoff = handoffFields.map(([title, description]) => `${title}\n${description}\n`).join('\n');
  const authorization = t('按本次授权执行。已确认的权限不重复申请；未获授权的发布、外发消息和不可逆操作，先确认。', 'Follow the current authorization. Do not ask again for permissions already granted. Confirm any release, external message or irreversible action that has not been authorized.');
  const prompt = [t('请按以下 AI 协作 SOP 完成本次任务。', 'Follow this AI collaboration SOP for this task.'), ...steps.map((step, index) => `${index + 1}. ${step.title}\n${step.ai}\n${t('交付', 'Output')}：${step.output}`), authorization, t('并行任务分清负责人、文件范围和依赖；由一人整合并检查结果。', 'Give parallel tasks clear owners, file scopes and dependencies; assign one person to integrate and verify the result.'), handoff, t('聊天命名：状态 员工 任务', 'Chat title: Status Employee Task'), ...statuses.map(([status, label]) => `${status}: ${label}`)].join('\n\n');

  if (!user) return null;
  return <section className="staff-sop sop-guide">
    <header className="sop-guide-intro">
      <div>
        <span className="sop-guide-eyebrow">{t('AI 协作', 'Working with AI')}</span>
        <h2>{t('先定义结果，再让 AI 开工', 'Define the result. Then put AI to work.')}</h2>
        <p>{t('员工负责目标、判断与验收；AI 帮助执行、检查和记录。', 'People own the goal, judgment and acceptance. AI helps execute, check and document the work.')}</p>
      </div>
      <button type="button" className="sop-guide-copy" onClick={() => copy(prompt, 'sop')}>
        {copiedKey === 'sop' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copiedKey === 'sop' ? t('已复制', 'Copied') : t('复制给 AI', 'Copy for AI')}
      </button>
    </header>

    <section className="sop-guide-workflow" data-site-surface="panel" aria-label={t('工作流程', 'Workflow')}>
      <div className="sop-guide-steps" role="tablist" aria-label={t('工作步骤', 'Workflow steps')}>
        {steps.map((step, index) => <button
          key={step.title} ref={(node) => { stepRefs.current[index] = node; }}
          type="button" role="tab" id={`sop-step-${index}`} aria-controls={`sop-step-panel-${index}`}
          aria-selected={activeStep === index} tabIndex={activeStep === index ? 0 : -1}
          className="sop-guide-step" onClick={() => setActiveStep(index)}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === 'ArrowRight') next = (index + 1) % steps.length;
            else if (event.key === 'ArrowLeft') next = (index - 1 + steps.length) % steps.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = steps.length - 1;
            else return;
            event.preventDefault(); setActiveStep(next); stepRefs.current[next]?.focus();
          }}>
          <span className="sop-guide-step-icon"><step.icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="sop-guide-step-label"><span className="sop-guide-step-number">0{index + 1}</span>{step.title}</span>
        </button>)}
      </div>
      <div className="sop-guide-panels">
        {steps.map((step, index) => <div key={step.title} id={`sop-step-panel-${index}`} role="tabpanel" aria-labelledby={`sop-step-${index}`}
          aria-hidden={activeStep !== index} inert={activeStep !== index} className="sop-guide-panel" data-active={activeStep === index} tabIndex={0}>
          <div className="sop-guide-roles">
            <div><span className="sop-guide-label"><UserRound size={15} aria-hidden="true" />{t('员工负责', 'People own')}</span><p>{step.human}</p></div>
            <div><span className="sop-guide-label"><Sparkles size={15} aria-hidden="true" />{t('AI 执行', 'AI helps with')}</span><p>{step.ai}</p></div>
          </div>
          <div className="sop-guide-output"><span>{t('本步交付', 'Output')}</span><strong>{step.output}</strong>{index === 3 && <AppLink href="/workspace?section=quality" prefetch={false} className="sop-guide-text-link">{t('质量标准', 'Quality standards')}<ArrowRight size={14} aria-hidden="true" /></AppLink>}</div>
          <div className="sop-guide-comparison">
            <div className="sop-guide-avoid"><span className="sop-guide-label"><X size={15} aria-hidden="true" />{t('不要这样', 'Avoid')}</span><p>{step.avoid}</p></div>
            <div className="sop-guide-prefer"><span className="sop-guide-label"><Check size={15} aria-hidden="true" />{t('这样做', 'Do this')}</span><p>{step.prefer}</p></div>
          </div>
        </div>)}
      </div>
    </section>

    <div className="sop-guide-two-up">
      <article className="sop-guide-card" data-site-surface="panel" aria-labelledby="sop-collaboration">
        <div className="sop-guide-card-heading"><GitBranch size={20} aria-hidden="true" /><h2 id="sop-collaboration">{t('并行分工，统一整合', 'Split the work. Integrate once.')}</h2></div>
        <p className="sop-guide-description">{t('一个聊天，一个目标。每个任务写清负责人、文件范围和依赖。', 'One chat, one goal. Give each task an owner, a file scope and clear dependencies.')}</p>
        <figure className="sop-guide-branch" aria-label={t('一人拆分任务，两个独立任务并行完成，再由同一负责人整合验收。', 'One owner splits the work into independent tasks, then integrates and reviews the result.')}>
          <div className="sop-guide-branch-owner"><UserRound size={15} aria-hidden="true" />{t('负责人拆分', 'Owner scopes')}</div>
          <div className="sop-guide-branch-lanes"><div><span>{t('任务 A', 'Task A')}</span><strong>{t('独立文件范围', 'Own file scope')}</strong></div><div><span>{t('任务 B', 'Task B')}</span><strong>{t('独立文件范围', 'Own file scope')}</strong></div></div>
          <div className="sop-guide-branch-owner"><Check size={15} aria-hidden="true" />{t('负责人整合与验收', 'Owner integrates and reviews')}</div>
        </figure>
        <p className="sop-guide-caution"><X size={14} aria-hidden="true" />{t('不要让多个 Agent 同时改同一处，也不要把彼此的改动覆盖掉。', 'Do not let agents edit the same area at the same time or overwrite one another’s work.')}</p>
      </article>

      <article className="sop-guide-card" data-site-surface="panel" aria-labelledby="sop-handoff">
        <div className="sop-guide-card-heading"><PackageCheck size={20} aria-hidden="true" /><h2 id="sop-handoff">{t('换人或换聊天，先交接', 'Hand off before switching context')}</h2></div>
        <p className="sop-guide-description">{t('交接后，接手的人应当能直接继续。', 'The next person should have enough context to continue.')}</p>
        <dl className="sop-guide-handoff">{handoffFields.map(([title, text], index) => <div key={title}><span aria-hidden="true">0{index + 1}</span><div><dt>{title}</dt><dd>{text}</dd></div></div>)}</dl>
        <button type="button" className="sop-guide-copy sop-guide-copy-small" onClick={() => copy(handoff, 'handoff')}>
          {copiedKey === 'handoff' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copiedKey === 'handoff' ? t('已复制', 'Copied') : t('复制交接提纲', 'Copy handoff outline')}
        </button>
      </article>
    </div>

    <section className="sop-guide-release" aria-labelledby="sop-release">
      <div className="sop-guide-section-heading"><h2 id="sop-release">{t('交付时，把状态说准确', 'Report the actual delivery state')}</h2><p>{t('按任务要求，分别核对。', 'Check each state required by the task.')}</p></div>
      <ul className="sop-guide-release-track">
        {[
          { title: t('本地完成', 'Local'), text: t('改动可供检查', 'Ready to inspect locally'), icon: Monitor },
          { title: t('已提交', 'Committed'), text: t('代码已保存到本地 Git', 'Saved in local Git'), icon: GitBranch },
          { title: t('已发布', 'Released'), text: t('目标环境已经更新', 'Available in the target environment'), icon: PackageCheck },
          { title: t('已验收', 'Accepted'), text: t('负责人确认符合要求', 'Confirmed against the agreed criteria'), icon: ShieldCheck },
        ].map((state) => <li key={state.title}><span className="sop-guide-release-icon"><state.icon size={17} aria-hidden="true" /></span><strong>{state.title}</strong><span>{state.text}</span></li>)}
      </ul>
      <p className="sop-guide-release-note">{t('已提交不等于已推送；推送、CI 和发布结果分别报告。', 'A commit is not a push. Report push, CI and release results separately.')}</p>
      <p className="sop-guide-authorization"><ShieldCheck size={17} aria-hidden="true" />{authorization}</p>
    </section>

    <div className="sop-guide-two-up sop-guide-bottom">
      <article className="sop-guide-card" data-site-surface="panel" aria-labelledby="sop-naming">
        <div className="sop-guide-card-heading"><h2 id="sop-naming">{t('聊天命名', 'Chat titles')}</h2></div>
        <div className="sop-guide-naming" aria-label={t('状态 员工 任务', 'Status Employee Task')}><span>{t('状态', 'Status')}</span><span>{t('员工', 'Employee')}</span><span>{t('任务', 'Task')}</span></div>
        <h3 className="sop-guide-status-title">{t('状态说明', 'Status guide')}</h3>
        <dl className="sop-guide-statuses">{statuses.map(([status, label]) => <div key={status}><dt>{status}</dt><dd>{label}</dd></div>)}</dl>
      </article>
      <article className="sop-guide-card" data-site-surface="panel" aria-labelledby="sop-office">
        <div className="sop-guide-card-heading"><h2 id="sop-office">{t('线下办公', 'Office rules')}</h2></div>
        <div className="sop-guide-office">
          <div><span className="sop-guide-office-icon"><Monitor size={25} aria-hidden="true" /><X size={14} aria-hidden="true" /></span><p>{t('不要触摸显示器。', 'Do not touch monitors.')}</p></div>
          <div><span className="sop-guide-office-icon"><Coffee size={25} aria-hidden="true" /><X size={14} aria-hidden="true" /></span><p>{t('水杯不要放在桌面上。', 'Do not place drinking cups on desks.')}</p></div>
          <div><span className="sop-guide-office-icon"><Move size={25} aria-hidden="true" /><X size={14} aria-hidden="true" /></span><p>{t('未经允许，不要移动设备。', 'Do not move equipment without permission.')}</p></div>
        </div>
      </article>
    </div>
  </section>;
}
