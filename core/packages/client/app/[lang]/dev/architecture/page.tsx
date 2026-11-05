'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../_lib/Lang';
import type { Lang } from '../_lib/Lang';
import ArchitectureAtlas from './_components/ArchitectureAtlas';
import ArchitectureDecisions from './_components/ArchitectureDecisions';
import ArchNav from './_components/ArchNav';
import CodeLanguageHistory from './_components/code-history/CodeLanguageHistory';
import './architecture.css';

export default function ArchitecturePage() {
  const { i18n } = useTranslation();
  const lang: Lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-hero">
          <h1 className="arch-hero-title"><L zh="CubeRoot 架构" en="CubeRoot Architecture" /></h1>
        </header>

        <section className="arch-sec arch-sec--wide">
          <div className="arch-sec-head">
            <span className="arch-sec-num">01</span>
            <h2 className="arch-sec-title"><L zh="从入口到数据" en="From entry to data" /></h2>
          </div>
          <ArchitectureAtlas lang={lang} />
        </section>

        <section className="arch-sec arch-sec--wide" id="decisions">
          <div className="arch-sec-head">
            <span className="arch-sec-num">02</span>
            <h2 className="arch-sec-title"><L zh="技术决策" en="Technical decisions" /></h2>
          </div>
          <ArchitectureDecisions />
        </section>

        <section className="arch-sec arch-sec--wide" id="code-history">
          <div className="arch-sec-head">
            <span className="arch-sec-num">03</span>
            <h2 className="arch-sec-title"><L zh="代码语言历史" en="Code language history" /></h2>
          </div>
          <CodeLanguageHistory />
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <a href="https://github.com/RuiminYan/cuberoot.me" target="_blank" rel="noreferrer"><L zh="源码" en="Source" /></a>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/flow"><L zh="请求流程" en="Request flow" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/infrastructure"><L zh="基础设施" en="Infrastructure" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
