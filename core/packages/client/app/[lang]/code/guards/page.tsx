'use client';

// /code/guards — 汇总散落仓库各处的「写入即拦」PreToolUse hook + CI 棘轮测试。
// 自包含静态内容,跟 /code 系其他页独立设计(art-directed dark,guard-red 主题)。
// 数据在 ./_guards.ts(与 tests/code-guards-drift.test.ts 共享,改这页先改那份数据)。

import Link from '@/components/AppLink';
import { ShieldAlert, Hand, FlaskConical, Terminal, GitCompare } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './guards.css';
import { tr, useLang } from '@/i18n/tr';
import { PAIRED_GUARDS, CI_GUARDS_UI, CI_GUARDS_DRIFT, CI_GUARDS_API, PROCESS_GUARDS } from './_guards';

export default function GuardsPage() {
  const lang = useLang();

  useDocumentTitle('约束守卫', 'Guards');

  const ciTotal = CI_GUARDS_UI.length + CI_GUARDS_DRIFT.length + CI_GUARDS_API.length;

  return (
    <div className="gd-page">
      <div className="gd-bg" aria-hidden="true" />
      <div className="gd-bg-glow" aria-hidden="true" />

      <div className="gd-shell">
        <div className="gd-topbar">
          <Link href="/code" className="gd-back">← /code</Link>
        </div>

        <header className="gd-hero">
          <div className="gd-hero-tag">// {tr({ zh: '立约束分层', en: 'layered constraints' })} · PreToolUse + CI</div>
          <h1 className="gd-hero-title">
            guards<span className="gd-hero-cursor">_</span>
          </h1>
          <p className="gd-hero-sub">
            {tr({
              zh: '多 AI 并行写这个仓库,反模式靠记忆口头约定挡不住。每条规则先问"最早能卡在哪":能在落盘那一刻拦的写进 PreToolUse hook,拦不住的(跨文件 / 需要全仓上下文)退到 CI 棘轮兜底,两层一起铺,不只做事后那层。',
              en: 'Multiple AIs write to this repo in parallel — verbal conventions don’t hold. Every rule starts with "where’s the earliest gate": what can be caught the instant it’s written goes into a PreToolUse hook; what can’t (cross-file, needs whole-repo context) falls back to a CI ratchet. Both layers stack — never just the after-the-fact one.',
            })}
          </p>
          <div className="gd-hero-stats">
            <div className="gd-stat"><span className="gd-stat-num">{PAIRED_GUARDS.length}</span><span className="gd-stat-label">{tr({ zh: '对双层守卫', en: 'paired guards' })}</span></div>
            <div className="gd-stat"><span className="gd-stat-num">{ciTotal}</span><span className="gd-stat-label">{tr({ zh: '条纯 CI 棘轮', en: 'CI-only ratchets' })}</span></div>
            <div className="gd-stat"><span className="gd-stat-num">{PROCESS_GUARDS.length}</span><span className="gd-stat-label">{tr({ zh: '条进程级守卫', en: 'process-level guards' })}</span></div>
          </div>
        </header>

        {/* 01 — paired guards */}
        <section className="gd-section">
          <header className="gd-sec-head">
            <span className="gd-sec-num">01</span>
            <h2 className="gd-sec-title">{tr({ zh: '双层守卫', en: 'Paired guards' })}</h2>
            <p className="gd-sec-desc">
              {tr({
                zh: '能从单文件文本里机械判定的反模式:写入即拦(matcher Edit|Write|MultiEdit)挡在最前,CI 棘轮兜逃逸的存量。BASELINE 只许降不许升,改 baseline 本身就是一种 review 信号。',
                en: 'Anti-patterns that are mechanically detectable from a single file’s text: a write-time hook (matcher Edit|Write|MultiEdit) blocks first, a CI ratchet catches what slips through against the remaining baseline. BASELINE only ever goes down — lowering it is itself a review signal.',
              })}
            </p>
          </header>
          <div className="gd-pair-list">
            {PAIRED_GUARDS.map((g) => {
              const t = g[lang];
              return (
                <div className="gd-pair-card" key={g.id}>
                  <div className="gd-pair-head">
                    <Hand size={15} strokeWidth={2} />
                    <h3 className="gd-pair-title">{t.title}</h3>
                    <span className="gd-pair-baseline">{g.baseline}</span>
                  </div>
                  <p className="gd-pair-desc">{t.desc}</p>
                  <div className="gd-pair-files">
                    <span className="gd-pair-file is-hook"><code>{g.hook}</code></span>
                    <span className="gd-pair-file is-test"><code>{g.test}</code></span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 02 — CI-only ratchets */}
        <section className="gd-section">
          <header className="gd-sec-head">
            <span className="gd-sec-num">02</span>
            <h2 className="gd-sec-title">{tr({ zh: '纯 CI 棘轮', en: 'CI-only ratchets' })}</h2>
            <p className="gd-sec-desc">
              {tr({
                zh: '判定需要跨文件对账(漂移检测)或整段 CSS 选择器解析,写入态单文件 hook 做不到,只挂 CI。',
                en: 'Detection needs cross-file reconciliation (drift checks) or full CSS-selector parsing — beyond what a single-file write-time hook can do, so these run in CI only.',
              })}
            </p>
          </header>

          <h3 className="gd-ci-group-title">{tr({ zh: 'UI 模式一致性', en: 'UI pattern consistency' })}</h3>
          <div className="gd-ci-list">
            {CI_GUARDS_UI.map((g) => {
              const t = g[lang];
              return (
                <div className="gd-ci-card" key={g.id}>
                  <div className="gd-ci-head">
                    <FlaskConical size={14} strokeWidth={2} />
                    <h4 className="gd-ci-title">{t.title}</h4>
                  </div>
                  <p className="gd-ci-desc">{t.desc}</p>
                  <code className="gd-ci-file">{g.test}</code>
                </div>
              );
            })}
          </div>

          <h3 className="gd-ci-group-title">{tr({ zh: '引用页对账(漂移守卫)', en: 'Reference page reconciliation (drift guards)' })}</h3>
          <p className="gd-ci-group-note">
            {tr({
              zh: '/code 下好几页是手工镜像真实源码状态的快照(这页本身也是一个)—— 这组测试逐条重新对比,源码改了快照忘同步就直接红。',
              en: 'Several /code pages are hand-maintained mirrors of real source state (this page is one too) — these tests re-diff every claim and turn red the moment the source moves but the snapshot doesn’t.',
            })}
          </p>
          <div className="gd-ci-list">
            {CI_GUARDS_DRIFT.map((g) => {
              const t = g[lang];
              return (
                <div className="gd-ci-card" key={g.id}>
                  <div className="gd-ci-head">
                    <GitCompare size={14} strokeWidth={2} />
                    <h4 className="gd-ci-title">{t.title}</h4>
                  </div>
                  <p className="gd-ci-desc">{t.desc}</p>
                  <code className="gd-ci-file">{g.test}</code>
                </div>
              );
            })}
          </div>

          <h3 className="gd-ci-group-title">{tr({ zh: 'API 契约', en: 'API contracts' })}</h3>
          <div className="gd-ci-list">
            {CI_GUARDS_API.map((g) => {
              const t = g[lang];
              return (
                <div className="gd-ci-card" key={g.id}>
                  <div className="gd-ci-head">
                    <FlaskConical size={14} strokeWidth={2} />
                    <h4 className="gd-ci-title">{t.title}</h4>
                  </div>
                  <p className="gd-ci-desc">{t.desc}</p>
                  <code className="gd-ci-file">{g.test}</code>
                </div>
              );
            })}
          </div>

          <p className="gd-ci-aside">
            {tr({
              zh: '死代码(knip,文件 / 依赖 / 幽灵命令)走独立的三层守卫,详见 ',
              en: 'Dead code (knip — files / deps / phantom binaries) has its own three-layer guard, see ',
            })}
            <Link href="/code/dead-code">/code/dead-code</Link>。
          </p>
        </section>

        {/* 03 — process-level guards */}
        <section className="gd-section">
          <header className="gd-sec-head">
            <span className="gd-sec-num">03</span>
            <h2 className="gd-sec-title">{tr({ zh: '进程级守卫', en: 'Process-level guards' })}</h2>
            <p className="gd-sec-desc">
              {tr({
                zh: '管的不是 commit 进仓库的源码模式,而是 Agent 工具调用本身的行为(起浏览器 / 跑 build / 写文件位置)。CI 不跑 Agent,这层没有对应的 CI 兜底。',
                en: 'These don’t gate the source pattern landing in a commit — they gate the agent’s tool calls themselves (launching a browser, running a build, where a file lands). CI doesn’t run an agent, so this layer has no CI counterpart.',
              })}
            </p>
          </header>
          <div className="gd-proc-list">
            {PROCESS_GUARDS.map((g) => {
              const t = g[lang];
              return (
                <div className="gd-proc-card" key={g.id}>
                  <Terminal size={15} strokeWidth={2} className="gd-proc-icon" />
                  <div className="gd-proc-body">
                    <div className="gd-proc-head">
                      <h3 className="gd-proc-title">{t.title}</h3>
                      <span className="gd-proc-matcher">{g.matcher}</span>
                    </div>
                    <p className="gd-proc-desc">{t.desc}</p>
                    <code className="gd-proc-file">{g.hook}</code>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="gd-foot">
          <span className="gd-foot-text">
            <ShieldAlert size={13} strokeWidth={2} />
            {tr({ zh: '问"最早能卡在哪",写入即拦 + CI 兜底一起铺', en: 'ask "earliest gate" — write-time block + CI backstop, stacked' })}
          </span>
          <Link href="/code" className="gd-foot-link">/code</Link>
        </footer>
      </div>
    </div>
  );
}
