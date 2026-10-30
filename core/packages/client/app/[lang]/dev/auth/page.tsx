'use client';

/* auth-doc-review {"fingerprint": "27b8d1ec7f30df9a29177d30a586807ce5d01d2b421cb05f897b96d7c07cba92", "reason": "Reviewed personal competition imports: requireAuth remains the only source of event ownership; the optional owner field only rejects stale-account requests. Per-owner competition identities reuse existing owned events, and account deletion now removes these identities including deleted-event markers. Session issuance, sign-in, WCA linking and credential flows are unchanged, so the authentication flow diagram remains accurate. No access to another user calendar or invited event is added. The final schema snapshot now also includes the pre-existing calendar tables and import foreign keys; production migrations and authentication behavior are unchanged."} */

import type { ReactNode } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import './auth-flow.css';

function FlowNode({ children, outcome = false }: { children: ReactNode; outcome?: boolean }) {
  return <div className={`auth-map-node${outcome ? ' auth-map-outcome' : ''}`}>{children}</div>;
}

function Arrow() {
  return <div className="auth-map-arrow" aria-hidden="true">↓</div>;
}

/** Ordered documentation steps, not a second authentication implementation. */
function Steps({ items }: { items: ReactNode[] }) {
  return <ol className="auth-map-steps">{items.map((item, index) => <li key={index}>
    {index > 0 && <Arrow />}<FlowNode>{item}</FlowNode>
  </li>)}</ol>;
}

export default function AuthFlowPage() {
  const t = useT();
  return <main className="auth-map-page">
    <header className="auth-map-header">
      <AppLink href="/dev" prefetch={false}>Dev</AppLink>
      <h1>{t('账号全流程', 'Account lifecycle')}</h1>
      <p className="auth-map-note">{t('后台版本管理仅对管理员开放，发布接口每次重新验证管理员登录，不接受通用管理员 API key。GitHub 发布凭据仅在 API 服务端使用，签名凭据仅在受保护的 CI 环境使用；网页只提交平台、源码提交和更新说明，不获取密钥。', 'Release management in the administration hub is available only to administrators. Every release API request verifies the administrator session and does not accept the general admin API key. GitHub credentials remain on the API server and signing credentials in the protected CI environment. The page submits platform, source commit and release notes without receiving secrets.')}</p>
      <p className="auth-map-note">{t('小程序联系页现为无需登录的原生页面。抖音旧网页入口按实际路径映射到原生联系、协议、计时或工具页；不签发网页换票，未支持的路径与参数明确提示，不再静默丢弃。账号管理、其他登录方式和退出网站流程仍走原有受限网页入口，不修改身份绑定、认证或会话规则。本次仅本地实现。', 'Mini Program contact details now use a native page without sign-in. Legacy Douyin web entries map exact destinations to native contact, policy, timer or tools pages without a web-session ticket. Unsupported paths and options show an explicit message instead of being silently discarded. Account management, other sign-in methods and website sign-out retain their restricted web flows; identity linking, authentication and session rules are unchanged. Implemented locally only.')}</p>
      <p className="auth-map-note">{t('微信和抖音小程序登录前的协议入口已改为原生离线页面，与网站共用协议全文；不请求会话换票，不改变同意、登录、绑定与注销规则。账号管理及邮箱之外的登录方式仍使用网站统一流程。本次仅本地构建，未部署或真机验收。', 'The agreement entry before Mini Program sign-in now opens a native offline page using the same full policy as the website. It requests no session handoff and leaves consent, sign-in, linking and deletion rules unchanged. Account management and sign-in methods other than email still use the unified website flows. Built locally only, without deployment or device acceptance.')}</p>
      <p className="auth-map-note">{t('工作台使用 CubeRoot 登录。管理员自动获得员工权限并保留管理能力，其他员工按 CubeRoot ID 开通；自动权限随管理员资格撤销，手工员工授权独立保留。每次请求重查员工状态及项目资格；停用或移出项目后立即拒绝后续访问。Mira 的员工账号、会话和数据独立，共享包只复用界面与规则。', 'Workspace uses CubeRoot sign-in. Administrators automatically receive employee access alongside management capabilities; other employees are granted access by CubeRoot ID. Derived access ends when administrator status is removed; explicit employee grants remain independent. Every request rechecks employee status and project membership; revocation denies subsequent access. Mira identities, sessions and data remain separate; packages share only UI and rules.')}</p>
      <p className="auth-map-note">{t('账号页通过 /admin/team 进入团队协作；网站管理入口位于 /admin，仅对管理员显示。旧 /workspace 页面不再提供；管理员页面和接口仍各自验证权限，入口调整不改变登录或授权。', 'The account page opens team collaboration at /admin/team. Site management is under /admin and visible only to administrators. The old /workspace pages are removed. Administrator pages and APIs still enforce their own permissions; the route change does not alter sign-in or authorization.')}</p>
      <p className="auth-map-note">{t('微信小程序账号页提供佣金提现入口。绑定和确认收款时，服务端核对微信身份与当前 CubeRoot 账号；未完结的微信转账会阻止清除对应的收款资料快照。源码中的保护不代表真实转账和注销流程已完成验收。', 'The WeChat Mini Program account page links to commission payouts. When binding or confirming a payout, the server checks the WeChat identity against the signed-in CubeRoot account. An unresolved WeChat transfer prevents its recipient snapshot from being cleared. These source protections do not establish real-transfer or account-deletion acceptance.')}</p>
      <p className="auth-map-note">{t('清单删除沿用编辑权限；排期删除另需负责人或管理员身份。两者均重新校验员工、项目资格及记录版本，归档项目禁止删除，删除与审计在同一事务内完成。界面二次确认后才提交整份删除，不新增登录方式或权限；角色测试会话不能操作工作台。', 'Checklist deletion uses the existing editing permission; schedule deletion also requires a manager or administrator. Both recheck employee access, project membership and the record version. Archived projects cannot be deleted from, and deletion and audit share one transaction. The interface submits a whole-list or whole-schedule deletion only after confirmation, without adding a sign-in method or permission; role-test sessions cannot use workspace operations.')}</p>
      <p>{t('一个 CubeRoot 账号，多种登录方式。先看从哪个平台进入，再看登录、绑定、合并和注销各自会做什么。', 'One CubeRoot account, multiple sign-in methods. Start with your platform, then follow sign-in, linking, merging, or deletion.')}</p>
      <p className="auth-map-note">{t('账号页卡片顺序由管理员拖动设置，所有用户共用；每个账号仍只显示其有权使用的入口。排序不改变登录、绑定或会话。', 'Administrators set the account card order for everyone. Each account still sees only its permitted entries; ordering does not change sign-in, linking, or sessions.')}</p>
      <p className="auth-map-note">{t('源码核对：2026-09-21。「源码已实现」不等于所有平台真人测试或商店发布完成；「目标方案」尚未接入。此页不执行账号操作。', 'Source reviewed: 2026-09-21. Implemented in source does not mean real-account testing or store release is complete on every platform. Proposals are not implemented. This page performs no account actions.')}</p>
      <p className="auth-map-note">{t('邮箱发送状态与账号事务已通过隔离数据库验证；短信发送受理状态、手机号账号操作及合并码核销完成聚焦本地检查。短信与合并仍待隔离数据库验证，短信另待真实服务商和设备验收；本轮均未部署。', 'Email delivery state and account transactions passed isolated database checks. SMS provider acceptance, phone account actions, and merge-code consumption passed focused local checks. SMS and merging still need isolated database checks; SMS also needs real-provider and device acceptance. None of these changes are deployed.')}</p>
      <Steps items={[
        t('开发模式下从 localhost、127.0.0.1 或 [::1] 直接访问 → 本地页面豁免验证码；配置服务端签名密钥后，访问检查自动签发仅本机使用的 HttpOnly 通行 Cookie，供比赛数据接口验证；公开开发域名和生产环境继续使用访问验证', 'Direct access through localhost, 127.0.0.1 or [::1] in development → local pages are exempt from CAPTCHA; with a server signing key configured, the access check issues a host-only HttpOnly traffic cookie for competition data verification; public development domains and production retain access verification'),
        t('获取图片验证码 → 2 分钟内输入；字母不区分大小写', 'Get an image code → enter it within 2 minutes; letters are case-insensitive'),
        t('输入错误 → 显示剩余次数；累计输错 3 次、过期、已失效或网络/浏览器变化 → 提示具体原因，点击「换一张」后重新输入', 'Incorrect answer → show remaining attempts; 3 wrong answers, expiry, invalidation or a network/browser change → show the reason and require a new image'),
        t('验证成功 → 一次性使用该图片并签发通行 Cookie；账号登录和权限仍独立校验', 'Successful verification → consume the image once and issue an access cookie; account sign-in and permissions are checked separately'),
      ]} />
      <p className="auth-map-note">{t('本地豁免仅取消站点流量验证，不签发账号会话或管理员权限。手动使用本地验证码时，代理按浏览器实际 Host 校验同源请求，避免 Next 内部 localhost 地址误拒绝 127.0.0.1；外部来源、生产 Origin 与 Cookie 限制保持原规则。此修复仅本地实现，未部署。', 'The local exemption removes only the site traffic challenge and grants no account session or administrator permissions. Manual local verification checks the browser’s actual Host, so Next’s internal localhost address does not reject 127.0.0.1. Foreign origins and production Origin/cookie restrictions remain unchanged. Implemented locally, not deployed.')}</p>
      <p className="auth-map-note">{t('除隐私政策、联系页、账号根页面和技术回调外，站点图片验证码通过后可访问页面及受保护数据 7 天；账号页公开可达不代表登录，也不授予账号或管理员权限。账号退出与账号会话仍按下图处理。', 'Except for the privacy policy, contact page, account root page, and technical callbacks, passing the site image verification grants page and protected-data access for 7 days. A publicly reachable account page does not sign in a user or grant account or administrator permissions. Account sessions and sign-out still follow the flows below.')}</p>
      <p className="auth-map-note">{t('站内问答读取公开索引或页面 → 服务端为固定自有内容域名签发 60 秒、绑定完整路径与查询串的服务凭证 → 网关校验后读取。服务凭证不发给浏览器或模型，不签发账号会话；私人内容仍须各自授权。此接入仅本地实现，未部署。', 'Assistant reads public index/pages → the server signs a 60-second proof for the fixed self-hosted content origin and exact path/query → the gateway verifies it before reading. Proofs never reach the browser or model and create no account session; private content still requires its own authorization. This integration is local only, not deployed.')}</p>
      <nav className="auth-map-nav" aria-label={t('账号流程目录', 'Account flow contents')}>
        <AppLink href="#platforms" prefetch={false}>{t('平台入口', 'Platforms')}</AppLink>
        <AppLink href="#signin" prefetch={false}>{t('登录 / 注册', 'Sign in / register')}</AppLink>
        <AppLink href="#mini" prefetch={false}>{t('微信 / 抖音小程序', 'WeChat / Douyin Mini Programs')}</AppLink>
        <AppLink href="#linking" prefetch={false}>{t('绑定 / 解绑', 'Link / unlink')}</AppLink>
        <AppLink href="#merge" prefetch={false}>{t('合并账号', 'Merge accounts')}</AppLink>
        <AppLink href="#exit" prefetch={false}>{t('退出 / 注销', 'Sign out / delete')}</AppLink>
        <AppLink href="#role-preview" prefetch={false}>{t('角色测试 / 用户查看', 'Role testing / user viewing')}</AppLink>
      </nav>
    </header>

    <section id="platforms" className="auth-map-section" aria-labelledby="platform-title">
      <h2 id="platform-title">{t('从哪里进入？账号不按平台分家', 'Where do you start? Platforms do not create separate account systems')}</h2>
      <p className="auth-map-note">{t('微信内置浏览器仍是网站入口。会员与订单页面仅在小程序标识或 SDK 环境查询确认后采用小程序购买限制；识别期间先等待。账号页共用同一判断，登录、绑定、回跳与会话流程不变。', 'The WeChat in-app browser is still a website entry. Membership and order pages apply Mini Program purchase restrictions only after an explicit marker or an SDK environment check confirms the container; checkout waits during detection. The account page uses the same check, with sign-in, linking, handoff and sessions unchanged.')}</p>
      <p className="auth-map-note">{t('安装端也可从「计时器设置 → 高级」登录、管理或退出账号；此入口与「我的」共用登录和会话流程，关闭设置窗口不会退出账号。', 'Installed apps also offer sign-in, account management and sign-out under Timer settings → Advanced. These actions share the My account authentication and session flow; closing settings does not sign out.')}</p>
      <div className="auth-map-platforms">
        <article><h3>{t('网站 / PWA', 'Website / PWA')}</h3><p>{t('打开「我的」→ 在网站登录。账号管理也在同一页。', 'Open My account → sign in on the website. Account management uses that same page.')}</p><AppLink href="#signin" prefetch={false}>{t('看网站登录流程 ↓', 'Website sign-in flow ↓')}</AppLink></article>
        <article><h3>iOS App</h3><p>{t('我的 → 系统浏览器完成网站登录 → 回到 App。凭据存入 Keychain；不是另建 Apple 账号。', 'My account → website sign-in in the system browser → return to the App. The session uses Keychain, not a separate Apple-only account.')}</p><AppLink href="#app-handoff" prefetch={false}>{t('看 App 回跳流程 ↓', 'App handoff flow ↓')}</AppLink></article>
        <article><h3>Android App</h3><p>{t('与 iOS 复用同一登录流程；由 Android 深链接回，凭据使用 Keystore 保护的存储。', 'Shares the iOS sign-in flow. An Android deep link returns to the App; session storage is protected by Keystore.')}</p><AppLink href="#app-handoff" prefetch={false}>{t('看 App 回跳流程 ↓', 'App handoff flow ↓')}</AppLink></article>
        <article><h3>{t('微信小程序', 'WeChat Mini Program')}</h3><p>{t('已绑定微信直接登录；未绑定可授权实时验证手机号，确认原账号或明确创建。账号管理仍复用网站；WCA 绑定从小程序跳到系统浏览器完成，返回小程序后刷新账号状态。本地接入不代表已发布。', 'Linked WeChat identities sign in directly. Unlinked users may authorize real-time phone verification, then confirm an existing account or explicitly create one. Account management reuses the website; WCA linking opens the system browser and refreshes the account when you return. Local integration is not a release.')}</p><AppLink href="#mini" prefetch={false}>{t('看手机号与旧号流程 ↓', 'Phone and existing-account flows ↓')}</AppLink></article>
        <article><h3>{t('抖音小程序', 'Douyin Mini Program')}</h3><p>{t('已绑定抖音身份时直接登录；新用户可明确创建账号。已有 CubeRoot 账号时，通过原生邮箱验证或网站账号页获取 6 位登录码，回小程序输入并确认同一个账号。', 'Linked Douyin identities sign in directly; new users may explicitly create an account. If you already have a CubeRoot account, get a six-digit sign-in code through native email verification or the website account page, then enter and confirm it in the Mini Program.')}</p><AppLink href="#douyin-mini-current" prefetch={false}>{t('看抖音登录流程 ↓', 'Douyin sign-in flow ↓')}</AppLink></article>
      </div>
      <details className="auth-map-current"><summary>{t('其他平台：鸿蒙、Windows、macOS', 'Other platforms: HarmonyOS, Windows, macOS')}</summary>
        <p>{t('Windows 在打开登录浏览器前注册当前 EXE 的回跳协议，安装版和免安装版共用此步骤；普通启动不更改关联。移动免安装 EXE 后再次发起登录会更新路径。注册失败时不打开登录浏览器。', 'Windows registers the current EXE callback before opening the sign-in browser, for both installed and standalone builds. Normal startup leaves the association unchanged. Signing in after moving the standalone EXE updates its path; registration failure prevents opening the browser.')}</p>
        <p>{t('HarmonyOS NEXT、Windows、macOS 共用 App 产品层和网站账号流程，只替换系统浏览器、深链与安全存储适配；每个平台的真实回跳仍须单独验收。', 'HarmonyOS NEXT, Windows, and macOS share the App product layer and website account flow, with platform browser, deep-link, and secure-storage adapters. Each platform still needs its own real handoff tests.')}</p>
        <Steps items={[
          t('抖音启动 → 使用宿主注入的 tt API，读取本地存储键列表；不依赖浏览器 globalThis', 'Douyin startup → use the host-injected tt API and read the local storage key inventory; browser globalThis is not required'),
          t('确认没有会话键 → 按游客打开公开页面；已有会话 → 校验后通过短期票据同步网站登录态', 'Confirmed missing session key → open public pages as a guest; existing session → validate it and synchronize website sign-in through a short-lived ticket'),
          t('存储不可读、损坏会话无法清理或登录同步失败 → 停止打开网页并允许重试，不冒充游客继续', 'Unreadable storage, failed cleanup of a malformed session, or sign-in synchronization failure → stop opening the web page and allow retry, without silently continuing as a guest'),
        ]} />
        <p className="auth-map-note">{t('上述抖音启动兼容修复仅在本地实现；模拟器与真机验收、上传和发布分别确认。', 'The Douyin startup compatibility fix above is implemented locally; simulator and physical-device acceptance, upload, and release must be confirmed separately.')}</p>
      </details>
    </section>

    <aside className="auth-map-boundaries">
      <p className="auth-map-note">{t('登录回调首屏：小程序网页同步入口 /auth/miniprogram 使用中文，普通 /auth 回调使用英文；服务端与浏览器初次渲染保持相同语言。源码已实现，未完成真机验收。', 'Auth callback first render: the Mini Program web synchronization entry /auth/miniprogram uses Chinese, while regular /auth callbacks use English. Server and initial browser rendering use the same language. This is implemented in source and has not been verified on a physical device.')}</p>
      <p className="auth-map-note">{t('WCA 授权返回 → 显示登录进度或错误 → 成功后回到原站内页面。回调不预载原页面的 iframe，离开回调后只显示目标页面。此修复已在本地实现，尚未部署或完成真实授权验收。', 'Return from WCA authorization → show sign-in progress or an error → return to the original on-site page on success. The callback does not preload the original page in an iframe; only the destination remains after navigation. This fix is implemented locally, pending deployment and a real authorization check.')}</p>
      <h2>{t('公开页面与账号操作', 'Public pages and account actions')}</h2>
      <p className="auth-map-note">{t('复盘测试历史仅管理员可查看。本机读取接口先验证现有账号会话；线上读取和同步沿用管理员会话或管理密钥。仅把同源 /api/admin/recon-tests 加入会话请求白名单，不允许向其他来源转发票据，也不新增账号权限。', 'Reconstruction test history is administrator-only. Local reads verify the existing account session; cloud reads and uploads use the existing administrator session or API key. Only the same-origin /api/admin/recon-tests endpoint is added to the session request allowlist; credentials are not forwarded to other origins and no new account privileges are granted.')}</p>
      <p className="auth-map-note">{t('会员权益文案公开读取；编辑需现有管理员认证或管理密钥，指定用户只读会话不能保存。文案修改不授予会员权限、不修改价格或服务额度，也不签发账号会话；登录、绑定、合并和注销沿用原流程。', 'Membership benefit copy is public. Editing requires existing administrator authentication or an admin API key; specific-user read-only sessions cannot save changes. Copy changes do not grant membership access, change prices or service allowances, or issue account sessions. Sign-in, linking, merging and deletion retain their existing flows.')}</p>
      <p className="auth-map-note">{t('问答的自动、快速与深入思考模式只改变回答策略和时限，浏览器仅保存模式偏好，不授予账号权限。旧接口返回参数校验错误时，前端依次移除思考、新会话或时区字段做有限兼容重试，保留原认证头和取消信号，不丢弃本轮问题或图片；参数拒绝发生在资格和额度检查之前。发送前按实际 JSON 字节裁剪较早的完整历史，仍超限则明确报错。账号或 WCA 绑定变化仍清空并中止对话。', 'Auto, quick and deep modes change response strategy and deadlines only. The browser stores the mode preference without granting account access. On an input-validation rejection, bounded compatibility retries remove thinking, conversation or time-zone fields while retaining authentication headers, cancellation and the current question and images. Input rejection precedes eligibility and quota checks. The client removes older whole history messages to fit the actual JSON byte budget, or reports an explicit size error. Account or WCA-link changes still clear and abort the conversation.')}</p>
      <p className="auth-map-note">{t('通用聊天与联网查询（本轮本地实现，尚未部署）：普通问答、写作和翻译沿用同一有效会话、实时 WCA 绑定、额度和监控门槛。模型按原用户与助手角色接收有限历史；历史、附件和网页内容不能授权私有数据访问或账号写入。联网工具只提交独立的公开搜索关键词，不直接转发完整历史或图片；额外拦截已识别的身份、凭据与敏感格式，但不能保证识别所有敏感内容。外部引用仅来自通过校验的来源元数据，正文里的任意链接不会直接变成可点击引用，外链不携带本站认证头。', 'General chat and web lookup (implemented locally in this change, not deployed) retain the same valid-session, current-WCA-link, quota and monitoring checks for ordinary questions, writing and translation. The model receives bounded history with the original user and assistant roles; history, attachments and web content cannot authorize private-data access or account writes. Web search receives separate public keywords rather than full history or images. Recognized identities, credentials and sensitive formats are additionally blocked, but detection is not guaranteed for every sensitive detail. External citations come only from validated source metadata; arbitrary prose links are not promoted to clickable citations, and external links receive no site authentication headers.')}</p>
      <p className="auth-map-note">{t('图片问答（本地实现，尚未部署）：浏览器压缩图片后随问题发送；服务端仍校验有效会话、当前 WCA 绑定与额度，再调用视觉模型。图片不写入公开图库或知识库；新对话、退出或换号时清空附件，未完成的图片处理不能恢复上一账号的内容。', 'Image questions (implemented locally, not deployed): the browser compresses attachments and sends them with the question. The server still checks the session, current WCA link and quota before calling the vision model. Images are not added to public galleries or the knowledge index. New conversations, sign-out and account changes clear attachments; pending image processing cannot restore the previous account’s content.')}</p>
      <p className="auth-map-note">{t('AI 聊天监控：通过实时身份校验后先持久记录，再预留额度和调用模型；记录不可用时不进入付费调用。长问答、思考模式和搜索用量沿用同一私有记录，费用为估算；完成日志按字节限制结果元数据和检索明细，不保存图片或完整对话历史。评价和页面点击只允许本人最近 30 天的问答，管理员读取与复核留审计。正文和复核备注保留 30 天、个人明细 90 天、无身份日汇总两年；注销删除个人记录，重试日志不能恢复已删除数据。', 'AI monitoring records admission after current identity checks and before quota or paid model work. If recording is unavailable, no paid call is started. Longer questions and answers, thinking mode and search usage remain in the same private records; costs are estimates. Completion journals bound result metadata and retrieval details by bytes without storing images or full conversation history. Feedback and destination clicks require ownership of a chat from the last 30 days. Admin reads and reviews are audited. Text and notes: 30 days; individual records: 90 days; anonymous daily totals: two years. Account deletion removes individual records, and replay cannot recreate deleted data.')}</p>
      <p className="auth-map-note">{t('问答结果的比赛表格、国家图标及去重链接只改变公开数据的展示；国家图标读取公开比赛索引，不新增授权或会话。登录、实时 WCA 绑定和提问额度仍按同一流程校验。', 'Competition tables, country flags and deduplicated links change only the presentation of public assistant results. Flags read public competition indexes without additional authorization or sessions. Sign-in, current WCA linking and question quotas follow the same checks.')}</p>
      <Steps items={[
        t('进入验证码页 → 开放模式由服务端直接返回安全的原站内页面，不等待浏览器脚本；防护开启时再检查访问资格，地区豁免或已有有效凭证则返回，明确拒绝才加载图片，检查失败可重试（服务端回跳为本地修复，尚未部署）', 'Enter the verification page → in open mode, the server returns directly to the safe original on-site page without waiting for browser scripts. In protected mode, check access: an exemption or valid proof returns to the page, explicit denial loads the image, and a failed check offers a retry (server redirect implemented locally, not deployed)'),
        t('开放模式 → 直接打开公开页面；防护模式 → 按原地区规则完成访问验证后打开页面。切换不签发账号会话，不查询首页卡片锁状态或管理员角色', 'Open mode → open public content directly; protected mode → complete access verification under the existing regional rules. Switching modes creates no account session and does not check homepage card locks or administrator roles'),
        t('Next 仅在状态服务明确返回开启时启用临时流量验证；超时、错误或无效响应不自动开启，避免与已开放的 API 反复回跳。账号、私有内容与业务接口继续独立鉴权（本地修复，尚未部署）', 'Next enables the temporary traffic challenge only when the control service explicitly reports it enabled. Timeouts, errors and invalid responses do not enable it automatically, avoiding repeated redirects against an open API. Accounts, private content and business APIs retain independent authorization (implemented locally, not deployed)'),
        t('赛前训练 → 游客也可使用，训练记录保存在当前浏览器', 'Competition Practice → guests can train, with practice records saved in this browser'),
        t('需要账号或管理权限的操作 → 由对应功能与服务端接口校验', 'Actions requiring an account or administrator access → checked by the feature and its server API'),
        t('AI 问答（已部署，2026-09-29 UTC）→ 未登录先到账号页；已登录但未绑定 WCA 也到账号页完成绑定 → 服务端校验有效 CubeRoot 会话并读取账号当前真实 WCA 绑定 → 预留全站每日 1000 问额度 → 调用模型。问答接口不要求浏览器验证码；普通搜索不受账号门槛影响', 'AI questions (deployed, 2026-09-29 UTC) → guests sign in on the account page; signed-in users without WCA link it there → server verifies a valid CubeRoot session and current WCA binding → reserves from the site-wide 1000-question daily allowance → calls the model. The question API needs no browser CAPTCHA; regular search has no account requirement'),
        t('AI 资格不由模型判断，也不接受浏览器自报的 WCA ID；解绑、注销或账号合并后重新校验，拒绝请求不占提问额度；账号/IP 短时限流和并发保护仍有效', 'AI eligibility is not decided by the model or a browser-supplied WCA ID. Unlinking, deletion and merges are checked again; rejected access consumes no question allowance. Account/IP burst and concurrency protection remain active'),
        t('国家菜单图钉 → 游客进入登录页，登录后回到原网址和筛选；任何登录账号都可置顶，无需会员或 WCA ID', 'Country menu pin → guests sign in and return to the original URL and filters; any signed-in account can pin, without membership or a WCA ID'),
        t('锁定的课程课时 → 「请先登录」进入账号页；登录后回到课程兑换页，兑换成功再直接进入对应视频页', 'Locked course lesson → Please sign in opens the account page; after sign-in, return to course redemption, then open the matching video page immediately after redemption'),
        t('登录后默认依次置顶 WCA 国家、IP 国家，相同国家只显示一次；未绑定 WCA 或未登录时使用 IP 国家。手动设置按账号保存在当前浏览器，取消后不自动恢复；退出登录只保留 IP 国家，定位失败不影响菜单', 'Signed-in defaults are WCA country first, then IP country, without duplicates; without a WCA link or login, use the IP country. Manual choices are saved per account in this browser and unpinning is retained; signing out shows only the IP country, and lookup failure leaves menus usable'),
      ]} />
      <p>{t('首页隐藏卡片只影响入口展示，不限制直接访问网址。', 'Hiding a homepage card affects its visibility, not direct URL access.')}</p>
    </aside>

    <section id="role-preview" className="auth-map-section">
      <div className="auth-map-section-heading"><h2>{t('超级管理员角色测试与指定用户查看', 'Superadministrator role testing and specific-user viewing')}</h2><span className="auth-map-status">{t('本地实现，尚未部署', 'Implemented locally, not deployed')}</span></div>
      <Steps items={[
        t('角色测试：超级管理员选择预设角色 → 服务端创建与真实账号隔离的测试身份；允许验证该角色的正常写入，写请求记录实际操作者、方法和路径', 'Role testing: a superadministrator selects a preset role → the server creates a test identity isolated from the real account; ordinary writes for that role remain testable and record the real actor, method, and path'),
        t('指定用户查看：超级管理员从用户管理页选择具体账号并填写理由 → 在新标签页建立该账号的只读会话，原管理员标签页不变', 'Specific-user viewing: a superadministrator selects an account in user administration and enters a reason → a read-only session opens in a new tab while the original administrator tab stays unchanged'),
        t('两类数据库会话与 JWT 都限制为 30 分钟；指定用户查看中的所有非只读请求由服务端先拦截并记录，不执行正文、账号或业务数据写入', 'Both database sessions and JWTs are limited to 30 minutes; during specific-user viewing the server blocks and records every non-read-only request before it can change account or business data'),
        t('两类会话都不能签发凭据、绑定身份、更改认证信息、授权 OAuth 或使用管理员密钥绕过；主动结束或任一层到期后令牌立即失效', 'Neither session can mint credentials, link identities, change authentication, authorize OAuth, or bypass checks with an admin key; explicit exit or expiry at either layer immediately invalidates the token'),
      ]} />
    </section>

    <aside className="auth-map-note"><h2>{t('Google 日历备份授权', 'Google Calendar backup authorization')}</h2><Steps items={[
      t('已登录用户在日历设置点击连接 Google → 使用现有 GIS 组件单独请求 calendar.readonly，不把登录权限扩大为日历权限', 'A signed-in user clicks Connect Google in calendar settings → the existing GIS client separately requests calendar.readonly; ordinary sign-in does not request calendar access'),
      t('Google 确认只读范围 → 浏览器直接分页读取所选日历及颜色、设置和原始活动 → 下载备份；令牌只在页面内存，关闭或取消后清除，不发送本站服务器', 'After Google confirms read-only scope, the browser paginates selected calendars, colors, settings and raw events into a downloaded backup. Tokens stay in page memory, are cleared on close/cancel, and never reach CubeRoot servers'),
      t('上传备份 → 显示支持范围与可能损失 → 用户确认后调用已有日历导入接口；不登录或绑定新的 CubeRoot 身份，也不邀请原活动参与人', 'Uploading a backup shows supported fields and limitations before confirmation invokes existing calendar import endpoints. It neither signs in or links a new CubeRoot identity nor invites original attendees'),
    ]} /><p>{t('本地实现，未发布。本地授权来源已配置，真实授权与导出验收仍待完成；普通登录与账号绑定流程保持不变。', 'Implemented locally, not deployed. The local authorized origin is configured; live authorization and export validation remain pending. Normal sign-in and identity linking are unchanged.')}</p></aside>

    <section id="browser-session" className="auth-map-section">
      <h2>{t('浏览器会话与登录凭据', 'Browser sessions and login credentials')}</h2>
      <Steps items={[
        t('登录验证成功 → 同源服务端验证长期会话并写入 HttpOnly Cookie → 浏览器内存仅保留最长 15 分钟的访问令牌；本地存储只保存会话标识和展示资料', 'Successful sign-in → the same-origin server verifies the durable session and sets an HttpOnly cookie → browser memory holds access tokens for at most 15 minutes; local storage contains only a session marker and display profile'),
        t('刷新页面或短令牌临近到期 → 校验同源请求和当前会话标识后换取访问令牌；保留最初验证时间，不重置邮箱或短信的敏感操作窗口', 'Reload or near-expiry access → verify the same-origin request and current session marker before exchanging access; preserve the original authentication time and email or SMS sensitive-action windows'),
        t('普通业务请求使用短令牌；账号修改、绑定合并和跨端换票通过同源账号接口读取 HttpOnly 凭据。短令牌不能直接续签长期会话或签发登录票据', 'Business requests use short access tokens. Account changes, linking, merging and platform handoffs use same-origin account endpoints backed by HttpOnly credentials. Short tokens cannot directly renew durable sessions or issue sign-in tickets'),
        t('首次身份待确认 → 真实票据保存于最长 15 分钟的 HttpOnly Cookie；标签页只保存无独立授权能力的随机标识。取消、到期或完成后不可继续确认旧流程', 'Pending first identity → the real ticket stays in an HttpOnly cookie for at most 15 minutes; the tab stores only a random handle that cannot authorize by itself. Cancellation, expiry or completion prevents the old flow from continuing'),
        t('退出或换号 → 立即废弃内存凭据和旧会话标识；迟到回包不得恢复旧身份。旧版浏览器 JWT 经服务端验证迁移后从本地存储移除', 'Sign-out or account switching → immediately discard in-memory credentials and the old session marker; late responses cannot restore the old identity. Legacy browser JWTs are removed from local storage after server-verified migration'),
        t('WCA 授权状态使用密码学随机数；App 内嵌网页使用独立分区 Cookie。原生 App 继续使用宿主安全存储，登录与换票的真实设备验收单独确认', 'WCA authorization state uses cryptographic randomness; embedded App pages use separate partitioned cookies. Native apps retain host secure storage, with physical-device sign-in and handoff verification recorded separately'),
      ]} />
      <p className="auth-map-note">{t('上述会话修复已在源码实现；自动检查、服务端部署和真机验收分别记账。', 'The session changes above are implemented in source; automated checks, server deployment and physical-device acceptance are recorded separately.')}</p>
    </section>

    <section id="signin" className="auth-map-section" aria-labelledby="signin-title">
      <p className="auth-map-note">{t('员工手册入口为 /admin/team?section=onboarding，离职、SOP 和质量标准分别使用 offboarding、sop 和 quality section；原 /account/get-started、/account/offboarding、/account/sop 和 /dev/team 转到同语言的新入口。未登录时只显示工作台登录按钮 → 点击后复用账号页的注册、验证和已有账号选择 → 按 next 返回原手册栏目。登录后可查看手册并复制本人 CubeRoot ID；员工权限由管理员另行开通，开发网址及 SSH 申请仍需真实负责人审批。手册访问不授予员工或管理员权限。', 'The staff handbook opens at /admin/team?section=onboarding, with offboarding, sop and quality sections for offboarding, SOP and quality standards. Former /account/get-started, /account/offboarding, /account/sop and /dev/team links redirect to the new entry in the same language. Signed-out visitors see the workspace sign-in button → use the existing account registration, verification and account-choice flow → return to the original handbook section via next. Signed-in users can read the handbook and copy their CubeRoot ID; administrators grant employee access separately, and development previews and SSH still require the real owner’s approval. Reading the handbook grants no employee or administrator permissions.')}</p>
      <div className="auth-map-section-heading"><h2 id="signin-title">{t('登录与注册：网站和 App 共用', 'Sign-in and registration: shared by website and App')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现 · 可用入口以服务端配置为准', 'Implemented in source · availability depends on server configuration')}</span></div>
      <Steps items={[
        t('访问管理后台 → 未登录时直接跳转同语言登录页，不显示权限提示中间页，并保留后台返回地址', 'Open administration → signed-out visitors go directly to sign-in in the same language, with the administration return address preserved and no intermediate access notice'),
        t('登录完成 → 返回管理后台 → 管理员进入；已登录但无管理员权限时显示权限提示，不重复跳转登录', 'Complete sign-in → return to administration → administrators enter; signed-in users without administrator access see an access notice without another sign-in redirect'),
      ]} />
      <figure className="auth-map-figure" aria-labelledby="signin-title">
        <div className="auth-map-current-paths">
          <section><h3>{t('邮箱 / 手机号 / 密码', 'Email / phone / password')}</h3><Steps items={[
            t('选择邮箱或手机号，使用验证码；已设密码也可用密码登录', 'Choose email or phone and verify a code; an existing password is another sign-in option'),
            t('邮箱或短信验证码：发送服务确认接受后才可验证；发送失败或结果未知时不能登录，不自动重发', 'Email or SMS codes become usable only after the provider confirms acceptance; failed or unknown sends cannot sign in and are not automatically retried'),
            t('验证通过 → 已有凭据直接进入原账号；陌生凭据先问是否已有账号，不自动注册', 'Verification succeeds → existing credentials sign in directly; unknown credentials ask whether you have an account, without automatic registration'),
            t('邮箱与短信验证和登录或账号选择票据一起保存；保存失败不消耗正确验证码，错误猜测仍计次', 'Email and SMS verification commit with sign-in or the account-choice ticket; a failed save preserves a correct code, while wrong guesses still count'),
            t('有旧号：验证原账号并确认绑定；没有：明确选择创建新账号', 'Existing account: authenticate and confirm linking. No account: explicitly choose to create one'),
          ]} /><p className="auth-map-note">{t('忘记密码时才走：验证原账号已绑定的邮箱或手机 → 设置新密码。不是每次登录都要重设。', 'Only if you forgot your password: verify the linked email or phone → set a new password. This is not required on every sign-in.')}</p><p className="auth-map-note">{t('密码登录不创建账号。「绑定已有账号」中的验证只认旧号，不会用陌生邮箱、手机号悄悄注册。', 'Password sign-in does not create accounts. Verification inside existing-account linking accepts existing accounts only; an unknown email or phone does not silently register.')}</p></section>
          <section><h3>{t('第三方登录', 'Provider sign-in')}</h3><Steps items={[
            t('抖音 / Google / Apple / 微信 / QQ / 支付宝 / WCA', 'Douyin / Google / Apple / WeChat / QQ / Alipay / WCA'),
            t('WCA 返回有效账号但没有 WCA ID → 明确提示改用其他方式登录；绑定时可暂时跳过，不签发新会话。账号资料无效则报告上游异常，不误报为缺少 WCA ID。', 'WCA returns a valid account without a WCA ID → explain that another sign-in method is needed; linking can be skipped without issuing a new session. Invalid account data is reported as an upstream error, not a missing WCA ID.'),
            t('网页 WCA 绑定回调 → 保留当前账号与绑定意图，通过共享绑定接口提交；失败显示原因和账号设置入口，离页后的响应不安装会话。', 'The website WCA linking callback preserves the current account and linking intent and uses the shared linking API. Failure shows the reason and an account-settings link; responses after leaving cannot install a session.'),
            t('授权成功 → 服务端识别这一个第三方身份', 'Authorization succeeds → server identifies this provider identity'),
          ]} /><div className="auth-map-phone-results">
            <div><p className="auth-map-branch-label">{t('已绑定', 'Already linked')}</p><Arrow /><FlowNode outcome>{t('直接登录原账号，不重复提问', 'Sign in to the existing account without asking again')}</FlowNode></div>
            <div><p className="auth-map-branch-label">{t('尚未绑定', 'Not linked')}</p><Arrow /><FlowNode>{t('你有 CubeRoot 账号吗？', 'Do you have a CubeRoot account?')}<small>{t('有：登录旧号 → 核对账号 → 确认绑定。没有：明确选择创建新账号。', 'Yes: authenticate the old account → check it → confirm linking. No: explicitly choose to create an account.')}</small></FlowNode></div>
          </div></section>
        </div>
        <figcaption>{t('拒绝授权、取消、过期或网络错误 → 提示并允许重试，不自动变成注册。不按相同邮箱或昵称认定两个身份属于同一个人。', 'Declined authorization, cancellation, expiry, or network failure → explain and allow retry, never silently register. Matching email addresses or nicknames do not establish identity.')}</figcaption>
      </figure>
      <p className="auth-map-note">{t('页面顶部头像位于姓名左侧，点击头像打开更换窗口；窗口内选择 WCA、上传图片或宠物头像，先预览，确认使用才上传和保存，关闭或取消不保存。头像选择复用宠物图鉴全部形象和公开状态，包含 Clawd 第 31–50 段故事的 20 个新增头像；仅公开且未移除的宠物可保存为头像，保留旧 Clawd 头像标识。WCA 官方头像和上传图片仍可使用，切换头像不影响登录或绑定。会话校验仅加载同源生成的头像 ID 清单，展示数据按需使用，头像有效性与访问权限规则保持不变。', 'The avatar appears to the left of the name in the page header; clicking it opens the change dialog. The dialog offers WCA, image upload or pets, previews the choice, and uploads/saves only on confirmation; closing or cancelling discards the draft. Avatar choices reuse all pet-gallery artwork and its public visibility, including 20 new avatars from Clawd stories 31–50. Only public, non-removed pets can be saved, with legacy Clawd preset IDs preserved. WCA avatars and image uploads remain available; avatar changes do not affect sign-in or linking. Session validation loads only the avatar IDs generated from the same gallery; display data is loaded where needed, with the same avatar validity and access rules.')}</p>
      <Steps items={[
        t('WCA 登录或绑定 → 仅请求公开资料授权 → WCA 返回有效性别时同步；未返回时保留原值。不请求或同步出生日期。', 'WCA sign-in or linking → request public profile access only → synchronize valid gender returned by WCA; absent values preserve existing data. Birth dates are neither requested nor imported.'),
        t('已绑定账号打开基本资料 → 未填写性别时从 WCA 公开选手资料补全；出生日期继续手动填写，省市仍手动选择。此改动仅本地实现，未部署。', 'Linked account opens basic profile → fill missing gender from public WCA person data; birth date, province and city remain manually entered. This change is local and not deployed.'),
      ]} />
      <p className="auth-map-note">{t('邮箱验证码、邮箱密码或手机验证码登录成功后，在当前浏览器保存该邮箱或手机号，下次打开对应登录表单时预填；仅输入或验证失败不会保存。清除按钮同时忘记该方式的账号，退出登录仍保留此提示。它不保存密码或验证码，也不授予登录权限；有效会话继续复用现有 HttpOnly 恢复机制，失效后仍须验证。旧版本未保存的账号不能追溯预填。本地实现，未部署。', 'Successful email-code, email-password or phone-code sign-in remembers that address or number in this browser for the corresponding form. Typing alone or failed verification never saves it. Clearing also forgets that sign-in hint; signing out retains it. This stores no passwords or codes and grants no access. Valid sessions use the existing HttpOnly restoration; expired sessions still require verification. Accounts not saved by older versions cannot be prefilled retroactively. Implemented locally, not deployed.')}</p>
      <section id="app-handoff" aria-labelledby="handoff-title"><h3 id="handoff-title">{t('iOS / 安卓：登录后怎样回到 App？', 'iOS / Android: how do you return after sign-in?')}</h3>
        <p className="auth-map-note">{t('UU 远程入口使用独立的设备绑定与回调：校验请求随机值、回调地址和有效期后，将设备标识保存在本机安全存储。它不签发 CubeRoot 会话，不改变登录、换票或账号绑定；返回“我的”只展示操作结果。源码已接入，真实设备授权与连接仍待验收。', 'UU Remote uses separate device binding and callbacks: after checking the request nonce, callback address and expiry, it saves the device identifier in local secure storage. It issues no CubeRoot session and does not change sign-in, ticket exchange or account linking; returning to My account only shows the result. Implemented in source; device authorization and connection still need physical-device verification.')}</p>
        <figure className="auth-map-figure" aria-labelledby="handoff-title"><Steps items={[
          t('App「我的」显示网站唯一账号页 → 点击登录', 'The App My account tab shows the canonical website account page → tap sign in'),
          t('打开系统浏览器 → 完成上方同一登录 / 已有账号选择流程', 'Open the system browser → complete the same sign-in / existing-account choice above'),
          t('单次短期票据 + 回跳校验（PKCE / state）→ App 换取并安全保存会话', 'One-time short-lived ticket + handoff validation (PKCE / state) → App exchanges and securely stores the session'),
          t('Android / iOS 安全存储使用配对的 set/get，兼容旧版编码；登录请求丢失或 state 不匹配时停止换票并显示重试提示，不静默留在登录表单', 'Android / iOS secure storage uses matching set/get operations, preserving the previous encoding. Missing login requests or mismatched state stop ticket exchange and show a retry error instead of silently leaving the sign-in form'),
          t('再用一次性网页票据恢复「我的」页登录态 → 显示同一个账号', 'A separate one-time web ticket restores sign-in in My account → show the same account'),
          t('iOS 纪录推送已配置时 → 请求系统通知权限 → 将 APNs 设备绑定到当前账号；拒绝不影响登录，开发与生产推送环境隔离', 'When iOS record push is configured → request system notification permission → bind the APNs device to this account; declining does not affect sign-in, and sandbox and production are isolated'),
          t('Android 纪录推送已配置时 → 单独征求 SDK 隐私同意和系统通知权限 → 绑定当前账号与设备；拒绝不影响登录', 'When Android record push is configured → separately request SDK privacy consent and notification permission → bind this account and device; declining does not affect sign-in'),
        ]} /><p className="auth-map-note">{t('iOS 推送通道已接入源码；APNs 凭据、签名和真机送达仍需单独验证。', 'The iOS push channel is wired in source; APNs credentials, signing, and device delivery still require separate verification.')}</p><figcaption>{t('浏览器、App 安全存储、内嵌账号页是三个会话容器，不是三个账号。回跳失败时回 App 重试，不重复注册；长期登录凭据不放进网址。', 'The browser, App secure storage, and embedded account page are three session containers, not three accounts. Retry a failed handoff without registering again; long-lived credentials never enter URLs.')}</figcaption></figure>
      </section>
      <p className="auth-map-note">{t('登录成功 ≠ 计时记录已云同步。App 的计时记录、备注和设置仍在本机；账号合并也不自动收集各台设备的本地记录。', 'Successful sign-in does not mean timer data is cloud-synced. App solves, notes, and settings remain local; account merging does not gather local records from every device.')}</p>
    </section>

    <section id="home-guide" className="auth-map-section">
      <h2>{t('首页新手指南', 'Homepage beginner guide')}</h2>
      <Steps items={[
        t('游客首次进入首页 → 按当前浏览器记录显示；不将游客记录当作账号记录', 'A guest’s first homepage visit → use browser-local status; guest status never substitutes for account status'),
        t('登录后进入首页 → 查询当前账号；未看过才直接进入第一步，不显示欢迎页；查询失败不自动弹出', 'Visit the homepage signed in → read the current account’s status; start at step one without a welcome screen only if unseen, and do not auto-open after a failed lookup'),
        t('关闭、跳过或完成 → 保存账号已看标记；同一账号换设备也不再自动显示。保存失败按账号暂存，下次进入首页重试', 'Close, skip, or finish → save the account’s seen status; other devices no longer auto-open it. Failed saves remain pending for that account and retry on the next homepage visit'),
        t('头像 → 我的 → 新手指南 → 回到首页手动重看；合并账号时保留任一账号的已看标记', 'Avatar → My account → Beginner guide → return to the homepage to replay; merging retains either account’s seen status'),
      ]} />
      <p>{t('本地实现；账号跨设备同步须部署 API 与数据库迁移后生效。登录、绑定和回跳流程不变。', 'Implemented locally; cross-device account sync requires the API and database migration to be deployed. Sign-in, linking, and handoff flows are unchanged.')}</p>
    </section>

    <section id="mini" className="auth-map-section" aria-labelledby="mini-current-title">
      <p>{t('每日训练入口（本地实现，未发布）：小程序「训练」复用已有登录门禁和一次性网页会话交接 → 学习中心 → 已绑定学员的每日任务与打卡。分享固定入口不会自动加入班级；服务端核对学员绑定、任务目标和当前班级关系后才展示同班排名。未完成真机验收。', 'Daily training entry (local, not released): the Mini Program Training tab reuses the existing sign-in gate and one-time website session handoff → learning center → daily assignments for the linked learner. A shared room link does not enroll a learner; the server verifies account binding, assignment targets and current class membership before showing class rankings. Real-device acceptance is pending.')}</p>
      <div className="auth-map-section-heading"><h2 id="mini-current-title">{t('微信 / 抖音小程序：当前流程', 'WeChat / Douyin Mini Programs: current flows')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现，尚未部署发布', 'Implemented in source, not deployed or released')}</span></div>
      <h3 id="douyin-mini-current">{t('抖音小程序', 'Douyin Mini Program')}</h3>
      <p className="auth-map-note">{t('个人主体产品范围：抖音端新增登录与绑定仅提供抖音、邮箱、手动手机号和密码，保留已有第三方身份；所有登记页面使用原生视图，旧网页入口只做原生路由分发，不请求网页会话票据；旧 WCA 授权参数也不打开浏览器或复制授权链接。下文网页保活、偏好回传和换票流程仅适用于微信及历史网页壳，不用于当前抖音构建。', 'Personal-account product scope: Douyin offers new sign-in and linking only through Douyin, email, manually entered phone numbers and passwords, while preserving existing third-party identities. Every registered page uses native views. Legacy web entries only dispatch native routes and do not request web-session tickets; legacy WCA parameters cannot open a browser or copy an authorization link. The web-document retention, preference handoff and ticket flows below apply only to WeChat and legacy web shells, not the current Douyin build.')}</p>
      <p className="auth-map-note">{t('原生账号安全页支持用户手动填写邮箱或大陆手机号、同意用途后发送验证码，再验证绑定；已有同类身份时走换绑接口，不先解绑。密码设置复用共享长度校验，修改已有密码要求当前密码并重复新密码。所有请求锁定加载时的会话，不自动重试写入；离页清除账号输入、验证码和密码。手动手机号验证码不调用抖音手机号授权能力。', 'Native account security accepts a manually entered email or mainland China phone number, sends a code after consent, and verifies it for linking. Existing credentials use replacement endpoints without unlinking first. Password changes use shared length validation, require the current password when already set, and repeat the new password. Requests remain bound to the loaded session and never retry writes automatically. Leaving clears identifiers, codes and passwords. Manual SMS verification does not invoke Douyin phone authorization.')}</p>
      <p className="auth-map-note">{t('原生解绑先确认，服务端保留最后一种登录方式保护，换号或离页后的响应不安装会话。退出仅清除本机小程序登录，不删除本地成绩、不退出网站及其他设备；存储失败不伪装退出成功。注销使用共享 primaryHandle，要求填写账号标识、已有密码及二次确认；沿用组织和会员合约限制。确认前换号或离页不提交，已确认请求完成后仅清除同一会话；失败不自动重试，离页清除密码，未调用真实账号删除进行验收。', 'Native unlinking requires confirmation and retains the server guard against removing the last sign-in method; stale or hidden-page responses cannot install sessions. Sign-out clears only this Mini Program session, keeping local solves and website or other-device sessions; storage failure is not reported as success. Deletion uses shared primaryHandle, a matching identifier, an existing password and a second confirmation, preserving organization and membership-contract restrictions. Switching accounts or leaving before confirmation prevents submission; a completed confirmed deletion clears only the same session. Writes are not retried automatically and leaving clears passwords. No real account was deleted for verification.')}</p>
      <p className="auth-map-note">{t('我的页可按需原生查询已绑定登录方式及密码设置状态，仅携带当前会话请求身份列表；离页清空，换号或失效响应不展示。邮箱、手机号与 WCA 显示可识别标识，其他三方不向视图传递 OpenID 等内部标识；抖音多种身份合并显示一行。查询不执行绑定或解绑。', 'Me can load linked sign-in methods and password status natively on demand, using only the current session. Leaving clears the list; stale or switched-session responses are not displayed. Email, phone and WCA show recognizable handles; other providers do not pass internal identifiers such as OpenID into the view. Multiple Douyin identities appear as one row. Loading never links or unlinks identities.')}</p>
      <p className="auth-map-note">{t('我的页支持原生修改展示名，复用共享字符校验和账号资料接口；绑定 WCA 的账号仍使用认证姓名。保存前后核对原会话，离页或切换账号后的响应不得安装会话。保存结果无法确认时提示刷新核对，不自动重试写入。解绑、退出本机小程序和注销已有原生入口；账号安全入口与旧账号链接均转到原生页面，不再内嵌网站；未支持的链接参数明确提示。', 'Me supports native display-name editing using shared validation and the account profile endpoint; WCA-linked accounts retain their verified name. The original session is checked before and after saving; responses after leaving or switching accounts cannot install a session. Unconfirmed saves ask users to refresh rather than retrying writes automatically. Unlinking, local Mini Program sign-out and deletion have native entries; account security and legacy account links open native pages without embedding the website; unsupported link parameters are reported explicitly.')}</p>
      <p className="auth-map-note">{t('原生邮箱验证码、邮箱密码或短信验证码取得的临时会话仅用于带 expectedUid 签发一次性登录码，不写入小程序登录状态、不自动绑定身份；离开页面清除验证码和登录码，过期停止展示与复制，离页后的请求响应不会回填或继续签发。抖音端不再提供第三方网页授权入口；已有第三方身份保留展示和解绑，网站仍支持原有授权。计时分享链接通过 App 内存传递项目和打乱，用户确认后才修改计时设置，不涉及账号换票。均为本地实现，邮件送达及真机流程尚未验收。', 'The temporary session from native email-code, email-password or SMS verification is used only to issue a one-time sign-in code with expectedUid. It never replaces the Mini Program session or links an identity automatically. Leaving clears verification and sign-in codes; expiry stops display and copying, and late responses cannot refill the page or continue issuance. Douyin no longer offers third-party web authorization. Existing third-party identities remain visible and unlinkable; the website retains its authorization methods. Shared timer event and scramble options travel through App memory and change settings only after confirmation, without account handoff. Implemented locally; email delivery and device flows remain unverified.')}</p>
      <figure className="auth-map-figure" aria-labelledby="douyin-mini-current"><Steps items={[
        t('我的 → 抖音登录；公开浏览和普通计时不要求登录', 'Me → Douyin sign-in; public browsing and ordinary timing do not require sign-in'),
        t('服务端验证抖音身份；旧小程序 OpenID 仍升级为 UnionID。同主体网站应用与小程序还各自查询 AlliedID，匹配同一账号后补齐跨应用登录入口；标识冲突时停止，不自动合并账号', 'The server verifies Douyin identity and still upgrades legacy Mini Program OpenID to UnionID. The same-owner website app and Mini Program each request AlliedID; a match adds cross-app sign-in to the same account. Conflicting identities stop the flow rather than merging accounts'),
        t('已绑定 → 直接进入原账号；未绑定 → 选择登录已有账号或明确创建新账号', 'Already linked → enter the existing account; not linked → choose to sign in to an existing account or explicitly create one'),
        t('登录已有账号 → 原生邮箱验证码或短信验证码验证（existingOnly=true），或邮箱密码登录 → 生成 6 位登录码 → 回“我的”输入并核对目标账号 → 明确确认后完成绑定', 'Existing account → native email or SMS verification (existingOnly=true), or email-password sign-in → generate a six-digit sign-in code → return to Me, enter it and check the target account → explicitly confirm linking'),
      ]} /><figcaption>{t('登录码 10 分钟内有效且只能使用一次，不包含账号编号。登录码不是合并码，不会迁移两个账号的数据。网站「抖音登录」使用独立的网站应用凭据。历史小程序绑定要在新版服务端重新登录小程序一次，才能记录跨应用标识；此能力还取决于抖音是否将两个应用认证为同一主体并开放相应接口。抖音授权页提供电脑二维码或支持环境中的抖音 App 授权。', 'The sign-in code is valid for 10 minutes, works once, and contains no account number. The sign-in code is not a merge code and does not migrate data between accounts. Website Douyin sign-in uses separate website-app credentials. A previously linked Mini Program identity must sign in once on the updated server to record the cross-app ID; this also depends on Douyin recognizing both apps as the same certified owner and providing the related-ID API. The Douyin authorization page offers a desktop QR code or Douyin App authorization in supported environments.')}</figcaption></figure>
      <p className="auth-map-note">{t('外接计时器：网页入口 → 原生连接页检查已有会话 → 未登录时复用“我的”登录并恢复设备连接页 → 用户启动蓝牙或麦克风 → 连接后切回计时页。桥接令牌只关联本次设备会话，不签发账号身份；麦克风权限不属于账号登录授权。本地源码已接入，尚未部署或完成真机验收。', 'External timers: web entry → native setup checks the existing session → signed-out users go through Me and return to setup → the user starts Bluetooth or microphone input → return to the timer tab after connection. The relay token identifies only this device session and does not issue an account identity; microphone permission is separate from sign-in. Implemented locally, not deployed or verified on real devices.')}</p>
      <p className="auth-map-note">{t('小程序切换语言或外观会同步原生导航和页面；后台网页需要刷新时，使用已有会话重新申请一次性票据，不重放旧票据、不改变登录身份。偏好参数不包含账号凭据，分享时会移除。本地实现与自动检查不等于已发布或真机验收。', 'Mini Program language and appearance changes update native navigation and pages. When a background web page needs refreshing, it requests a new one-time ticket using the existing session, without replaying old tickets or changing identity. Preference parameters contain no account credentials and are removed from shares. Local implementation and automated checks do not imply release or real-device acceptance.')}</p>
      <p className="auth-map-note">{t('旧版小程序不支持透明背景偏好时，网页沿用外观与语言消息同步，不打开偏好中转页，避免反复重载与登录同步限流。支持协议 3 的新壳继续即时保存完整偏好；网站不改写用户背景选择，账号与票据校验保持不变。网站兼容修复与新版小程序发布、真机验收分别记录。', 'When an older Mini Program cannot accept transparent background preferences, the website uses appearance and language messages without opening the preference adapter page, avoiding repeated reloads and sign-in throttling. Protocol 3 shells still save full preferences immediately. Saved background choices, account identity and ticket validation are unchanged. Website compatibility deployment, new Mini Program publication and physical-device acceptance are recorded separately.')}</p>
      <p className="auth-map-note">{t('切换小程序导航或暂时离开时保留已有网页与滚动位置，不重复消费票据。返回时核对本机会话与偏好；仅身份或偏好变化才重新同步，退出后先清除网页会话。账号管理的返回按钮回到“我的”，普通 Web 仍回首页；计时导航只承载计时器，其他工具切到工具导航。本轮为本地实现与自动回归，尚未发布或真机验收。', 'Switching Mini Program tabs or briefly leaving keeps the current document and scroll position without replaying tickets. On return, compare the native session and preferences; synchronize again only when either changes, and clear the website session after sign-out. Account management returns to Me, while the regular website returns home. The Timer tab only hosts the timer; other tools open in Tools. Locally implemented and regression-tested, not released or verified on a physical device.')}</p>
      <figure className="auth-map-figure"><Steps items={[
        t('打开已登录的小程序工具 → 独立检查 IP 额度 → 验证已有账号会话 → 按账号检查签票额度', 'Open Tools while signed in → check the dedicated IP allowance → verify the existing account session → check the account ticket allowance'),
        t('签发 90 秒一次性票据 → 网页用独立兑换额度原子核销 → 恢复同一账号；普通业务请求不占用同步额度', 'Issue a 90-second single-use ticket → redeem atomically under a separate allowance → restore the same account; ordinary business requests do not consume synchronization allowances'),
        t('达到额度 → 返回 429 和实际剩余等待秒数；停止本次同步，不以游客替代已登录账号', 'Allowance exhausted → return 429 and the actual remaining wait in seconds; stop synchronization without substituting a guest for the signed-in account'),
      ]} /></figure>
      <p className="auth-map-note">{t('同步限流使用 60 秒滑动窗口：签票每个已验证账号 60 次，每个 IP 600 次；兑换每个 IP 单独 600 次。关注比赛读取另设每账号 120 次、每 IP 600 次，关注写入仍使用原有保护。限额由各 API 进程在内存中执行；部署状态与真机恢复证据单列，不把自动检查当作用户设备验收。', 'Synchronization uses a rolling 60-second window: 60 ticket requests per verified account and 600 per IP; redemption has a separate 600-per-IP allowance. Reading followed competitions uses separate limits of 120 per account and 600 per IP, while follow writes retain their existing protection. Each API process enforces these limits in memory. Deployment and physical-device recovery are recorded separately; automated checks are not device acceptance.')}</p>
      <p className="auth-map-note">{t('抖音工具版：教程、课程、班级任务及专项训练对全部用户下线，基础计时和公开比赛信息查询无需登录。原生入口和网页使用同一范围限制，旧训练链接不再打开。抖音容器标记仅控制产品内容，不是身份或权限凭据；账号登录、一次性网页会话票据、绑定、退出及蓝牙隐私授权仍沿用现有流程。', 'Douyin tools: tutorials, courses, class assignments and specialized training are unavailable to all users. Basic timing and public competition information require no sign-in. Native and web entry points share the same scope, including old training links. The Douyin container marker selects product content, not identity or permissions; sign-in, one-time web-session tickets, linking, sign-out and Bluetooth privacy authorization retain their existing flows.')}</p>
      <p>{t('私测签约仅允许服务器指定账号在有效期内访问，仍须同账号微信验证与明确同意；默认只签约及取消，不扣款。首期真实扣款另需开关，私测不申请第二期。私测预览可由指定账号登录后现场签发短期票据，其他账号拒绝；入口不开放公开套餐，也不绕过正式版发布门槛。', 'Private acceptance admits only the server-designated account before expiry and still requires same-account WeChat verification and explicit consent. It defaults to signing and cancellation without debits. A real first payment requires a separate switch; no second cycle is requested. The designated signed-in account can obtain a short-lived ticket in the preview; other accounts are rejected. Private access does not open public plans or bypass the production-release gate.')}</p>
      <h3>{t('会员签约的账号校验', 'Account checks for membership authorization')}</h3>
      <Steps items={[
        t('网站登录 → 选择套餐 → 生成有效期 10 分钟、绑定账号及套餐的签约票据；票据不能作为登录会话', 'Website sign-in → select a plan → create a 10-minute authorization ticket bound to the account and plan; it cannot be used as a sign-in session'),
        t('微信小程序打开链接 → 复用“我的”登录并返回签约页 → 服务器核对同一账号；过期或账号不符则重新从网站进入', 'Open the link in the WeChat Mini Program → reuse Me sign-in and return to authorization → the server checks the same account; expired or mismatched links must be reopened from the website'),
        t('明确同意价格与协议 → 微信登录 code 再次核对 UnionID 所属账号 → 服务器生成官方签约参数；切换账号或离开页面后不使用迟到响应', 'Explicitly accept the price and agreement → a fresh WeChat login code verifies the UnionID account → the server generates official signing parameters; late responses are discarded after switching accounts or leaving'),
        t('进入微信官方签约页 → 返回后向服务器查询 → 仅已验证到账授予会员，客户端跳转成功不能开通权益', 'Open the official WeChat authorization page → query the server on return → grant benefits only for verified payment, never for successful client navigation'),
      ]} />
      <p className="auth-map-note">{t('此流程不创建第二套账号，不自动绑定或合并账号；原 WebView 会员销售限制保留，抖音构建不包含签约页。接口和页面已实现，仍须微信正式版本发布及真实签约、扣款和取消验收后开放。', 'This flow creates no separate account system and does not link or merge accounts automatically. Existing WebView membership restrictions remain; the Douyin build excludes this page. APIs and pages are implemented, but public access requires the WeChat production release and real authorization, debit and cancellation acceptance.')}</p>
      <h3 id="wechat-mini-current">{t('微信小程序', 'WeChat Mini Program')}</h3>
      <figure className="auth-map-figure" aria-labelledby="wechat-mini-current"><Steps items={[
        t('我的 → 微信登录（公开浏览和普通计时无需登录）', 'Me → WeChat sign-in (public browsing and ordinary timing need no sign-in)'),
        t('服务端验证微信身份（UnionID）；取不到则停止，不另造 OpenID 账号', 'Server verifies the WeChat identity (UnionID); if unavailable, stop rather than create an OpenID account'),
        t('已绑定 → 原账号登录；未绑定 → 手机号实时验证授权，或其他方式验证旧号', 'Already linked → sign in; otherwise → authorize real-time phone verification, or verify an existing account another way'),
        t('手机号命中旧号 → 显示账号并确认；未命中 → 使用原账号生成的一次性小程序登录码或明确创建，微信与手机号原子绑定', 'Phone matches an account → show it and confirm; no match → use a one-time Mini Program sign-in code from the original account or explicitly create, linking phone and WeChat atomically'),
      ]} /></figure>
      <p className="auth-map-note">{t('不会自动取得手机号：需主动点击并完成微信实时验证授权。仅支持既有中国大陆手机号契约；其他号码或不支持实时验证时，使用其他方式登录旧号，不降级到非实时授权。后台权限、额度、隐私声明和真机验收仍是发布前置条件。', 'Phone access requires an explicit tap and WeChat real-time verification. The existing phone contract supports mainland China numbers only. Other numbers or unsupported real-time verification use another existing-account sign-in method, never a non-real-time fallback. Platform permission, quota, privacy declarations and real-device acceptance remain release prerequisites.')}</p>
      <div className="auth-map-section-heading">
        <h2 id="mini-flow-title">{t('微信小程序：手机号与旧号流程', 'WeChat Mini Program: phone and existing accounts')}</h2>
        <span className="auth-map-status">{t('本地接入 · 待后台与真机验收', 'Locally integrated · platform and device acceptance pending')}</span>
      </div>
      <p className="auth-map-note">{t('普通浏览、基础计时不要求先登录。下面从用户需要账号功能时开始。', 'Browsing and basic timing do not require sign-in. This flow begins when an account is needed.')}</p>

      <figure className="auth-map-figure" aria-labelledby="mini-flow-title">
        <div className="auth-map-stem"><FlowNode>{t('进入小程序，需要登录', 'Open the Mini Program and sign in')}</FlowNode><Arrow />
          <FlowNode>{t('这个微信是否已绑定 CubeRoot 账号？', 'Is this WeChat identity already linked to CubeRoot?')}</FlowNode>
        </div>
        <div className="auth-map-branches">
          <section className="auth-map-lane" aria-labelledby="returning-title">
            <h3 id="returning-title">{t('已绑定', 'Already linked')}</h3>
            <Arrow />
            <FlowNode>{t('验证微信身份，恢复登录', 'Verify WeChat identity and restore sign-in')}</FlowNode>
            <Arrow />
            <FlowNode outcome>{t('直接使用原账号', 'Continue with the existing account')}</FlowNode>
            <p className="auth-map-note">{t('不重复授权手机号，不重新注册。', 'No repeated phone authorization or registration.')}</p>
          </section>

          <section className="auth-map-lane auth-map-main-lane" aria-labelledby="phone-title">
            <h3 id="phone-title">{t('未绑定 → 主入口', 'Not linked → primary path')}</h3>
            <Arrow />
            <FlowNode><strong>{t('手机号快捷登录', 'Quick phone sign-in')}</strong><small>{t('说明：验证后绑定微信，下次直接登录。', 'Explain: link WeChat after verification for future sign-ins.')}</small></FlowNode>
            <Arrow />
            <FlowNode>{t('用户同意手机号实时验证；服务端校验 AppID、OpenID 与独立授权码', 'User authorizes real-time phone verification; the server checks AppID, OpenID and the separate authorization code')}</FlowNode>
            <Arrow />
            <FlowNode>{t('该手机号是否已关联 CubeRoot 账号？', 'Is that phone number linked to a CubeRoot account?')}</FlowNode>
            <div className="auth-map-phone-results">
              <div><p className="auth-map-branch-label">{t('已关联', 'Linked')}</p><Arrow />
                <FlowNode>{t('确认使用原账号，并绑定微信', 'Confirm the existing account and link WeChat')}</FlowNode>
              </div>
              <div><p className="auth-map-branch-label">{t('未关联', 'Not linked')}</p><Arrow />
                <FlowNode>{t('提示未匹配账号；明确同意注册后，创建账号并绑定微信', 'No matching account: create one and link WeChat only after explicit registration consent')}</FlowNode>
                <AppLink className="auth-map-cross-link" href="#existing-account" prefetch={false}>{t('其实有旧号？走「已有账号」路径 →', 'Already have an account? Use the existing-account path →')}</AppLink>
              </div>
            </div>
          </section>

          <section id="existing-account" className="auth-map-lane" aria-labelledby="existing-title">
            <h3 id="existing-title">{t('未绑定 → 次入口', 'Not linked → alternative path')}</h3>
            <Arrow />
            <FlowNode><strong>{t('已有账号，绑定微信', 'Link WeChat to an existing account')}</strong></FlowNode>
            <Arrow />
            <FlowNode>{t('使用原账号的登录方式验证', 'Authenticate with an existing sign-in method')}<small>{t('手机号、邮箱、WCA、Apple 等已绑定方式。', 'An already-linked phone, email, WCA, Apple, or other method.')}</small></FlowNode>
            <Arrow />
            <FlowNode>{t('已授权手机号：网站原账号生成一次性小程序登录码 → 回小程序预览并确认，一并绑定手机号和微信；未授权：在网站完成原有微信绑定后返回', 'After phone authorization: generate a one-time Mini Program sign-in code in the existing website account → preview and confirm it in the Mini Program to link both phone and WeChat. Without phone authorization: complete existing WeChat linking on the website and return')}</FlowNode>
            <p className="auth-map-note">{t('登录码有效期 10 分钟，不是合并码。原账号已有其他手机号时停止，不覆盖号码；可取消并用原有方式登录、在设置中处理换绑。', 'The sign-in code lasts 10 minutes and is not a merge code. If the account has another phone, stop without replacing it; cancel, sign in with an existing method and manage replacement in settings.')}</p>
          </section>
        </div>
        <div className="auth-map-stem auth-map-finish"><Arrow /><FlowNode outcome>{t('登录完成：会员、资料仍在同一个账号', 'Signed in: membership and profile stay on one account')}<small>{t('以后进入小程序，走「已绑定」路径。', 'Future visits follow the already-linked path.')}</small></FlowNode></div>
        <figcaption>{t('三条路径是不同情况，不是每个人都要走三遍。登录和绑定完成后才到达底部结果。', 'These are alternative paths, not three steps everyone must repeat. The final result requires successful sign-in and linking.')}</figcaption>
      </figure>
      <h3>{t('打开别人分享的页面', 'Opening a shared page')}</h3>
      <Steps items={[
        t('右上角转发 → 读取当前网页地址，保留语言、网址中的筛选和锚点；排除认证回调，移除票据与令牌', 'Native share menu → read the current web address, retaining language, URL filters and anchor; exclude authentication callbacks and remove tickets and tokens'),
        t('接收者已登录 → 用接收者自己的单次网页票据同步会话；未登录 → 以游客打开页面', 'Signed-in recipient → sync their own session with a one-time web ticket; otherwise open the page as a guest'),
        t('到达具体页面；课程、机构、账号和编辑页仍检查接收者自己的权限，未保存且不在网址中的内容不随分享传递；重试保留目的地', 'Open the exact page; courses, organizations, account and editing pages still check the recipient’s own permissions. Unsaved content outside the URL is not transferred; retries retain the destination'),
      ]} />
      <p className="auth-map-note">{t('分享不携带发送者的登录态。本地实现仍须发布后验收微信真机转发。', 'Sharing never carries the sender’s session. This local implementation still needs release and real-device WeChat sharing acceptance.')}</p>
    </section>

    <aside className="auth-map-boundaries" aria-labelledby="boundary-title">
      <h2 id="boundary-title">{t('这些情况不会自动新建或合并', 'No automatic creation or merging in these cases')}</h2>
      <ul>
        <li>{t('拒绝授权、验证失败或超时：留在未登录流程，可重试或使用已有账号；不悄悄注册。', 'Authorization declined, verification failed, or timed out: retry or use an existing account; never register silently.')}</li>
        <li>{t('微信和手机号分别属于两个账号：停止绑定，核实账号；不能覆盖绑定或直接合并会员。', 'WeChat and phone belong to different accounts: stop and resolve the conflict; never overwrite links or merge memberships automatically.')}</li>
        <li>{t('手机号未匹配，不代表用户没有旧号。手机号只是登录方式，不是账号本身。', 'An unmatched phone does not prove there is no existing account. A phone is a sign-in method, not the account itself.')}</li>
      </ul>
    </aside>

    <section id="linking" className="auth-map-section" aria-labelledby="linking-title">
      <div className="auth-map-section-heading"><h2 id="linking-title">{t('绑定 / 解绑：还是一个账号，只改登录入口', 'Link / unlink: one account, different ways to sign in')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现', 'Implemented in source')}</span></div>
      <p className="auth-map-note">{t('入口：网站「我的 → 齿轮 → 登录方式」；iOS / 安卓显示同一个账号页，小程序从「账号管理」进入网站。小程序内绑定 WCA 时，先用短期票据关联当前账号，再在系统浏览器完成 WCA 授权；绑定写入服务端后，小程序返回前台刷新账号，不把长期凭据放进小程序 URL。', 'Entry: website My account → settings gear → sign-in methods. iOS / Android display the same account page; Mini Program Account management opens the website. WCA linking from the Mini Program uses a short-lived ticket for the current account, completes WCA authorization in the system browser, then refreshes the account on return; long-lived credentials never enter the Mini Program URL.')}</p>
      <figure className="auth-map-figure" aria-labelledby="linking-title"><div className="auth-map-current-paths">
        <section><h3>{t('新增登录方式', 'Add a sign-in method')}</h3><Steps items={[
          t('先登录要保留的 CubeRoot 账号', 'Sign in to the CubeRoot account you want to keep'),
          t('选择绑定方式 → 验证新邮箱 / 手机号，或完成第三方授权', 'Choose a method → verify the new email / phone, or authorize the provider'),
          t('邮箱或手机号绑定与换绑和验证码核销一起完成；冲突或保存失败时都不生效', 'Email or phone linking and replacement commit together with code consumption; conflicts or save failures apply neither change'),
          t('归属检查通过 → 新登录方式挂到当前账号，会员不另开一份', 'Ownership checks pass → attach the method to this account, without creating a second membership'),
        ]} /><p className="auth-map-note">{t('该身份已经属于另一个账号？停止绑定；需要合并时走下一节，不能直接抢绑。保存服务故障会提示重试，不会误报身份冲突。', 'Identity already belongs to another account? Stop linking. Use the merge flow if appropriate; never take over the link. A storage failure asks you to retry instead of reporting an identity conflict.')}</p></section>
        <section><h3>{t('解绑或换绑', 'Unlink or replace')}</h3><Steps items={[
          t('查看已绑定方式 → 选择解绑，或邮箱 / 手机号的换绑入口', 'Review linked methods → choose unlink, or replace the email / phone'),
          t('唯一登录方式不能解绑；换绑必须验证新凭据', 'The only sign-in method cannot be removed; replacing it requires verifying the new credential'),
          t('成功后账号仍保留，只是旧方式不能再登录这个账号', 'The account remains; the removed method no longer signs in to it'),
        ]} /><p className="auth-map-note">{t('Apple 解绑涉及撤销授权；撤销失败保留绑定供重试，不伪报成功。每个账号各保留一个邮箱和一个手机号。', 'Unlinking Apple requires authorization revocation. A failure keeps the link for retry, rather than reporting success. Each account has at most one email and one phone.')}</p></section>
      </div><figcaption>{t('App 中需要外部授权的绑定会转系统浏览器，并核对目标账号；浏览器登录了别的号时，不能把身份绑错。', 'App linking that needs external authorization opens the system browser and checks the target account; a different browser account must not receive the link.')}</figcaption></figure>
    </section>

    <section id="wechat-renewal" className="auth-map-section" aria-labelledby="wechat-renewal-title">
      <h2 id="wechat-renewal-title">{t('微信自动续费与账号归属', 'WeChat renewal and account ownership')}</h2>
      <Steps items={[
        t('当前登录账号确认方案、价格与条款 → 服务端锁定账号归属并记录同意 → 前往微信 HTTPS 签约页', 'The signed-in account confirms the plan, price and terms → the server reserves account ownership and records consent → continue to the WeChat HTTPS enrollment page'),
        t('浏览器返回不证明签约或付款 → 服务端核验合约，再通过验签查单核对商户、订单、金额和账号归属 → 幂等发放权益', 'Returning in the browser proves neither enrollment nor payment → the server verifies the contract, then checks signed payment results against the merchant, order, amount and account ownership → grant benefits idempotently'),
        t('开放签约须满足商户模板批准、H5 批准及上线开关；周期扣款另需扣款开关。源码已实现，部署成功不等于真实商户闭环验收通过。', 'Enrollment requires approved merchant templates, H5 approval and the release switch; recurring debits additionally require the debit switch. Implemented in source; successful deployment does not prove real-merchant end-to-end acceptance.'),
        t('企业续费方案仅向已认证企业的有效负责人或管理员开放，服务端在展示可用方案及生成小程序签约链接时核验。', 'Enterprise renewal plans require an active owner or administrator of a verified enterprise; the server checks eligibility when listing plans and issuing mini-program enrollment links.'),
      ]} />
    </section>

    <section id="android-membership" className="auth-map-section" aria-labelledby="android-membership-title">
      <h2 id="android-membership-title">{t('Android 发行渠道与付款账号', 'Android distribution channels and payment accounts')}</h2>
      <figure className="auth-map-figure" aria-labelledby="android-membership-title"><Steps items={[
        t('原生壳报告发行渠道 → Google Play 版只启用 Google 购买与恢复同步；直接下载 APK 版使用网页付款。渠道读取失败时不开放网页付款，两个版本仍共用原登录与会话流程', 'The native shell reports its distribution channel → the Google Play build enables Google purchases and restore synchronization; the direct-download APK uses website checkout. A failed channel lookup does not enable website checkout. Both builds retain the same sign-in and session flow'),
        t('直接下载版网页付款 → 仅接收可信来源和对应内嵌页面的请求 → 核对网页目标 UID 与 App 当前账号；原生端在打开前和返回后再次核对安全存储中的账号，换号或退出时停止', 'Website checkout in the direct build → accept only requests from the trusted origin and matching embedded frame → match the requested website UID to the current App account. Before opening and after returning, the native handler rechecks the securely stored account; switching accounts or signing out stops the handoff'),
        t('系统浏览器打开本站中转页，再进入允许的支付宝或微信 HTTPS 收银台；收银台链接通过网址片段传递，CubeRoot 登录令牌不进入网址', 'The system browser opens the site checkout relay, then an allowed Alipay or WeChat HTTPS cashier. The cashier link is carried in the URL fragment; CubeRoot sign-in tokens never enter the URL'),
        t('返回 App 只表示浏览器已返回，不表示付款成功 → 保持同一账号并向服务端查单确认；换号会停止旧订单轮询，不能凭回跳授予会员或转移订单归属', 'Returning to the App means only that the browser returned, not that payment succeeded → keep the same account and query the server for order status. Account changes stop the old order polling; a return cannot grant membership or transfer order ownership'),
      ]} /><figcaption>{t('此处记录源码中的渠道与账号边界；签名安装包、渠道发布、商户配置及真机付款验收须分别确认。付款渠道不新增登录方式，也不改变账号绑定、合并或注销规则。', 'These are source-level channel and account boundaries. Signed builds, channel releases, merchant setup and real-device payment acceptance require separate confirmation. Payment channels add no sign-in method and do not change identity linking, merging or account deletion rules.')}</figcaption></figure>
    </section>

    <section id="merge" className="auth-map-section" aria-labelledby="merge-title">
      <Steps items={[
        t('Google Play 购买：App 与网页当前 UID 一致 → 服务端创建随机混淆账号标识 → 原生商店购买 → 服务端向 Google 查询当前状态、核对归属后保存权益并确认购买', 'Google Play purchase: match the current App and website UID → server creates a random obfuscated account identifier → native store purchase → server queries Google, verifies ownership, persists benefits and acknowledges the purchase'),
        t('恢复与续费沿用原购买归属；主动确认的账号合并在同一事务迁移所有 Google 标识，不通过恢复购买转绑', 'Restores and renewals retain purchase ownership; a confirmed account merge moves all Google identifiers in the same transaction, never by restoring to another account'),
        t('注销前到 Google Play 取消续费；注销时清空购买标识的账号归属，保留交易凭据，禁止新账号认领；不影响其他渠道独立会员权益', 'Cancel renewal in Google Play before deletion; deletion clears account ownership while retaining transaction evidence and prevents another account from claiming it. Other channels retain their independent membership grants'),
      ]} />
      <p>{t('Google Play 接入尚待商家与商品配置、服务账号授权、生产部署和内部测试真实购买验收；源码接线不是支付已开通。', 'Google Play integration still needs merchant and product configuration, service-account authorization, deployment and real internal-track purchase acceptance. Source wiring does not mean payments are enabled.')}</p>
      <div className="auth-map-section-heading"><h2 id="merge-title">{t('合并账号：把已有的 B 并入 A', 'Merge accounts: move existing B into A')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现 · 有限制 · 不可撤销', 'Implemented in source · restricted · irreversible')}</span></div>
      <p className="auth-map-note">{t('适合确实已经有两个账号的人，不是每次登录都要做。在统一账号页的「登录方式」中，直接点击「合并账号」整行展开，再次点击收起。', 'For someone who already has two accounts, not a step on every sign-in. Under Sign-in methods on the canonical account page, click the Merge accounts row to expand it; click again to collapse.')}</p>
      <figure className="auth-map-figure" aria-labelledby="merge-title">
        <div className="auth-map-direction"><span>{t('B · 不再单独使用', 'B · retire separately')}</span><span aria-hidden="true">→</span><strong>{t('A · 保留账号', 'A · keep this account')}</strong></div>
        <Steps items={[
          t('① 登录 A → 选择「保留当前账号」→ 生成合并码（10 分钟有效）', '① Sign in to A → Keep this account → generate a merge code (valid for 10 minutes)'),
          t('② 再登录 B → 选择「合并当前账号」→ 输入 A 的合并码', '② Sign in to B → Merge this account → enter the code from A'),
          t('③ 先检查合并方向 B → A，再在确认画面主动提交；此时目标资料尚未验证，不能只凭码相信对方身份', '③ Review direction B → A, then submit from the confirmation screen. Target details are not yet verified; do not trust someone’s identity from the code alone'),
          t('④ 服务端检查两个账号、合并码、凭据冲突和数据迁移条件', '④ Server checks both accounts, the code, credential conflicts, and data migration constraints'),
        ]} />
        <div className="auth-map-current-paths auth-map-results">
          <FlowNode outcome><strong>{t('检查通过 → 一次事务完成', 'Checks pass → one transaction')}</strong><small>{t('受支持的数据、已领养宠物和登录方式转入 A，当前会话切到 A；B 的其他旧会话失效，B 不再作为独立账号使用。不能撤销。', 'Supported data, adopted pets, and sign-in methods move to A; the current session switches to A. Other old B sessions become invalid, and B is retired as a separate account. This cannot be undone.')}</small></FlowNode>
          <FlowNode><strong>{t('检查失败 → 不迁移账号数据', 'Checks fail → no account data is moved')}</strong><small>{t('提示冲突并停止；正确且未过期的合并码保留，可在解决冲突后重试；过期则在 A 重新生成。', 'Explain the conflict and stop. A correct, unexpired merge code remains available for retry after resolving the conflict; generate a new one in A if it expires.')}</small></FlowNode>
        </div>
        <figcaption>{t('合并码只能在你自己的两个账号之间使用，不要交给他人。绑定一个新方式 ≠ 合并两个账号。合并后旧版 WCA 会话需要重新登录。', 'Use the merge code only between your own accounts; do not share it. Linking a new method is not the same as merging two accounts. Older WCA sessions require sign-in again after a merge.')}</figcaption>
      </figure>
      <details className="auth-map-current"><summary>{t('哪些情况会被拦住？会员怎么处理？', 'What blocks a merge? What happens to membership?')}</summary>
        <ul className="auth-map-list">
          <li>{t('宠物随账号迁移；同一种宠物保留亲密度较高的一份养成记录与更早的领养日期，亲密度相同则保留 A 的记录，不把两份经验相加。领养、互动与合并共用账号锁，避免并发遗漏。', 'Adopted pets move with the account. For the same pet, keep the care record with the higher bond and the earlier adoption date; equal bonds keep A’s record. Experience is not added together. Adoption, care, and merging share account locks to prevent concurrent omissions.')}</li>
          <li>{t('两个不同的 WCA ID；双方各有邮箱或手机号；双方密码凭据冲突。', 'Different WCA IDs; both accounts have an email or both have a phone; conflicting password credentials.')}</li>
          <li>{t('待并入账号有尚未支持迁移的直接关联数据，例如机构或课程关系；数据库唯一键冲突也会整体回滚。', 'The source account has unsupported directly linked data, such as organization or course relationships; database uniqueness conflicts also roll back the entire merge.')}</li>
          <li>{t('已有会员、订单与续约合约按当前迁移规则处理；冲突会阻止合并，不能承诺两份会员时长自动相加。Apple 内购的全部历史账号令牌在已确认的合并事务中迁移到保留账号，续费和恢复仍沿用原令牌；单纯恢复购买不能转绑。', 'Existing memberships, orders, and renewal contracts follow current migration rules. Conflicts block the merge; membership durations are not guaranteed to add together. All historical Apple account tokens move to the retained account within the confirmed merge transaction, preserving renewals and restores. Restoring alone cannot reassign a purchase.')}</li>
          <li>{t('登录其中一个账号不能证明另一个也属于你；合并需要分别登录两边。原账号无法登录时，先找回，不能跳过验证。', 'Access to one account does not prove ownership of the other. Sign in to both; recover an inaccessible account first rather than bypassing verification.')}</li>
        </ul>
      </details>
    </section>

    <section id="exit" className="auth-map-section" aria-labelledby="exit-title">
      <h2 id="exit-title">{t('退出登录 ≠ 注销账号 ≠ 取消续费', 'Sign out ≠ delete account ≠ cancel renewal')}</h2>
      <p className="auth-map-note">{t('智能魔方地址按账号私有保存，连接前复用现有会话读取，修改通过已登录账号同步；退出或换号后不再读取旧账号的缓存，也不接收旧请求结果。离线修改留在本机，稍后重试；旧访客地址仅迁移一次。注销会级联删除服务端地址，本机按账号隔离的缓存不等于已被远程擦除。', 'Smart-cube addresses are private to each account. Connections read them with the existing session, and edits sync under the signed-in account. Sign-out or account switching stops reading the previous account’s cache and discards its pending responses. Offline edits stay local for retry; legacy guest addresses migrate once. Account deletion removes server addresses through a foreign-key cascade; it does not remotely erase isolated browser caches.')}</p>
      <div className="auth-map-current-paths">
        <section aria-labelledby="logout-title"><h3 id="logout-title">{t('退出登录：下次还能回来', 'Sign out: you can return')}</h3><figure className="auth-map-figure" aria-labelledby="logout-title"><Steps items={[
          t('在当前账号页选择「退出登录」', 'Choose Sign out in the current account page'),
          t('Android / iOS 先关闭本机纪录推送，再撤销设备绑定；离线时仅保留设备撤销凭据，联网后重试，旧绑定撤销前不绑定另一个账号', 'Android / iOS first stops local record push and revokes its device binding. Offline revocation retains only a device credential and retries online; another account cannot bind until the old binding is revoked'),
          t('清理当前会话；App 内账号页与宿主通过消息同步退出', 'Clear the current session; the App account page and host coordinate sign-out through the bridge'),
          t('账号、会员和服务端资料仍保留 → 下次用已绑定方式登录', 'Account, membership, and server data remain → sign in again with a linked method'),
        ]} /><figcaption>{t('不等于全设备退出。外部浏览器退出不能主动通知休眠 App；也不会删除本地计时记录或取消续费。', 'Not a global device sign-out. An external browser cannot proactively notify a sleeping App. Signing out does not delete local solves or cancel renewal.')}</figcaption></figure></section>
        <section aria-labelledby="delete-title"><h3 id="delete-title">{t('注销账号：永久删除，不能恢复', 'Delete account: permanent, no recovery')}</h3><figure className="auth-map-figure" aria-labelledby="delete-title"><Steps items={[
          t('我的 → 齿轮 → 登录方式 → 底部「注销账号」', 'My account → settings gear → sign-in methods → Delete account at the bottom'),
          t('阅读删除与保留清单 → 输入页面要求的账号标识；设过密码还须输入当前密码', 'Read what is deleted and retained → type the requested account identifier; enter the current password if one is set'),
          t('主动确认永久注销 → 服务端检查续约合约、机构归属等条件，并撤销已绑定 Apple 授权', 'Explicitly confirm deletion → server checks renewal contracts, organization ownership, and other constraints, and revokes linked Apple authorization'),
          t('私人会议安排随账号删除；不含账号信息的预留会议码保持占用，避免旧邀请链接被分配给另一场会议', 'Private meeting plans are deleted with the account; identity-free reserved codes remain occupied so old invitations cannot point to a different meeting'),
          t('复盘评论的点赞和点踩随账号删除；这类投票数据沿用现有 linked_data 规则，阻止尚未支持的账号合并', 'Reconstruction comment votes are deleted with the account; votes follow the existing linked_data rule for unsupported account merges'),
          t('表情包收藏随账号删除；无其他会话或收藏引用的上传图片同时删除，别人已持有的副本解除上传者归属后保留', 'Sticker favorites are deleted with the account. Uploaded images without other message or favorite references are deleted; copies held by others remain without uploader attribution'),
          t('成功 → 删除站内账号与对应私有数据、推送设备绑定和队列、解除登录方式；失败 → 展示原因，不宣称已注销', 'Success → delete the site account, covered private data, push device bindings and queues, and sign-in methods. Failure → show the reason, never claim deletion succeeded'),
        ]} /><figcaption>{t('源码已实现立即注销、无恢复期。App 与小程序复用网站入口，不另造删除表单；各端真实注销与会话清理仍须分别验收。', 'Source implements immediate deletion with no grace period. App and Mini Program reuse the website entry, not separate deletion forms; real deletion and session cleanup require per-platform testing.')}</figcaption></figure></section>
      </div>
      <section aria-labelledby="dev-preview-title"><h3 id="dev-preview-title">{t('开发网址接入', 'Development preview enrollment')}</h3><Steps items={[
        t('本人登录申请 → 一次性接入码交给本机 AI → 本机生成公钥并绑定申请。', 'Sign in → pass the scoped enrollment ticket to local AI → generate and bind the device public key.'),
        t('仅真实负责人可批准，角色预览及普通管理员不能批准；独立工作服务令牌只执行已批准队列。', 'Only the real owner can approve; role previews and other admins cannot. A separate worker credential processes only approved requests.'),
        t('批准后临时网络故障自动退避重试，权限或配置冲突留给负责人处理；同事端持续等待并复用原密钥，取得配置后自动启动现有 cuberoot 服务与隧道，不需要再复制指令。', 'After approval, temporary transport failures retry with backoff; permission or configuration conflicts require the owner. The device keeps waiting with its original key and automatically starts the existing cuberoot runner after receiving its profile, without another copied command.'),
        t('仅独立工作服务通过 HTTPS、网页、全部启动资源与 API 验收后显示可用；设备接入码不能自报成功。验收失败或成功证据超过 5 分钟则显示等待接入，审批与凭据权限不变。本轮源码尚未发布。', 'Only independent worker verification of HTTPS, page, all startup assets and API marks the preview available; device tickets cannot self-certify. Failed checks or evidence older than five minutes return to waiting. Approval and credential boundaries are unchanged. These source changes are not yet deployed.'),
        t('开发隧道仅可转发分配端口，不授予服务器命令权限。停用电脑须由负责人执行现有 revoke；网站账号注销不代替服务器隧道撤销。', 'The tunnel can only forward its allocated port, with no server shell. The owner uses the existing revoke command to retire a computer; website account deletion does not replace tunnel revocation.'),
      ]}/></section>
      <section aria-labelledby="remote-access-title"><h3 id="remote-access-title">{t('员工 SSH 接入', 'Staff SSH access')}</h3><Steps items={[
        t('登录入门页 → 浏览器生成设备 Ed25519 密钥并下载私钥；只提交公钥，员工不需要复制密钥。', 'Sign in on onboarding → generate a device Ed25519 key and download the private key; submit only the public key.'),
        t('等待负责人 2017YANR02 明确批准；普通管理员、角色预览与主机同步令牌不能批准。', 'Wait for explicit approval by host owner 2017YANR02; ordinary admins, role previews and the host sync credential cannot approve.'),
        t('Mac 出站读取批准清单 → 只更新 authorized_keys 的管理区块 → 确认写入后显示已生效；离线时保持等待。', 'The Mac fetches approvals outbound, updates only the managed authorized_keys block, and acknowledges the write before showing ready; offline requests wait.'),
        t('员工 AI 安装已下载密钥、核验主机指纹并连接；权限为 eula 系统账号，不是项目隔离。', 'The employee’s AI installs the downloaded key, verifies the host fingerprint and connects as eula; access is not isolated to the project.'),
        t('负责人撤销或员工注销 → Mac 下次成功同步移除管理区公钥，阻止新登录；已有 SSH 会话不会自动终止。', 'Owner revocation or account deletion removes managed keys at the next successful Mac sync and prevents new logins; existing SSH sessions are not terminated automatically.'),
      ]} /></section>
      <aside className="auth-map-boundaries"><h3>{t('注销前一定要知道', 'Before deleting')}</h3><ul>
        <li>{t('好友聊天：任一参与账号注销时，整段会话和双方相关提醒一起删除。解除好友或拉黑只停止新消息，保留已有历史；聊天记录、表情包上传和收藏仍按现有 linked_data 规则阻止不受支持的账号合并。', 'Friend chat: deleting either participant removes the entire conversation and both inbox reminders. Unfriending or blocking stops new messages but retains history. Chat history, sticker uploads and favorites follow the existing linked_data rule for unsupported account merges.')}</li>
        <li>{t('AI 回答公开分享由账号关联；注销账号会删除分享快照，使公开链接失效。浏览器本地保存的置顶聊天需在本设备另行清理。', 'Public AI answer shares belong to the account; deleting it removes their snapshots and invalidates the links. Pinned chats saved locally in a browser must be cleared on that device separately.')}</li>
        <li>{t('企业对公认证独立于个人登录和企业成员身份。账号注销后企业认证材料、到账、退款与审核记录保留，申请人和操作人的账号引用置空；不自动退款、撤销认证或把企业归属转交他人。该流程仅本地实现，未部署或完成实款验收。', 'Corporate bank verification is separate from personal sign-in and organization membership. Account deletion retains enterprise documents, bank receipts, refunds and review records while clearing applicant and operator account references; it does not refund money, revoke certification or transfer ownership. This is implemented locally, without deployment or real-bank acceptance.')}</li>
        <li>{t('有待生效或生效中的自动续费合约：先取消并确认终止。是机构最后一位负责人：先转移归属。不是点注销就自动解约或退钱。', 'Pending or active renewal contract: cancel and confirm termination first. Last organization owner: transfer ownership first. Deletion is not automatic contract cancellation or a refund.')}</li>
        <li>{t('私有数据按清单删除，包括私人宠物领养、养成记录、复盘收藏、私有视频采集记录及其修订，以及 AI 问答监控记录；公开讨论和公开复盘匿名保留，交易及必要业务审计记录保留。采集原视频沿用网盘文件清理流程；其他采集上的修订操作者归属置空。WCA 官方公开成绩不因 CubeRoot 注销消失。', 'Covered private data, including private pet adoptions, care records, reconstruction favorites, private video capture records and their revisions, and AI chat monitoring records, is deleted; public discussions and public reconstructions are anonymized. Transactions and required business audit records remain. Original capture videos follow Drive file cleanup; actor attribution on other captures is cleared. Official public WCA results do not disappear when a CubeRoot account is deleted.')}</li>
        <li>{t('管理员维护的公开选手战队按 WCA ID 关联，不属于账号私有数据；注销 CubeRoot 账号不会删除战队资料。', 'Administrator-maintained public cuber teams are linked to WCA IDs and are not private account data; deleting a CubeRoot account does not remove these entries.')}</li>
        <li>{t('Apple 自动续费必须到系统订阅中取消；注销 CubeRoot 不会取消续费。注销后账号令牌归属置空，保留交易对账证据，旧收据不能恢复到新账号。', 'Cancel Apple auto-renewal in system subscriptions; deleting CubeRoot does not cancel it. Deletion clears token ownership and retains financial evidence; old receipts cannot restore to a new account.')}</li>
        <li>{t('不能声称远程清空所有手机。App 本地记录、导出备份和其他设备副本需要另外管理；注销的是 CubeRoot 账号，不是 Apple、Google 或微信账号。', 'This does not remotely wipe every phone. Manage local App records, exported backups, and other device copies separately. You delete CubeRoot, not your Apple, Google, or WeChat account.')}</li>
      </ul></aside>
    </section>

    <details className="auth-map-current">
      <summary>{t('还需要补什么？', 'What remains to be done?')}</summary>
      <p>{t('微信手机号实时授权已本地接入，仍须后端和网站部署、新版小程序上传、后台能力及隐私声明核验，以及授权成功/拒绝/旧号绑定的真机验收。Apple IAP 已有本地接线，商店配置、沙盒及正式环境验收仍未完成；各平台真人登录回跳、绑定、合并、退出和注销矩阵须分别验收。不能把这张说明图当成功能完成清单。', 'WeChat real-time phone authorization is locally integrated. Backend and website deployment, a new Mini Program upload, platform capability and privacy checks, and real-device authorization/decline/existing-account linking acceptance are still required. Apple IAP has local wiring; store configuration, sandbox and production acceptance are incomplete. Real-account handoff, linking, merging, sign-out and deletion need per-platform acceptance. This diagram is not a completion checklist.')}</p>
    </details>

    <p className="auth-map-note">{t('Platform 学习、收藏和订单继续使用同一个 CubeRoot 账号；账号切换时重建工作区并清空旧账号页面状态，公开内容搜索不读取私人数据。讲师和后台入口仍由服务器核对角色，证书验证链接只验证证书，不授予登录或课程访问权限。本轮补齐仍是本地实现，尚未发布。', 'Platform learning, favorites and orders use the same CubeRoot account; switching accounts resets workspace state, and public content search does not read private data. The server still checks instructor and administrator roles. Certificate links verify a certificate without granting sign-in or course access. These additions are local and have not been released.')}</p>

    <section id="face-verification" className="auth-map-section">
      <p className="auth-map-note">{t('认证页采用简洁状态展示，身份与人脸信息处理说明默认折叠、可随时展开；仍须单独勾选同意后才能发起。重新开始仍结束当前流水且不退次数，成功后仅展示认证状态与证件尾号。仅本地界面调整，认证与账号流程不变。', 'The verification page uses concise states with expandable identity and facial data details. Separate consent is still required to start. Restart still ends the current attempt without restoring quota; success shows only the verified state and ID suffix. This is a local UI update; verification and account flows are unchanged.')}</p>
      <h2>{t('本人刷脸实名认证', 'Personal identity and liveness verification')}</h2>
      <Steps items={[
        t('本人登录 → 我的 / 账号设置（齿轮）/ 实名认证 → 已绑定 WCA 时预填姓名（优先中文，可修改）并填写大陆居民身份证 → 单独同意后加载设备认证脚本并前往阿里云。角色测试或代看会话不可发起。', 'Sign in personally → Account / Account settings (gear) / Identity Verification → review the prefilled WCA name (Chinese name preferred, editable) and enter a Mainland China ID → separately consent before loading the device script and continuing to Alibaba Cloud. Preview and impersonation sessions cannot start verification.'),
        t('服务端绑定账号与当前会话，先占用每日次数，再发起认证；回跳页面不采信结果参数，只查询服务器保存的当前流水。阿里云服务端返回通过后才记录认证成功。', 'The server binds the account and current session, reserves a daily attempt, then starts verification. Return URL parameters are not trusted; the server queries its own attempt and records success only after the provider confirms it.'),
        t('实名状态独立于登录凭据与 WCA 绑定，不修改公开资料；账号合并不转移认证。完整证件号、姓名和原始人脸不在站内留存，认证记录随账号注销级联删除。', 'Identity verification is separate from login credentials and WCA linking and does not change public profile data. Merging does not transfer verification. Full identity numbers, legal names and raw facial data are not stored by CubeRoot; verification records cascade on account deletion.'),
      ]} />
      <p>{t('发起失败会刷新当前状态；进行中、1 分钟重试间隔、每账号滚动 24 小时 50 次限额和服务授权异常分别提示，服务端只记录安全错误码与请求编号。', 'Failed starts refresh the current status. Pending attempts, the one-minute retry interval, the 50-attempt per-account rolling 24-hour limit and service permission failures have separate messages. Server diagnostics contain only safe error codes and request IDs.')}</p>
      <p>{t('结果明确未通过后结束本次认证；未完成仍可查询。切换设备后须回原会话查询，或主动结束原认证再重试；结束操作只作用于本人指定的未完成流水，不退回次数，旧结果不能再写入通过。过期后恢复发起入口。', 'An explicit failure ends the attempt; unfinished results remain queryable. After changing devices, check in the original session or end the old attempt before retrying. Ending affects only the owner’s selected unfinished attempt, does not restore quota, and prevents late results from granting verification. Expiry restores the start form.')}</p>
      <AppLink href="/account/verify" prefetch={false}>{t('前往实名认证', 'Open identity verification')}</AppLink>
    </section>
    <section id="mcp" className="auth-map-section">
      <h2>{t('ChatGPT 只读授权', 'ChatGPT read-only authorization')}</h2>
      <Steps items={[
        t('ChatGPT 发起 OAuth → 校验客户端、回调地址、资源与 S256 PKCE → CubeRoot 管理员登录并明确同意或拒绝；角色测试会话不能授权。', 'ChatGPT starts OAuth → validate client, callback, resource and S256 PKCE → a CubeRoot administrator signs in and explicitly approves or declines; role-preview sessions cannot authorize.'),
        t('同意后签发 5 分钟单次授权码 → 核对 PKCE 后换取 10 分钟访问令牌和轮换刷新令牌；授权最多 30 天。数据库只存凭据摘要。', 'Approval issues a single-use code valid for 5 minutes → PKCE verification exchanges it for a 10-minute access token and rotating refresh token; the grant lasts at most 30 days. Only credential hashes are stored.'),
        t('每次调用重查原账号管理员权限，只提供汇总和数值诊断。账号合并或降权后失效；注销通过外键级联删除授权。', 'Every call rechecks the original account’s administrator access and exposes only aggregates and numeric diagnostics. Merging or demotion invalidates access; account deletion cascades to grants.'),
        t('网站退出不等于撤销 ChatGPT：在账号的只读连接页撤销授权后，访问及刷新令牌立即失效。', 'Website sign-out does not revoke ChatGPT: revoke the grant on the account connection page to invalidate access and refresh tokens immediately.'),
      ]} />
      <p>{t('连接页和协议实现属于源码证据；部署成功与 ChatGPT 真人连接须另外验收。', 'The connection page and protocol implementation are source evidence; deployment and a real ChatGPT connection require separate acceptance.')}</p>
      <AppLink href="/account/mcp" prefetch={false}>{t('管理我的连接', 'Manage my connections')}</AppLink>
    </section>
    <footer className="auth-map-footer">
      <AppLink href="/dev/api" prefetch={false}>{t('API 目录', 'API reference')}</AppLink>
      <AppLink href="/dev/schema" prefetch={false}>{t('账号数据结构', 'Account schema')}</AppLink>
      <span>{t('此页只解释流程，不执行登录、绑定、合并或注销。实现事实源：AuthPanel、account_auth、account_merge、account_delete、InstalledAuthClient 与小程序 auth；发布状态以路线图为准。', 'Documentation only: no sign-in, linking, merging, or deletion. Source: AuthPanel, account_auth, account_merge, account_delete, InstalledAuthClient, and Mini Program auth. Release evidence remains in the roadmap.')}</span>
      <span>{t('维护约定：修改账号流程时同步更新此图。源码指纹守卫会检查是否完成文档复核；纯重构须记录流程不变的原因。通过检查不等于已部署或真机验收。', 'Maintenance: update this diagram when account flows change. A source-fingerprint guard requires documentation review; refactors must explain why flows remain unchanged. Passing does not prove deployment or device acceptance.')}</span>
    </footer>
  </main>;
}
