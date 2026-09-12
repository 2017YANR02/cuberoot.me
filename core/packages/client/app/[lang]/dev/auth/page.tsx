'use client';

/* auth-doc-review
{"fingerprint":"54b1b696806a743e42680b3214fd0093f46350c6dce91bf5bcbd705a75fd0f4f","reason":"复核未知身份先选择旧号或明确创建、独立抖音绑定码、账号合并确认及退出注销边界；微信手机号授权仍是方案，真实跨平台授权与发布仍待验收。本次只增加防陈旧守卫，不改变账号行为。"}
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
      <p className="auth-map-note">{t('源码核对：2026-09-11。「源码已实现」不等于所有平台真人测试或商店发布完成；「目标方案」尚未接入。此页不执行账号操作。', 'Source reviewed: 2026-09-11. Implemented in source does not mean real-account testing or store release is complete on every platform. Proposals are not implemented. This page performs no account actions.')}</p>
      <nav className="auth-map-nav" aria-label={t('账号流程目录', 'Account flow contents')}>
        <AppLink href="#platforms" prefetch={false}>{t('平台入口', 'Platforms')}</AppLink>
        <AppLink href="#signin" prefetch={false}>{t('登录 / 注册', 'Sign in / register')}</AppLink>
        <AppLink href="#mini" prefetch={false}>{t('微信小程序', 'WeChat Mini Program')}</AppLink>
        <AppLink href="#linking" prefetch={false}>{t('绑定 / 解绑', 'Link / unlink')}</AppLink>
        <AppLink href="#merge" prefetch={false}>{t('合并账号', 'Merge accounts')}</AppLink>
        <AppLink href="#exit" prefetch={false}>{t('退出 / 注销', 'Sign out / delete')}</AppLink>
      </nav>
    </header>

    <section id="platforms" className="auth-map-section" aria-labelledby="platform-title">
      <h2 id="platform-title">{t('从哪里进入？账号不按平台分家', 'Where do you start? Platforms do not create separate account systems')}</h2>
      <div className="auth-map-platforms">
        <article><h3>{t('网站 / PWA', 'Website / PWA')}</h3><p>{t('打开「我的」→ 在网站登录。账号管理也在同一页。', 'Open My account → sign in on the website. Account management uses that same page.')}</p><AppLink href="#signin" prefetch={false}>{t('看网站登录流程 ↓', 'Website sign-in flow ↓')}</AppLink></article>
        <article><h3>iOS App</h3><p>{t('我的 → 系统浏览器完成网站登录 → 回到 App。凭据存入 Keychain；不是另建 Apple 账号。', 'My account → website sign-in in the system browser → return to the App. The session uses Keychain, not a separate Apple-only account.')}</p><AppLink href="#app-handoff" prefetch={false}>{t('看 App 回跳流程 ↓', 'App handoff flow ↓')}</AppLink></article>
        <article><h3>Android App</h3><p>{t('与 iOS 复用同一登录流程；由 Android 深链接回，凭据使用 Keystore 保护的存储。', 'Shares the iOS sign-in flow. An Android deep link returns to the App; session storage is protected by Keystore.')}</p><AppLink href="#app-handoff" prefetch={false}>{t('看 App 回跳流程 ↓', 'App handoff flow ↓')}</AppLink></article>
        <article><h3>{t('微信小程序', 'WeChat Mini Program')}</h3><p>{t('当前：微信身份登录；账号管理打开网站。手机号首次授权是下方单独标出的目标方案。', 'Today: WeChat identity sign-in; account management opens the website. First-time phone authorization is a separate proposal below.')}</p><AppLink href="#mini" prefetch={false}>{t('看当前与目标流程 ↓', 'Current and proposed flows ↓')}</AppLink></article>
      </div>
      <details className="auth-map-current"><summary>{t('其他平台：鸿蒙、Windows、macOS、抖音小程序', 'Other platforms: HarmonyOS, Windows, macOS, Douyin Mini Program')}</summary>
        <p>{t('HarmonyOS NEXT、Windows、macOS 共用 App 产品层和网站账号流程，只替换系统浏览器、深链与安全存储适配；每个平台的真实回跳仍须单独验收。', 'HarmonyOS NEXT, Windows, and macOS share the App product layer and website account flow, with platform browser, deep-link, and secure-storage adapters. Each platform still needs its own real handoff tests.')}</p>
        <p>{t('抖音小程序：已绑定身份直接登录；未知身份先选择绑定旧号或明确创建。绑定旧号时，先在网站原账号的登录方式页生成短期「绑定码」，回小程序输入并核对目标账号，再确认绑定。绑定码不是合并码，不会搬迁两个账号的数据。此增量须部署并发布新版小程序后才生效。', 'Douyin Mini Program: linked identities sign in directly; unknown identities choose existing-account linking or explicit creation. Generate a short-lived link code in the existing website account’s sign-in settings, enter it in the Mini Program, check the target account, and confirm. A link code is not a merge code and does not migrate two accounts. This change requires deployment and a new Mini Program release.')}</p>
      </details>
    </section>

    <section id="signin" className="auth-map-section" aria-labelledby="signin-title">
      <div className="auth-map-section-heading"><h2 id="signin-title">{t('登录与注册：网站和 App 共用', 'Sign-in and registration: shared by website and App')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现 · 可用入口以服务端配置为准', 'Implemented in source · availability depends on server configuration')}</span></div>
      <figure className="auth-map-figure" aria-labelledby="signin-title">
        <div className="auth-map-current-paths">
          <section><h3>{t('邮箱 / 手机号 / 密码', 'Email / phone / password')}</h3><Steps items={[
            t('选择邮箱或手机号，使用验证码；已设密码也可用密码登录', 'Choose email or phone and verify a code; an existing password is another sign-in option'),
            t('验证通过 → 已有凭据直接进入原账号；陌生凭据先问是否已有账号，不自动注册', 'Verification succeeds → existing credentials sign in directly; unknown credentials ask whether you have an account, without automatic registration'),
            t('有旧号：验证原账号并确认绑定；没有：明确选择创建新账号', 'Existing account: authenticate and confirm linking. No account: explicitly choose to create one'),
          ]} /><p className="auth-map-note">{t('忘记密码时才走：验证原账号已绑定的邮箱或手机 → 设置新密码。不是每次登录都要重设。', 'Only if you forgot your password: verify the linked email or phone → set a new password. This is not required on every sign-in.')}</p><p className="auth-map-note">{t('密码登录不创建账号。「绑定已有账号」中的验证只认旧号，不会用陌生邮箱、手机号悄悄注册。', 'Password sign-in does not create accounts. Verification inside existing-account linking accepts existing accounts only; an unknown email or phone does not silently register.')}</p></section>
          <section><h3>{t('第三方登录', 'Provider sign-in')}</h3><Steps items={[
            t('Google / Apple / 微信 / QQ / 支付宝 / WCA', 'Google / Apple / WeChat / QQ / Alipay / WCA'),
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
        ]} /><figcaption>{t('浏览器、App 安全存储、内嵌账号页是三个会话容器，不是三个账号。回跳失败时回 App 重试，不重复注册；长期登录凭据不放进网址。', 'The browser, App secure storage, and embedded account page are three session containers, not three accounts. Retry a failed handoff without registering again; long-lived credentials never enter URLs.')}</figcaption></figure>
      </section>
      <p className="auth-map-note">{t('登录成功 ≠ 计时记录已云同步。App 的计时记录、备注和设置仍在本机；账号合并也不自动收集各台设备的本地记录。', 'Successful sign-in does not mean timer data is cloud-synced. App solves, notes, and settings remain local; account merging does not gather local records from every device.')}</p>
    </section>

    <section id="mini" className="auth-map-section" aria-labelledby="mini-current-title">
      <div className="auth-map-section-heading"><h2 id="mini-current-title">{t('微信小程序：当前流程', 'WeChat Mini Program: current flow')}</h2><span className="auth-map-status auth-map-implemented">{t('源码已实现', 'Implemented in source')}</span></div>
      <figure className="auth-map-figure" aria-labelledby="mini-current-title"><Steps items={[
        t('我的 → 阅读并同意协议 → 微信登录', 'Me → read and accept the agreements → WeChat sign-in'),
        t('服务端验证微信身份（UnionID）；取不到则停止，不另造 OpenID 账号', 'Server verifies the WeChat identity (UnionID); if unavailable, stop rather than create an OpenID account'),
        t('已绑定 → 原账号登录；未绑定 → 选择绑定已有账号，或明确创建新账号', 'Already linked → sign in; otherwise → choose existing-account linking or explicitly create an account'),
        t('绑定旧号时打开网站验证并确认 → 回小程序；登录后可打开网站账号管理', 'For existing-account linking, verify and confirm on the website → return to the Mini Program; signed-in users can open website account management'),
      ]} /></figure>
      <p className="auth-map-note">{t('小程序不会自动拿到手机号。下面是计划中的简化入口，不是当前已上线行为。', 'The Mini Program does not automatically receive a phone number. The simplified entry below is a proposal, not the current released behavior.')}</p>
      <div className="auth-map-section-heading">
        <h2 id="mini-flow-title">{t('微信小程序：目标流程', 'WeChat Mini Program: proposed flow')}</h2>
        <span className="auth-map-status">{t('设计方案 · 手机号授权尚未接入', 'Proposal · phone authorization not implemented')}</span>
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
            <FlowNode>{t('用户同意微信手机号授权，服务端验证', 'User authorizes their phone number; the server verifies it')}</FlowNode>
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
            <FlowNode>{t('确认目标账号，再绑定当前微信', 'Confirm the target account, then link this WeChat identity')}</FlowNode>
            <p className="auth-map-note">{t('适合旧号未绑手机号、号码不同，或不使用微信手机号授权的人。', 'For accounts without a phone, a different number, or users who do not use WeChat phone authorization.')}</p>
          </section>
        </div>
        <div className="auth-map-stem auth-map-finish"><Arrow /><FlowNode outcome>{t('登录完成：会员、资料仍在同一个账号', 'Signed in: membership and profile stay on one account')}<small>{t('以后进入小程序，走「已绑定」路径。', 'Future visits follow the already-linked path.')}</small></FlowNode></div>
        <figcaption>{t('三条路径是不同情况，不是每个人都要走三遍。登录和绑定完成后才到达底部结果。', 'These are alternative paths, not three steps everyone must repeat. The final result requires successful sign-in and linking.')}</figcaption>
      </figure>
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
      <p className="auth-map-note">{t('入口：网站「我的 → 齿轮 → 登录方式」；iOS / 安卓显示同一个账号页，小程序从「账号管理」进入网站。', 'Entry: website My account → settings gear → sign-in methods. iOS / Android display the same account page; Mini Program Account management opens the website.')}</p>
      <figure className="auth-map-figure" aria-labelledby="linking-title"><div className="auth-map-current-paths">
        <section><h3>{t('新增登录方式', 'Add a sign-in method')}</h3><Steps items={[
          t('先登录要保留的 CubeRoot 账号', 'Sign in to the CubeRoot account you want to keep'),
          t('选择绑定方式 → 验证新邮箱 / 手机号，或完成第三方授权', 'Choose a method → verify the new email / phone, or authorize the provider'),
          t('归属检查通过 → 新登录方式挂到当前账号，会员不另开一份', 'Ownership checks pass → attach the method to this account, without creating a second membership'),
        ]} /><p className="auth-map-note">{t('该身份已经属于另一个账号？停止绑定；需要合并时走下一节，不能直接抢绑。', 'Identity already belongs to another account? Stop linking. Use the merge flow if appropriate; never take over the link.')}</p></section>
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
          <FlowNode outcome><strong>{t('检查通过 → 一次事务完成', 'Checks pass → one transaction')}</strong><small>{t('受支持的数据和登录方式转入 A，当前会话切到 A；B 不再作为独立账号使用。不能撤销。', 'Supported data and sign-in methods move to A; the current session switches to A. B is retired as a separate account. This cannot be undone.')}</small></FlowNode>
          <FlowNode><strong>{t('检查失败 → 不迁移账号数据', 'Checks fail → no account data is moved')}</strong><small>{t('提示冲突并停止；处理后可能需要在 A 重新生成合并码，不要反复点确认。', 'Explain the conflict and stop. After resolving it, a new code from A may be required; do not repeatedly submit.')}</small></FlowNode>
        </div>
        <figcaption>{t('合并码只能在你自己的两个账号之间使用，不要交给他人。绑定一个新方式 ≠ 合并两个账号。', 'Use the merge code only between your own accounts; do not share it. Linking a new method is not the same as merging two accounts.')}</figcaption>
      </figure>
      <details className="auth-map-current"><summary>{t('哪些情况会被拦住？会员怎么处理？', 'What blocks a merge? What happens to membership?')}</summary>
        <ul className="auth-map-list">
          <li>{t('两个不同的 WCA ID；双方各有邮箱或手机号；双方密码凭据冲突。', 'Different WCA IDs; both accounts have an email or both have a phone; conflicting password credentials.')}</li>
          <li>{t('待并入账号有尚未支持迁移的直接关联数据，例如机构或课程关系；数据库唯一键冲突也会整体回滚。', 'The source account has unsupported directly linked data, such as organization or course relationships; database uniqueness conflicts also roll back the entire merge.')}</li>
          <li>{t('已有会员、订单与续约合约按当前迁移规则处理；冲突会阻止合并，不能承诺两份会员时长自动相加。Apple IAP 尚未接入，不能声称已支持订阅跨账号迁移。', 'Existing memberships, orders, and renewal contracts follow current migration rules. Conflicts block the merge; membership durations are not guaranteed to add together. Apple IAP is not implemented, so subscription transfer is not claimed.')}</li>
          <li>{t('登录其中一个账号不能证明另一个也属于你；合并需要分别登录两边。原账号无法登录时，先找回，不能跳过验证。', 'Access to one account does not prove ownership of the other. Sign in to both; recover an inaccessible account first rather than bypassing verification.')}</li>
        </ul>
      </details>
    </section>

    <section id="exit" className="auth-map-section" aria-labelledby="exit-title">
      <h2 id="exit-title">{t('退出登录 ≠ 注销账号 ≠ 取消续费', 'Sign out ≠ delete account ≠ cancel renewal')}</h2>
      <div className="auth-map-current-paths">
        <section aria-labelledby="logout-title"><h3 id="logout-title">{t('退出登录：下次还能回来', 'Sign out: you can return')}</h3><figure className="auth-map-figure" aria-labelledby="logout-title"><Steps items={[
          t('在当前账号页选择「退出登录」', 'Choose Sign out in the current account page'),
          t('清理当前会话；App 内账号页与宿主通过消息同步退出', 'Clear the current session; the App account page and host coordinate sign-out through the bridge'),
          t('账号、会员和服务端资料仍保留 → 下次用已绑定方式登录', 'Account, membership, and server data remain → sign in again with a linked method'),
        ]} /><figcaption>{t('不等于全设备退出。外部浏览器退出不能主动通知休眠 App；也不会删除本地计时记录或取消续费。', 'Not a global device sign-out. An external browser cannot proactively notify a sleeping App. Signing out does not delete local solves or cancel renewal.')}</figcaption></figure></section>
        <section aria-labelledby="delete-title"><h3 id="delete-title">{t('注销账号：永久删除，不能恢复', 'Delete account: permanent, no recovery')}</h3><figure className="auth-map-figure" aria-labelledby="delete-title"><Steps items={[
          t('我的 → 齿轮 → 登录方式 → 底部「注销账号」', 'My account → settings gear → sign-in methods → Delete account at the bottom'),
          t('阅读删除与保留清单 → 输入页面要求的账号标识；设过密码还须输入当前密码', 'Read what is deleted and retained → type the requested account identifier; enter the current password if one is set'),
          t('主动确认永久注销 → 服务端检查续约合约、机构归属等条件，并撤销已绑定 Apple 授权', 'Explicitly confirm deletion → server checks renewal contracts, organization ownership, and other constraints, and revokes linked Apple authorization'),
          t('成功 → 删除站内账号与对应私有数据、解除登录方式；失败 → 展示原因，不宣称已注销', 'Success → delete the site account and covered private data, remove sign-in methods. Failure → show the reason, never claim deletion succeeded'),
        ]} /><figcaption>{t('源码已实现立即注销、无恢复期。App 与小程序复用网站入口，不另造删除表单；各端真实注销与会话清理仍须分别验收。', 'Source implements immediate deletion with no grace period. App and Mini Program reuse the website entry, not separate deletion forms; real deletion and session cleanup require per-platform testing.')}</figcaption></figure></section>
      </div>
      <aside className="auth-map-boundaries"><h3>{t('注销前一定要知道', 'Before deleting')}</h3><ul>
        <li>{t('有待生效或生效中的自动续费合约：先取消并确认终止。是机构最后一位负责人：先转移归属。不是点注销就自动解约或退钱。', 'Pending or active renewal contract: cancel and confirm termination first. Last organization owner: transfer ownership first. Deletion is not automatic contract cancellation or a refund.')}</li>
        <li>{t('私有数据按清单删除；公开讨论和公开复盘匿名保留，交易及必要业务审计记录保留。WCA 官方公开成绩不因 CubeRoot 注销消失。', 'Covered private data is deleted; public discussions and public reconstructions are anonymized. Transactions and required business audit records remain. Official public WCA results do not disappear when a CubeRoot account is deleted.')}</li>
        <li>{t('不能声称远程清空所有手机。App 本地记录、导出备份和其他设备副本需要另外管理；注销的是 CubeRoot 账号，不是 Apple、Google 或微信账号。', 'This does not remotely wipe every phone. Manage local App records, exported backups, and other device copies separately. You delete CubeRoot, not your Apple, Google, or WeChat account.')}</li>
      </ul></aside>
    </section>

    <details className="auth-map-current">
      <summary>{t('还需要补什么？', 'What remains to be done?')}</summary>
      <p>{t('微信手机号授权目标流程和 Apple IAP 仍待接入。邮箱、手机、抖音的防误注册增量仍须后端部署及相应客户端发布；各平台真人登录回跳、绑定、合并、退出和注销矩阵也须分别验收。不能把这张说明图当成功能完成清单。', 'The WeChat phone proposal and Apple IAP remain unimplemented. Email, phone, and Douyin duplicate-prevention changes still require backend deployment and relevant client releases; real-account handoff, linking, merging, sign-out, and deletion need per-platform acceptance. This diagram is not a completion checklist.')}</p>
    </details>

    <footer className="auth-map-footer">
      <AppLink href="/dev/api" prefetch={false}>{t('API 目录', 'API reference')}</AppLink>
      <AppLink href="/dev/schema" prefetch={false}>{t('账号数据结构', 'Account schema')}</AppLink>
      <span>{t('此页只解释流程，不执行登录、绑定、合并或注销。实现事实源：AuthPanel、account_auth、account_merge、account_delete、InstalledAuthClient 与小程序 auth；发布状态以路线图为准。', 'Documentation only: no sign-in, linking, merging, or deletion. Source: AuthPanel, account_auth, account_merge, account_delete, InstalledAuthClient, and Mini Program auth. Release evidence remains in the roadmap.')}</span>
      <span>{t('维护约定：修改账号流程时同步更新此图。源码指纹守卫会检查是否完成文档复核；纯重构须记录流程不变的原因。通过检查不等于已部署或真机验收。', 'Maintenance: update this diagram when account flows change. A source-fingerprint guard requires documentation review; refactors must explain why flows remain unchanged. Passing does not prove deployment or device acceptance.')}</span>
    </footer>
  </main>;
}
