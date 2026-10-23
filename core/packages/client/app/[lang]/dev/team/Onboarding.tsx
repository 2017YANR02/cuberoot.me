'use client';

import { useEffect } from 'react';
import { ArrowRight, Check, ChevronDown, ClipboardCheck, FileText, KeyRound, Laptop, ShieldCheck, Sparkles, UserRound, X } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { UserIdLabel } from '@/components/UserIdLabel';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import { useAuthUser, useAuthStore } from '@/lib/auth-store';
import RemoteAccess from './RemoteAccess';
import DevPreview from './DevPreview';
import './team-lifecycle.css';

export default function GetStartedPage() {
  const t = useT();
  const user = useAuthUser();
  const { copiedKey, copy } = useCopy();
  useEffect(() => {
    // Read the hydrated store inside the effect; useAuthUser is null on the first render.
    if (!useAuthStore.getState().user) useAuthStore.getState().login();
  }, [user]);
  const hasId = Number.isSafeInteger(user?.uid) && (user?.uid ?? 0) > 0;

  const softwarePrompt = t("请帮我安装 CubeRoot 入职必备软件。先检查系统、芯片架构和已有安装，保留原配置，只补缺少的软件：所有员工安装微信输入法（https://z.weixin.qq.com/）和网易 UU远程（从网易官方渠道核验并下载）；Windows 安装 ShareX（https://getsharex.com/）。从官方渠道核对当前系统兼容性和下载，版本不写死；无法安装时说明原因，不自行换软件。系统要求本人确认的权限由我完成。验证 UU远程能正常启动；本人完成登录，远程控制授权按实际需要由本人确认，不分享访问密码或自动开启无人值守控制。验证输入法能切换和输入，Windows 验证 ShareX 能截图，默认不自动上传截图。最后只报告已安装与未完成项。", "Install the required CubeRoot staff software. Check the OS, architecture and existing installations; preserve settings and install only missing apps. Everyone needs WeChat Input (https://z.weixin.qq.com/) and NetEase UU Remote (verify and download through official NetEase channels). Windows needs ShareX (https://getsharex.com/). Check current compatibility and downloads through official sources without pinning versions. Report incompatibility instead of substituting apps. I will handle required system confirmations. Verify UU Remote launches; I handle sign-in and any required remote-control authorization. Do not share access passwords or automatically enable unattended access. Verify input switching and typing, and ShareX capture on Windows; do not enable automatic screenshot uploads. Report only installed apps and unfinished work.");

  const aiPrompt = t(
    '请直接帮我完成 CubeRoot 本地开发环境配置，目标是在终端输入 cuberoot 就能启动并打开网站。\n\n1. 检查当前系统（Mac / Windows）、Git 和 OpenSSH 客户端（ssh、ssh-keygen）；缺少时从官方渠道安装，Windows 优先系统自带 OpenSSH / Git for Windows，Mac 检查命令行工具。检查已有项目；没有代码时克隆 https://github.com/2017YANR02/cuberoot.me.git，已有代码则复用。\n2. 先读仓库 AGENTS.md、docs/development.md。Node 版本以 .node-version 为准，pnpm 版本以 core/package.json 的 packageManager 为准；检查已有安装，缺什么补什么，不使用本文固定版本。检查支持操作本机的 AI App；本人完成 App 登录，AI 不索取密码。普通网页开发无需 Docker、数据库、Rust、Xcode 完整版或 Android Studio；仅在具体任务确实需要时安装。\n3. 在 core/ 安装依赖（pnpm install --frozen-lockfile），按现有说明运行 pnpm setup:local。复用 devsite 登记，不覆盖已有配置或另写同名 shell 函数。\n4. 核对新终端的 PATH，验证 cuberoot 能启动或复用服务，并实际打开网页确认成功；保留日志，不杀其他进程。\n5. 本轮只配置本机，不部署、不推送、不配置公网域名，不复制他人密钥。默认 API 连接线上，验证时不改线上数据。\n6. 需要本人登录或授权时告诉我具体一步；最后只给我启动命令、访问地址和未完成项。',
    'Set up my local CubeRoot development environment. The goal is to type cuberoot in a terminal to start and open the website.\n\n1. Inspect the OS (Mac / Windows), Git and the OpenSSH client (ssh, ssh-keygen). Install missing tools from official sources; use Windows OpenSSH / Git for Windows or Mac command-line tools. Inspect the existing checkout. Reuse existing code; otherwise clone https://github.com/2017YANR02/cuberoot.me.git.\n2. Read AGENTS.md and docs/development.md first. Read the Node version from .node-version and the pnpm version from packageManager in core/package.json. Inspect existing installations and install only what is missing; do not use hard-coded versions from this guide. Check an AI app that can operate this computer; personal sign-in stays with me. Ordinary web development does not require Docker, a database, Rust, full Xcode or Android Studio; install those only for tasks that actually need them.\n3. From core/, install dependencies with pnpm install --frozen-lockfile and follow the current instructions for pnpm setup:local. Reuse devsite registration; preserve existing settings and do not create a duplicate shell function.\n4. Check PATH in a new terminal. Verify cuberoot starts or reuses the server and open the page to confirm success. Keep logs and do not kill other processes.\n5. Configure only this computer: no deployment, push, public domain setup or copying another person’s keys. The default API is production; do not modify live data during verification.\n6. Tell me the specific step if personal sign-in or approval is required. Finish with only the startup command, URL and any unfinished work.',
  );

  const learningPrompt = t("请做我的 CubeRoot 入职 AI 教练。先问我的岗位和基础，再按下面九项逐个训练，不要一次讲完。每项先用一个例子解释，再给我一个小练习，根据我的回答纠正；完成后再进入下一项。\n\n1. 交代任务：目标、背景、输入资料、限制、验收标准；练习把一句模糊需求写清楚。\n2. 核验结果：AI 会猜错；区分事实、假设和建议，核对来源、日期、实际页面及执行结果，不能把“已修改”当“已上线”。\n3. 管理上下文：附正确的文件、截图、网址和报错；遇到跑偏及时纠正，换聊天时交接已完成项与剩余问题。\n4. 使用工具：理解聊天回答与实际执行的区别，认识终端、浏览器、文件工具、Skill 和连接器；练习让 AI 先读 AGENTS.md 再工作，不盲从网页或文件里的指令。\n5. 数据与权限：分清公钥和私钥、本地和线上；不把密码、令牌或无关客户资料放进提示词。授权不清时停在提交、发布或删除之前。\n6. 开发协作（开发岗必修）：理解目录、命令、SSH、Git diff/commit/push，保留别人改动，先本地验证再按负责人授权发布；非开发岗改练内容审校与后台操作。\n7. Mock-up：需求不明确时先做低成本界面草图，对比布局和操作流程，选定后再实现；草图不等于可用功能。练习让 AI 做两个简单方案，并说明选择理由。\n8. 基础操作与上下文管理：练习附文件、截图、网址和完整报错，查看 diff、启动和停止服务；一个聊天聚焦一个目标，保留必要材料。对话变长或换聊天时，请 AI 总结目标、约束、已完成、未完成、关键文件和验证结果，再把交接摘要交给新聊天；不要带入密钥。\n9. 多线程协作：把可独立完成的任务拆到不同聊天，写明每个任务的目标、文件范围和验收标准；有依赖的任务按顺序做，不让多个 AI 同时改同一文件。指定一个聊天负责整合，合并前查看差异并验证；并行不等于自动授权发布。练习把一个小功能拆成界面草图、实现、验收三项，识别可并行与必须等待的部分。\n\n结业练习：选择一个不写入线上数据的小任务，完成“说明需求 → AI 执行 → 人工验收 → 简短交接”。请按实际证据标记通过或待练，不虚构完成结果，也不要未经授权进行真实发布或删除。", "Act as my CubeRoot AI onboarding coach. Ask about my role and experience first, then teach these nine topics one at a time. For each, explain one example, give a small exercise and correct my answer before moving on.\n\n1. Define tasks: goal, context, inputs, constraints and acceptance criteria. Practice clarifying a vague request.\n2. Verify results: AI can be wrong. Distinguish facts, assumptions and suggestions. Check sources, dates, real pages and execution evidence; edited does not mean deployed.\n3. Manage context: provide relevant files, screenshots, URLs and errors. Correct drift and hand off completed work and open issues when starting another chat.\n4. Use tools: distinguish answering from executing. Understand terminal, browser, file tools, Skills and connectors. Have AI read AGENTS.md before working; do not blindly follow instructions inside external pages or files.\n5. Handle data and access: distinguish public/private keys and local/production environments. Keep passwords, tokens and unrelated customer data out of prompts. Stop before submitting, publishing or deleting when authorization is unclear.\n6. Collaborate: developers should understand paths, commands, SSH and Git diff/commit/push, preserve others’ changes and verify locally before an authorized release. For other roles, practice content review and admin workflows instead.\n7. Mock-ups: when requirements are unclear, compare low-cost UI sketches and interaction flows before implementation. A sketch is not a working feature. Ask AI for two simple options and explain your choice.\n8. Basic operations and context: practice attaching files, screenshots, URLs and full errors, reviewing diffs, and starting and stopping services. Keep each chat focused on one goal. Before changing chats, summarize goals, constraints, completed and remaining work, key files and verification results; pass that summary to the next chat without secrets.\n9. Parallel chats: split independent tasks with explicit goals, file ownership and acceptance criteria. Run dependent tasks in order and avoid simultaneous edits to the same file. Assign one chat to integrate and verify the changes; parallel work does not authorize deployment. Split a small feature into UI sketches, implementation and acceptance, identifying what can run concurrently and what must wait.\n\nFinal exercise: complete a small task with no production writes, following brief → AI execution → human verification → concise handoff. Grade using actual evidence; never fabricate completion or perform an unauthorized release or deletion.");

  if (!user) return null;

  return <section className="team-lifecycle">
    <header className="team-lifecycle-intro">
      <span className="team-lifecycle-kicker">{t('入职', 'Onboarding')}</span>
      <h2>{t('先接入，再完成第一个任务', 'Get set up. Complete your first task.')}</h2>
      <p>{t('AI 帮你准备工具，你负责理解任务、确认权限和验收结果。', 'Let AI prepare the tools. You own the brief, access decisions and acceptance.')}</p>
    </header>
    <ol className="team-lifecycle-path" aria-label={t('入职顺序', 'Onboarding sequence')}>
      <li><span className="team-lifecycle-path-icon"><UserRound size={22} aria-hidden="true" /></span><div><span className="team-lifecycle-step">01</span><h3>{t('确认身份', 'Identify yourself')}</h3><p>{t('发送账号 ID，由负责人分配权限。', 'Share your account ID so your lead can assign access.')}</p></div><ArrowRight className="team-lifecycle-path-arrow" size={18} aria-hidden="true" /></li>
      <li><span className="team-lifecycle-path-icon"><Laptop size={22} aria-hidden="true" /></span><div><span className="team-lifecycle-step">02</span><h3>{t('准备工具', 'Prepare your tools')}</h3><p>{t('补齐软件，实际打开本地网页。', 'Install what is missing and open the local site.')}</p></div><ArrowRight className="team-lifecycle-path-arrow" size={18} aria-hidden="true" /></li>
      <li><span className="team-lifecycle-path-icon"><ClipboardCheck size={22} aria-hidden="true" /></span><div><span className="team-lifecycle-step">03</span><h3>{t('完成练习', 'Complete a small task')}</h3><p>{t('说明需求，核验结果，留下交接。', 'Write the brief, verify the result and leave a handoff.')}</p></div></li>
    </ol>
    <div className="staff-start-modules">
      <article className="staff-start-module" data-site-surface="panel" aria-labelledby="staff-ai-title">
        <div className="staff-start-module-heading">
          <Sparkles className="staff-start-module-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <div><span className="team-lifecycle-role">{t('执行与整理', 'Execution and preparation')}</span><h2 id="staff-ai-title" className="staff-start-module-title">{t('交给 AI', 'Delegate to AI')}</h2></div>
        </div>
        <section className="staff-start-task">
          <div className="staff-start-row">
            <h3>{t('安装必备软件', 'Install required apps')}</h3>
            <button type="button" className="staff-start-action" onClick={() => copy(softwarePrompt, 'ai-software')}>
              {copiedKey === 'ai-software' ? t('已复制', 'Copied') : t('复制指令', 'Copy prompt')}
            </button>
          </div>
          <details className="staff-start-instructions">
            <summary>{t('软件与指令', 'Apps and instructions')}<ChevronDown size={14} aria-hidden="true" /></summary>
            <ul className="staff-start-apps">
              <li>{t('全部：微信输入法、UU远程', 'Everyone: WeChat Input, UU Remote')}</li>
              <li>{t('Windows：ShareX', 'Windows: ShareX')}</li>
            </ul>
            <pre className="staff-start-prompt">{softwarePrompt}</pre>
          </details>
        </section>
        <section className="staff-start-task">
          <div className="staff-start-row">
            <h3>{t('配置本地环境', 'Set up locally')}</h3>
            <button type="button" className="staff-start-action" onClick={() => copy(aiPrompt, 'ai-setup')}>
              {copiedKey === 'ai-setup' ? t('已复制', 'Copied') : t('复制指令', 'Copy prompt')}
            </button>
          </div>
          <details className="staff-start-instructions">
            <summary>{t('查看指令', 'View instructions')}<ChevronDown size={14} aria-hidden="true" /></summary>
            <p>{t('输入 cuberoot 启动，Ctrl+C 停止。', 'Run cuberoot to start; Ctrl+C to stop.')}</p>
            <pre className="staff-start-prompt">{aiPrompt}</pre>
          </details>
        </section>
        <section className="staff-start-task">
          <div className="staff-start-row">
            <h3>{t('AI 带练', 'AI coaching')}</h3>
            <button type="button" className="staff-start-action" onClick={() => copy(learningPrompt, 'ai-learning')}>
              {copiedKey === 'ai-learning' ? t('已复制', 'Copied') : t('复制指令', 'Copy prompt')}
            </button>
          </div>
          <details className="staff-start-instructions">
            <summary>{t('查看指令', 'View instructions')}<ChevronDown size={14} aria-hidden="true" /></summary>
            <pre className="staff-start-prompt">{learningPrompt}</pre>
          </details>
        </section>
        <details className="staff-start-disclosure">
          <summary>{t('远程连接', 'Remote access')}<ChevronDown size={18} aria-hidden="true" /></summary>
          <RemoteAccess />
        </details>
        <details className="staff-start-disclosure">
          <summary>{t('开发网址', 'Development URL')}<ChevronDown size={18} aria-hidden="true" /></summary>
          <DevPreview />
        </details>
      </article>
      <article className="staff-start-module" data-site-surface="panel" aria-labelledby="staff-self-title">
        <div className="staff-start-module-heading">
          <UserRound className="staff-start-module-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <div><span className="team-lifecycle-role">{t('判断与确认', 'Judgment and approval')}</span><h2 id="staff-self-title" className="staff-start-module-title">{t('由自己完成', 'Do yourself')}</h2></div>
        </div>
        <div className="staff-start-row staff-start-account">
          <h3>{t('登录账号', 'Sign in')}</h3>
          <span className="staff-start-complete" role="status"><Check size={15} aria-hidden="true" />{t('已完成', 'Done')}</span>
        </div>
        <section className="staff-start-identity">
          <h3>{t('把 ID 发给负责人', 'Send your ID to your lead')}</h3>
          {hasId ? <div className="staff-start-row">
            <div className="staff-start-id"><UserIdLabel userId={user.uid} full /></div>
            <button type="button" className="staff-start-action" onClick={() => copy(String(user.uid), String(user.uid))}>
              {copiedKey === String(user.uid) ? t('已复制', 'Copied') : t('复制 ID', 'Copy ID')}
            </button>
          </div> : <p>{t('请到账号页重新登录以获取 ID。', 'Sign in again on the account page to retrieve your ID.')}</p>}
        </section>
        <details className="staff-start-disclosure">
          <summary>{t('学习 AI 与代码基础', 'Learn AI and coding basics')}<ChevronDown size={18} aria-hidden="true" /></summary>
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
        <AppLink className="staff-start-account-link" href="/account" prefetch={false}>{t('我的账号', 'My account')}</AppLink>
      </article>
    </div>
    <section className="team-lifecycle-boundaries" aria-labelledby="onboarding-boundaries">
      <div className="team-lifecycle-section-heading"><ShieldCheck size={22} aria-hidden="true" /><h2 id="onboarding-boundaries">{t('把工作交给 AI，把授权留给自己', 'Delegate work. Keep control of access.')}</h2></div>
      <div className="team-lifecycle-comparison">
        <article className="team-lifecycle-example team-lifecycle-example--good" data-site-surface="panel">
          <h3><Check size={18} aria-hidden="true" />{t('可以这样做', 'Do this')}</h3>
          <div className="team-lifecycle-access-flow" aria-hidden="true"><FileText size={26} /><span>{t('任务与资料', 'Brief and files')}</span><ArrowRight size={16} /><Sparkles size={26} /><span>AI</span></div>
          <p>{t('提供相关文件、截图和完整报错，让 AI 先检查再执行。', 'Share relevant files, screenshots and full errors. Have AI inspect before acting.')}</p>
          <p>{t('登录和系统授权由本人完成；开发接入使用自己的设备与密钥。', 'Handle sign-in and system permissions yourself. Use your own device and keys.')}</p>
        </article>
        <article className="team-lifecycle-example team-lifecycle-example--bad" data-site-surface="panel">
          <h3><X size={18} aria-hidden="true" />{t('不要这样做', 'Avoid this')}</h3>
          <div className="team-lifecycle-access-flow" aria-hidden="true"><KeyRound size={26} /><span>{t('密码与私钥', 'Passwords and keys')}</span><X className="team-lifecycle-stop" size={18} /><Sparkles size={26} /><span>AI</span></div>
          <p>{t('不把密码、令牌、私钥或无关客户资料粘进聊天。', 'Keep passwords, tokens, private keys and unrelated customer data out of chats.')}</p>
          <p>{t('不复制同事的接入凭据，不把安装软件当成发布授权。', 'Do not reuse a colleague’s credentials or treat setup permission as release approval.')}</p>
        </article>
      </div>
    </section>
    <section className="team-lifecycle-first-task" data-site-surface="panel" aria-labelledby="onboarding-first-task">
      <div className="team-lifecycle-section-heading"><ClipboardCheck size={22} aria-hidden="true" /><h2 id="onboarding-first-task">{t('第一项练习：改好一个页面', 'First exercise: improve one page')}</h2></div>
      <p className="team-lifecycle-task-brief">{t('选一个不写入线上数据的小任务。把“做漂亮一点”改成明确的改动与验收条件。', 'Choose a small task with no production writes. Replace “make it nicer” with specific changes and acceptance criteria.')}</p>
      <div className="team-lifecycle-delivery">
        <div className="team-lifecycle-delivery-card"><span className="team-lifecycle-role">{t('给 AI 的任务', 'The brief')}</span><strong>{t('简化入职页面', 'Simplify onboarding')}</strong><span>{t('范围：标题与说明', 'Scope: headings and copy')}</span><span>{t('要求：去掉重复，保留操作', 'Criteria: remove repetition, keep actions')}</span></div>
        <ArrowRight className="team-lifecycle-delivery-arrow" size={24} aria-hidden="true" />
        <div className="team-lifecycle-delivery-card"><span className="team-lifecycle-role">{t('由你核验', 'Your acceptance')}</span><strong>{t('打开实际页面', 'Open the actual page')}</strong><span>{t('文字是否清楚，按钮是否可用', 'Check the copy and use the buttons')}</span><span>{t('交接：成果链接与未完成项', 'Handoff: result link and open items')}</span></div>
      </div>
      <div className="team-lifecycle-next"><AppLink className="team-lifecycle-link" href="/workspace?section=sop" prefetch={false}>{t('查看工作流程', 'Open the workflow')}<ArrowRight size={16} aria-hidden="true" /></AppLink><AppLink className="team-lifecycle-link" href="/workspace?section=quality" prefetch={false}>{t('对照质量标准', 'Check quality standards')}<ArrowRight size={16} aria-hidden="true" /></AppLink></div>
    </section>
  </section>;
}
