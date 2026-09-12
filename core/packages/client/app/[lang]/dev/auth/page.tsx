'use client';

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

export default function AuthFlowPage() {
  const t = useT();
  return <main className="auth-map-page">
    <header className="auth-map-header">
      <AppLink href="/dev" prefetch={false}>Dev</AppLink>
      <h1>{t('登录与账号绑定', 'Sign-in and account linking')}</h1>
      <p>{t('手机号用于首次验证，微信用于以后快捷登录；会员和资料始终属于同一个 CubeRoot 账号。', 'Verify a phone number once, then use WeChat for convenient sign-in. Membership and profile belong to one CubeRoot account.')}</p>
    </header>

    <section aria-labelledby="mini-flow-title">
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

    <details className="auth-map-current">
      <summary>{t('对照：当前源码已实现什么？', 'Compare: what is implemented in the current source?')}</summary>
      <p>{t('网站与 App 共用第三方登录流程；小程序目前仍是微信身份登录，没有接入上图的手机号授权。源码具备不代表所有平台真人验收或商店发布完成。', 'Website and App share the provider sign-in flow. The Mini Program still uses WeChat identity sign-in, without the proposed phone authorization. Source implementation does not prove real-account testing or store release.')}</p>
      <div className="auth-map-stem"><FlowNode>{t('Google / Apple / 微信 / QQ / 支付宝 / WCA 授权成功', 'Google / Apple / WeChat / QQ / Alipay / WCA authorization succeeds')}</FlowNode><Arrow /></div>
      <div className="auth-map-current-paths">
        <FlowNode outcome>{t('身份已绑定 → 直接登录', 'Identity already linked → sign in directly')}</FlowNode>
        <FlowNode>{t('未知身份 → 登录已有账号并确认绑定，或明确创建新账号', 'Unknown identity → authenticate and confirm linking to an existing account, or explicitly create an account')}<small>{t('确认之前只保存短期认证尝试，不创建账号。', 'Only a short-lived authentication attempt exists before confirmation; no account is created.')}</small></FlowNode>
      </div>
      <p>{t('小程序现有逻辑：未知微信身份先让用户选择绑定旧号或明确创建；浏览器回小程序确认时，也不会自动同意注册。', 'Current Mini Program: an unknown WeChat identity offers existing-account linking or explicit creation. A browser handoff does not automatically consent to registration.')}</p>
    </details>

    <footer className="auth-map-footer">
      <AppLink href="/dev/api" prefetch={false}>{t('API 目录', 'API reference')}</AppLink>
      <AppLink href="/dev/schema" prefetch={false}>{t('账号数据结构', 'Account schema')}</AppLink>
      <span>{t('此页只解释流程，不执行真实登录或绑定。', 'This page explains the flow; it does not sign in or link accounts.')}</span>
    </footer>
  </main>;
}
