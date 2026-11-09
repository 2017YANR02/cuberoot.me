'use client';

// Ported from packages/client-vite/src/pages/wca_stats/AllEventsDonePage.tsx.
import { Suspense, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from '@app-foundation/icons/lucide';
import PersonLink from '@/components/PersonLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { WcaStatsPageHeader } from '@/components/wca-stats/WcaStatsPageHeader';
import Paginator from '@/components/wca-stats/Paginator';
import { loadFlagData } from '@/lib/country-flags';
import { CompCell } from '@/components/CompCell/CompCell';
import { Flag } from '@/components/Flag';
import { apiUrl } from '@/lib/api-base';
import RegionCountrySelect from '@/components/wca-stats/RegionCountrySelect';
import { useCountries } from '@/components/wca-stats/useCountries';
import '../_wca_stats_extra.css';
import { WcaStatsTable, WcaStatsTableSection } from '@/components/wca-stats/WcaStatsTable';
import { tr } from '@/i18n/tr';
import { ContentSkeleton } from '@/components/ContentSkeleton';

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
  const [q, setQ] = useQueryStates(
    {
      country: parseAsString,
      onlyDone: parseAsString,
      order: parseAsString,
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const country = q.country ?? '';
  const onlyDone = q.onlyDone !== '0';
  const order = q.order === 'desc' ? 'desc' : 'asc';
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
    let active = true;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('v', '2');
    qs.set('onlyDone', onlyDone ? '1' : '0');
    qs.set('order', order);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    fetch(apiUrl(`/v1/wca/all-events-done?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [country, onlyDone, order, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="wse-page">
      <WcaStatsPageHeader
        slug="all-events-done"
        title={{ zh: '全项目达成排名', en: 'All Events Achievement' }}
        subtitle={{ zh: '从首次参赛到集齐 17 项有效成绩的间隔，按比赛开始日期计算', en: 'Days from first competition to valid results in all 17 events, measured by competition start dates' }}
      />

      <div className="wse-filters">
        <RegionCountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{tr({ zh: '视图', en: 'View'
        })}</label>
          <select className="wse-filter-select" value={onlyDone ? '1' : '0'} onChange={e => update('onlyDone', e.target.value)}>
            <option value="1">{tr({ zh: '已完成 17 项', en: 'Completed all 17'
            })}</option>
            <option value="0">{tr({ zh: '全部选手', en: 'All competitors' })}</option>
          </select>
        </div>
      </div>

      <WcaStatsTableSection>
        {loading && <ContentSkeleton variant="table" />}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <WcaStatsTable>
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th className="wca-person-column">{tr({ zh: '选手', en: 'Person'
                })}</th>
                  <th className="wse-value-col" aria-sort={order === 'asc' ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      className="wse-th-sort"
                      aria-label={order === 'asc'
                        ? tr({ zh: '按达成天数从多到少排序', en: 'Sort completion days from most to fewest' })
                        : tr({ zh: '按达成天数从少到多排序', en: 'Sort completion days from fewest to most' })}
                      onClick={() => update('order', order === 'asc' ? 'desc' : 'asc')}
                    >
                      {tr({ zh: '达成天数', en: 'Days' })}
                      {order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
                    </button>
                  </th>
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
                      <PersonLink wcaId={r.wcaId} name={r.name} isZh={isZh} />
                    </td>
                    <td className="wse-value-col">{
                      r.daysToComplete === 0 && r.firstCompId && r.firstCompId === r.achievementCompId
                        ? tr({ zh: '首赛达成', en: 'At debut' })
                        : r.daysToComplete != null
                          ? `${r.daysToComplete.toLocaleString()} ${tr({ zh: '天', en: 'd' })}`
                          : '—'
                    }</td>
                    {/* 无日期列,年号是这格唯一的时间信息 —— 保留(date={null}) */}
                    <td>{r.achievementCompId ? <CompCell compId={r.achievementCompId} compName={r.achievementCompName} isZh={isZh} date={null} /> : ''}</td>
                    <td className="wse-value-col">{r.totalCompCount}</td>
                    {!onlyDone && <td className="wse-value-col">{r.doneCount}/17</td>}
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <span>{r.countryId}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </WcaStatsTable>
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
      </WcaStatsTableSection>
    </div>
  );
}

export default function AllEventsDonePage() {
  return (
    <Suspense fallback={<ContentSkeleton variant="table" />}>
      <AllEventsDonePageInner />
    </Suspense>
  );
}
