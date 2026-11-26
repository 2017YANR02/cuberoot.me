import { ArrowLeft, ChevronDown, Code2, Download } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import JsonLd, { SITE_URL } from '@/components/JsonLd';
import type { CubingPaper } from '../paper';
import s from './full-cycle-commutators/reader.module.css';

const labels = {
  en: { back: 'Cubing Lean', contents: 'Contents', demo: 'Interactive cube reduction', pdf: 'Download PDF', source: 'Source (ZIP)' },
  zh: { back: 'Cubing Lean', contents: '论文目录', demo: '试着缩小魔方', pdf: '下载 PDF', source: '下载源码（ZIP）' },
};

type Manuscript = { sections: { id: string; title: string }[]; html: string };
export default function PaperReader({ lang, paper, manuscript }: { lang: string; paper: CubingPaper; manuscript: Manuscript }) {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  const github = revision && /^[a-f0-9]{40}$/i.test(revision)
    ? 'https://github.com/2017YANR02/cuberoot.me/raw/' + revision + '/core/packages/client/public' + paper.source
    : undefined;
  const l = labels[lang === 'zh' ? 'zh' : 'en'];
  return <main className={s.reader}>
    <JsonLd data={{
      '@context': 'https://schema.org', '@type': 'ScholarlyArticle',
      headline: paper.title, author: { '@type': 'Person', name: paper.author },
      inLanguage: 'en', encoding: { '@type': 'MediaObject', encodingFormat: 'application/pdf', contentUrl: SITE_URL + paper.pdf },
      url: SITE_URL + paper.href,
    }} />
    <div className={s.bar}>
      <AppLink href={'/math/cubing-lean#' + paper.topic}><ArrowLeft size={16}/>{l.back}</AppLink>
      <div className={s.actions}>
        {paper.topic === 'short-solutions' && <AppLink href="/math/cubing-lean/short-solutions">{l.demo}</AppLink>}
        <a href={paper.pdf} download><Download size={16}/>{l.pdf}</a>
        <a href={paper.source} download><Code2 size={16}/>{l.source}</a>
        {github && <a href={github}><Download size={16}/>{lang === 'zh' ? '从 GitHub 下载' : 'Download from GitHub'}</a>}
        <HeaderToggles />
      </div>
    </div>
    <details className={s.contents}>
      <summary>{l.contents}<ChevronDown size={15}/></summary>
      <nav aria-label={l.contents} lang="en">{manuscript.sections.map(section =>
        <a key={section.id} href={'#' + section.id}>{section.title}</a>)}</nav>
    </details>
    <article lang="en" className={s.text} dangerouslySetInnerHTML={{ __html: manuscript.html }} />
  </main>;
}
