'use client';

/* auth-doc-review
{"fingerprint":"a191734684a3962c97ebde566e6583bbf4118b5c3e70d0e2098d4a582bc5532f","reason":"2026-10-03 问答结果展示复核：对照 SiteAssistantDialog、LandingSearch 和 site_assistant 路由，比赛正文改为摘要、表格行链接替代重复导航、国家图标加载仅读取公开比赛索引。登录及未绑定 WCA 的账号页入口、verifySession/requireAuth、实时资格和额度检查、账号变化清空与中止对话、草稿内存和会话凭据传递均未修改。因此保留现有登录、绑定、回跳、退出、注销流程节点，并补充中英文展示边界说明。 2026-10-02 发布复核：已对照 LandingSearch、SiteAssistantDialog 和 site_assistant 路由；新增页面 action、相对时间与浏览器时区只改变公开资料查询，旧 API 参数拒绝重试保留认证头并发生在额度前；verifySession、requireAuth、实时 WCA 绑定、封禁、账号变化清空及中止对话保持原规则。因此登录与账号生命周期图不变，补充中英文边界说明。 2026-10-02 复核登录回调语言初始化：/auth/miniprogram 浏览器首次初始化改为中文，与现有中文服务端 layout 一致；普通 /auth 仍为英文，/zh 路由仍为中文。只修复首屏语言，不改变票据消费、会话、Cookie、回跳或账号生命周期。补充中英文说明并将 i18n-client 纳入源码守卫；SSR 模拟与初次 hydration 按路由语言验证，待本轮部署、真机未验收。 2026-09-29 验证码反馈复核：后端区分输入错误及剩余次数、2 分钟过期、3 次错误耗尽、网络或浏览器变化和记录失效；前端失效后要求换图，保留旧 API 的兼容提示。过期记录只保留额外 2 分钟用于说明原因且仍受 5000 条上限保护，不能再次验证成功。验证码流程已同步中英文节点，Origin、限流、一次性消费、Cookie 和账号权限边界不变。 2026-09-29 Apple IAP 本地接入复核：host 对请求来源和当前 UID 双重校验；长期凭据与 JWS 不跨 iframe。StoreKit appAccountToken 绑定既有账号，已确认合并在原事务迁移全部旧令牌，恢复不能转绑；注销置空归属并提示先到 Apple 取消续费。App 头像暂不提供 Clawd，保留原资料。购买与账号生命周期文案已同步；未部署、未完成 Apple 沙盒验收。 复核好友表情包的账号生命周期：上传和收藏复用现有登录身份及账号锁，登录、绑定和会话流程不变；新增账号外键仍由 linked_data 阻止不支持的合并。注销在原有续费、机构与 Apple 撤销检查之后删除收藏并清理无引用图片，别人持有的副本保留且清空上传者归属。注销流程节点和中英文保留清单已同步；仅本地实现，未部署。 本次 index.ts 只新增公开站内问答路由的导入和挂载；已对比发布前后的入口，登录路由及 rolePreviewGuard 顺序未变。当时问答不读取账号凭据、不签发会话，仅用服务端模型密钥读取公开页面；指定用户只读查看仍拦截此 POST。账号生命周期各流程不变，因此保留现有流程图。 2026-09-28 本地问答回源复核：Next 页面访问门禁新增验证既有 service 目的凭证，绑定完整路径及查询串且最多 60 秒；不签发浏览器 Cookie 或账号会话，不替代私有内容授权。新增中英文访问流程说明，浏览器验证码、Origin/Cookie、国家豁免和第三方登录回调保持原策略；将 competition-gate 与 competition-access 纳入本守卫。未部署。 2026-09-28 后续需求改为 AI 仅登录且绑定 WCA 可用：先用 verifySession 要求有效 CubeRoot 会话，再复用 requireAuth 并实时重读 app_users；缺失、伪造或过期会话不进入旧 WCA token 回退，禁止用旧 JWT、缓存 WCA token 或请求 viewerWcaId 恢复已解绑资格；保留封禁、合并、注销与只读会话限制。前端带现有认证头、展示登录/绑定入口，账号变化清空对话；资格校验在额度和模型前，纳入 28 秒总预算。同步中英文流程节点及 API 文档，将路由和两个入口组件纳入守卫。普通搜索及其他页面验证码不变；仅本地未部署。 2026-09-28 日历备份：复用 GIS 加入显式只读日历授权，校验授予范围，令牌仅页面内存并在取消/关闭后清除；普通登录仍只请求 openid email profile，不新增绑定或会话。导入经预览确认后复用现有个人日历 API。新增中英文备份授权流程，并把入口组件纳入源码守卫；仅本地实现，真实授权来源尚待配置验收。补充复核备份解析的时区与颜色预检：读取既有 bootstrap 能力标记，旧服务器拒绝精确颜色时在任何导入写入前停止；不增加授权范围、绑定或账号操作。旧版默认配色新增原值保留提示，授权和令牌边界不变。 2026-09-28 日历备份：复用 GIS 单独请求并校验 calendar.readonly，令牌只在页面内存，取消/关闭/导出成功后清除，普通登录仍只请求 openid email profile，不新增绑定或会话。中英文流程说明浏览器直读 Google、下载备份及确认后调用原有个人日历 API；精确颜色先检查后端能力，避免静默丢色。源码守卫显式读取日历授权入口，补充实际收集测试；本地授权来源已配置，真实授权与导出验收仍待完成，未部署。 2026-09-29 CI 复核：私人会议预约在既有注销前置检查及 Apple 撤销成功后随事务删除，无账号信息的会议码保留以防旧邀请复用；注销节点同步。日历组件仅缩小 CSS 选择器，GIS 授权边界不变。AI 登录与绑定 WCA 门禁已在生产验证，匿名请求不扣额度；同步该部署状态。验证码页面增加真实封禁说明，比赛代理在缺少服务签名密钥时只转发已有浏览器凭证和绑定 UA，由 API 继续验签；无凭证先本地拒绝，避免自动请求误封出口，不签发新身份或绕过验证。 2026-09-29 问答流式 UI 复核：Accept 协商 SSE 仅发生在原有有效会话、实时 WCA 绑定检查及额度预留之后；原登录/绑定入口、账号变化清空与中止对话保持不变。流连接断开会中止查询，并发名额到连接结束才释放；引用仅指向已读取的公开来源，不发出服务凭证或新增账号授权，因此账号生命周期节点保持原样。本轮发布状态另记问答跟踪表。 2026-09-29 问答交互复核：新增复制、编辑上一问、重新生成、草稿保留、全屏与正文 Markdown。编辑和重生成仍调用同一 askAssistant，通过现有登录和 WCA 门禁；替换的旧回答不进入本次模型上下文，停止后的未完成文本只保留展示。草稿仅组件内存，账号变化与新对话清空；关闭保留草稿但中止请求。登录、绑定、会话、回跳和账号生命周期均不变，保留现有流程节点。 2026-09-29 main 合并复核：远端唯一变化的账号守卫文件为 app-ui/App.tsx；新增计时器声音、节拍器、训练、显示、打乱朝向、快捷键、成绩导出和设置重置。高级设置中的 auth.login、账号管理/注销网址、logoutEverywhere 及原生身份桥接未变；重置只调用 timer repository.updateSettings，不读取或删除账号会话凭据。故登录、绑定、回跳、退出、注销节点保持原样，合并保留本地问答交互复核记录。 2026-09-29 Apple 权益迁移复核：0254 与快照中的 effective_memberships 改用显式 14 列，修复线上 vip_number 物理列序不同导致的 UNION 类型错误；账号 token 外键、合并迁移、注销置空归属、恢复购买的账号校验及最长有效期规则未变，故保留已有流程节点。生产 0254 已应用、API 健康检查通过；购买开关关闭，真实 Sandbox 验收仍未完成。 2026-09-29 外接计时器桥接复核：新原生页沿用 getStoredSessionSnapshot 与 openRequiredSessionLogin，登录后恢复连接页，成功后切回 timer tab；设备 session.ts 仅管理随机中继令牌、BLE/PCM 与生命周期，不签发或传播账号凭据，不改注册、绑定、合并、注销。已将原生页纳入精确守卫，并同步中英文入口流程及麦克风独立授权边界；源码实现尚未部署和真机验收。 2026-09-29 Google Play 合规入口复核：页面网关仅精确放行隐私政策和账号根页面（含中英文路径，账号查询参数同样放行），子路径与 API 仍按原规则保护；账号页公开可达不等于登录，不授予会话、会员或私有数据权限。已同步中英文验证码边界，登录、绑定、合并和注销行为不变。 2026-09-29 远端主线整合复核：保留 Apple 月卡/年卡自动续费、购买归属、账号合并和注销规则以及全部既有登录入口；新增 iOS APNs 复用 Android 的登录后设备控制器，系统通知授权后绑定当前账号，退出或换号先停本机接收并撤销绑定，离线仅保留撤销凭据；开发/生产由设备目标隔离。已同步中英文授权、退出节点及 Swift 守卫。页面门禁在既有 privacy/account 精确放行基础上补 contact，不放行子路径或 API，不签发账号身份。APNs 仅本地源码整合，尚未部署或完成真实签名与送达验收。 2026-09-29 微信浏览器误判修复复核：账号页仅异步确认会员入口所属容器，普通 MicroMessenger 浏览器不再等同小程序；会员与订单共用 SDK getEnv 确认，等待期间隐藏购买入口。原登录、注册、WCA 绑定、回跳、退出通知、会话与注销实现未改，故保留账号生命周期节点并补充中英文平台说明。本轮本地验证与发布状态另行确认。 2026-10-01 发布复核：纳管源码唯一变化为 LandingSearch 删除 ClearButton 导入与清空搜索输入的按钮；已核对 askAssistant、登录及实时 WCA 绑定门禁、账号变化清空/中止对话和会话凭据传递均未改变。搜索清空控件不签发身份或修改账号，所以保留现有登录、绑定、回跳、退出和注销流程图及中英文说明。 2026-10-01 本机验证码豁免复核：仅 development 且实际 Host 为 localhost、127.0.0.1 或 [::1]、未由外部 forwarded Host 访问时跳过站点流量验证；即使本机加载签名密钥也适用。生产和公开开发域名继续按原门禁处理，不新增账号、管理员或私人内容权限。手动验证码代理以实际 Host 校验 Origin，修复 Next 内部 localhost 与浏览器 127.0.0.1 不一致；跨来源拒绝及生产 Cookie 策略保留。中英文访问流程已同步，未部署。 本地数据访问继续复核：仅实际 loopback development 的 /v1/competition-access/check 使用服务端密钥签发 host-only、HttpOnly、Secure 的流量凭证；无密钥返回 503，公网开发入口及 production 只转发既有验证，不自动签发凭证。密钥仅配置于本机 ignored .env.local，不进入浏览器或 Git；同源验证码代理和本地检查路由一并纳入指纹守卫。API 原有验签、账号登录与私有内容授权不变。"}
*/

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
        <article><h3>{t('抖音小程序', 'Douyin Mini Program')}</h3><p>{t('已绑定抖音身份时直接登录；新用户可明确创建账号。已有 CubeRoot 账号时，在网站账号页生成醒目的 6 位登录码，回小程序输入并确认同一个账号。', 'Linked Douyin identities sign in directly; new users may explicitly create an account. If you already have a CubeRoot account, generate the prominent 6-digit sign-in code on the website account page, then enter and confirm it in the Mini Program.')}</p><AppLink href="#douyin-mini-current" prefetch={false}>{t('看抖音登录流程 ↓', 'Douyin sign-in flow ↓')}</AppLink></article>
      </div>
      <details className="auth-map-current"><summary>{t('其他平台：鸿蒙、Windows、macOS', 'Other platforms: HarmonyOS, Windows, macOS')}</summary>
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
      <h2>{t('公开页面与账号操作', 'Public pages and account actions')}</h2>
      <p className="auth-map-note">{t('问答的时区参数与页面跳转只影响公开资料查询，不改变登录、WCA 绑定或账号权限。旧接口拒绝时区字段时，前端只在参数校验失败后移除该字段重试一次，保留原认证头；参数拒绝发生在资格和额度检查之前。账号变化仍清空并中止对话。', 'Assistant time zones and page links affect public-data queries only, without changing sign-in, WCA linking or account permissions. If an older API rejects the time-zone field during input validation, the client removes only that field and retries once with the same authentication headers. Input rejection precedes eligibility and quota checks. Account changes still clear and abort the conversation.')}</p>
      <p className="auth-map-note">{t('问答结果的比赛表格、国家图标及去重链接只改变公开数据的展示；国家图标读取公开比赛索引，不新增授权或会话。登录、实时 WCA 绑定和提问额度仍按同一流程校验。', 'Competition tables, country flags and deduplicated links change only the presentation of public assistant results. Flags read public competition indexes without additional authorization or sessions. Sign-in, current WCA linking and question quotas follow the same checks.')}</p>
      <Steps items={[
        t('通过适用的访问验证 → 打开公开页面，不查询首页卡片锁状态或管理员角色', 'Pass any required access verification → open public content without checking homepage card locks or administrator roles'),
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

    <section id="signin" className="auth-map-section" aria-labelledby="signin-title">
      <div className="auth-map-section-heading"><h2 id="signin-title">{t('登录与注册：网站和 App 共用', 'Sign-in and registration: shared by website and App')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现 · 可用入口以服务端配置为准', 'Implemented in source · availability depends on server configuration')}</span></div>
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
            t('授权成功 → 服务端识别这一个第三方身份', 'Authorization succeeds → server identifies this provider identity'),
          ]} /><div className="auth-map-phone-results">
            <div><p className="auth-map-branch-label">{t('已绑定', 'Already linked')}</p><Arrow /><FlowNode outcome>{t('直接登录原账号，不重复提问', 'Sign in to the existing account without asking again')}</FlowNode></div>
            <div><p className="auth-map-branch-label">{t('尚未绑定', 'Not linked')}</p><Arrow /><FlowNode>{t('你有 CubeRoot 账号吗？', 'Do you have a CubeRoot account?')}<small>{t('有：登录旧号 → 核对账号 → 确认绑定。没有：明确选择创建新账号。', 'Yes: authenticate the old account → check it → confirm linking. No: explicitly choose to create an account.')}</small></FlowNode></div>
          </div></section>
        </div>
        <figcaption>{t('拒绝授权、取消、过期或网络错误 → 提示并允许重试，不自动变成注册。不按相同邮箱或昵称认定两个身份属于同一个人。', 'Declined authorization, cancellation, expiry, or network failure → explain and allow retry, never silently register. Matching email addresses or nicknames do not establish identity.')}</figcaption>
      </figure>
      <section id="app-handoff" aria-labelledby="handoff-title"><h3 id="handoff-title">{t('iOS / 安卓：登录后怎样回到 App？', 'iOS / Android: how do you return after sign-in?')}</h3>
        <figure className="auth-map-figure" aria-labelledby="handoff-title"><Steps items={[
          t('App「我的」显示网站唯一账号页 → 点击登录', 'The App My account tab shows the canonical website account page → tap sign in'),
          t('打开系统浏览器 → 完成上方同一登录 / 已有账号选择流程', 'Open the system browser → complete the same sign-in / existing-account choice above'),
          t('单次短期票据 + 回跳校验（PKCE / state）→ App 换取并安全保存会话', 'One-time short-lived ticket + handoff validation (PKCE / state) → App exchanges and securely stores the session'),
          t('再用一次性网页票据恢复「我的」页登录态 → 显示同一个账号', 'A separate one-time web ticket restores sign-in in My account → show the same account'),
          t('iOS 纪录推送已配置时 → 请求系统通知权限 → 将 APNs 设备绑定到当前账号；拒绝不影响登录，开发与生产推送环境隔离', 'When iOS record push is configured → request system notification permission → bind the APNs device to this account; declining does not affect sign-in, and sandbox and production are isolated'),
          t('Android 纪录推送已配置时 → 单独征求 SDK 隐私同意和系统通知权限 → 绑定当前账号与设备；拒绝不影响登录', 'When Android record push is configured → separately request SDK privacy consent and notification permission → bind this account and device; declining does not affect sign-in'),
        ]} /><p className="auth-map-note">{t('iOS 推送通道已接入源码；APNs 凭据、签名和真机送达仍需单独验证。', 'The iOS push channel is wired in source; APNs credentials, signing, and device delivery still require separate verification.')}</p><figcaption>{t('浏览器、App 安全存储、内嵌账号页是三个会话容器，不是三个账号。回跳失败时回 App 重试，不重复注册；长期登录凭据不放进网址。', 'The browser, App secure storage, and embedded account page are three session containers, not three accounts. Retry a failed handoff without registering again; long-lived credentials never enter URLs.')}</figcaption></figure>
      </section>
      <p className="auth-map-note">{t('登录成功 ≠ 计时记录已云同步。App 的计时记录、备注和设置仍在本机；账号合并也不自动收集各台设备的本地记录。', 'Successful sign-in does not mean timer data is cloud-synced. App solves, notes, and settings remain local; account merging does not gather local records from every device.')}</p>
    </section>

    <section id="mini" className="auth-map-section" aria-labelledby="mini-current-title">
      <div className="auth-map-section-heading"><h2 id="mini-current-title">{t('微信 / 抖音小程序：当前流程', 'WeChat / Douyin Mini Programs: current flows')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现，尚未部署发布', 'Implemented in source, not deployed or released')}</span></div>
      <h3 id="douyin-mini-current">{t('抖音小程序', 'Douyin Mini Program')}</h3>
      <figure className="auth-map-figure" aria-labelledby="douyin-mini-current"><Steps items={[
        t('我的 → 抖音登录；公开浏览和普通计时不要求登录', 'Me → Douyin sign-in; public browsing and ordinary timing do not require sign-in'),
        t('服务端验证抖音身份；旧小程序 OpenID 仍升级为 UnionID。同主体网站应用与小程序还各自查询 AlliedID，匹配同一账号后补齐跨应用登录入口；标识冲突时停止，不自动合并账号', 'The server verifies Douyin identity and still upgrades legacy Mini Program OpenID to UnionID. The same-owner website app and Mini Program each request AlliedID; a match adds cross-app sign-in to the same account. Conflicting identities stop the flow rather than merging accounts'),
        t('已绑定 → 直接进入原账号；未绑定 → 选择登录已有账号或明确创建新账号', 'Already linked → enter the existing account; not linked → choose to sign in to an existing account or explicitly create one'),
        t('登录已有账号 → 在网站登录原账号，账号页顶部生成 6 位数字登录码 → 回小程序输入并核对账号 → 完成绑定', 'Existing account → sign in to it on the website, generate a 6-digit numeric sign-in code at the top of the account page → enter it in the Mini Program and verify the account → finish linking'),
      ]} /><figcaption>{t('登录码 10 分钟内有效且只能使用一次，不包含账号编号。登录码不是合并码，不会迁移两个账号的数据。网站「抖音登录」使用独立的网站应用凭据。历史小程序绑定要在新版服务端重新登录小程序一次，才能记录跨应用标识；此能力还取决于抖音是否将两个应用认证为同一主体并开放相应接口。抖音授权页提供电脑二维码或支持环境中的抖音 App 授权。', 'The sign-in code is valid for 10 minutes, works once, and contains no account number. The sign-in code is not a merge code and does not migrate data between accounts. Website Douyin sign-in uses separate website-app credentials. A previously linked Mini Program identity must sign in once on the updated server to record the cross-app ID; this also depends on Douyin recognizing both apps as the same certified owner and providing the related-ID API. The Douyin authorization page offers a desktop QR code or Douyin App authorization in supported environments.')}</figcaption></figure>
      <p className="auth-map-note">{t('外接计时器：网页入口 → 原生连接页检查已有会话 → 未登录时复用“我的”登录并恢复设备连接页 → 用户启动蓝牙或麦克风 → 连接后切回计时页。桥接令牌只关联本次设备会话，不签发账号身份；麦克风权限不属于账号登录授权。本地源码已接入，尚未部署或完成真机验收。', 'External timers: web entry → native setup checks the existing session → signed-out users go through Me and return to setup → the user starts Bluetooth or microphone input → return to the timer tab after connection. The relay token identifies only this device session and does not issue an account identity; microphone permission is separate from sign-in. Implemented locally, not deployed or verified on real devices.')}</p>
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

    <section id="merge" className="auth-map-section" aria-labelledby="merge-title">
      <div className="auth-map-section-heading"><h2 id="merge-title">{t('合并账号：把已有的 B 并入 A', 'Merge accounts: move existing B into A')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现 · 有限制 · 不可撤销', 'Implemented in source · restricted · irreversible')}</span></div>
      <p className="auth-map-note">{t('适合确实已经有两个账号的人，不是每次登录都要做。入口仍在统一账号页的「登录方式 → 合并账号」。', 'For someone who already has two accounts, not a step on every sign-in. Open Sign-in methods → Merge accounts on the canonical account page.')}</p>
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
          t('表情包收藏随账号删除；无其他会话或收藏引用的上传图片同时删除，别人已持有的副本解除上传者归属后保留', 'Sticker favorites are deleted with the account. Uploaded images without other message or favorite references are deleted; copies held by others remain without uploader attribution'),
          t('成功 → 删除站内账号与对应私有数据、推送设备绑定和队列、解除登录方式；失败 → 展示原因，不宣称已注销', 'Success → delete the site account, covered private data, push device bindings and queues, and sign-in methods. Failure → show the reason, never claim deletion succeeded'),
        ]} /><figcaption>{t('源码已实现立即注销、无恢复期。App 与小程序复用网站入口，不另造删除表单；各端真实注销与会话清理仍须分别验收。', 'Source implements immediate deletion with no grace period. App and Mini Program reuse the website entry, not separate deletion forms; real deletion and session cleanup require per-platform testing.')}</figcaption></figure></section>
      </div>
      <aside className="auth-map-boundaries"><h3>{t('注销前一定要知道', 'Before deleting')}</h3><ul>
        <li>{t('好友聊天：任一参与账号注销时，整段会话和双方相关提醒一起删除。解除好友或拉黑只停止新消息，保留已有历史；聊天记录、表情包上传和收藏仍按现有 linked_data 规则阻止不受支持的账号合并。', 'Friend chat: deleting either participant removes the entire conversation and both inbox reminders. Unfriending or blocking stops new messages but retains history. Chat history, sticker uploads and favorites follow the existing linked_data rule for unsupported account merges.')}</li>
        <li>{t('有待生效或生效中的自动续费合约：先取消并确认终止。是机构最后一位负责人：先转移归属。不是点注销就自动解约或退钱。', 'Pending or active renewal contract: cancel and confirm termination first. Last organization owner: transfer ownership first. Deletion is not automatic contract cancellation or a refund.')}</li>
        <li>{t('私有数据按清单删除，包括私人宠物领养与养成记录；公开讨论和公开复盘匿名保留，交易及必要业务审计记录保留。WCA 官方公开成绩不因 CubeRoot 注销消失。', 'Covered private data, including private pet adoptions and care records, is deleted; public discussions and public reconstructions are anonymized. Transactions and required business audit records remain. Official public WCA results do not disappear when a CubeRoot account is deleted.')}</li>
        <li>{t('Apple 自动续费必须到系统订阅中取消；注销 CubeRoot 不会取消续费。注销后账号令牌归属置空，保留交易对账证据，旧收据不能恢复到新账号。', 'Cancel Apple auto-renewal in system subscriptions; deleting CubeRoot does not cancel it. Deletion clears token ownership and retains financial evidence; old receipts cannot restore to a new account.')}</li>
        <li>{t('不能声称远程清空所有手机。App 本地记录、导出备份和其他设备副本需要另外管理；注销的是 CubeRoot 账号，不是 Apple、Google 或微信账号。', 'This does not remotely wipe every phone. Manage local App records, exported backups, and other device copies separately. You delete CubeRoot, not your Apple, Google, or WeChat account.')}</li>
      </ul></aside>
    </section>

    <details className="auth-map-current">
      <summary>{t('还需要补什么？', 'What remains to be done?')}</summary>
      <p>{t('微信手机号实时授权已本地接入，仍须后端和网站部署、新版小程序上传、后台能力及隐私声明核验，以及授权成功/拒绝/旧号绑定的真机验收。Apple IAP 已有本地接线，商店配置、沙盒及正式环境验收仍未完成；各平台真人登录回跳、绑定、合并、退出和注销矩阵须分别验收。不能把这张说明图当成功能完成清单。', 'WeChat real-time phone authorization is locally integrated. Backend and website deployment, a new Mini Program upload, platform capability and privacy checks, and real-device authorization/decline/existing-account linking acceptance are still required. Apple IAP has local wiring; store configuration, sandbox and production acceptance are incomplete. Real-account handoff, linking, merging, sign-out and deletion need per-platform acceptance. This diagram is not a completion checklist.')}</p>
    </details>

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
