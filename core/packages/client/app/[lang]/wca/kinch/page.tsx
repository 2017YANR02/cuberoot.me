'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import type { WcaPersonLite } from '@/lib/wca-api';
import { apiUrl } from '@/lib/api-base';
import { displayCuberName } from '@/lib/cuber-name-display';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import Paginator from '@/components/wca-stats/Paginator';
import RegionCountrySelect from '@/components/wca-stats/RegionCountrySelect';
import { useCountries } from '@/components/wca-stats/useCountries';
import { tr, useLang } from '@/i18n/tr';
import '../_wca_stats_extra.css';
import './kinch.css';

const PAGE_SIZE_OPTIONS = [50, 100, 200];

interface LeaderboardRow {
  rank: number;
  wcaId: string;
  name: string;
  countryId: string;
  iso2: string | null;
  score: number;
}

interface LeaderboardData {
  scope: 'world' | 'continent' | 'country';
  country: string;
  page: number;
  size: number;
  total: number;
  rows: LeaderboardRow[];
}

interface KinchEventRow {
  eventId: string;
  score: number;
  value: number | null;
  type: 'single' | 'average';
}

interface PersonData {
  scope: 'world' | 'continent' | 'country';
  country: string;
  wcaId: string;
  person: { name: string; countryId: string; iso2: string | null };
  rank: number | null;
  score: number;
  events: KinchEventRow[];
}

function KinchPageInner() {
  const isZh = useLang() === 'zh';
  const countries = useCountries();
  const [query, setQuery] = useQueryStates(
    {
      country: parseAsString,
      wcaId: parseAsString,
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const country = query.country ?? '';
  const wcaId = (query.wcaId ?? '').toUpperCase();
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const size = PAGE_SIZE_OPTIONS.includes(Number(query.size)) ? Number(query.size) : 100;
  const [pickedPerson, setPickedPerson] = useState<WcaPersonLite | null>(null);
  const [data, setData] = useState<LeaderboardData | PersonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (country) params.set('country', country);
    if (wcaId) params.set('wcaId', wcaId);
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/v1/wca/kinch?${params.toString()}`), { signal: controller.signal })
      .then(response => {
        if (response.ok) return response.json() as Promise<LeaderboardData | PersonData>;
        throw new Error(response.status === 404 ? 'not-found' : 'request-failed');
      })
      .then(setData)
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error && reason.message === 'not-found'
          ? tr({ zh: '这位选手还没有可计算的 WCA 成绩', en: 'This person has no WCA results to score yet' })
          : tr({ zh: '加载失败,请稍后重试', en: 'Failed to load. Please try again.' }));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [country, wcaId, page, size]);

  const personData = wcaId && data && 'person' in data ? data : null;
  const leaderboard = !wcaId && data && 'rows' in data ? data : null;
  const pickerValue = useMemo<WcaPersonLite | null>(() => {
    if (!wcaId) return null;
    if (pickedPerson?.id === wcaId) return pickedPerson;
    return {
      id: wcaId,
      name: personData?.person.name ?? wcaId,
      country_iso2: personData?.person.iso2 ?? '',
    };
  }, [pickedPerson, personData, wcaId]);
  const totalPages = leaderboard ? Math.max(1, Math.ceil(leaderboard.total / size)) : 1;
  const scopeLabel = personData?.scope === 'country'
    ? tr({ zh: '国家', en: 'Country' })
    : personData?.scope === 'continent'
      ? tr({ zh: '大洲', en: 'Continent' })
      : tr({ zh: '世界', en: 'World' });

  const update = (patch: Record<string, string | null>) => {
    setQuery({ ...patch, page: patch.page === undefined ? null : patch.page });
  };

  return (
    <main className="wse-page kinch-page">
      <header className="wse-header">
        <h1>Kinch</h1>
        <p className="wse-subtitle">
          {tr({
            zh: '用 17 个现役项目衡量综合速拧水平,分数越高越好。',
            en: 'An all-round measure across all 17 current WCA events. Higher is better.',
          })}
        </p>
      </header>

      <div className="wse-filters kinch-filters">
        <div className="wse-filter kinch-person-filter">
          <label>{tr({ zh: '选手', en: 'Person' })}</label>
          <WcaPersonPicker
            value={pickerValue}
            onChange={person => {
              setPickedPerson(person);
              update({ wcaId: person?.id ?? null });
            }}
            placeholder={tr({ zh: '搜索姓名或 WCA ID', en: 'Search name or WCA ID' })}
            isZh={isZh}
          />
        </div>
        <RegionCountrySelect
          countries={countries}
          value={country}
          isZh={isZh}
          onChange={value => update({ country: value || null })}
        />
      </div>

      {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
      {error && <div className="wse-state wse-state-error">{error}</div>}

      {personData && !loading && (
        <>
          <div className="kinch-summary">
            <div>
              <span className="kinch-summary-label">{tr({ zh: '综合分', en: 'Overall' })}</span>
              <strong>{personData.score.toFixed(2)}</strong>
            </div>
            <div>
              <span className="kinch-summary-label">{scopeLabel}{tr({ zh: '排名', en: ' rank' })}</span>
              <strong>{personData.rank == null ? '—' : `#${personData.rank}`}</strong>
            </div>
          </div>
          <div className="wse-table-wrapper sticky-scroll">
            <table className="wse-table sticky-thead kinch-event-table">
              <thead>
                <tr>
                  <th>{tr({ zh: '项目', en: 'Event' })}</th>
                  <th className="wse-value-col">Kinch</th>
                  <th className="wse-value-col">{tr({ zh: '采用成绩', en: 'Result used' })}</th>
                </tr>
              </thead>
              <tbody>
                {personData.events.map(row => (
                  <tr key={row.eventId}>
                    <td className="kinch-event-name">
                      <EventIcon event={row.eventId} />
                      {eventDisplayName(row.eventId, isZh)}
                    </td>
                    <td className="wse-value-col">{row.score.toFixed(2)}</td>
                    <td className="wse-value-col">
                      {row.value == null
                        ? '—'
                        : formatWcaResult(row.value, row.eventId, row.type)}
                      {row.value != null && (
                        <span className="kinch-result-type">
                          {row.type === 'single'
                            ? tr({ zh: '单次', en: 'single' })
                            : tr({ zh: '平均', en: 'average' })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {leaderboard && !loading && (
        <div className="wse-table-wrapper sticky-scroll">
          <div className="wse-result-meta">
            {tr({ zh: `共 ${leaderboard.total.toLocaleString()} 人`, en: `${leaderboard.total.toLocaleString()} cubers` })}
          </div>
          <table className="wse-table sticky-thead">
            <thead>
              <tr>
                <th className="wse-rank-col">#</th>
                <th>{tr({ zh: '选手', en: 'Person' })}</th>
                <th>{tr({ zh: '国家', en: 'Country' })}</th>
                <th className="wse-value-col">Kinch</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.rows.map(row => (
                <tr key={row.wcaId}>
                  <td className="wse-rank-col">{row.rank}</td>
                  <td>
                    <AppLink
                      href={`/wca/kinch?wcaId=${encodeURIComponent(row.wcaId)}${country ? `&country=${encodeURIComponent(country)}` : ''}`}
                      prefetch={false}
                    >
                      {displayCuberName(row.name, isZh)}
                    </AppLink>
                    <span className="kinch-person-id">{row.wcaId}</span>
                  </td>
                  <td>
                    {row.iso2 && <Flag iso2={row.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                    {row.countryId}
                  </td>
                  <td className="wse-value-col">{row.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {leaderboard.total > size && (
            <Paginator
              page={leaderboard.page}
              totalPages={totalPages}
              size={size}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              isZh={isZh}
              onPageChange={next => setQuery({ page: String(next) })}
              onSizeChange={next => update({ size: String(next) })}
            />
          )}
        </div>
      )}

      <section className="kinch-about">
        <h2>{tr({ zh: '怎么算', en: 'How it works' })}</h2>
        <p>
          {tr({
            zh: '每项分数通常是「所选范围的纪录 ÷ 个人平均 × 100」,缺项记 0,最后对 17 项取平均。三盲、最少步、四盲和五盲会在单次与平均中取较高分。',
            en: 'Each event normally scores the selected region record divided by your average, times 100. Missing events score zero, then all 17 events are averaged. 3BLD, FMC, 4BLD and 5BLD use the better of single and average.',
          })}
        </p>
        <p>
          {tr({
            zh: '多盲先把成绩换成「点数 + 一小时剩余比例」,再用个人积分除以纪录积分。',
            en: 'Multi-Blind first becomes points plus the fraction of the hour remaining, then uses personal points divided by record points.',
          })}
        </p>
        <p>
          <a href="https://www.speedsolving.com/threads/all-round-rankings-kinchranks.53353/" target="_blank" rel="noopener noreferrer">
            {tr({ zh: 'Kinch 原始讨论', en: 'Original Kinch discussion' })}
          </a>
          <span className="kinch-about-separator"> / </span>
          <AppLink href="/wca/results?events=all" prefetch={false}>
            {tr({ zh: '比较名次和', en: 'Compare Sum of Ranks' })}
          </AppLink>
        </p>
      </section>
    </main>
  );
}

export default function KinchPage() {
  return (
    <Suspense fallback={null}>
      <KinchPageInner />
    </Suspense>
  );
}
