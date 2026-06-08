'use client';

// Ported from packages/client/src/pages/wca_stats/SuccessRatePage.tsx.
import { Suspense, useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';

const EVENTS = [
  '333bf','444bf','555bf','333mbf','333fm','333',
  '222','444','555','666','777','333oh',
  'minx','pyram','clock','skewb','sq1',
];
const EVENTS_SET = new Set(EVENTS);
const MIN_OPTIONS = [3, 5, 12, 50, 100, 200, 500];
const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  solved: number; attempted: number; percentage: number;
}

function SuccessRatePageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('完成率', 'Success Rate');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const event = params.get('event') ?? '333bf';
  const country = params.get('country') ?? '';
  const minAttempted = parseInt(params.get('minAttempted') ?? '3', 10);
  const page = parseInt(params.get('page') ?? '1', 10);
  const size = parseInt(params.get('size') ?? '100', 10);

  const update = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v); else next.delete(k);
    if (resetPage) next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  useEffect(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('event', event);
    qs.set('minAttempted', String(minAttempted));
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    fetch(apiUrl(`/v1/wca/success-rate?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [event, country, minAttempted, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}</Link>
        </div>
        <h1 className="wse-title-row">
          {isZh ? '项目成功率' : 'Event Success Rate'}
          <Link
            href="/wca/about/success-rate"
            className="wse-title-help"
            title={isZh ? '这页是干啥的?' : 'What is this page?'}
            aria-label={isZh ? '查看说明' : 'About this page'}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{isZh ? '每位选手在该项目中成功完成的轮次占比(主要看盲拧 / FMC 等失败率高的项目)' : 'Per-cuber success rate per event (most relevant for BLD / FMC)'}</p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => update('event', v)}
        isZh={isZh}
      />

      <div className="wse-filters">
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{isZh ? '最小尝试数' : 'Min attempts'}</label>
          <select value={minAttempted} onChange={e => update('minAttempted', e.target.value)}>
            {MIN_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th className="wse-value-col">{isZh ? '成功率' : 'Rate'}</th>
                  <th className="wse-value-col">{isZh ? '复原' : 'Solved'}</th>
                  <th className="wse-value-col">{isZh ? '尝试' : 'Attempts'}</th>
                  <th>{isZh ? '国家' : 'Country'}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                    <td>
                      <Link prefetch={false} href={`/${isZh ? 'zh' : 'en'}/wca/persons/${r.wcaId}`}>{displayCuberName(r.name, isZh)}</Link>
                    </td>
                    <td className="wse-value-col">{r.percentage.toFixed(2)}%</td>
                    <td className="wse-value-col">{r.solved}</td>
                    <td className="wse-value-col">{r.attempted}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <span>{r.countryId}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.total > size && (
              <Paginator
                page={page}
                totalPages={totalPages}
                size={size}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                isZh={isZh}
                onPageChange={(p) => update('page', String(p), false)}
                onSizeChange={(s) => update('size', String(s))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SuccessRatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <SuccessRatePageInner />
    </Suspense>
  );
}
