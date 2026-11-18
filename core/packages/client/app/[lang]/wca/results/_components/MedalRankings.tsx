'use client';

import { useEffect, useState, type ReactNode } from 'react';
import WcaEventSelector from '@/components/WcaEventSelector';
import PersonLink, { personHref } from '@/components/PersonLink';
import { WcaPersonIdentity } from '@/components/WcaPersonIdentity';
import { Flag } from '@/components/Flag';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import BarRaceChart from '@/components/wca-stats/BarRaceChart';
import Paginator from '@/components/wca-stats/Paginator';
import RegionCountrySelect from '@/components/wca-stats/RegionCountrySelect';
import type { CountryOption } from '@/components/wca-stats/useCountries';
import { apiUrl } from '@/lib/api-base';
import { displayCuberName } from '@/lib/cuber-name-display';
import { niceAxis } from '@/lib/top10-axis';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { tr } from '@/i18n/tr';
import '@/components/wca-stats/top10_history.css';
import './medal-rankings.css';

const EVENTS = new Set(ALL_EVENT_IDS.filter(event => !CANCELLED_EVENT_IDS.has(event)));
const MEDALS = [
  { id: 'gold', zh: '金', en: 'Gold', count: { zh: '累计金牌数', en: 'Total gold medals' } },
  { id: 'silver', zh: '银', en: 'Silver', count: { zh: '累计银牌数', en: 'Total silver medals' } },
  { id: 'bronze', zh: '铜', en: 'Bronze', count: { zh: '累计铜牌数', en: 'Total bronze medals' } },
] as const;
type Medal = typeof MEDALS[number]['id'];
interface MedalRow {
  rank: number; wcaId: string; name: string; countryId: string; iso2: string | null;
  gold: number; silver: number; bronze: number; sum: number;
}
interface MedalData { rows: MedalRow[]; total: number; medal: Medal }

interface Props {
  medal: Medal; eventId: string; country: string; countries: CountryOption[]; isZh: boolean;
  page: number; size: number; leadingControls: ReactNode;
  onMedalChange: (medal: Medal) => void; onEventChange: (event: string) => void;
  onCountryChange: (country: string) => void; onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}

export default function MedalRankings({ medal, eventId, country, countries, isZh, page, size,
  leadingControls, onMedalChange, onEventChange, onCountryChange, onPageChange, onSizeChange }: Props) {
  const event = EVENTS.has(eventId) ? eventId : '';
  const params = new URLSearchParams({ type: event ? 'event' : 'all', event, region: country || 'world',
    medal, page: String(page), size: String(size), v: '2' });
  const requestKey = params.toString();
  const [result, setResult] = useState<{ key: string; data: MedalData; leaders: MedalRow[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setFailure(null);
    async function load(query: URLSearchParams): Promise<MedalData> {
      const response = await fetch(apiUrl(`/v1/wca/fun/medals?${query}`), { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: MedalData = await response.json();
      // An older API ignores medal and still sorts by gold; never present it as a silver/bronze ranking.
      if (data.medal !== query.get('medal')) throw new Error('Medal ranking response mismatch');
      return data;
    }
    const query = new URLSearchParams(requestKey);
    const leadersQuery = new URLSearchParams(query);
    leadersQuery.set('page', '1');
    leadersQuery.set('size', '10');
    const dataRequest = load(query);
    const leadersRequest = page === 1 ? dataRequest : load(leadersQuery);
    void Promise.all([dataRequest, leadersRequest]).then(([data, leaders]) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, data, leaders: leaders.rows.slice(0, 10) });
    }).catch(() => { if (!controller.signal.aborted) setFailure(requestKey); });
    return () => controller.abort();
  }, [requestKey, page]);

  const current = result?.key === requestKey ? result : null;
  const failed = failure === requestKey;
  const label = tr(MEDALS.find(item => item.id === medal)!.count);
  const axis = niceAxis(current?.leaders[0]?.[medal] ?? 0);

  return <section className="medal-rankings" aria-label={tr({ zh: '选手奖牌排行', en: 'Cuber medal rankings' })}>
    <div className="wse-filters wca-stats-controls">
      <WcaEventSelector availableEvents={EVENTS} selectedEvent={event} onSelect={onEventChange}
        isZh={isZh} allowAll onlyAvailable />
      <div className="wca-stats-tab-bar wca-stats-tab-bar-connected" role="group"
        aria-label={tr({ zh: '奖牌类型', en: 'Medal type' })}>
        {MEDALS.map(item => <button key={item.id} type="button"
          className={`wca-stats-tab${medal === item.id ? ' active' : ''}`}
          aria-pressed={medal === item.id} onClick={() => onMedalChange(item.id)}>{tr(item)}</button>)}
      </div>
      {leadingControls}
      <RegionCountrySelect hideLabel countries={countries} value={country} isZh={isZh} onChange={onCountryChange} />
    </div>
    {failed && <div className="wse-state wse-state-error" role="alert">{tr({ zh: '奖牌排行加载失败', en: 'Could not load medal rankings' })}</div>}
    {!current && !failed && <ContentSkeleton variant="table" />}
    {current && <>
      <div className="t10h-stage medal-rankings-chart" role="img" aria-label={label}>
        <h2 className="wse-section-title">{label}</h2>
        <BarRaceChart axisMax={axis.max} ticks={axis.ticks} tickLabel={String} rowH={44}
          showN={current.leaders.length} barFrac={75}
          rows={current.leaders.map(row => ({
            key: row.wcaId, href: personHref(row.wcaId), name: displayCuberName(row.name, isZh),
            iso2: row.iso2, country: row.countryId, value: row[medal], valueLabel: String(row[medal]), rankLabel: row.rank,
            label: <WcaPersonIdentity wcaId={row.wcaId} linked={false}
              flag={row.iso2 && <Flag iso2={row.iso2} className="t10h-bar-flag" />}>
              <span className="t10h-bar-name">{displayCuberName(row.name, isZh)}</span>
            </WcaPersonIdentity>,
          }))} />
      </div>
      <div className="wse-table-wrapper sticky-scroll" aria-live="polite">
        <table className="wse-table sticky-thead medal-rankings-table">
          <thead><tr><th className="wse-rank-col">#</th>
            <th className="wca-person-column">{tr({ zh: '选手', en: 'Person' })}</th>
            {MEDALS.map(item => <th key={item.id} className={item.id === medal ? 'medal-selected' : undefined}>{tr(item)}</th>)}
            <th>{tr({ zh: '合计', en: 'Total' })}</th>
          </tr></thead>
          <tbody>{current.data.rows.map(row => <tr key={row.wcaId}>
            <td className="wse-rank-col">{row.rank}</td>
            <td><PersonLink wcaId={row.wcaId} name={row.name} isZh={isZh}
              flag={row.iso2 && <Flag iso2={row.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />} /></td>
            {MEDALS.map(item => <td key={item.id} className={item.id === medal ? 'medal-selected' : undefined}>{row[item.id]}</td>)}
            <td>{row.sum}</td>
          </tr>)}</tbody>
        </table>
        {current.data.rows.length === 0 && <div className="wse-state">{tr({ zh: '暂无获奖记录', en: 'No medals found' })}</div>}
      </div>
      {current.data.total > size && <Paginator page={page} totalPages={Math.ceil(current.data.total / size)}
        size={size} pageSizeOptions={[50, 100, 200]} isZh={isZh} onPageChange={onPageChange} onSizeChange={onSizeChange} />}
    </>}
  </section>;
}
