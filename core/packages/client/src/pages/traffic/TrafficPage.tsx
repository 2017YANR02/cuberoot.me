/**
 * /traffic — WCA-gated 站内流量统计.
 * 数据来源: GET /v1/analytics/summary?range=7d|30d|90d|all (Bearer auth).
 * 4 块: PV/UV 折线 + Top 路径 + Top 来源 + 国家分布.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import LangToggle from '../../components/LangToggle';
import { Flag } from '../../utils/flag';
import { countryName } from '../../utils/country_name';
import { useAuthStore } from '../../stores/auth_store';
import { apiUrl } from '../../utils/api_base';
import { getLangQuery } from '../../i18n';
import './traffic.css';

type Range = '7d' | '30d' | '90d' | 'all';

interface DailyRow { day: string; pv: number; uv: number }
interface PathRow { path: string; pv: number; uv: number; avg_dwell_ms: number | null }
interface RefRow { ref_domain: string; pv: number; uv: number }
interface CountryRow { country: string; pv: number; uv: number }

interface Summary {
  range: Range;
  generated_at: string;
  totals: { pv: number; uv_sum_of_days: number; days: number };
  daily: DailyRow[];
  paths: PathRow[];
  referrers: RefRow[];
  countries: CountryRow[];
}

function token(): string | null {
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}

async function fetchSummary(range: Range): Promise<Summary> {
  const t = token();
  const res = await fetch(apiUrl(`/v1/analytics/summary?range=${range}`), {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

function fmtDwell(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

export default function TrafficPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const T = (zh: string, en: string) => (isZh ? zh : en);
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);

  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setErr(null);
    fetchSummary(range)
      .then(setData)
      .catch(e => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [range, user]);

  if (!user) {
    return (
      <div className="tr-page">
        <header className="tr-header">
          <div className="tr-header-left">
            <Link to={`/${getLangQuery()}`} className="tr-back" aria-label={T('返回首页', 'Back')}>
              <ArrowLeft size={18} />
            </Link>
            <h1 className="tr-title">{T('流量统计', 'Traffic')}</h1>
          </div>
          <LangToggle variant="inline" />
        </header>
        <div className="tr-gate">
          <p>{T('登录后查看站内流量统计.', 'Sign in to view site traffic analytics.')}</p>
          <button className="tr-login-btn" onClick={login}>
            {T('用 WCA 账号登录', 'Sign in with WCA')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tr-page">
      <header className="tr-header">
        <div className="tr-header-left">
          <Link to={`/${getLangQuery()}`} className="tr-back" aria-label={T('返回首页', 'Back')}>
            <ArrowLeft size={18} />
          </Link>
          <h1 className="tr-title">{T('流量统计', 'Traffic')}</h1>
        </div>
        <LangToggle variant="inline" />
      </header>

      <div className="tr-toolbar">
        <div className="tr-range-tabs" role="tablist">
          {(['7d', '30d', '90d', 'all'] as Range[]).map(r => (
            <button
              key={r}
              role="tab"
              aria-selected={r === range}
              className={`tr-range-btn${r === range ? ' is-active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r === 'all' ? T('全部', 'All') : r}
            </button>
          ))}
        </div>
        {data && (
          <div className="tr-totals">
            {T('共', '')} <b>{data.totals.pv.toLocaleString()}</b> {T('次访问', 'pageviews')}
            {data.totals.days > 0 && ` · ${data.totals.days} ${T('天', 'days')}`}
          </div>
        )}
      </div>

      {loading && <div className="tr-loading">{T('加载中…', 'Loading…')}</div>}
      {err && <div className="tr-error">{err}</div>}

      {data && !loading && !err && (
        <>
          <TrafficTimeSeries data={data.daily} isZh={isZh} />
          <TopPaths rows={data.paths} isZh={isZh} />
          <TopRefs rows={data.referrers} isZh={isZh} />
          <TopCountries rows={data.countries} isZh={isZh} />
        </>
      )}

      <footer className="tr-footer">
        <p>
          {T(
            '隐私: 每次访问只记 URL 路径 + 来源域名 + 国家(粗粒度) + UA 类型. 不存 IP, 不存 UA 字符串. visitor_id = sha256(IP || UA || 今天 || 站内 salt) 截前 16 字节, 每天换一份 → 跨日不可追踪. 原始数据 90 天滚动清理, 仅留日聚合.',
            'Privacy: each visit records only URL path, referrer domain, country (coarse), and UA class. No IP or UA string is stored. visitor_id = sha256(IP || UA || today || site salt) truncated to 16 bytes — rotated daily, not cross-day-trackable. Raw rows are pruned after 90 days; only daily aggregates persist.',
          )}
        </p>
      </footer>
    </div>
  );
}

// ── 子组件 ──────────────────────────────────────────────

function TrafficTimeSeries({ data, isZh }: { data: DailyRow[]; isZh: boolean }) {
  const T = (zh: string, en: string) => (isZh ? zh : en);
  const option = useMemo(() => ({
    grid: { left: 48, right: 16, top: 36, bottom: 28 },
    legend: { top: 4, textStyle: { color: '#cfd3dc' } },
    tooltip: { trigger: 'axis' as const },
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d.day),
      axisLabel: { color: '#aab1bd', fontSize: 11 },
      axisLine: { lineStyle: { color: '#3a3f4a' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#aab1bd', fontSize: 11 },
      splitLine: { lineStyle: { color: '#2a2e36' } },
    },
    series: [
      {
        name: 'PV',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: data.map(d => d.pv),
        lineStyle: { color: '#5b9dd9', width: 2 },
        areaStyle: { color: 'rgba(91,157,217,0.15)' },
      },
      {
        name: 'UV',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: data.map(d => d.uv),
        lineStyle: { color: '#f0a04b', width: 2 },
      },
    ],
  }), [data]);

  return (
    <section className="tr-section">
      <h2 className="tr-section-title">{T('每日 PV / UV', 'Daily PV / UV')}</h2>
      {data.length === 0 ? (
        <div className="tr-empty">{T('暂无数据', 'No data')}</div>
      ) : (
        <div className="tr-chart-wrap">
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
        </div>
      )}
    </section>
  );
}

function TopPaths({ rows, isZh }: { rows: PathRow[]; isZh: boolean }) {
  const T = (zh: string, en: string) => (isZh ? zh : en);
  if (rows.length === 0) {
    return (
      <section className="tr-section">
        <h2 className="tr-section-title">{T('热门路径', 'Top paths')}</h2>
        <div className="tr-empty">{T('暂无数据', 'No data')}</div>
      </section>
    );
  }
  const maxPv = rows[0]?.pv ?? 1;
  return (
    <section className="tr-section">
      <h2 className="tr-section-title">{T('热门路径', 'Top paths')}</h2>
      <ul className="tr-rank-list">
        {rows.map(r => (
          <li key={r.path} className="tr-rank-row">
            <span className="tr-rank-label" title={r.path}>{r.path}</span>
            <div className="tr-rank-bar-wrap">
              <div className="tr-rank-bar" style={{ width: `${(r.pv / maxPv) * 100}%` }} />
            </div>
            <span className="tr-rank-pv">{r.pv.toLocaleString()}</span>
            <span className="tr-rank-uv">{r.uv.toLocaleString()} UV</span>
            <span className="tr-rank-dwell" title={T('平均停留', 'Avg dwell')}>{fmtDwell(r.avg_dwell_ms)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopRefs({ rows, isZh }: { rows: RefRow[]; isZh: boolean }) {
  const T = (zh: string, en: string) => (isZh ? zh : en);
  if (rows.length === 0) {
    return (
      <section className="tr-section">
        <h2 className="tr-section-title">{T('来源', 'Top referrers')}</h2>
        <div className="tr-empty">{T('暂无数据', 'No data')}</div>
      </section>
    );
  }
  const maxPv = rows[0]?.pv ?? 1;
  return (
    <section className="tr-section">
      <h2 className="tr-section-title">{T('来源', 'Top referrers')}</h2>
      <ul className="tr-rank-list">
        {rows.map(r => (
          <li key={r.ref_domain} className="tr-rank-row">
            <span className="tr-rank-label">
              {r.ref_domain === '(direct)' ? T('直接访问', 'Direct') : r.ref_domain}
            </span>
            <div className="tr-rank-bar-wrap">
              <div className="tr-rank-bar" style={{ width: `${(r.pv / maxPv) * 100}%` }} />
            </div>
            <span className="tr-rank-pv">{r.pv.toLocaleString()}</span>
            <span className="tr-rank-uv">{r.uv.toLocaleString()} UV</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopCountries({ rows, isZh }: { rows: CountryRow[]; isZh: boolean }) {
  const T = (zh: string, en: string) => (isZh ? zh : en);
  if (rows.length === 0) {
    return (
      <section className="tr-section">
        <h2 className="tr-section-title">{T('国家分布', 'Top countries')}</h2>
        <div className="tr-empty">{T('暂无数据', 'No data')}</div>
      </section>
    );
  }
  const maxPv = rows[0]?.pv ?? 1;
  return (
    <section className="tr-section">
      <h2 className="tr-section-title">{T('国家分布', 'Top countries')}</h2>
      <ul className="tr-rank-list">
        {rows.map(r => {
          const isUnknown = r.country === 'XX' || !r.country;
          return (
            <li key={r.country} className="tr-rank-row">
              <span className="tr-rank-label tr-rank-country">
                {isUnknown ? (
                  <span className="tr-flag-placeholder" aria-hidden="true">??</span>
                ) : (
                  <Flag iso2={r.country.toLowerCase()} className="tr-flag" />
                )}
                {isUnknown ? T('未知', 'Unknown') : (countryName(r.country, isZh) || r.country)}
              </span>
              <div className="tr-rank-bar-wrap">
                <div className="tr-rank-bar" style={{ width: `${(r.pv / maxPv) * 100}%` }} />
              </div>
              <span className="tr-rank-pv">{r.pv.toLocaleString()}</span>
              <span className="tr-rank-uv">{r.uv.toLocaleString()} UV</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
