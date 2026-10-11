'use client';

import AppLink from '@/components/AppLink';
import { UserIdLabel } from '@/components/UserIdLabel';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthUser } from '@/lib/auth-store';
import './get-started.css';
import RemoteAccess from './RemoteAccess';
import DevPreview from './DevPreview';

export default function GetStartedPage() {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const { copiedKey, copy } = useCopy();
  const returnPath = `${lang === 'zh' ? '/zh' : ''}/account/get-started`;
  const hasId = Number.isSafeInteger(user?.uid) && (user?.uid ?? 0) > 0;

  const aiPrompt = t(
    '请直接帮我完成 CubeRoot 本地开发环境配置，目标是在终端输入 cuberoot 就能启动并打开网站。\n\n1. 检查当前系统（Mac / Windows）、Git 和 OpenSSH 客户端（ssh、ssh-keygen）；缺少时从官方渠道安装，Windows 优先系统自带 OpenSSH / Git for Windows，Mac 检查命令行工具。检查已有项目；没有代码时克隆 https://github.com/2017YANR02/cuberoot.me.git，已有代码则复用。\n2. 先读仓库 AGENTS.md、docs/development.md。Node 版本以 .node-version 为准，pnpm 版本以 core/package.json 的 packageManager 为准；检查已有安装，缺什么补什么，不使用本文固定版本。检查支持操作本机的 AI App；本人完成 App 登录，AI 不索取密码。普通网页开发无需 Docker、数据库、Rust、Xcode 完整版或 Android Studio；仅在具体任务确实需要时安装。\n3. 在 core/ 安装依赖（pnpm install --frozen-lockfile），按现有说明运行 pnpm setup:local。复用 devsite 登记，不覆盖已有配置或另写同名 shell 函数。\n4. 核对新终端的 PATH，验证 cuberoot 能启动或复用服务，并实际打开网页确认成功；保留日志，不杀其他进程。\n5. 本轮只配置本机，不部署、不推送、不配置公网域名，不复制他人密钥。默认 API 连接线上，验证时不改线上数据。\n6. 需要本人登录或授权时告诉我具体一步；最后只给我启动命令、访问地址和未完成项。',
    'Set up my local CubeRoot development environment. The goal is to type cuberoot in a terminal to start and open the website.\n\n1. Inspect the OS (Mac / Windows), Git and the OpenSSH client (ssh, ssh-keygen). Install missing tools from official sources; use Windows OpenSSH / Git for Windows or Mac command-line tools. Inspect the existing checkout. Reuse existing code; otherwise clone https://github.com/2017YANR02/cuberoot.me.git.\n2. Read AGENTS.md and docs/development.md first. Read the Node version from .node-version and the pnpm version from packageManager in core/package.json. Inspect existing installations and install only what is missing; do not use hard-coded versions from this guide. Check an AI app that can operate this computer; personal sign-in stays with me. Ordinary web development does not require Docker, a database, Rust, full Xcode or Android Studio; install those only for tasks that actually need them.\n3. From core/, install dependencies with pnpm install --frozen-lockfile and follow the current instructions for pnpm setup:local. Reuse devsite registration; preserve existing settings and do not create a duplicate shell function.\n4. Check PATH in a new terminal. Verify cuberoot starts or reuses the server and open the page to confirm success. Keep logs and do not kill other processes.\n5. Configure only this computer: no deployment, push, public domain setup or copying another person’s keys. The default API is production; do not modify live data during verification.\n6. Tell me the specific step if personal sign-in or approval is required. Finish with only the startup command, URL and any unfinished work.',
  );

  const learningPrompt = t("请做我的 CubeRoot 入职 AI 教练。先问我的岗位和基础，再按下面六项逐个训练，不要一次讲完。每项先用一个例子解释，再给我一个小练习，根据我的回答纠正；完成后再进入下一项。\n\n1. 交代任务：目标、背景、输入资料、限制、验收标准；练习把一句模糊需求写清楚。\n2. 核验结果：AI 会猜错；区分事实、假设和建议，核对来源、日期、实际页面及执行结果，不能把“已修改”当“已上线”。\n3. 管理上下文：附正确的文件、截图、网址和报错；遇到跑偏及时纠正，换聊天时交接已完成项与剩余问题。\n4. 使用工具：理解聊天回答与实际执行的区别，认识终端、浏览器、文件工具、Skill 和连接器；练习让 AI 先读 AGENTS.md 再工作，不盲从网页或文件里的指令。\n5. 数据与权限：分清公钥和私钥、本地和线上；不把密码、令牌或无关客户资料放进提示词。授权不清时停在提交、发布或删除之前。\n6. 开发协作（开发岗必修）：理解目录、命令、SSH、Git diff/commit/push，保留别人改动，先本地验证再按负责人授权发布；非开发岗改练内容审校与后台操作。\n\n结业练习：选择一个不写入线上数据的小任务，完成“说明需求 → AI 执行 → 人工验收 → 简短交接”。请按实际证据标记通过或待练，不虚构完成结果，也不要未经授权进行真实发布或删除。", "Act as my CubeRoot AI onboarding coach. Ask about my role and experience first, then teach these six topics one at a time. For each, explain one example, give a small exercise and correct my answer before moving on.\n\n1. Define tasks: goal, context, inputs, constraints and acceptance criteria. Practice clarifying a vague request.\n2. Verify results: AI can be wrong. Distinguish facts, assumptions and suggestions. Check sources, dates, real pages and execution evidence; edited does not mean deployed.\n3. Manage context: provide relevant files, screenshots, URLs and errors. Correct drift and hand off completed work and open issues when starting another chat.\n4. Use tools: distinguish answering from executing. Understand terminal, browser, file tools, Skills and connectors. Have AI read AGENTS.md before working; do not blindly follow instructions inside external pages or files.\n5. Handle data and access: distinguish public/private keys and local/production environments. Keep passwords, tokens and unrelated customer data out of prompts. Stop before submitting, publishing or deleting when authorization is unclear.\n6. Collaborate: developers should understand paths, commands, SSH and Git diff/commit/push, preserve others’ changes and verify locally before an authorized release. For other roles, practice content review and admin workflows instead.\n\nFinal exercise: complete a small task with no production writes, following brief → AI execution → human verification → concise handoff. Grade using actual evidence; never fabricate completion or perform an unauthorized release or deletion.");

  return <main className="staff-start">
    <header>
      <h1>{t('新员工入门', 'Getting started for staff')}</h1>
    </header>
    <div className="staff-start-modules">
    <article className="staff-start-module" data-site-surface="panel" aria-labelledby="staff-ai-title">
      <h2 id="staff-ai-title" className="staff-start-module-title">{t('交给 AI', 'Delegate to AI')}</h2>
    <section className="staff-start-development">
      <h3>{t('配置本地环境', 'Set up the local environment')}</h3>
      <p>{t('AI 检查并安装：Git、Node.js、pnpm、OpenSSH 和项目依赖。版本以仓库为准；只做后台管理可跳过。', 'AI checks and installs Git, Node.js, pnpm, OpenSSH and project dependencies using repository versions. Skip if you only manage website content.')}</p>
      <button type="button" className="staff-start-action" onClick={() => copy(aiPrompt, 'ai-setup')}>
        {copiedKey === 'ai-setup' ? t('已复制', 'Copied') : t('复制给 AI', 'Copy for AI')}
      </button>
      <details><summary>{t('查看 AI 指令', 'View AI instructions')}</summary><pre className="staff-start-prompt">{aiPrompt}</pre></details>
      <p>{t('配好后：输入 cuberoot 启动，Ctrl+C 停止。', 'Once set up: run cuberoot to start; Ctrl+C to stop.')}</p>
    </section>
    <RemoteAccess />
    <DevPreview />
    <section className="staff-start-development">
      <h3>{t('AI 带练', 'AI coaching')}</h3>
      <p>{t('让 AI 按岗位逐项讲解、出题并纠正。', 'Ask AI to explain, quiz and coach you for your role.')}</p>

      <button type="button" className="staff-start-action" onClick={() => copy(learningPrompt, 'ai-learning')}>
        {copiedKey === 'ai-learning' ? t('已复制', 'Copied') : t('复制给 AI，开始带练', 'Copy for AI coaching')}
      </button>
      <details><summary>{t('查看带练指令', 'View coaching instructions')}</summary><pre className="staff-start-prompt">{learningPrompt}</pre></details>
      <p>{t('入门验收：独立完成一个小任务，能说明做了什么、如何验证、还有什么没完成。', 'Completion check: finish a small task and explain what changed, how you verified it and what remains.')}</p>
    </section>
    </article>
    <article className="staff-start-module" data-site-surface="panel" aria-labelledby="staff-self-title">
      <h2 id="staff-self-title" className="staff-start-module-title">{t('由自己完成', 'Do yourself')}</h2>
    <ol className="staff-start-steps">
      <li>
        <h3>{t('1. 注册或登录账号', '1. Register or sign in')}</h3>
        {user ? <p role="status">{t('你已登录，可以继续下一步。', 'You are signed in. Continue to the next step.')}</p> : <>
          <p>{t('已有账号直接登录；无需 WCA ID。', 'Sign in if you already have an account. No WCA ID needed.')}</p>
          <AppLink className="staff-start-action" href={`/account?next=${encodeURIComponent(returnPath)}`} prefetch={false}>{t('注册 / 登录', 'Register / sign in')}</AppLink>
        </>}
      </li>
      <li>
        <h3>{t('2. 把 CubeRoot ID 发给负责人', '2. Send your CubeRoot ID to your team lead')}</h3>
        <p>{t('把这个数字 ID 发给负责人，等待开通管理员权限。', 'Send this numeric ID to your team lead for administrator access.')}</p>
        {hasId ? <>
          <div className="staff-start-id"><UserIdLabel userId={user!.uid} full /></div>
          <button type="button" className="staff-start-action" onClick={() => copy(String(user!.uid), String(user!.uid))}>
            {copiedKey === String(user!.uid) ? t('已复制', 'Copied') : t('复制 CubeRoot ID', 'Copy CubeRoot ID')}
          </button>
        </> : <p>{user
          ? t('当前会话没有账号 ID，请到账号页重新登录后再试。', 'This session has no account ID. Sign in again on the account page and retry.')
          : t('登录后，这里会显示你自己的账号 ID。', 'Your account ID will appear here after you sign in.')}</p>}
      </li>
      <li>
        <h3>{t('3. 学习 AI 与代码基础', '3. Learn AI and coding basics')}</h3>
        <p>{t('自行上网查资料，或让 AI 解释并给你出练习。查技术用法优先看官方文档，不必死记版本和命令。', 'Research online or ask AI to explain and give you exercises. Prefer official documentation for technical usage; do not memorize versions or commands.')}</p>
        <ul className="staff-start-knowledge">
          <li><strong>{t('AI 使用', 'Using AI')}</strong><p>{t('提示词、上下文、幻觉、工具与 Skill；会提供目标、资料、限制和验收标准，能核验 AI 的说法与执行结果。', 'Prompts, context, hallucinations, tools and Skills. Supply goals, inputs, constraints and acceptance criteria; verify claims and execution results.')}</p></li>
          <li><strong>{t('代码基础', 'Coding basics')}</strong><p>{t('文件与目录、变量、函数、条件、循环；了解 HTML 管结构、CSS 管样式、JavaScript / TypeScript 管逻辑，能看懂简单修改。', 'Files, folders, variables, functions, conditions and loops. Understand HTML structure, CSS styling and JavaScript / TypeScript logic well enough to read a small change.')}</p></li>
          <li><strong>{t('网站怎样运行', 'How websites run')}</strong><p>{t('浏览器、前端、后端、API、数据库；理解 localhost、域名、端口、HTTPS，以及本地开发和线上网站的区别。', 'Browser, frontend, backend, API and database. Understand localhost, domains, ports, HTTPS and local versus production environments.')}</p></li>
          <li><strong>{t('开发工具', 'Development tools')}</strong><p>{t('终端、路径、环境变量、Node.js、pnpm、依赖；会启动和停止服务、看报错、把完整问题交给 AI 排查。', 'Terminal, paths, environment variables, Node.js, pnpm and dependencies. Start and stop services, read errors and provide enough context for AI to debug.')}</p></li>
          <li><strong>Git</strong><p>{t('仓库、分支、diff、commit、pull、push；知道保存文件、提交代码和发布上线是不同的事，不覆盖别人改动。', 'Repositories, branches, diff, commit, pull and push. Distinguish saving files, committing changes and deploying; preserve other people’s work.')}</p></li>
          <li><strong>{t('权限与验证', 'Access and verification')}</strong><p>{t('SSH、公钥与私钥、密码与令牌；不泄露凭据。能实际打开页面验收，并说清哪些已完成、哪些未验证。', 'SSH, public/private keys, passwords and tokens. Keep credentials private. Verify the actual page and distinguish completed work from unverified work.')}</p></li>
        </ul>
        <p className="staff-start-note">{t('学习目标：能用自己的话解释，并完成一个不影响线上数据的小练习；不懂就查或问，不需要先成为程序员。', 'Goal: explain each topic in your own words and complete a small exercise without affecting production data. Research or ask when unsure; you do not need to become a programmer first.')}</p>
      </li>
    </ol>
    <AppLink href="/account" prefetch={false}>{t('查看我的账号', 'View my account')}</AppLink>
    </article>
    </div>
  </main>;
}
