'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ArchNav from '../_components/ArchNav';
import { MobilePipelineSVG } from '../_components/ArchSvgs';
import { DECISIONS, DETAILS } from '../_lib/arch-data';
import '../architecture.css';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

export default function ArchDecisionsPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  useDocumentTitle('技术决策', 'Technical Decisions');

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-subhero">
          <div className="arch-subhero-num">
            <L zh="架构 · 技术决策" en="Architecture · Decisions" />
          </div>
          <h1 className="arch-subhero-title">
            <L zh="为什么是这些选型" en="Why these picks" />
          </h1>
          <p className="arch-subhero-lede">
            <L
              zh={<>每个技术选型都有 alternatives。这里列出选了什么、没选什么、以及为什么 — 还有几个值得了解的工程细节。</>}
              en={<>Every tech pick has alternatives. Here's what was chosen, what wasn't, and why — plus a few engineering details worth knowing.</>}
            />
          </p>
        </header>

        {/* 07 Decisions table */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">07</span>
            <h2 className="arch-sec-title"><L zh="选型一览" en="Decision table" /></h2>
          </div>
          <table className="arch-tbl arch-tbl-decisions">
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '20%' }} />
              <col />
            </colgroup>
            <thead><tr>
              <th><L zh="主题" en="Topic" /></th>
              <th><L zh="选" en="Picked" /></th>
              <th><L zh="没选" en="Not picked" /></th>
              <th><L zh="为什么" en="Why" /></th>
            </tr></thead>
            <tbody>
              {DECISIONS.map((d) => (
                <tr key={d.topic}>
                  <td className="arch-tbl-topic">{d.topic}</td>
                  <td className="arch-tbl-pick">{d.pick}</td>
                  <td className="arch-tbl-alt">{d.alt}</td>
                  <td>{tr(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 08 Engineering details */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">08</span>
            <h2 className="arch-sec-title"><L zh="几个工程细节" en="Engineering details worth knowing" /></h2>
          </div>
          <div className="arch-details">
            {DETAILS.map((d) => (
              <article key={d.title} className="arch-detail">
                <h3 className="arch-detail-title">{d.title}</h3>
                <p className="arch-detail-body">{tr(d)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 10 Mobile */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">10</span>
            <h2 className="arch-sec-title"><L zh="移动端:一份 SPA, 两个 webview 套壳" en="Mobile: one SPA, two webview shells" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>2026-05 接 <strong>Capacitor 8</strong>, 把同一份 <code>dist/</code> 套进 iOS WKWebView 和 Android WebView, 装到自己手机, 不上架 App Store / Play Store。CI 双 runner 并行: ubuntu 编 APK (gradle ~3.5min), macOS 编 IPA (xcodebuild ~3min), push 到 main 改了 client/shared/visualcube 即自动触发。iOS 用 Sideloadly + 免费 Apple ID 走 7 天签 (不付 $99/yr), Android 直装无期限。</>}
              en={<>2026-05 wrapped the SPA with <strong>Capacitor 8</strong> — same <code>dist/</code> hosted inside iOS WKWebView + Android WebView, side-loaded to personal devices, not published to either store. CI runs two runners in parallel: ubuntu builds APK via gradle (~3.5min), macOS builds IPA via xcodebuild (~3min), auto-triggered on push to main when client/shared/visualcube change. iOS uses Sideloadly + free Apple ID for 7-day signing (no $99/yr), Android installs directly with no expiry.</>}
            />
          </p>
          <div className="arch-diagram">
            <MobilePipelineSVG />
          </div>
          <p className="arch-sec-lede" style={{ marginTop: 28 }}>
            <L
              zh={<>但 app 不是把网站重新跑一遍那么轻松 — webview origin 不是 <code>cuberoot.me</code> 而是 <code>capacitor://localhost</code> (iOS) / <code>https://localhost</code> (Android), CORS / 路由 / 静态资源 / OAuth 每一项都要兜底。下表是 web 和 app 在运行时的实际差异:</>}
              en={<>But the app isn't just "the site, again, inside a webview" — its origin is <code>capacitor://localhost</code> (iOS) / <code>https://localhost</code> (Android), not <code>cuberoot.me</code>. CORS, routing, static assets, and OAuth each need their own fallback. Here's how web and app actually differ at runtime:</>}
            />
          </p>
          <div className="arch-table-wrap">
            <table className="arch-table">
              <thead>
                <tr>
                  <th><L zh="维度" en="Aspect" /></th>
                  <th><L zh="Web" en="Web" /></th>
                  <th><L zh="App" en="App" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><L zh="origin" en="origin" /></td>
                  <td><code>https://cuberoot.me</code></td>
                  <td><code>capacitor://localhost</code> / <code>https://localhost</code></td>
                </tr>
                <tr>
                  <td><L zh="API 调用" en="API calls" /></td>
                  <td><L zh="fetch api.cuberoot.me, CORS 白名单 3 项" en="fetch api.cuberoot.me, 3-entry CORS allowlist" /></td>
                  <td><L zh="加 capacitor + localhost 两 origin · CapacitorHttp 绕过 webview CORS" en="add capacitor + localhost origins · CapacitorHttp bypasses webview CORS" /></td>
                </tr>
                <tr>
                  <td><L zh="/stats/* /tools/*" en="/stats/* /tools/*" /></td>
                  <td><L zh="nginx 静态服务" en="served by nginx" /></td>
                  <td><L zh="不打进 APK (17MB 太重), fetch wrapper 改写到 cuberoot.me 拉" en="not bundled (17MB too heavy); fetch wrapper rewrites to cuberoot.me" /></td>
                </tr>
                <tr>
                  <td><L zh="back 按钮" en="back button" /></td>
                  <td><L zh="浏览器 ◁ 走 history.back" en="browser ◁ uses history.back" /></td>
                  <td><L zh="@capacitor/app 拦 backButton → React Router navigate(-1) (webView.canGoBack 不认 pushState)" en="@capacitor/app intercepts backButton → React Router navigate(-1) (webView.canGoBack ignores pushState)" /></td>
                </tr>
                <tr>
                  <td><L zh="WCA OAuth" en="WCA OAuth" /></td>
                  <td><L zh="redirect_uri = https://cuberoot.me/auth/callback" en="redirect_uri = https://cuberoot.me/auth/callback" /></td>
                  <td><L zh="custom scheme deep link me.cuberoot.app://auth-callback · @capacitor/browser 开 + appUrlOpen 回收 token" en="custom-scheme deep link me.cuberoot.app://auth-callback · @capacitor/browser opens + appUrlOpen catches token" /></td>
                </tr>
                <tr>
                  <td><L zh="更新方式" en="update path" /></td>
                  <td><L zh="nginx 部署即生效" en="nginx deploy = instant" /></td>
                  <td><L zh="push → CI build → 手动重装 (artifact 留 14d)" en="push → CI build → manual reinstall (artifact retained 14d)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="arch-sec-lede" style={{ marginTop: 24 }}>
            <L
              zh={<>装机步骤 + 已知 webview 限制 (cstimer iframe / SAB / WebCodecs) 见 <a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/packages/client/MOBILE.md" target="_blank" rel="noreferrer"><code>core/packages/client/MOBILE.md</code></a>。</>}
              en={<>Install steps + known webview limitations (cstimer iframe / SAB / WebCodecs) live in <a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/packages/client/MOBILE.md" target="_blank" rel="noreferrer"><code>core/packages/client/MOBILE.md</code></a>.</>}
            />
          </p>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/code/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/code/architecture/flow"><L zh="请求流程" en="Flow" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/code/architecture/history"><L zh="历程" en="History" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
