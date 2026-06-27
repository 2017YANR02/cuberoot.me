'use client';

// Ported from packages/client-vite/src/pages/wca_stats/AllEventsDonePage.tsx.
import { Suspense, useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import { loadFlagData } from '@/lib/country-flags';
import { CompCell } from '@/components/CompCell/CompCell';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  doneCount: number; isDone: boolean;
  firstCompId: string | null; firstCompDate: string | null;
  achievementCompId: string | null; achievementCompName: string | null; achievementCompDate: string | null;
  daysToComplete: number | null;
  totalCompCount: number;
}

function AllEventsDonePageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('全项目达成', 'All Events Done');
  const [q, setQ] = useQueryStates(
    {
      country: parseAsString,
      onlyDone: parseAsString,
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const country = q.country ?? '';
  const onlyDone = q.onlyDone !== '0';
  const page = parseInt(q.page ?? '1', 10);
  const size = parseInt(q.size ?? '100', 10);

  const update = (k: string, v: string, resetPage = true) => {
    setQ({ [k]: v || null, ...(resetPage ? { page: null } : {}) } as Parameters<typeof setQ>[0]);
  };

  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);
  const countries = useCountries();

  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  useEffect(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('onlyDone', onlyDone ? '1' : '0');
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    fetch(apiUrl(`/v1/wca/all-events-done?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [country, onlyDone, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}</Link>
        </div>
        <h1 className="wse-title-row">
          {tr({ zh: '全项目达成排名', en: 'All Events Achievement'
        })}
          <Link
            href="/wca/about/all-events-done"
            className="wse-title-help"
            title={tr({ zh: '这页是干啥的?', en: 'What is this page?'
            })}
            aria-label={tr({ zh: '查看说明', en: 'About this page'
            })}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{tr({ zh: '完成全 17 项 WCA 官方项目所用天数(从首次参赛到最后一项达成),即「全项目大满贯」', en: 'Days from first WCA comp to completing all 17 events — the all-events grand slam'
        })}</p>
      </header>

      <div className="wse-filters">
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{tr({ zh: '视图', en: 'View'
        })}</label>
          <select className="wse-filter-select" value={onlyDone ? '1' : '0'} onChange={e => update('onlyDone', e.target.value)}>
            <option value="1">{tr({ zh: '全达成', en: 'Completed'
            })}</option>
            <option value="0">{tr({ zh: '全部', en: 'All' })}</option>
          </select>
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...'
        })}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{tr({ zh: '选手', en: 'Person'
                })}</th>
                  <th className="wse-value-col">{tr({ zh: '达成天数', en: 'Days'
                })}</th>
                  <th>{tr({ zh: '达成比赛', en: 'At competition'
                })}</th>
                  <th className="wse-value-col">{tr({ zh: '比赛场次', en: 'Comps'
                })}</th>
                  {!onlyDone && <th className="wse-value-col">{tr({ zh: '完成项目', en: 'Done'
                })}</th>}
                  <th>{tr({ zh: '国家', en: 'Country'
                })}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                    <td>
                      <Link prefetch={false} href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${r.wcaId}`}>{displayCuberName(r.name, isZh)}</Link>
                    </td>
                    <td className="wse-value-col">{r.daysToComplete != null ? `${r.daysToComplete.toLocaleString()} ${tr({ zh: '天', en: 'd' })}` : '—'}</td>
                    <td>{r.achievementCompId ? <CompCell compId={r.achievementCompId} compName={r.achievementCompName} isZh={isZh} /> : ''}</td>
                    <td className="wse-value-col">{r.totalCompCount}</td>
                    {!onlyDone && <td className="wse-value-col">{r.doneCount}/17</td>}
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

export default function AllEventsDonePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <AllEventsDonePageInner />
    </Suspense>
  );
}
