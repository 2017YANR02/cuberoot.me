'use client';
/**
 * /wca/comp/[slug] — competition detail page (STUB).
 *
 * The full Vite SPA implementation is 1835 lines and pulls in:
 *   - useLiveStream + useWcaLiveStream (WebSocket subscriptions, server + WCA Live)
 *   - wca_pb (personal records prefetch)
 *   - Heavy round / event tab UI with PR badge inference
 *   - Source switcher (cubing / wca / wca_live / wca_db)
 *
 * Until the live-stream hooks + PR infrastructure are ported into client-next
 * we link out to the source pages.
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import HeaderToggles from '@/components/HeaderToggles';
import { wcaIdToCubingSlug } from '@/lib/wca-results-api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../comp.css';

export default function CompDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = (Array.isArray(params?.slug) ? params.slug[0] : params?.slug) ?? '';
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle(slug, slug);

  const cubingSlug = wcaIdToCubingSlug(slug);
  const wcaUrl = `https://www.worldcubeassociation.org/competitions/${encodeURIComponent(slug)}`;
  const cubingUrl = `https://cubing.com/competition/${encodeURIComponent(cubingSlug)}`;

  return (
    <div className="comp-index-page">
      <HeaderToggles className="comp-top-bar" />

      <Link href="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>

      <h1 className="comp-page-title">{slug}</h1>

      <div style={{ padding: '24px 0', color: 'var(--muted-foreground)' }}>
        <p style={{ marginBottom: 16 }}>
          {isZh
            ? '完整比赛详情页（实时直播 / WCA Live WS / cubing.com 抓取 / PR 标记）尚未在 Next.js 版本中实现。'
            : 'Full live competition detail page (WCA Live WS / cubing.com scraping / PR badges) is not yet implemented in the Next.js port.'}
        </p>
        <p style={{ marginBottom: 12 }}>{isZh ? '可前往原始来源：' : 'Please use the upstream sources:'}</p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>
            <a href={wcaUrl} target="_blank" rel="noopener noreferrer" className="comp-hint-link">
              WCA <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a href={cubingUrl} target="_blank" rel="noopener noreferrer" className="comp-hint-link">
              cubing.com <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a href={`https://cuberoot.me/wca/comp/${encodeURIComponent(slug)}`} className="comp-hint-link">
              {isZh ? '当前 Vite 版本' : 'Current Vite version'} <ExternalLink size={12} />
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
