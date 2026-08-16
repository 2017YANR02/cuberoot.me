'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { useTranslation } from 'react-i18next';
import {
  RECORD_METRICS,
  type CityRecordCounts,
  type CountryRecordCounts,
  type RecordMetric,
  type RecordPlacesData,
} from '@cuberoot/shared/record-places';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import { ListSelect } from '@/components/ListSelect';
import { RecordBadge } from '@/components/RecordBadge';
import { SearchInput } from '@/components/SearchInput';
import { SortArrow } from '@/components/SortArrow';
import { useWcaTeachers } from '@/components/WcaTeacherCell';
import Paginator from '@/components/wca-stats/Paginator';
import {
  WcaRecordRowsTable,
  type WcaRecordRowsTableRow,
} from '@/components/wca-records/WcaRecordRowsTable';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import { countryName } from '@/lib/country-name';
import { loadFlagData } from '@/lib/country-flags';
import {
  cityRecordMatches,
  countryRecordMatches,
  loadRecordPlaceDetails,
  loadRecordPlaces,
  localizedCityCollisionKeys,
  rankRecordRows,
  recordPlaceDetailRows,
  recordCityDisplayName,
  type RankedRecordRow,
} from '@/lib/record-places';

const RECORD_PAGE_SIZES = ['20', '50', '100'] as const;
const DEFAULT_RECORD_PAGE_SIZE = RECORD_PAGE_SIZES[0];
const DETAIL_BATCH_SIZE = 50;
const RECORD_PLACE_VIEWS = ['country', 'city'] as const;
type RecordPlaceView = typeof RECORD_PLACE_VIEWS[number];
type RecordPageSize = typeof RECORD_PAGE_SIZES[number];

interface RecordDetailModalProps {
  iso2: string;
  city: string | null;
  metric: RecordMetric | null;
  isZh: boolean;
  placeName: string;
  onClose: () => void;
}

function RecordDetailModal({ iso2, city, metric, isZh, placeName, onClose }: RecordDetailModalProps) {
  const [shard, setShard] = useState<Awaited<ReturnType<typeof loadRecordPlaceDetails>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState(DETAIL_BATCH_SIZE);
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);

  useModalDismiss(onClose);

  useEffect(() => {
    let current = true;
    setShard(null);
    setFailed(false);
    loadRecordPlaceDetails(iso2).then((value) => {
      if (current) setShard(value);
    }).catch(() => {
      if (current) setFailed(true);
    });
    return () => { current = false; };
  }, [iso2]);

  useEffect(() => {
    setLimit(DETAIL_BATCH_SIZE);
  }, [city, metric]);

  useEffect(() => {
    modalRef.current?.querySelector<HTMLButtonElement>('.cs-record-modal-close')?.focus();
  }, []);

  const rows = useMemo(
    () => shard ? recordPlaceDetailRows(shard, metric, city) : [],
    [shard, metric, city],
  );
  const tableRows = useMemo<WcaRecordRowsTableRow[]>(
    () => rows.slice(0, limit).map(({ compId, comp, entry }) => ({
      e: entry.e,
      t: entry.k,
      v: entry.v,
      l: entry.t,
      p: entry.p,
      pn: entry.n,
      c: compId,
      cn: comp.n,
      d: comp.s,
      de: comp.d,
      a: entry.a,
    })),
    [rows, limit],
  );
  const teacherStudentIds = useMemo(() => tableRows.map((row) => row.p), [tableRows]);
  const teacherEventIds = useMemo(() => tableRows.map((row) => row.e), [tableRows]);
  const teacherDirectory = useWcaTeachers(teacherStudentIds, teacherEventIds);
  const titleMetrics = metric === null ? RECORD_METRICS : [metric];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="cs-record-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={modalRef} className="cs-record-modal">
        <header className="cs-record-modal-header">
          <div className="cs-record-modal-title-line">
            {titleMetrics.map((value) => (
              <RecordBadge key={value} record={value.toUpperCase()} />
            ))}
            <h2 id={titleId} className="cs-record-modal-title">{placeName}</h2>
          </div>
          <ClearButton
            variant="standalone"
            className="cs-record-modal-close"
            ariaLabel={tr({ zh: '关闭', en: 'Close' })}
            onClick={onClose}
          />
        </header>

        <div className="cs-record-modal-body">
          {failed ? (
            <div className="cs-record-detail-state">{tr({ zh: '纪录数据暂不可用。', en: 'Record data are unavailable.' })}</div>
          ) : !shard ? (
            <div className="cs-record-detail-state">{tr({ zh: '正在加载纪录…', en: 'Loading records…' })}</div>
          ) : rows.length === 0 ? (
            <div className="cs-record-detail-state">{tr({ zh: '没有这类纪录。', en: 'No records of this type.' })}</div>
          ) : (
            <>
              <div className="cs-record-detail-summary">
                {tr({ zh: `共 ${rows.length.toLocaleString()} 条`, en: `${rows.length.toLocaleString()} records` })}
              </div>
              <div className="wse-table-wrapper cs-record-detail-table-wrap">
                <WcaRecordRowsTable
                  rows={tableRows}
                  isZh={isZh}
                  showEvent
                  showRank={false}
                  teacherDirectory={teacherDirectory}
                />
              </div>
              {limit < rows.length && (
                <button
                  type="button"
                  className="cs-record-detail-more"
                  onClick={() => setLimit((value) => value + DETAIL_BATCH_SIZE)}
                >
                  {tr({ zh: '显示更多', en: 'Show more' })}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface SelectedRecordPlace {
  iso2: string;
  city: string | null;
  metric: RecordMetric | null;
  placeName: string;
}

interface RankingTableProps<T extends CountryRecordCounts> {
  label: string;
  rows: RankedRecordRow<T>[];
  metric: RecordMetric;
  isZh: boolean;
  city: boolean;
  cityCollisions?: ReadonlySet<string>;
  onMetricChange: (metric: RecordMetric) => void;
}

function RankingTable<T extends CountryRecordCounts>({
  label, rows, metric, isZh, city, cityCollisions = new Set(), onMetricChange,
}: RankingTableProps<T>) {
  const [selected, setSelected] = useState<SelectedRecordPlace | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openDetails = useCallback((trigger: HTMLButtonElement, value: SelectedRecordPlace) => {
    triggerRef.current = trigger;
    setSelected(value);
  }, []);
  const closeDetails = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <div className="cs-record-table-wrap">
      <table className="cs-record-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th className="cs-record-rank" scope="col">#</th>
            <th scope="col">{label}</th>
            {RECORD_METRICS.map((recordMetric) => {
              const code = recordMetric.toUpperCase();
              const active = metric === recordMetric;
              return (
                <th key={recordMetric} scope="col" aria-sort={active ? 'descending' : 'none'}>
                  <button
                    type="button"
                    className="cs-record-sort"
                    onClick={() => onMetricChange(recordMetric)}
                    aria-label={tr({ zh: `按 ${code} 数量排序`, en: `Sort by ${code} count` })}
                  >
                    <RecordBadge record={code} variant="inline" />
                    <SortArrow active={active} dir="desc" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, rank }) => {
            const cityRow = city ? row as T & CityRecordCounts : null;
            const placeName = cityRow
              ? recordCityDisplayName(cityRow, isZh, cityCollisions)
              : countryName(row.iso2, isZh);
            const placeKey = cityRow ? `${row.iso2}:${cityRow.city}` : row.iso2;
            return (
              <tr className="cs-record-row" key={placeKey}>
                <td className="cs-record-rank">{rank}</td>
                <td>
                  <button
                    type="button"
                    className="cs-record-place-button"
                    aria-haspopup="dialog"
                    aria-label={tr({ zh: `查看${placeName}的全部纪录`, en: `Show all records for ${placeName}` })}
                    onClick={(event) => openDetails(event.currentTarget, {
                      iso2: row.iso2,
                      city: cityRow?.city ?? null,
                      metric: null,
                      placeName,
                    })}
                  >
                    <span className="cs-record-place">
                      <Flag iso2={row.iso2} />
                      <span className="cs-record-place-text">
                        <span className="cs-record-place-name">{placeName}</span>
                        {cityRow && <span className="cs-record-country">{countryName(row.iso2, isZh)}</span>}
                      </span>
                    </span>
                  </button>
                </td>
                {RECORD_METRICS.map((recordMetric) => {
                  const active = recordMetric === metric;
                  const code = recordMetric.toUpperCase();
                  return (
                    <td key={recordMetric} className={active ? 'cs-record-count cs-record-count-active' : 'cs-record-count'}>
                      <button
                        type="button"
                        className="cs-record-count-button"
                        disabled={row[recordMetric] === 0}
                        aria-haspopup="dialog"
                        aria-label={tr({ zh: `查看${placeName}的 ${code} 明细`, en: `Show ${code} details for ${placeName}` })}
                        onClick={(event) => {
                          onMetricChange(recordMetric);
                          openDetails(event.currentTarget, {
                            iso2: row.iso2,
                            city: cityRow?.city ?? null,
                            metric: recordMetric,
                            placeName,
                          });
                        }}
                      >
                        {row[recordMetric].toLocaleString()}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {selected && (
        <RecordDetailModal
          {...selected}
          isZh={isZh}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}

export function RecordPlaceRankings() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const rankingRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<RecordPlacesData | null>(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useQueryState(
    'recordBy',
    parseAsStringEnum<RecordMetric>([...RECORD_METRICS]).withDefault('wr').withOptions({ history: 'replace', scroll: false }),
  );
  const [view, setView] = useQueryState(
    'recordPlace',
    parseAsStringEnum<RecordPlaceView>([...RECORD_PLACE_VIEWS]).withDefault('country').withOptions({ history: 'push', scroll: false }),
  );
  const [countryQuery, setCountryQuery] = useQueryState(
    'recordCountry',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );
  const [cityQuery, setCityQuery] = useQueryState(
    'recordCity',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );
  const [page, setPage] = useQueryState(
    'recordPage',
    parseAsInteger.withDefault(1).withOptions({ history: 'replace', scroll: false }),
  );
  const [pageSizeValue, setPageSizeValue] = useQueryState(
    'recordPageSize',
    parseAsStringEnum<RecordPageSize>([...RECORD_PAGE_SIZES])
      .withDefault(DEFAULT_RECORD_PAGE_SIZE)
      .withOptions({ history: 'replace', scroll: false }),
  );

  useEffect(() => {
    void loadFlagData();
  }, []);

  useEffect(() => {
    let current = true;
    loadRecordPlaces().then((value) => {
      if (current) setData(value);
    }).catch(() => {
      if (current) setFailed(true);
    });
    return () => { current = false; };
  }, []);

  const rankedCountries = useMemo(
    () => data ? rankRecordRows(data.countries, metric, (row) => row.iso2) : [],
    [data, metric],
  );
  const rankedCities = useMemo(
    () => data ? rankRecordRows(data.cities, metric, (row) => `${row.iso2}\0${row.city}`) : [],
    [data, metric],
  );
  const hasCountryQuery = Boolean(countryQuery.trim());
  const hasCityQuery = Boolean(cityQuery.trim());
  const matchingCountries = useMemo(() => (
    hasCountryQuery
      ? rankedCountries.filter(({ row }) => countryRecordMatches(row, countryQuery))
      : rankedCountries.filter(({ row }) => row[metric] > 0)
  ), [rankedCountries, countryQuery, hasCountryQuery, metric]);
  const matchingCities = useMemo(() => {
    const rows = hasCityQuery
      ? rankedCities.filter(({ row }) => cityRecordMatches(row, cityQuery))
      : rankedCities.filter(({ row }) => row[metric] > 0);
    return rows;
  }, [rankedCities, cityQuery, hasCityQuery, metric]);
  const cityCollisions = useMemo(
    () => localizedCityCollisionKeys(data?.cities ?? [], isZh),
    [data, isZh],
  );
  const pageSize = Number(pageSizeValue);
  const activeQuery = view === 'country' ? countryQuery : cityQuery;
  const hasActiveQuery = view === 'country' ? hasCountryQuery : hasCityQuery;
  const activeMatchCount = view === 'country' ? matchingCountries.length : matchingCities.length;
  const totalPages = Math.max(1, Math.ceil(activeMatchCount / pageSize));
  const activePage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (activePage - 1) * pageSize;
  const countryRows = matchingCountries.slice(pageStart, pageStart + pageSize);
  const cityRows = matchingCities.slice(pageStart, pageStart + pageSize);
  const activeRows = view === 'country' ? countryRows : cityRows;
  const viewLabel = view === 'country'
    ? tr({ zh: '国家榜', en: 'Countries' })
    : tr({ zh: '城市榜', en: 'Cities' });

  useEffect(() => {
    if (data && page !== activePage) void setPage(activePage);
  }, [activePage, data, page, setPage]);

  const changeMetric = useCallback((value: RecordMetric) => {
    void setMetric(value);
    void setPage(1);
  }, [setMetric, setPage]);

  const scrollToRankingStart = useCallback(() => {
    requestAnimationFrame(() => {
      rankingRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }, []);

  const changePage = useCallback((value: number) => {
    void setPage(value);
    scrollToRankingStart();
  }, [scrollToRankingStart, setPage]);

  const changePageSize = useCallback((value: number) => {
    void setPageSizeValue(String(value) as RecordPageSize);
    void setPage(1);
    scrollToRankingStart();
  }, [scrollToRankingStart, setPage, setPageSizeValue]);

  return (
    <section className="cs-section cs-record-section">
      <h2 className="cs-section-title">{tr({ zh: '纪录诞生地', en: 'Record birthplaces' })}</h2>
      <p className="cs-record-note">
        {tr({
          zh: '按创造纪录时的比赛举办地统计，单次和平均各计一条；地球页的 WR 按选手所属国统计，因此数字不会相同。',
          en: 'Counts use the competition venue where each record was set; singles and averages count separately. Globe WR counts use athlete nationality, so the totals differ.',
        })}
      </p>

      {failed ? (
        <div className="cs-empty">{tr({ zh: '纪录统计暂不可用。', en: 'Record statistics are unavailable.' })}</div>
      ) : !data ? (
        <div className="cs-loading">{t('common.loading')}</div>
      ) : (
        <div ref={rankingRef} className="cs-record-ranking">
          <h3 className="sr-only">{viewLabel}</h3>
          <div className="cs-record-controls">
            <ListSelect
              items={RECORD_PLACE_VIEWS.map((value) => ({
                value,
                label: value === 'country'
                  ? tr({ zh: '国家榜', en: 'Countries' })
                  : tr({ zh: '城市榜', en: 'Cities' }),
              }))}
              value={view}
              onChange={(value) => {
                void setView(value as RecordPlaceView);
                void setPage(1);
              }}
              allLabel={viewLabel}
              clearable={false}
              className="cs-record-view-select"
            />
            <SearchInput
              value={activeQuery}
              onChange={(value) => {
                if (view === 'country') void setCountryQuery(value);
                else void setCityQuery(value);
                void setPage(1);
              }}
              placeholder={view === 'country'
                ? tr({ zh: '搜索国家', en: 'Search countries' })
                : tr({ zh: '搜索城市', en: 'Search cities' })}
              ariaLabel={view === 'country'
                ? tr({ zh: '搜索国家纪录', en: 'Search country records' })
                : tr({ zh: '搜索城市纪录', en: 'Search city records' })}
              className="cs-record-search"
              inputClassName="cs-record-search-input"
              type="search"
            />
          </div>
          {hasActiveQuery && (
            <div className="cs-record-search-summary">
              {tr({ zh: `${activeMatchCount.toLocaleString()} 个匹配`, en: `${activeMatchCount.toLocaleString()} matches` })}
            </div>
          )}
          {activeRows.length > 0 ? (
            <>
              {view === 'country' ? (
                <RankingTable
                  label={tr({ zh: '国家', en: 'Country' })}
                  rows={countryRows}
                  metric={metric}
                  isZh={isZh}
                  city={false}
                  onMetricChange={changeMetric}
                />
              ) : (
                <RankingTable
                  label={tr({ zh: '城市', en: 'City' })}
                  rows={cityRows}
                  metric={metric}
                  isZh={isZh}
                  city
                  cityCollisions={cityCollisions}
                  onMetricChange={changeMetric}
                />
              )}
              {activeMatchCount > pageSize && (
                <Paginator
                  page={activePage}
                  totalPages={totalPages}
                  size={pageSize}
                  pageSizeOptions={RECORD_PAGE_SIZES.map(Number)}
                  isZh={isZh}
                  onPageChange={changePage}
                  onSizeChange={changePageSize}
                />
              )}
            </>
          ) : (
            <div className="cs-empty cs-record-empty">
              {view === 'country'
                ? tr({ zh: '没有匹配的国家。', en: 'No matching countries.' })
                : tr({ zh: '没有匹配的城市。', en: 'No matching cities.' })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
