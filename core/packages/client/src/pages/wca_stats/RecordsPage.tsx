/**
 * Records — WR / CR / NR 历史纪录查询
 * /wca-stats/records
 *
 * 数据:静态 JSON,/stats/records/history/{world|continent/<slug>|country/<ISO2>}.json
 * 由 stats-build/src/bin/records_build.ts 周更.
 *
 * 两种 show 模式(对齐 WCA 官方):
 *   - history (默认)        选定 region + event,按 event 分组的明细表(只显示该 event)
 *   - mixed                 选定 region,全部 event 合并成一个时序表
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import WcaEventSelector from '../../components/WcaEventSelector';
import { EventIcon } from '../../components/EventIcon';
import { Flag } from '../../utils/flag';
import { loadFlagData } from '../../utils/country_flags';
import { countryName } from '../../utils/country_name';
import { formatWcaResult } from '../../utils/wca_format_result';
import { displayCuberName } from '../../utils/name_utils';
import { eventDisplayName } from '../../utils/wca_events';
import { CompCell } from '../../components/CompCell/CompCell';
import { RecordBadge } from '../../components/RecordBadge';
import { ALL_EVENT_IDS } from './event_constants';
import { formatAttempts } from './AllResultsPage';
import './wca_stats_extra.css';
import './records.css';

interface Row {
  e: string; t: 's' | 'a'; v: number; l: string;
  p: string; pn: string; pc: string;
  c: string; cn: string; cc: string;
  d: string; a: number[] | null;
}

interface Bundle { updated: string; rows: Row[] }

const CONTINENTS = [
  { slug: 'africa',        zh: '非洲',     en: 'Africa' },
  { slug: 'asia',          zh: '亚洲',     en: 'Asia' },
  { slug: 'europe',        zh: '欧洲',     en: 'Europe' },
  { slug: 'northAmerica',  zh: '北美洲',   en: 'North America' },
  { slug: 'oceania',       zh: '大洋洲',   en: 'Oceania' },
  { slug: 'southAmerica',  zh: '南美洲',   en: 'South America' },
];

function regionUrl(region: string): string {
  if (region === 'world' || region === '') return '/stats/records/history/world.json';
  if (CONTINENTS.some(c => c.slug === region)) return `/stats/records/history/continent/${region}.json`;
  return `/stats/records/history/country/${region}.json`;
}

type Show = 'history' | 'mixed';

export default function RecordsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();

  const show: Show = params.get('show') === 'mixed' ? 'mixed' : 'history';
  const region = params.get('region') || 'world';
  const event = params.get('event') || '';   // '' = all events

  // 强制 show 显式在 URL 里(默认 history)
  useEffect(() => {
    if (params.get('show') !== 'history' && params.get('show') !== 'mixed') {
      const next = new URLSearchParams(params);
      next.set('show', 'history');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: false });
  };

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<{ countries: string[] } | null>(null);

  // 加载 flag 数据(用于 CompCell 比赛国旗 + 比赛中文名)
  useEffect(() => { void loadFlagData(); }, []);

  // 加载 manifest:可选 region 列表
  useEffect(() => {
    fetch('/stats/records/history/manifest.json')
      .then(r => r.ok ? r.json() : null)
      .then((j) => { if (j) setManifest({ countries: j.countries }); })
      .catch(() => { /* keep null */ });
  }, []);

  // 加载选中 region 的数据
  useEffect(() => {
    setLoading(true);
    setError(null);
    setBundle(null);
    fetch(regionUrl(region))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Bundle) => setBundle(j))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [region]);

  // event picker 可选,空字符串 = 全部
  const visibleRows = useMemo(() => {
    if (!bundle) return [];
    return event ? bundle.rows.filter(r => r.e === event) : bundle.rows;
  }, [bundle, event]);

  // available events:bundle 里出现过的所有 event_id(用于 event selector 灰显)
  const availableEvents = useMemo(() => {
    if (!bundle) return new Set<string>();
    return new Set(bundle.rows.map(r => r.e));
  }, [bundle]);

  // history 模式按 event 分组(N 张表),mixed 模式扁平单表
  // 每组内 single 排前、average 排后,各自保持原日期序
  const grouped = useMemo(() => {
    if (show !== 'history') return null;
    const map = new Map<string, Row[]>();
    for (const r of visibleRows) {
      const arr = map.get(r.e) ?? [];
      arr.push(r);
      map.set(r.e, arr);
    }
    return ALL_EVENT_IDS
      .filter(id => map.has(id))
      .map(id => {
        const rows = map.get(id)!;
        const singles = rows.filter(r => r.t === 's');
        const averages = rows.filter(r => r.t === 'a');
        return { event: id, rows: [...singles, ...averages] };
      });
  }, [visibleRows, show]);

  return (
    <div className="wse-page records-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link to={`/wca-stats?lang=${i18n.language}`} className="wse-back">
            <ChevronLeft size={16} /> {isZh ? '返回' : 'Back'}
          </Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '纪录' : 'Records'}</h1>
        <p className="wse-subtitle">
          {isZh
            ? '历史上所有曾被打破的世界 / 大洲 / 国家纪录'
            : 'Every world / continental / national record ever set'}
        </p>
      </header>

      <div className="records-toolbar">
        <div className="records-toolbar-row">
          <div className="records-show-toggle">
            <button
              type="button"
              className={show === 'history' ? 'active' : ''}
              onClick={() => update('show', 'history')}
            >{isZh ? '历史' : 'History'}</button>
            <button
              type="button"
              className={show === 'mixed' ? 'active' : ''}
              onClick={() => update('show', 'mixed')}
            >{isZh ? '混合' : 'Mixed'}</button>
          </div>

          <RegionPicker
            value={region}
            isZh={isZh}
            countries={manifest?.countries ?? []}
            onChange={(v) => update('region', v)}
          />
        </div>

        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={event}
          onSelect={(v) => update('event', v)}
          isZh={isZh}
          allowAll
        />
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{isZh ? '加载中...' : 'Loading...'}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {bundle && !loading && (
          <>
            {visibleRows.length === 0 && (
              <div className="wse-state">{isZh ? '该区域 / 项目暂无历史纪录' : 'No historical records for this region / event'}</div>
            )}

            {show === 'history' && grouped && grouped.map(g => (
              <section key={g.event} className="records-event-group">
                {!event && (
                  <h2 className="records-event-h2">
                    <EventIcon event={g.event} />
                    <span>{eventDisplayName(g.event, isZh)}</span>
                  </h2>
                )}
                <RowsTable rows={g.rows} isZh={isZh} showEvent={false} />
              </section>
            ))}

            {show === 'mixed' && visibleRows.length > 0 && (
              <RowsTable rows={visibleRows} isZh={isZh} showEvent={!event} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface RowsTableProps {
  rows: Row[];
  isZh: boolean;
  showEvent: boolean;
}

function RowsTable({ rows, isZh, showEvent }: RowsTableProps) {
  // rows desc-sorted by date — 倒序编号:每个 (event, type) 序列里,最早 = 1,最新 = 总数
  const ranks = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.e}-${r.t}`;
      totals.set(k, (totals.get(k) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    const out: number[] = [];
    for (const r of rows) {
      const k = `${r.e}-${r.t}`;
      const s = seen.get(k) ?? 0;
      out.push((totals.get(k) ?? 0) - s);
      seen.set(k, s + 1);
    }
    return out;
  }, [rows]);

  return (
    <table className="wse-table records-table">
      <thead>
        <tr>
          <th>{isZh ? '类型' : 'Type'}</th>
          {showEvent && <th>{isZh ? '项目' : 'Event'}</th>}
          <th className="wse-value-col">{isZh ? '成绩' : 'Result'}</th>
          <th>{isZh ? '选手' : 'Person'}</th>
          <th>{isZh ? '比赛' : 'Competition'}</th>
          <th>{isZh ? '日期' : 'Date'}</th>
          <th className="wse-attempts-col">{isZh ? '详细成绩' : 'Solves'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.p}-${r.c}-${r.e}-${r.t}-${i}`}>
            <td>
              <RecordBadge record={r.l} />
              {' '}
              <span className="records-type-sub">{r.t === 's' ? (isZh ? '单次' : 'Single') : (isZh ? '平均' : 'Avg')}</span>
              {' '}
              <span className="records-rank">#{ranks[i]}</span>
            </td>
            {showEvent && (
              <td>
                <EventIcon event={r.e} />
                {' '}
                <span>{eventDisplayName(r.e, isZh)}</span>
              </td>
            )}
            <td className="wse-value-col">{formatWcaResult(r.v, r.e, r.t === 's' ? 'single' : 'average')}</td>
            <td>
              {r.pc && <Flag iso2={r.pc} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
              <a href={`https://www.worldcubeassociation.org/persons/${r.p}`} target="_blank" rel="noopener noreferrer">
                {displayCuberName(r.pn, isZh)}
              </a>
            </td>
            <td>
              <a href={`https://www.worldcubeassociation.org/competitions/${r.c}`} target="_blank" rel="noopener noreferrer">
                <CompCell compId={r.c} compName={r.cn} isZh={isZh} />
              </a>
            </td>
            <td className="wse-detail-cell">{r.d}</td>
            <td className="wse-attempts-col">
              {r.a && r.a.length > 0 ? formatAttempts(r.a, r.e, r.t === 's' ? 'single' : 'average', r.v) : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 大洲剪影 — public/_assets/continent-icons/*.svg(手工维护,非脚本生成)
function ContinentIcon({ slug }: { slug: string }) {
  return (
    <span className="continent-icon">
      <img src={`/_assets/continent-icons/${slug}.svg`} alt="" />
    </span>
  );
}

// Region picker:World / 6 大洲 / 国家.效仿 WCA results/records 页 Region 下拉.
function RegionPicker({ value, isZh, countries, onChange }: {
  value: string; isZh: boolean; countries: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    setTimeout(() => document.addEventListener('click', handler, { once: true }), 0);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const label = (() => {
    if (value === 'world' || value === '') return isZh ? '全部区域' : 'All regions';
    const cont = CONTINENTS.find(c => c.slug === value);
    if (cont) return isZh ? cont.zh : cont.en;
    return countryName(value, isZh);
  })();

  const ql = q.trim().toLowerCase();
  const showWorld = !ql || (isZh ? '全部区域' : 'all regions').includes(ql);
  const continentsFiltered = useMemo(() => {
    if (!ql) return CONTINENTS;
    return CONTINENTS.filter(c => c.en.toLowerCase().includes(ql) || c.zh.includes(q));
  }, [ql, q]);
  const countriesSorted = useMemo(() => {
    const collator = new Intl.Collator(isZh ? 'zh-Hans-CN' : 'en', { sensitivity: 'base' });
    return [...countries].sort((a, b) => collator.compare(countryName(a, isZh), countryName(b, isZh)));
  }, [countries, isZh]);
  const countriesFiltered = useMemo(() => {
    if (!ql) return countriesSorted;
    return countriesSorted.filter(iso =>
      iso.toLowerCase().includes(ql) ||
      countryName(iso, isZh).toLowerCase().includes(ql) ||
      countryName(iso, false).toLowerCase().includes(ql),
    );
  }, [countriesSorted, ql, isZh]);

  const select = (v: string) => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div className="records-region" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="records-region-trigger" onClick={() => setOpen(o => !o)}>
        {value !== 'world' && value !== '' && (
          CONTINENTS.some(c => c.slug === value)
            ? <ContinentIcon slug={value} />
            : <Flag iso2={value} spanClassName="country-flag" imgClassName="country-flag-ct" />
        )}
        <span className="records-region-label">{label}</span>
        <span className="records-region-caret">▾</span>
      </button>
      {open && (
        <div className="records-region-popup">
          <div className="records-region-search">
            <Search size={14} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isZh ? '搜索...' : 'Search...'}
            />
          </div>
          <div className="records-region-list">
            {showWorld && (
              <button
                className={`records-region-item${value === 'world' || value === '' ? ' active' : ''}`}
                onClick={() => select('world')}
              >{isZh ? '全部区域' : 'All regions'}</button>
            )}
            {continentsFiltered.length > 0 && (
              <div className="records-region-section">{isZh ? '大洲' : 'Continent'}</div>
            )}
            {continentsFiltered.map(c => (
              <button
                key={c.slug}
                className={`records-region-item${value === c.slug ? ' active' : ''}`}
                onClick={() => select(c.slug)}
              >
                <ContinentIcon slug={c.slug} />
                <span>{isZh ? c.zh : c.en}</span>
              </button>
            ))}
            {countriesFiltered.length > 0 && (
              <div className="records-region-section">{isZh ? '地区' : 'Region'}</div>
            )}
            {countriesFiltered.map(iso => (
              <button
                key={iso}
                className={`records-region-item${value === iso ? ' active' : ''}`}
                onClick={() => select(iso)}
              >
                <Flag iso2={iso} spanClassName="country-flag" imgClassName="country-flag-ct" />
                <span>{countryName(iso, isZh)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
