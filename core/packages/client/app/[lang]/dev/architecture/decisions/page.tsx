'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import ArchNav from '../_components/ArchNav';
import { DECISIONS, DETAILS } from '../_lib/arch-data';
import '../architecture.css';
import { tr } from '@/i18n/tr';

export default function ArchDecisionsPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-subhero">
          <div className="arch-subhero-num">
            <L zh="架构 / 技术决策" en="Architecture / Decisions" />
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

        {/* 10 Installed clients */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">10</span>
            <h2 className="arch-sec-title"><L zh="已安装客户端:一份产品层，三个薄宿主" en="Installed clients: one product layer, three thin hosts" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>Android、iOS、HarmonyOS NEXT、Windows 和 macOS 共用 <code>core/packages/app-ui</code> 产品层。各宿主只负责启动、打包和系统能力适配，不复制业务界面。</>}
              en={<>Android, iOS, HarmonyOS NEXT, Windows, and macOS share the <code>core/packages/app-ui</code> product layer. Each host only handles startup, packaging, and system capability adapters instead of copying product UI.</>}
            />
          </p>
          <div className="arch-table-wrap">
            <table className="arch-table">
              <thead>
                <tr>
                  <th><L zh="层" en="Layer" /></th>
                  <th><L zh="平台" en="Platforms" /></th>
                  <th><L zh="职责" en="Responsibility" /></th>
                  <th><L zh="源码" en="Source" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><L zh="共享产品层" en="Shared product layer" /></td>
                  <td><L zh="全部已安装客户端" en="All installed clients" /></td>
                  <td><L zh="React 界面、业务流程、运行时中性能力调用" en="React UI, product flows, and runtime-neutral capability calls" /></td>
                  <td><code>core/packages/app-ui</code></td>
                </tr>
                <tr>
                  <td><L zh="移动宿主" en="Mobile host" /></td>
                  <td>Android / iOS</td>
                  <td><L zh="移动系统桥接、构建和签名" en="Mobile system bridges, builds, and signing" /></td>
                  <td><code>core/apps/mobile</code></td>
                </tr>
                <tr>
                  <td><L zh="桌面宿主" en="Desktop host" /></td>
                  <td>Windows / macOS</td>
                  <td><L zh="桌面窗口、安装包和系统桥接" en="Desktop windows, installers, and system bridges" /></td>
                  <td><code>core/apps/desktop</code></td>
                </tr>
                <tr>
                  <td><L zh="鸿蒙宿主" en="Harmony host" /></td>
                  <td>HarmonyOS NEXT</td>
                  <td><L zh="ArkTS、ArkWeb 和系统能力桥接" en="ArkTS, ArkWeb, and system capability bridges" /></td>
                  <td><code>core/apps/harmony</code></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="arch-sec-lede" style={{ marginTop: 24 }}>
            <L
              zh={<>平台能力、构建状态和发布证据见 <a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/docs/mobile-app-roadmap.md" target="_blank" rel="noreferrer"><code>core/docs/mobile-app-roadmap.md</code></a>。</>}
              en={<>Platform capabilities, build status, and release evidence live in <a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/docs/mobile-app-roadmap.md" target="_blank" rel="noreferrer"><code>core/docs/mobile-app-roadmap.md</code></a>.</>}
            />
          </p>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/dev/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/flow"><L zh="请求流程" en="Flow" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/history"><L zh="历程" en="History" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
