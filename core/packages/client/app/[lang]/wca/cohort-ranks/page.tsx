'use client';

// Ported from packages/client-vite/src/pages/wca_stats/CohortRanksPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import { tr } from '@/i18n/tr';

const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
];
const EVENTS_SET = new Set(EVENTS);
const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  rank: number; wcaId: string; name: string; value: number;
  countryId: string; iso2: string | null;
}

function CohortRanksPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('届别排名', 'Cohort Ranks');
  const [q, setQ] = useQueryStates(
    {
      cohort: parseAsString,
      event: parseAsString,
      type: parseAsString,
      country: parseAsString,
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const currentYear = new Date().getUTCFullYear();
  const cohort = parseInt(q.cohort ?? String(currentYear), 10);
  const event = q.event ?? '333';
  const type = (q.type ?? 'single') as 'single' | 'average';
  const country = q.country ?? '';
  const page = parseInt(q.page ?? '1', 10);
  const size = parseInt(q.size ?? '100', 10);

  const update = (k: string, v: string, resetPage = true) => {
    setQ({ [k]: v || null, ...(resetPage ? { page: null } : {}) } as Parameters<typeof setQ>[0]);
  };

  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();
  const allowAvg = event !== '333mbf';

  useEffect(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('cohort', String(cohort));
    qs.set('event', event);
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    fetch(apiUrl(`/v1/wca/cohort-ranks?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [cohort, event, type, country, page, size]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 1982; y--) ys.push(y);
    return ys;
  }, [currentYear]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}</Link>
        </div>
        <h1 className="wse-title-row">
          {tr({ zh: '参赛届别排名', en: 'Cohort Ranks'
        })}
          <Link
            href="/wca/about/cohort-ranks"
            className="wse-title-help"
            title={tr({ zh: '这页是干啥的?', en: 'What is this page?'
            })}
            aria-label={tr({ zh: '查看说明', en: 'About this page'
            })}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{tr({ zh: '按选手首次参赛年份分组,组内 PB 排名', en: 'PB ranking among cubers whose first WCA competition was in the chosen year'
        })}</p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => update('event', v)}
        isZh={isZh}
      />

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{tr({ zh: '届别(首参赛年)', en: 'Cohort year'
        })}</label>
          <select className="wse-filter-select" value={cohort} onChange={e => update('cohort', e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{tr({ zh: '类型', en: 'Type'
        })}</label>
          <select className="wse-filter-select" value={type} onChange={e => update('type', e.target.value)}>
            <option value="single">{tr({ zh: '单次', en: 'Single'
            })}</option>
            {allowAvg && <option value="average">{tr({ zh: '平均', en: 'Average' })}</option>}
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper sticky-scroll">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...'
        })}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <table className="wse-table sticky-thead">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{tr({ zh: '选手', en: 'Person'
                })}</th>
                  <th className="wse-value-col">{(isZh ? (type === 'single' ? '单次' : '平均') : (type === 'single' ? 'Single' : 'Average'))}</th>
                  {!country && <th>{tr({ zh: '国家', en: 'Country'
                })}</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{r.rank}</td>
                    <td>
                      <Link prefetch={false} href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${r.wcaId}`}>{displayCuberName(r.name, isZh)}</Link>
                    </td>
                    <td className="wse-value-col">{formatWcaResult(r.value, event, type)}</td>
                    {!country && (
                      <td>
                        {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                        <span>{r.countryId}</span>
                      </td>
                    )}
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

export default function CohortRanksPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <CohortRanksPageInner />
    </Suspense>
  );
}
