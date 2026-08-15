'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { RecordBadge } from '@/components/RecordBadge';
import { SearchInput } from '@/components/SearchInput';
import { SortArrow } from '@/components/SortArrow';
import { tr } from '@/i18n/tr';
import { countryName } from '@/lib/country-name';
import {
  cityRecordMatches,
  loadRecordPlaces,
  localizedCityCollisionKeys,
  rankRecordRows,
  recordCityDisplayName,
  type RankedRecordRow,
} from '@/lib/record-places';

const TOP_LIMIT = 20;
const SEARCH_LIMIT = 50;

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
            return (
              <tr key={cityRow ? `${row.iso2}:${cityRow.city}` : row.iso2}>
                <td className="cs-record-rank">{rank}</td>
                <td>
                  <span className="cs-record-place">
                    <Flag iso2={row.iso2} />
                    <span className="cs-record-place-text">
                      <span className="cs-record-place-name">{placeName}</span>
                      {cityRow && <span className="cs-record-country">{countryName(row.iso2, isZh)}</span>}
                    </span>
                  </span>
                </td>
                {RECORD_METRICS.map((recordMetric) => (
                  <td key={recordMetric} className={recordMetric === metric ? 'cs-record-count cs-record-count-active' : 'cs-record-count'}>
                    {row[recordMetric].toLocaleString()}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
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
