'use client';
// /wca/persons/[wcaId] — WCA person detail page (client shell).
// Hero + PR table + 5 tabs (results / comps / events / milestones / cities).
// Ported from packages/client/src/pages/wca_stats/persons/PersonDetailPage.tsx.
//
// The wcaId space is unbounded so this route ships as ONE prerendered static
// shell (see page.tsx) reused for every id via a next.config rewrite. The real
// id therefore can't come from useParams (the rendered route is the sentinel);
// read it from the browser URL client-side instead.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  fetchWcaPerson, fetchWcaPersonResults, fetchWcaPersonCompetitions,
  type WcaPersonProfile, type WcaResultRow, type WcaCompetition,
} from '@/lib/wca-person-api';
import { loadFlagData } from '@/lib/country-flags';
import { listRecons } from '@/lib/recon-api';
import { buildReconAttemptMap } from '@/lib/recon-attempt-lookup';
import PersonHero from '@/components/persons/sections/PersonHero';
import PersonPRTable from '@/components/persons/sections/PersonPRTable';
import PersonTabs from '@/components/persons/sections/PersonTabs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/components/persons/persons.css';

export default function PersonDetailClient() {
  const [wcaId, setWcaId] = useState('');
  useEffect(() => {
    // URL is /<lang>/wca/persons/<wcaId>; the rendered route is the sentinel,
    // so derive the real id from the actual browser path.
    const m = window.location.pathname.match(/\/persons\/([^/?#]+)/);
    setWcaId(m ? decodeURIComponent(m[1]) : '');
  }, []);
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [profile, setProfile] = useState<WcaPersonProfile | null>(null);
  const [results, setResults] = useState<WcaResultRow[] | null>(null);
  const [comps, setComps] = useState<WcaCompetition[] | null>(null);
  const [reconLookup, setReconLookup] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wcaId) return; // wait until the id is resolved from the URL
    setProfile(null); setResults(null); setComps(null); setError(null);
    let cancelled = false;
    loadFlagData().catch(() => { /* fallback to en */ });
    fetchWcaPerson(wcaId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    fetchWcaPersonResults(wcaId)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { /* keep degraded UI */ });
    fetchWcaPersonCompetitions(wcaId)
      .then((c) => { if (!cancelled) setComps(c); })
      .catch(() => { /* keep degraded UI */ });
    listRecons(wcaId)
      .then((all) => { if (!cancelled) setReconLookup(buildReconAttemptMap(all)); })
      .catch(() => { /* keep degraded UI */ });
    return () => { cancelled = true; };
  }, [wcaId]);

  const personName = profile?.person?.name ?? '';
  useDocumentTitle(personName ? `${personName} · WCA` : '', personName ? `${personName} · WCA` : '');

  if (error) {
    return (
      <div className="wp-page">
        <PageHeader t={t} />
        <main className="wp-main">
          <div className="wp-error">{t('加载失败', 'Failed to load')}: {error}</div>
        </main>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="wp-page">
        <PageHeader t={t} />
        <main className="wp-main">
          <div className="wp-loading">{t('加载中…', 'Loading…')}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="wp-page">
      <PageHeader t={t} wcaId={profile.person.wca_id} />
      <main className="wp-main">
        <PersonHero profile={profile} results={results} isZh={isZh} />
        <PersonPRTable profile={profile} results={results} isZh={isZh} />
        <PersonTabs profile={profile} results={results} comps={comps} reconLookup={reconLookup} isZh={isZh} />
      </main>
    </div>
  );
}

function PageHeader({ t, wcaId }: { t: (zh: string, en: string) => string; wcaId?: string }) {
  return (
    <header className="wp-header">
      <Link href="/wca/persons" className="wp-back">
        <ChevronLeft size={16} />
        <span>{t('选手搜索', 'Search')}</span>
      </Link>
      <div className="wp-header-right">
        {wcaId && (
          <a
            href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
            target="_blank" rel="noopener noreferrer"
            className="wp-source-link"
          >WCA</a>
        )}
      </div>
    </header>
  );
}
