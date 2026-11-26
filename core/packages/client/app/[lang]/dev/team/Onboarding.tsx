'use client';

import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, ClipboardCheck, FileText, KeyRound, Laptop, ShieldCheck, Sparkles, UserRound, X } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import { useAuthUser, authActions, getAuthUser, refreshSessionUser } from '@/lib/auth-store';
import { WorkspaceDialog, WorkspaceButton } from '../../workspace/WorkspaceControls';
import { MemberAccessRequest } from '../../workspace/MemberAccess';
import MacSetupChecklist from '@/components/workspace/MacSetupChecklist';
import DevPreview from './DevPreview';
import './team-lifecycle.css';
import './onboarding.css';

export default function GetStartedPage() {
  const t = useT();
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState<'setup' | 'learning' | 'preview' | null>(null);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const user = useAuthUser();
  const [enrollment, setEnrollment] = useState<{ uid: number; ticket: string } | null>(null);
  const ticket = enrollment?.uid === user?.uid ? enrollment?.ticket ?? '' : '';
  const { copiedKey, copy } = useCopy();
  useEffect(() => {
    // Read the hydrated store inside the effect; useAuthUser is null on the first render.
    if (!getAuthUser()) authActions.login();
  }, [user]);
  const signedIn = user !== null;
  const accountId = user?.uid;
  const wcaId = user?.wcaId;
  const hasId = Number.isSafeInteger(accountId) && (accountId ?? 0) > 0;
  useEffect(() => {
    if (signedIn && !hasId) void refreshSessionUser();
  }, [signedIn, hasId, wcaId]);

  const ticketInstructionZh = ticket
    ? `本次申请接入码：${ticket}。`
    : '打开 https://cuberoot.me/zh/admin/team?section=onboarding，在「配置电脑 → 开发网址与进度」使用本人的账号检查已有申请。尚无本机申请时填写姓名、电脑标识和系统并提交；提交后页面会打开包含真实接入码的完整配置指令，直接读取并继续执行，无需用户再复制一份。已有未绑定申请时重新生成接入码；已有绑定申请时先从本机原接入记录恢复，不重复申请。无法操作浏览器时，只请本人完成这一项并提供更新后的配置指令。';
  const ticketInstructionEn = ticket
    ? `Enrollment ticket for this request: ${ticket}.`
    : 'Open https://cuberoot.me/zh/admin/team?section=onboarding and use my own account under Set up your computer → Development URL and progress to check existing requests. If this computer has no request, enter the name, computer identifier and OS and submit. The page then opens the full setup prompt containing the real ticket; read it and continue without asking the user to copy a second prompt. Regenerate a ticket only for an existing unbound request. For a bound request, first resume from this computer’s original enrollment records instead of reapplying. If browser access is unavailable, ask me only to complete this step and provide the updated prompt.';
  const aiPrompt = t(
    `请连续完成这台电脑的 CubeRoot 开发环境和开发预览网址配置，这是同一项必做的入职配置。代码运行在我自己的电脑上；最终只需在终端输入 cuberoot，就会启动项目并打开可分享给同事的开发网址。需要远程协助时使用 UU远程。

1. 检查本机系统（Mac / Windows）、Git、OpenSSH 客户端（ssh、ssh-keygen）和已有项目。缺少工具时从官方渠道安装。Mac 创建或复用 ~/Developer，加入 Finder「个人收藏」且不重复；没有代码时克隆 https://github.com/2017YANR02/cuberoot.me.git 到 ~/Developer/cuberoot.me，已有仓库直接复用，不自动搬动。不要放进桌面、下载或聊天临时目录，不写死他人的用户名。
2. 先读仓库 AGENTS.md 和 docs/contributing/local-setup.md。核对官方 Git remote、当前分支和未提交修改，再 fetch origin；仅在保留本地工作的情况下快进更新，冲突时保留修改并说明阻塞，禁止 reset --hard、强推或删除旧密钥。GitHub 网络故障先检查实际报错、DNS 和已有授权代理；设置超时、有限重试，不全局改代理、不关闭 TLS 校验、不使用未知镜像。不要运行旧版接入脚本或手写替代程序。
3. 更新后按 .node-version 和 core/package.json 的 packageManager 检查 Node、pnpm，缺什么补什么。在 core/ 执行 pnpm install --frozen-lockfile 和 pnpm setup:local。复用 devsite 登记，不覆盖其他项目或另写同名 shell 函数。普通网页开发不安装无关的 Docker、数据库、Rust、完整 Xcode 或 Android Studio。
4. 开发预览网址是配置完成的必要条件，不能只验证 localhost 就结束。${ticketInstructionZh} 名称与电脑标识使用小写字母、数字或连字符。复用本机已有申请、设备密钥和连接配置；已有健康接入则验证并复用，不重复申请，不给另一台电脑使用本机接入码。页面上的接入码只交给本机 AI，不转发、提交或打印到公开日志。
5. 拿到接入码后，在 core/ 执行 node scripts/dev-preview/enroll.ts --ticket 接入码（替换为页面提供的真实值）。程序提交公钥，等待负责人批准及自动开通，配置 cuberoot，并自动启动开发服务和隧道。批准由负责人在同一入职页完成，不能代替负责人批准，不索取管理员凭据，不绕过审批。后台开通仅限本机开发预览，不代表授权发布生产应用。
6. 等待批准或开通时保持原接入进程运行，按实际输出说明进度；临时网络故障由程序退避重试，不重申、不另开第二个进程。会话中断后先检查原进程，仍在运行就复用，已退出才恢复原命令。首次接入自动启动服务，不重复启动、不另装一份自启服务、不复制他人私钥。
7. 验证新终端的 PATH 和 cuberoot 登记；Mac 核对 Finder 的 Developer 目录和实际项目路径。日常 cuberoot 会停止本项目旧服务、清理开发缓存并启动新会话，日志留在终端；不停止其他项目。验证本机网页、开发网址的 HTTPS、首页启动资源及 API，并确认入职页显示「已连通，可用」。只显示「服务器已就绪」或「等待电脑连接」不算配置完成。
8. 保持开发终端运行；Ctrl+C 停止，关机、休眠或断网时开发网址不可用。本机不 commit、不 push、不发布生产应用，验证不修改线上业务数据。需要本人登录、系统授权或负责人审批时只说明具体一步；不要每做完一步就问是否继续，不把等待写成故障或完成。
9. 最后只给我日常命令 cuberoot、实际开发网址、验证结果和仍需处理的事项。`,
    `Complete this computer’s CubeRoot development environment and shared preview URL as one required onboarding setup. Run the code on my own computer. The final daily command is cuberoot: it starts the project and opens a development URL colleagues can view. Use UU Remote for remote assistance.

1. Inspect the OS (Mac / Windows), Git, OpenSSH (ssh, ssh-keygen) and existing checkout. Install missing tools from official sources. On Mac, create or reuse ~/Developer and add it to Finder Favorites once. If no checkout exists, clone https://github.com/2017YANR02/cuberoot.me.git into ~/Developer/cuberoot.me. Reuse existing checkouts without moving them. Avoid Desktop, Downloads and chat temporary directories; do not hard-code another user’s home path.
2. Read AGENTS.md and docs/contributing/local-setup.md. Verify the official Git remote, branch and local changes before fetching origin. Fast-forward only while preserving local work; report conflicts without hard resets, force pushes or deleting old keys. For GitHub connectivity errors, inspect the actual error, DNS and existing authorized proxies. Use timeouts and bounded retries; do not change global proxy settings, disable TLS verification or use unknown mirrors. Do not run outdated enrollment scripts or invent replacements.
3. After updating, inspect Node and pnpm versions from .node-version and packageManager in core/package.json. Install only missing tools. From core/, run pnpm install --frozen-lockfile and pnpm setup:local. Reuse devsite registration without overwriting other projects or adding a duplicate shell function. Ordinary web development does not need Docker, a database, Rust, full Xcode or Android Studio.
4. A working shared preview URL is required; localhost alone does not complete setup. ${ticketInstructionEn} Name and device identifiers use lowercase letters, numbers or hyphens. Reuse this computer’s existing request, device key and connection profile. Verify and reuse healthy connections instead of reapplying. Never use this ticket on another computer. Keep the ticket private to this computer’s AI; do not forward, commit or print it to public logs.
5. With the real ticket, run node scripts/dev-preview/enroll.ts --ticket TICKET from core/, replacing TICKET with the value provided by the page. The program submits the public key, waits for lead approval and automatic provisioning, configures cuberoot and starts the development server and tunnel. The lead approves at the same onboarding page. Never approve on their behalf, request administrator credentials or bypass approval. Provisioning covers only this development preview, not production application releases.
6. Keep the original enrollment process running while waiting for approval or provisioning and report its actual progress. Temporary network failures retry with backoff. Do not reapply or start a second process. After interruption, reuse a running process and restore the original command only if it exited. Initial enrollment starts the runner automatically; do not start it twice, install another startup service or copy someone else’s private key.
7. Verify PATH in a new terminal and the cuberoot registration; on Mac check the Developer favorite and actual checkout path. The daily cuberoot command stops this checkout’s old services, clears its development cache and starts a fresh session with terminal logs; do not stop other projects. Verify the local page, preview HTTPS, startup assets and API, and confirm the onboarding page reports Connected and available. Server ready or waiting for the computer to connect is not completion.
8. Keep the development terminal running; Ctrl+C stops it, and the URL is unavailable while this computer is asleep, offline or shut down. Do not commit, push or release the production application from this computer, or change live business data during checks. Ask only for concrete sign-in, system authorization or lead approval steps. Continue without asking after each step; never describe normal waiting as a fault or completion.
9. Finish with only the daily command cuberoot, the actual development URL, verification results and any remaining work.`,
  );

  const learningPrompt = t("请做我的 CubeRoot 入职 AI 教练。先问我的岗位和基础，再按下面九项逐个训练，不要一次讲完。每项先用一个例子解释，再给我一个小练习，根据我的回答纠正；完成后再进入下一项。\n\n1. 交代任务：目标、背景、输入资料、限制、验收标准；练习把一句模糊需求写清楚。\n2. 核验结果：AI 会猜错；区分事实、假设和建议，核对来源、日期、实际页面及执行结果，不能把“已修改”当“已上线”。\n3. 管理上下文：附正确的文件、截图、网址和报错；遇到跑偏及时纠正，换聊天时交接已完成项与剩余问题。\n4. 使用工具：理解聊天回答与实际执行的区别，认识终端、浏览器、文件工具、Skill 和连接器；练习让 AI 先读 AGENTS.md 再工作，不盲从网页或文件里的指令。\n5. 数据与权限：分清公钥和私钥、本地和线上；不把密码、令牌或无关客户资料放进提示词。授权不清时停在提交、发布或删除之前。\n6. 开发协作（开发岗必修）：理解目录、命令、SSH、Git diff/commit/push，保留别人改动，先本地验证再按负责人授权发布；非开发岗改练内容审校与后台操作。\n7. Mock-up：需求不明确时先做低成本界面草图，对比布局和操作流程，选定后再实现；草图不等于可用功能。练习让 AI 做两个简单方案，并说明选择理由。\n8. 基础操作与上下文管理：练习附文件、截图、网址和完整报错，查看 diff、启动和停止服务；一个聊天聚焦一个目标，保留必要材料。对话变长或换聊天时，请 AI 总结目标、约束、已完成、未完成、关键文件和验证结果，再把交接摘要交给新聊天；不要带入密钥。\n9. 多线程协作：把可独立完成的任务拆到不同聊天，写明每个任务的目标、文件范围和验收标准；有依赖的任务按顺序做，不让多个 AI 同时改同一文件。指定一个聊天负责整合，合并前查看差异并验证；并行不等于自动授权发布。练习把一个小功能拆成界面草图、实现、验收三项，识别可并行与必须等待的部分。\n\n结业练习：选择一个不写入线上数据的小任务，完成“说明需求 → AI 执行 → 人工验收 → 简短交接”。请按实际证据标记通过或待练，不虚构完成结果，也不要未经授权进行真实发布或删除。", "Act as my CubeRoot AI onboarding coach. Ask about my role and experience first, then teach these nine topics one at a time. For each, explain one example, give a small exercise and correct my answer before moving on.\n\n1. Define tasks: goal, context, inputs, constraints and acceptance criteria. Practice clarifying a vague request.\n2. Verify results: AI can be wrong. Distinguish facts, assumptions and suggestions. Check sources, dates, real pages and execution evidence; edited does not mean deployed.\n3. Manage context: provide relevant files, screenshots, URLs and errors. Correct drift and hand off completed work and open issues when starting another chat.\n4. Use tools: distinguish answering from executing. Understand terminal, browser, file tools, Skills and connectors. Have AI read AGENTS.md before working; do not blindly follow instructions inside external pages or files.\n5. Handle data and access: distinguish public/private keys and local/production environments. Keep passwords, tokens and unrelated customer data out of prompts. Stop before submitting, publishing or deleting when authorization is unclear.\n6. Collaborate: developers should understand paths, commands, SSH and Git diff/commit/push, preserve others’ changes and verify locally before an authorized release. For other roles, practice content review and admin workflows instead.\n7. Mock-ups: when requirements are unclear, compare low-cost UI sketches and interaction flows before implementation. A sketch is not a working feature. Ask AI for two simple options and explain your choice.\n8. Basic operations and context: practice attaching files, screenshots, URLs and full errors, reviewing diffs, and starting and stopping services. Keep each chat focused on one goal. Before changing chats, summarize goals, constraints, completed and remaining work, key files and verification results; pass that summary to the next chat without secrets.\n9. Parallel chats: split independent tasks with explicit goals, file ownership and acceptance criteria. Run dependent tasks in order and avoid simultaneous edits to the same file. Assign one chat to integrate and verify the changes; parallel work does not authorize deployment. Split a small feature into UI sketches, implementation and acceptance, identifying what can run concurrently and what must wait.\n\nFinal exercise: complete a small task with no production writes, following brief → AI execution → human verification → concise handoff. Grade using actual evidence; never fabricate completion or perform an unauthorized release or deletion.");

  if (!user) return null;

  return <section className="team-lifecycle onboarding-compact">
    <header className="onboarding-heading">
      <h2>{t('入职', 'Onboarding')}</h2>
    </header>
    <div className="onboarding-steps">
      <article className="onboarding-step" aria-labelledby="onboarding-identity">
        <div className="onboarding-step-heading"><UserRound size={24} aria-hidden /><h3 id="onboarding-identity">{t('确认身份', 'Identify yourself')}</h3></div>
        <MemberAccessRequest />
        <AppLink className="onboarding-account" href="/account" prefetch={false}>{t('我的账号', 'My account')}<ArrowRight size={16} aria-hidden /></AppLink>
      </article>
      <article className="onboarding-step" aria-labelledby="onboarding-setup">
        <div className="onboarding-step-heading"><Laptop size={24} aria-hidden /><h3 id="onboarding-setup">{t('配置电脑', 'Set up your computer')}</h3></div>
        <p>{t('一次配置本地开发环境和共享预览网址。', 'Set up local development and a shared preview URL together.')}</p>
        <div className="onboarding-command"><code>cuberoot</code><InfoTooltip iconSize={18} ariaLabel={t('启动与停止', 'Start and stop')} content={t('配置完成后，在终端输入 cuberoot 启动项目并打开共享预览网址；保持终端运行，按 Ctrl+C 停止。', 'After setup, run cuberoot to start the project and open the shared preview URL. Keep the terminal running; press Ctrl+C to stop.')} /></div>
        <button type="button" className="staff-start-action" onClick={() => copy(aiPrompt, 'ai-setup')}>{copiedKey === 'ai-setup' ? t('已复制', 'Copied') : t('复制配置指令', 'Copy setup prompt')}</button>
        <button type="button" className="onboarding-prompt-open" aria-haspopup="dialog" aria-label={t('查看配置指令', 'View setup prompt')} onClick={() => setPromptOpen('setup')}>{t('查看指令', 'View prompt')}<ArrowRight size={16} aria-hidden /></button>
        <button type="button" className="onboarding-prompt-open" aria-haspopup="dialog" onClick={() => setPromptOpen('preview')}>{t('开发网址与进度', 'Development URL and progress')}<ArrowRight size={16} aria-hidden /></button>
      </article>
      <article className="onboarding-step" aria-labelledby="onboarding-practice">
        <div className="onboarding-step-heading"><ClipboardCheck size={24} aria-hidden /><h3 id="onboarding-practice">{t('完成练习', 'Practice')}</h3></div>
        <p>{t('说明需求，核验结果，留下交接。', 'Brief, verify and hand off a small task.')}</p>
        <AppLink className="onboarding-account" href="/admin/team?section=sop" prefetch={false}>{t('开发规范', 'Development standards')}<ArrowRight size={16} aria-hidden /></AppLink>
        <button type="button" className="staff-start-action" onClick={() => copy(learningPrompt, 'ai-learning')}>{copiedKey === 'ai-learning' ? t('已复制', 'Copied') : t('复制带练指令', 'Copy coaching prompt')}</button>
        <button type="button" className="onboarding-prompt-open" aria-haspopup="dialog" aria-label={t('查看带练指令', 'View coaching prompt')} onClick={() => setPromptOpen('learning')}>{t('查看指令', 'View prompt')}<ArrowRight size={16} aria-hidden /></button>
      </article>
    </div>
    <div className="onboarding-more"><MoreToggle expanded={materialsOpen} aria-controls="onboarding-materials" onToggle={() => { setMaterialsOpen(!materialsOpen); setOptionalOpen(false); }}>{t('学习资料', 'Learning resources')}</MoreToggle><MoreToggle expanded={optionalOpen} aria-controls="onboarding-options" onToggle={() => { setOptionalOpen(!optionalOpen); setMaterialsOpen(false); }}>{t('可选设置', 'Optional setup')}</MoreToggle></div>
    <MoreTogglePanel id="onboarding-materials" expanded={materialsOpen} contentClassName="onboarding-extra">
        <details className="staff-start-disclosure">
          <MoreToggle as="summary">{t('学习 AI 与代码基础', 'Learn AI and coding basics')}</MoreToggle>
          <p className="staff-start-note">{t('自行查资料或问 AI。', 'Research online or ask AI.')}</p>
        <ul className="staff-start-knowledge">
          <li><strong>{t('AI 使用', 'Using AI')}</strong><p>{t('提示词、上下文、工具、Skill、结果核验。', 'Prompts, context, tools, Skills and verification.')}</p></li>
          <li><strong>{t('代码基础', 'Coding basics')}</strong><p>{t('文件、变量、函数；HTML、CSS、JavaScript / TypeScript。', 'Files, variables, functions; HTML, CSS, JavaScript / TypeScript.')}</p></li>
          <li><strong>{t('网站怎样运行', 'How websites run')}</strong><p>{t('前端、后端、API、数据库；本地与线上。', 'Frontend, backend, APIs, databases; local and production.')}</p></li>
          <li><strong>{t('开发工具', 'Development tools')}</strong><p>{t('终端、路径、依赖、启动与报错。', 'Terminal, paths, dependencies, startup and errors.')}</p></li>
          <li><strong>Git</strong><p>{t('diff、commit、pull、push；提交与发布。', 'Diff, commit, pull, push; commits and deployment.')}</p></li>
          <li><strong>{t('权限与验证', 'Access and verification')}</strong><p>{t('SSH、密钥、权限；实际验收。', 'SSH, keys, permissions and hands-on verification.')}</p></li>
          <li><strong>Mock-up</strong><p>{t('先做草图，选定再实现。', 'Sketch first, choose, then build.')}</p></li>
          <li><strong>{t('上下文管理', 'Context management')}</strong><p>{t('附文件与报错；聚焦目标，换聊天先交接。', 'Attach files and errors; stay focused and hand off before switching chats.')}</p></li>
          <li><strong>{t('多线程协作', 'Parallel chats')}</strong><p>{t('独立任务分开做，同一文件不同时改，最后统一验收。', 'Split independent tasks, avoid editing the same file concurrently, then verify together.')}</p></li>
        </ul>
        </details>
    <section className="team-lifecycle-boundaries" aria-labelledby="onboarding-boundaries">
      <div className="team-lifecycle-section-heading"><ShieldCheck size={22} aria-hidden="true" /><h2 id="onboarding-boundaries">{t('把工作交给 AI，把授权留给自己', 'Delegate work. Keep control of access.')}</h2></div>
      <div className="team-lifecycle-comparison">
        <article className="team-lifecycle-example team-lifecycle-example--good">
          <h3><Check size={18} aria-hidden="true" />{t('可以这样做', 'Do this')}</h3>
          <div className="team-lifecycle-access-flow" aria-hidden="true"><FileText size={26} /><span>{t('任务与资料', 'Brief and files')}</span><ArrowRight size={16} /><Sparkles size={26} /><span>AI</span></div>
          <p>{t('提供相关文件、截图和完整报错，让 AI 先检查再执行。', 'Share relevant files, screenshots and full errors. Have AI inspect before acting.')}</p>
          <p>{t('登录和系统授权由本人完成；开发接入使用自己的设备与密钥。', 'Handle sign-in and system permissions yourself. Use your own device and keys.')}</p>
        </article>
        <article className="team-lifecycle-example team-lifecycle-example--bad">
          <h3><X size={18} aria-hidden="true" />{t('不要这样做', 'Avoid this')}</h3>
          <div className="team-lifecycle-access-flow" aria-hidden="true"><KeyRound size={26} /><span>{t('密码与私钥', 'Passwords and keys')}</span><X className="team-lifecycle-stop" size={18} /><Sparkles size={26} /><span>AI</span></div>
          <p>{t('不把密码、令牌、私钥或无关客户资料粘进聊天。', 'Keep passwords, tokens, private keys and unrelated customer data out of chats.')}</p>
          <p>{t('不复制同事的接入凭据，不把安装软件当成发布授权。', 'Do not reuse a colleague’s credentials or treat setup permission as release approval.')}</p>
        </article>
      </div>
    </section>
    <section className="team-lifecycle-first-task" aria-labelledby="onboarding-first-task">
      <div className="team-lifecycle-section-heading"><ClipboardCheck size={22} aria-hidden="true" /><h2 id="onboarding-first-task">{t('第一项练习：改好一个页面', 'First exercise: improve one page')}</h2></div>
      <p className="team-lifecycle-task-brief">{t('选一个不写入线上数据的小任务。把“做漂亮一点”改成明确的改动与验收条件。', 'Choose a small task with no production writes. Replace “make it nicer” with specific changes and acceptance criteria.')}</p>
      <div className="team-lifecycle-delivery">
        <div className="team-lifecycle-delivery-card"><span className="team-lifecycle-role">{t('给 AI 的任务', 'The brief')}</span><strong>{t('简化入职页面', 'Simplify onboarding')}</strong><span>{t('范围：标题与说明', 'Scope: headings and copy')}</span><span>{t('要求：去掉重复，保留操作', 'Criteria: remove repetition, keep actions')}</span></div>
        <ArrowRight className="team-lifecycle-delivery-arrow" size={24} aria-hidden="true" />
        <div className="team-lifecycle-delivery-card"><span className="team-lifecycle-role">{t('由你核验', 'Your acceptance')}</span><strong>{t('打开实际页面', 'Open the actual page')}</strong><span>{t('文字是否清楚，按钮是否可用', 'Check the copy and use the buttons')}</span><span>{t('交接：成果链接与未完成项', 'Handoff: result link and open items')}</span></div>
      </div>
      <div className="team-lifecycle-next"><AppLink className="team-lifecycle-link" href="/admin/team?section=sop" prefetch={false}>{t('查看开发规范', 'Read development standards')}<ArrowRight size={16} aria-hidden="true" /></AppLink></div>
    </section>
    </MoreTogglePanel>
    <MoreTogglePanel id="onboarding-options" expanded={optionalOpen} contentClassName="onboarding-extra">
    <section className="staff-start-optional" aria-labelledby="onboarding-optional-title">
      <h3 id="onboarding-optional-title">{t('可选设置', 'Optional setup')}</h3>
      <p className="staff-start-note">{t('需要远程操作电脑时，使用 UU远程并联系负责人授权。', 'For remote desktop access, use UU Remote and ask the lead to authorize access.')}</p>
    </section>
    <MacSetupChecklist />

    </MoreTogglePanel>
    {promptOpen === 'preview' && <WorkspaceDialog wide solid title={t('开发网址与进度', 'Development URL and progress')} onClose={() => setPromptOpen(null)}>
      <DevPreview key={user.uid} onTicketIssued={(value) => {
        const uid = user.uid;
        if (typeof uid !== 'number' || getAuthUser()?.uid !== uid) return;
        setEnrollment({ uid, ticket: value });
        setPromptOpen('setup');
      }} />
    </WorkspaceDialog>}
    {(promptOpen === 'setup' || promptOpen === 'learning') && <WorkspaceDialog wide solid title={promptOpen === 'setup' ? t('配置电脑与开发预览', 'Computer and preview setup') : t('AI 带练指令', 'AI coaching prompt')} onClose={() => setPromptOpen(null)}>
      <div className="onboarding-prompt-window">
        <WorkspaceButton className="onboarding-prompt-copy" action="copy" iconOnly={false} variant="secondary" onClick={() => copy(promptOpen === 'setup' ? aiPrompt : learningPrompt, `ai-${promptOpen}`)}>{copiedKey === `ai-${promptOpen}` ? t('已复制', 'Copied') : t('复制完整指令', 'Copy full prompt')}</WorkspaceButton>
        <pre tabIndex={0} className="onboarding-prompt-text">{promptOpen === 'setup' ? aiPrompt : learningPrompt}</pre>
      </div>
    </WorkspaceDialog>}
  </section>;
}
