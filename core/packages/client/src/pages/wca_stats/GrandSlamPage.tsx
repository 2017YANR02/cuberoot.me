/**
 * 大满贯 - WC + Continental + National 领奖台 + WR(任一类型)的人.
 * /wca/grand-slam
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import WcaEventSelector from '../../components/WcaEventSelector';
import PillToggle from '../../components/PillToggle/PillToggle';
import { RecordBadge } from '../../components/RecordBadge/RecordBadge';
import { CompCell } from '../../components/CompCell/CompCell';
import { Flag } from '../../utils/flag';
import { loadFlagData } from '../../utils/country_flags';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import LangToggle from '../../components/LangToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './wca_stats_extra.css';

const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
];
const EVENTS_SET = new Set(EVENTS);

interface ChampInfo { compId: string; name: string | null; pos: number | null }
interface GsRow {
  wcaId: string; name: string; eventId: string;
  single: number | null; average: number | null;
  countryId: string; iso2: string | null;
  hasWr: boolean; isOnlyFirst: boolean;
  worldChamp: ChampInfo | null;
  continentalChamp: ChampInfo | null;
  nationalChamp: ChampInfo | null;
}

export default function GrandSlamPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('大满贯', 'Grand Slam');
  const [params, setParams] = useSearchParams();
  const event = params.get('event') ?? '';
  const onlyFirst = params.get('onlyFirst') === '1';
  const hasWr = params.get('hasWr') === '1';

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: false });
  };

  const [rows, setRows] = useState<GsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);

  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = new URL(apiUrl('/v1/wca/grand-slam'), window.location.origin);
    if (event) url.searchParams.set('event', event);
    if (onlyFirst) url.searchParams.set('onlyFirst', '1');
    if (hasWr) url.searchParams.set('hasWr', '1');
    fetch(url.toString().replace(window.location.origin, ''))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: { rows: GsRow[] }) => setRows(j.rows))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [event, onlyFirst, hasWr]);

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca?lang=${i18n.language}`} className="wse-back">
            <ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}
          </Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '大满贯' : 'Grand Slam'}</h1>
        <p className="wse-subtitle">
          {isZh
            ? '单个项目里,某位选手同时获得世锦赛领奖台、所属洲际赛领奖台、所属国家赛领奖台,且打破过该项目 WR,即达成该项目大满贯。默认采用领奖台最佳且最早的比赛。注意:部分世锦赛 / 洲际赛可能同时被算作举办国的国家锦标赛。'
            : 'For a single event, a cuber achieves Grand Slam by podium at Worlds + their Continental + their National championship AND having broken WR. Defaults to the best & earliest podium. Note: some World/Continental championships also count as the host country’s nationals.'}
        </p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => setParam('event', v)}
        isZh={isZh}
        allowAll
      />

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{isZh ? '筛选' : 'Filter'}</label>
          <PillToggle
            value={onlyFirst}
            onChange={v => setParam('onlyFirst', v ? '1' : '')}
            offLabel={isZh ? '全部' : 'All'}
            onLabel={isZh ? '仅全部第一' : 'Only all gold'}
          />
        </div>
        <div className="wse-filter">
          <label>{isZh ? '破 WR' : 'Broke WR'}</label>
          <PillToggle
            value={hasWr}
            onChange={v => setParam('hasWr', v ? '1' : '')}
            offLabel={isZh ? '全部' : 'All'}
            onLabel={isZh ? '是' : 'Yes'}
          />
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {!loading && !error && (
          <>
            <div className="wse-result-meta">
              {isZh ? `共 ${rows.length} 项达成` : `${rows.length} achievements`}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{isZh ? '选手' : 'Person'}</th>
                  <th>{isZh ? '项目' : 'Event'}</th>
                  <th className="wse-value-col">{isZh ? '单次' : 'Single'}</th>
                  <th className="wse-value-col">{isZh ? '平均' : 'Average'}</th>
                  <th>WR</th>
                  <th>{isZh ? '世锦赛' : 'World'}</th>
                  <th>{isZh ? '洲际赛' : 'Continental'}</th>
                  <th>{isZh ? '国家赛' : 'National'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.wcaId}-${r.eventId}`}>
                    <td className="wse-rank-col">{i + 1}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <a href={`https://www.worldcubeassociation.org/persons/${r.wcaId}`} target="_blank" rel="noopener noreferrer">
                        {displayCuberName(r.name, isZh)}
                      </a>
                    </td>
                    <td>{r.eventId}</td>
                    <td className="wse-value-col">{r.single != null ? formatWcaResult(r.single, r.eventId, 'single') : '—'}</td>
                    <td className="wse-value-col">{r.average != null ? formatWcaResult(r.average, r.eventId, 'average') : '—'}</td>
                    <td>{r.hasWr ? <RecordBadge record="WR" /> : ''}</td>
                    <td className="wse-detail-cell">{champCell(r.worldChamp, isZh)}</td>
                    <td className="wse-detail-cell">{champCell(r.continentalChamp, isZh)}</td>
                    <td className="wse-detail-cell">{champCell(r.nationalChamp, isZh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function champCell(c: { compId: string; name: string | null; pos: number | null } | null, isZh: boolean) {
  if (!c) return '';
  const medal = c.pos === 1 ? '🥇' : c.pos === 2 ? '🥈' : c.pos === 3 ? '🥉' : '';
  return (
    <span><CompCell compId={c.compId} compName={c.name} isZh={isZh} /> {medal}</span>
  );
}
