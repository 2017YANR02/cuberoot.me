import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ChevronLeft, Download } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import JsonLd, { PUBLISHER } from '@/components/JsonLd';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import '../regulation.css';
import './translation.css';

// The downloadable Markdown is the only authored copy. Server rendering keeps
// the tables readable to crawlers and avoids shipping the full corpus to JS.
export default async function RegulationTranslation() {
  const markdown = await readFile(path.join(process.cwd(), 'public/regulation/wca-translation-reference.md'), 'utf8');
  return (
    <div className="reg-page">
      <div className="reg-wrap">
        <Link href="/regulation" prefetch={false} className="back-home" aria-label="返回规则首页 / Back to regulations">
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <nav className="reg-translation-downloads" aria-label="Markdown 下载 / Markdown downloads">
          <a href="/regulation/wca-translation-reference.md" download>
            <Download size={16} aria-hidden="true" />术语参考 / Terminology (.md)
          </a>
          <a href="/regulation/wca-regulations-bilingual.md" download>
            <Download size={16} aria-hidden="true" />条款对照 / Parallel clauses (.md)
          </a>
        </nav>
        <article className="reg-translation-reference">{renderArticleMarkdown(markdown)}</article>
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
