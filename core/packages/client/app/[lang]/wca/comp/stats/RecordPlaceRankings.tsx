'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
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
import { RecordBadge } from '@/components/RecordBadge';
import { SearchInput } from '@/components/SearchInput';
import { SortArrow } from '@/components/SortArrow';
import { useWcaTeachers } from '@/components/WcaTeacherCell';
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
  loadRecordPlaceDetails,
  loadRecordPlaces,
  localizedCityCollisionKeys,
  rankRecordRows,
  recordPlaceDetailRows,
  recordCityDisplayName,
  type RankedRecordRow,
} from '@/lib/record-places';

const TOP_LIMIT = 20;
const SEARCH_LIMIT = 50;
const DETAIL_BATCH_SIZE = 50;

interface RecordDetailModalProps {
  iso2: string;
  city: string | null;
  metric: RecordMetric;
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
            <RecordBadge record={metric.toUpperCase()} />
            <h2 id={titleId} className="cs-record-modal-title">
              {tr({ zh: `${placeName}纪录明细`, en: `${placeName} record details` })}
            </h2>
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
            <div className="cs-record-detail-state">{tr({ zh: '纪录明细暂不可用。', en: 'Record details are unavailable.' })}</div>
          ) : !shard ? (
            <div className="cs-record-detail-state">{tr({ zh: '正在加载纪录明细…', en: 'Loading record details…' })}</div>
          ) : rows.length === 0 ? (
            <div className="cs-record-detail-state">{tr({ zh: '没有这类纪录明细。', en: 'No records of this type.' })}</div>
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
  metric: RecordMetric;
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
                    onClick={(event) => openDetails(event.currentTarget, {
                      iso2: row.iso2,
                      city: cityRow?.city ?? null,
                      metric,
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
                    <ChevronRight className="cs-record-dialog-icon" size={14} aria-hidden="true" />
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
  const [data, setData] = useState<RecordPlacesData | null>(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useQueryState(
    'recordBy',
    parseAsStringEnum<RecordMetric>([...RECORD_METRICS]).withDefault('wr').withOptions({ history: 'replace', scroll: false }),
  );
  const [cityQuery, setCityQuery] = useQueryState(
    'recordCity',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
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
  const countryRows = useMemo(
    () => rankedCountries.filter(({ row }) => row[metric] > 0).slice(0, TOP_LIMIT),
    [rankedCountries, metric],
  );
  const matchingCities = useMemo(() => {
    const rows = cityQuery
      ? rankedCities.filter(({ row }) => cityRecordMatches(row, cityQuery))
      : rankedCities.filter(({ row }) => row[metric] > 0);
    return rows;
  }, [rankedCities, cityQuery, metric]);
  const cityCollisions = useMemo(
    () => localizedCityCollisionKeys(data?.cities ?? [], isZh),
    [data, isZh],
  );
  const cityRows = matchingCities.slice(0, cityQuery ? SEARCH_LIMIT : TOP_LIMIT);

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
        <div className="cs-record-grid">
          <div>
            <h3 className="cs-record-heading">{tr({ zh: '国家榜', en: 'Countries' })}</h3>
            <RankingTable
              label={tr({ zh: '国家', en: 'Country' })}
              rows={countryRows}
              metric={metric}
              isZh={isZh}
              city={false}
              onMetricChange={(value) => { void setMetric(value); }}
            />
          </div>

          <div>
            <div className="cs-record-city-heading">
              <h3 className="cs-record-heading">{tr({ zh: '城市榜', en: 'Cities' })}</h3>
              <SearchInput
                value={cityQuery}
                onChange={(value) => { void setCityQuery(value); }}
                placeholder={tr({ zh: '搜索城市', en: 'Search cities' })}
                ariaLabel={tr({ zh: '搜索城市纪录', en: 'Search city records' })}
                className="cs-record-search"
                inputClassName="cs-record-search-input"
                type="search"
              />
            </div>
            {cityQuery && (
              <div className="cs-record-search-summary">
                {tr({ zh: `${matchingCities.length.toLocaleString()} 个匹配`, en: `${matchingCities.length.toLocaleString()} matches` })}
                {matchingCities.length > SEARCH_LIMIT && tr({ zh: `，显示前 ${SEARCH_LIMIT} 个`, en: `, showing the first ${SEARCH_LIMIT}` })}
              </div>
            )}
            {cityRows.length > 0 ? (
              <RankingTable
                label={tr({ zh: '城市', en: 'City' })}
                rows={cityRows}
                metric={metric}
                isZh={isZh}
                city
                cityCollisions={cityCollisions}
                onMetricChange={(value) => { void setMetric(value); }}
              />
            ) : (
              <div className="cs-empty cs-record-empty">{tr({ zh: '没有匹配的城市。', en: 'No matching cities.' })}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
