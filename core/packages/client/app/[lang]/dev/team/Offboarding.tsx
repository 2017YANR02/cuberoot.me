'use client';

import { useEffect } from 'react';
import { ArrowRight, Check, ChevronDown, ClipboardCheck, FileCheck2, FolderOpen, KeyRound, Laptop, ShieldCheck, Sparkles, Unplug, UserRound, X } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import { useAuthUser, useAuthStore } from '@/lib/auth-store';
import './team-lifecycle.css';

export default function OffboardingPage() {
  const t = useT();
  const user = useAuthUser();
  const { copiedKey, copy } = useCopy();
  useEffect(() => {
    if (!useAuthStore.getState().user) useAuthStore.getState().login();
  }, [user]);

  const tasks = [
    {
      id: 'handoff', title: t('整理工作交接', 'Prepare the handoff'),
      prompt: t(
        '帮我整理 CubeRoot 离职交接。先读当前项目 AGENTS.md 和已有任务记录，检查工作区及 Git 状态，保留所有人的未提交改动。整理一份交接清单：项目与文件位置、已完成和未完成工作、分支及未提交改动、启动与验证方法、已知问题、相关文档、待接收事项。按证据区分本地修改、已提交、已发布和实际验收。列出需要移交的组织资源及管理员归属，不输出密码、令牌、私钥或客户数据。优先复用已有文档，不擅自提交、推送、发布、删除或向别人发消息。只一次性询问无法从资料中查明的接收人和必要缺项，最后给我交接文件位置及待确认清单；交接是否完成由接收人确认。',
        'Prepare my CubeRoot offboarding handoff. Read AGENTS.md and existing task records, inspect the workspace and Git status, and preserve everyone’s uncommitted changes. Document project/file locations, completed and pending work, branches and uncommitted changes, startup and verification steps, known issues, relevant docs and items awaiting acceptance. Distinguish local edits, commits, deployments and actual verification using evidence. List organizational resources and administrator ownership to transfer without exposing passwords, tokens, private keys or customer data. Reuse existing docs. Do not commit, push, deploy, delete or message others. Batch only missing recipient details and essential questions that cannot be resolved from available material. Report the handoff file and outstanding items; the recipient confirms acceptance.',
      ),
    },
    {
      id: 'cleanup', title: t('清理本机接入', 'Clean up local access'),
      prompt: t(
        '帮我完成 CubeRoot 离职设备清理。先核对工作交接已由接收人确认；未确认时只盘点，不删除。检查这台设备的 CubeRoot 项目、专用 SSH 别名和密钥、开发网址隧道、自启任务、devsite 登记、AI App 远程项目和组织登录。生成明确的清理清单，区分个人与组织资源，保留其他项目、软件及个人资料。把需要删除的具体路径和需退出的账号一次列出，经本人确认后仅清理这些项目专用配置；不删整份 .ssh、凭据库或共享目录，不输出秘密。负责人应先完成服务端撤权，本机删除密钥不等于撤权。交接确认且服务端撤权后，停止该设备隧道与自启，移除专用别名和密钥，退出组织账号，按已确认清单清理组织副本。验证自启、隧道和远程项目已移除，列出无法验证的事项，不把删除文件当作服务器撤权成功。',
        'Clean up this device for CubeRoot offboarding. First verify that the recipient accepted the handoff; until then, inventory only. Inspect CubeRoot checkouts, dedicated SSH aliases/keys, preview tunnels, startup jobs, devsite registrations, AI app remote projects and organizational sign-ins. Prepare an exact cleanup list distinguishing personal and organizational resources. Preserve other projects, apps and personal data. Batch specific paths and accounts for my confirmation before removing dedicated configuration. Never delete the entire .ssh directory, credential store or shared directories; never expose secrets. The lead must revoke server access first; deleting local keys is not revocation. After handoff acceptance and server revocation, stop this device’s tunnel/startup jobs, remove its dedicated aliases and keys, sign out of organizational accounts and remove only approved organizational copies. Verify removal of startup jobs, tunnels and remote projects, and report anything unverified. File removal does not prove server revocation.',
      ),
    },
  ];
  const leadPrompt = t(
    '协助负责人完成 CubeRoot 离职撤权。先核对离职人的账号 ID、设备与交接接收人，列出所有授权和具体撤销对象，负责人确认范围后执行，不能凭姓名猜账号。在 https://cuberoot.me/zh/workspace?section=onboarding 的“远程连接”核对该人的全部设备，使用“撤销新连接权限”，等待主机确认密钥移除；这只阻止新连接，还须核查并终止该人的现有 SSH 会话和相关进程，不能影响他人会话。开发网址按仓库 .agents/skills/dev-preview/SKILL.md 和 docs/dev-preview-onboarding.md 的撤销流程处理，核对设备清单、专用账号、隧道、DNS、证书与 nginx 配置，保留审计记录，不能只删 DNS。按实际拥有的权限清单移除 CubeRoot 管理员、代码仓库、云服务、AI 工作区和 UU远程等组织访问；资源先交接给接收人，再移除成员。仅在相关共享凭据确有接触且已确认影响范围时轮换，不打印秘密。验证旧密钥无法新建连接、旧会话结束、开发网址不再代理该设备和各组织授权已撤销。缺权限时汇总负责人需要完成的具体操作。最后列出已验证、等待同步、未完成，禁止仅凭点击按钮报告全部撤权成功。',
    'Assist the lead with CubeRoot offboarding access revocation. Identify the departing account ID, devices and handoff recipient. Inventory grants and exact targets; execute only after the lead confirms scope, never infer identity from a name. At https://cuberoot.me/workspace?section=onboarding, inspect all of their devices under Remote access, use Revoke new connections and wait for host confirmation of key removal. This only blocks new connections: inspect and terminate their existing SSH sessions and related processes without affecting others. Revoke development URLs using .agents/skills/dev-preview/SKILL.md and docs/dev-preview-onboarding.md; check the registry, dedicated account, tunnels, DNS, certificates and nginx, preserving audit records. DNS removal alone is insufficient. Remove actual grants for CubeRoot administration, repositories, cloud services, AI workspaces and UU Remote; transfer resource ownership before removing membership. Rotate shared credentials only when exposure and impact have been confirmed; never print secrets. Verify old keys cannot connect, old sessions ended, the preview no longer proxies the device, and organizational grants were removed. Batch specific manual steps if permissions are missing. Report verified, pending synchronization and incomplete items separately; clicking a button is not proof of complete revocation.',
  );

  if (!user) return null;
  return <section className="team-lifecycle">
    <header className="team-lifecycle-intro">
      <span className="team-lifecycle-kicker">{t('离职', 'Offboarding')}</span>
      <h2>{t('工作有人接，权限有记录', 'Hand over the work. Account for every access grant.')}</h2>
      <p>{t('先确认交接，再撤销权限，最后清理设备。每一步都留下可核查的结果。', 'Confirm the handoff, revoke access, then clean up the device. Keep evidence for each step.')}</p>
    </header>
    <ol className="team-lifecycle-path" aria-label={t('离职交接顺序', 'Offboarding sequence')}>
      <li><span className="team-lifecycle-path-icon"><FileCheck2 size={22} aria-hidden="true" /></span><div><span className="team-lifecycle-step">01</span><h3>{t('接收人确认', 'Recipient accepts')}</h3><p>{t('工作、文件与组织资源已接收。', 'Work, files and organizational resources are received.')}</p></div><ArrowRight className="team-lifecycle-path-arrow" size={18} aria-hidden="true" /></li>
      <li><span className="team-lifecycle-path-icon"><ShieldCheck size={22} aria-hidden="true" /></span><div><span className="team-lifecycle-step">02</span><h3>{t('负责人撤权', 'Lead revokes access')}</h3><p>{t('收回授权，确认旧连接已结束。', 'Remove grants and confirm existing sessions have ended.')}</p></div><ArrowRight className="team-lifecycle-path-arrow" size={18} aria-hidden="true" /></li>
      <li><span className="team-lifecycle-path-icon"><Laptop size={22} aria-hidden="true" /></span><div><span className="team-lifecycle-step">03</span><h3>{t('本人清理', 'Employee cleans up')}</h3><p>{t('只清理已确认的组织配置与副本。', 'Remove only approved organizational configuration and copies.')}</p></div></li>
    </ol>
    <section className="team-lifecycle-handoff" data-site-surface="panel" aria-labelledby="offboarding-handoff">
      <div className="team-lifecycle-section-heading"><FolderOpen size={22} aria-hidden="true" /><h2 id="offboarding-handoff">{t('一份能接着做的交接', 'A handoff someone can continue')}</h2></div>
      <div className="team-lifecycle-handoff-grid">
        <div><span className="team-lifecycle-step">01</span><h3>{t('找到成果', 'Find the work')}</h3><p>{t('项目、文件、分支和成果链接。', 'Projects, files, branches and result links.')}</p></div>
        <div><span className="team-lifecycle-step">02</span><h3>{t('知道进度', 'Understand its status')}</h3><p>{t('已完成、未完成和已知问题。', 'Completed work, open tasks and known issues.')}</p></div>
        <div><span className="team-lifecycle-step">03</span><h3>{t('能够继续', 'Continue the task')}</h3><p>{t('启动方式、验证结果和下一步。', 'Startup steps, verification evidence and the next action.')}</p></div>
        <div><span className="team-lifecycle-step">04</span><h3>{t('确认接收', 'Confirm receipt')}</h3><p>{t('接收人核对内容与资源归属。', 'The recipient checks the work and resource ownership.')}</p></div>
      </div>
    </section>
    <div className="staff-start-modules">
      <article className="staff-start-module" data-site-surface="panel" aria-labelledby="offboarding-ai">
        <div className="staff-start-module-heading">
          <Sparkles className="staff-start-module-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <div><span className="team-lifecycle-role">{t('盘点与整理', 'Inventory and preparation')}</span><h2 id="offboarding-ai" className="staff-start-module-title">{t('交给 AI', 'Delegate to AI')}</h2></div>
        </div>
        {tasks.map(task => <section className="staff-start-task" key={task.id}>
          <div className="staff-start-row"><h3>{task.title}</h3>
            <button type="button" className="staff-start-action" onClick={() => copy(task.prompt, task.id)}>{copiedKey === task.id ? t('已复制', 'Copied') : t('复制指令', 'Copy prompt')}</button>
          </div>
          <details className="staff-start-instructions"><summary>{t('查看指令', 'View instructions')}<ChevronDown size={14} aria-hidden="true" /></summary><pre className="staff-start-prompt">{task.prompt}</pre></details>
        </section>)}
      </article>
      <article className="staff-start-module" data-site-surface="panel" aria-labelledby="offboarding-self">
        <div className="staff-start-module-heading">
          <UserRound className="staff-start-module-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <div><span className="team-lifecycle-role">{t('接收与确认', 'Receipt and confirmation')}</span><h2 id="offboarding-self" className="staff-start-module-title">{t('由自己完成', 'Do yourself')}</h2></div>
        </div>
        <ul className="staff-start-knowledge">
          <li><strong>{t('确认交接', 'Confirm the handoff')}</strong><p>{t('由接收人确认工作、文件和资源已接收。', 'Have the recipient confirm receipt of work, files and resources.')}</p></li>
          <li><strong>{t('归还设备', 'Return equipment')}</strong><p>{t('核对公司设备与配件，确认归还。', 'Check and return company equipment and accessories.')}</p></li>
          <li><strong>{t('退出组织账号', 'Sign out of work accounts')}</strong><p>{t('交接完成后退出，个人账号保留。', 'Sign out after handoff; retain personal accounts.')}</p></li>
        </ul>
        <details className="staff-start-disclosure">
          <summary>{t('负责人：撤销权限', 'Lead: revoke access')}<ChevronDown size={18} aria-hidden="true" /></summary>
          <p className="staff-start-note">{t('核对全部设备与组织授权，确认旧连接已断开。', 'Check all devices and organizational grants; confirm existing connections have ended.')}</p>
          <button type="button" className="staff-start-action" onClick={() => copy(leadPrompt, 'lead')}>{copiedKey === 'lead' ? t('已复制', 'Copied') : t('复制指令', 'Copy prompt')}</button>
          <pre className="staff-start-prompt">{leadPrompt}</pre>
        </details>
      </article>
    </div>
    <section className="team-lifecycle-boundaries" aria-labelledby="offboarding-evidence">
      <div className="team-lifecycle-section-heading"><ClipboardCheck size={22} aria-hidden="true" /><h2 id="offboarding-evidence">{t('撤权看结果，不看按钮', 'Verify the outcome of revocation')}</h2></div>
      <div className="team-lifecycle-comparison">
        <article className="team-lifecycle-example team-lifecycle-example--good" data-site-surface="panel">
          <h3><Check size={18} aria-hidden="true" />{t('已验证的撤权', 'Verified revocation')}</h3>
          <div className="team-lifecycle-access-flow" aria-hidden="true"><KeyRound size={26} /><span>{t('旧密钥', 'Old key')}</span><Unplug className="team-lifecycle-stop" size={22} /><ShieldCheck size={26} /><span>{t('服务端', 'Server')}</span></div>
          <p>{t('旧密钥无法新建连接，旧会话已结束，开发网址不再代理该设备。', 'Old keys cannot connect, existing sessions have ended and preview URLs no longer reach the device.')}</p>
          <p>{t('分别记录已验证、等待同步和未完成项。', 'Record verified, pending synchronization and incomplete items separately.')}</p>
        </article>
        <article className="team-lifecycle-example team-lifecycle-example--bad" data-site-surface="panel">
          <h3><X size={18} aria-hidden="true" />{t('这些还不算完成', 'These are not proof of completion')}</h3>
          <div className="team-lifecycle-access-flow" aria-hidden="true"><Laptop size={26} /><span>{t('本机删文件', 'Delete local files')}</span><span className="team-lifecycle-unequal">≠</span><ShieldCheck size={26} /><span>{t('服务端撤权', 'Revoke access')}</span></div>
          <p>{t('点击撤销、删除本机密钥或移除 DNS，都不能单独证明权限已收回。', 'A revoke click, deleted local key or removed DNS record alone does not prove access is gone.')}</p>
          <p>{t('交接未确认时只盘点；不清空整份 .ssh、共享目录或个人资料。', 'Inventory only until the handoff is accepted. Never clear all of .ssh, shared folders or personal data.')}</p>
        </article>
      </div>
      <div className="team-lifecycle-next"><AppLink className="team-lifecycle-link" href="/workspace?section=onboarding" prefetch={false}>{t('核对远程连接与开发网址', 'Review remote access and development URLs')}<ArrowRight size={16} aria-hidden="true" /></AppLink></div>
    </section>
  </section>;
}
