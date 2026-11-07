import PageBackLink from '@/components/PageBackLink';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Download, ExternalLink } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import JsonLd, { PUBLISHER } from '@/components/JsonLd';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { T } from '@/i18n/tr';
import type { Components } from 'react-markdown';
import RegulationLink from '../_components/RegulationLink';
import '../regulation.css';
import './translation.css';

const TranslationLink: Components['a'] = ({ node: _node, ...props }) => {
  // These unanchored source documents establish translation provenance; clause
  // and other reading references can still resolve to their local counterpart.
  const source = /^https:\/\/www\.worldcubeassociation\.org\/regulations\/(?:translations\/chinese\/)?$/.test(props.href ?? '');
  return <RegulationLink {...props} source={source} />;
};

// The downloadable Markdown is the only authored copy. Server rendering keeps
// the tables readable to crawlers and avoids shipping the full corpus to JS.
export default async function RegulationTranslation() {
  const markdown = await readFile(path.join(process.cwd(), 'public/regulation/wca-translation-reference.md'), 'utf8');
  return (
    <div className="reg-page">
      <div className="reg-wrap">
        <PageBackLink fallback="/regulation" prefetch={false} className="back-home" />
        <nav className="reg-translation-downloads" aria-label="翻译资源 / Translation resources">
          <Link href="/regulation/translation/search" prefetch={false}>
            <T zh="官方译文查询" en="Search official translations" /> →
          </Link>
          <a href="/regulation/wca-translation-reference.md" download>
            <Download size={16} aria-hidden="true" />术语参考 / Terminology (.md)
          </a>
          <a href="/regulation/wca-regulations-bilingual.md" download>
            <Download size={16} aria-hidden="true" />条款对照 / Parallel clauses (.md)
          </a>
          <a href="https://translate.worldcubeassociation.org/projects/wca/-/zh_Hans/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />WCA 官方翻译 / WCA translations
          </a>
        </nav>
        <article className="reg-translation-reference">{renderArticleMarkdown(markdown, { linkComponent: TranslationLink })}</article>
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'WCA 英中翻译参考 / WCA English–Chinese Translation Reference',
          inLanguage: ['en', 'zh-Hans'],
          author: PUBLISHER,
          publisher: PUBLISHER,
          isBasedOn: 'https://www.worldcubeassociation.org/regulations/',
        }} />
      </div>
    </div>
  );
}
