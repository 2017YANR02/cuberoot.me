'use client';

import { Suspense, useEffect, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import AppLink from '@/components/AppLink';
import { CompCell } from '@/components/CompCell/CompCell';
import { Flag } from '@/components/Flag';
import PersonLink from '@/components/PersonLink';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import { tr, useLang } from '@/i18n/tr';
import Paginator from './Paginator';
import RegionCountrySelect from './RegionCountrySelect';
import { useCountries } from './useCountries';
import { WcaStatsPageHeader } from './WcaStatsPageHeader';
import '../../app/[lang]/wca/_wca_stats_extra.css';

const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface Row {
  rank: number;
  wcaId: string;
  name: string;
  countryId: string;
  iso2: string | null;
  streak: number;
  startCompId: string | null;
  startCompName: string | null;
  endCompId: string | null;
  endCompName: string | null;
}

interface Data {
  page: number;
  size: number;
  total: number;
  rows: Row[];
}

function PersonalRecordStreakPageInner() {
  const isZh = useLang() === 'zh';
  const countries = useCountries();
  const [query, setQuery] = useQueryStates(
    { country: parseAsString, page: parseAsString, size: parseAsString },
    { history: 'replace', scroll: false },
  );
  const country = query.country ?? '';
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const size = PAGE_SIZE_OPTIONS.includes(Number(query.size)) ? Number(query.size) : 100;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (country) params.set('country', country);
    setLoading(true);
    setError(false);
    fetch(apiUrl(`/v1/wca/pr-streaks?${params}`), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Data>;
      })
      .then(setData)
      .catch(reason => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [country, page, size]);

  const update = (patch: Record<string, string | null>) => {
    setQuery({ ...patch, page: patch.page === undefined ? null : patch.page });
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <main className="wse-page">
      <WcaStatsPageHeader
        slug="longest_streak_of_personal_records"
        title={{ zh: '连续取得个人纪录的最多参赛场数', en: 'Longest streak of competitions with a personal record done' }}
        subtitle={{ zh: '每场比赛至少取得一项个人纪录的最长连续参赛场数', en: 'Longest run of consecutive competitions with at least one personal record' }}
      />
      <div className="wse-filters">
        <RegionCountrySelect
          countries={countries}
          value={country}
          isZh={isZh}
          onChange={value => update({ country: value || null })}
        />
      </div>
      <div className="wse-table-wrapper sticky-scroll">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
        {error && <div className="wse-state wse-state-error">{tr({ zh: '加载失败,请稍后重试', en: 'Failed to load. Please try again.' })}</div>}
        {data && !loading && !error && (
          <>
            <div className="wse-result-meta">
              {tr({ zh: `共 ${data.total.toLocaleString()} 人`, en: `${data.total.toLocaleString()} cubers` })}
            </div>
            <table className="wse-table sticky-thead">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th className="wse-value-col">{tr({ zh: '参赛场数', en: 'Competitions' })}</th>
                  <th>{tr({ zh: '选手', en: 'Person' })}</th>
                  <th>{tr({ zh: '起始比赛', en: 'Started at' })}</th>
                  <th>{tr({ zh: '结束比赛', en: 'Ended at' })}</th>
                  <th>{tr({ zh: '国家', en: 'Country' })}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.wcaId}>
                    <td className="wse-rank-col">{row.rank}</td>
                    <td className="wse-value-col">{row.streak}</td>
                    <td><PersonLink wcaId={row.wcaId} name={row.name} isZh={isZh} /></td>
                    <td>{row.startCompId ? <AppLink {...compLinkProps(row.startCompId)}><CompCell compId={row.startCompId} compName={row.startCompName} isZh={isZh} date={null} /></AppLink> : '—'}</td>
                    <td>{row.endCompId ? <AppLink {...compLinkProps(row.endCompId)}><CompCell compId={row.endCompId} compName={row.endCompName} isZh={isZh} date={null} /></AppLink> : '—'}</td>
                    <td>
                      {row.iso2 && <Flag iso2={row.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      {row.countryId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.total > size && (
              <Paginator
                page={data.page}
                totalPages={totalPages}
                size={size}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                isZh={isZh}
                onPageChange={next => setQuery({ page: String(next) })}
                onSizeChange={next => update({ size: String(next) })}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function PersonalRecordStreakPage() {
  return <Suspense fallback={null}><PersonalRecordStreakPageInner /></Suspense>;
}
