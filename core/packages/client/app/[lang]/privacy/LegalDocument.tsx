import { createElement, type ReactNode } from 'react';
import { TERMS_SECTIONS, PRIVACY_INTRO, PRIVACY_SECTIONS, type PrivacyNode } from '@cuberoot/shared/privacy';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import './privacy.css';

export default function LegalDocument({ kind, lang }: { kind: 'terms' | 'privacy'; lang: 'en' | 'zh' }) {
  const meta = PAGE_META[kind];
  const terms = kind === 'terms';
  const sections = terms ? TERMS_SECTIONS : PRIVACY_SECTIONS;
  const related = terms ? 'privacy' : 'terms';
  function render(node: PrivacyNode, key: number): ReactNode {
    if ('zh' in node) return node[lang];
    return createElement(node.tag, { key, id: node.id, href: node.href, target: node.target, rel: node.rel },
      node.children.map(render));
  }
  return <main className="privacy-page">
    <JsonLd data={articleJsonLd({ headline: meta.title[lang], description: meta.description![lang],
      url: SITE_URL + (lang === 'zh' ? '/zh/' : '/') + kind, lang })} />
    <BackHome />
    <header>
      <h1>{PAGE_META[kind].title[lang]}</h1>
      <div className="legal-meta"><time dateTime="2026-11-23">{lang === 'zh' ? '更新于 2026 年 11 月 23 日' : 'Updated November 23, 2026'}</time>
        <AppLink href={'/' + related}>{PAGE_META[related].title[lang]}</AppLink>
      </div>
    </header>
    <div className="legal-layout">
      <nav aria-labelledby="legal-contents">
        <h2 id="legal-contents">{lang === 'zh' ? '本页目录' : 'Contents'}</h2>
        <ol>{sections.map(node => 'tag' in node && node.tag === 'h2' &&
          <li key={node.id}><a href={'#' + node.id}>{node.children.map(render)}</a></li>)}</ol>
      </nav>
      <article>{!terms && render(PRIVACY_INTRO, -1)}{sections.map(render)}</article>
    </div>
  </main>;
}
