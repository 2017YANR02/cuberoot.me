/**
 * /comp/:slug — cubing.com 单场比赛直播视图
 *
 * 数据流: GET /v1/cubing-live/:slug → 一次性 server 端 scrape + WS 抓 users+全 round 成绩。
 * 主体 UI: 上方 round 下拉(分组,按 events 顺序) + filter 下拉; 下方成绩表;
 *         点击选手名 → 弹该选手所有 round 的全部成绩。
 * PR 标志: 启动后异步 prefetch 该 round 所有 WCA ID 的 personal_records,
 *         result.b/.a ≤ pre-comp PR(或本比赛之前的更优) → 标黄。
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, X as XIcon, RefreshCw } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { Flag } from '../../utils/flag';
import { eventDisplayName } from '../../utils/wca_events';
import { displayCuberName } from '../../utils/name_utils';
import { apiUrl } from '../../utils/api_base';
import { fetchPb, prefetchPbs, type PbByEvent } from './wca_pb';
import { rememberRecent } from './CompIndexPage';
import './comp.css';

// ─── 类型(与 server 端 cubing_live.ts 保持一致) ─────────────────────────

interface User {
  number: number;
  name: string;
  wcaid: string;
  region: string;
}

interface RoundMeta {
  i: string;
  e: string;
  f: string;
  co: number;
  tl: number;
  n: number;
  s: number;
  rn: number;
  tt: number;
  name: string;
}

interface EventMeta {
  i: string;
  name: string;
  rs: RoundMeta[];
}

interface LiveResult {
  i: number; c: number; n: number; e: string; r: string; f: string;
  b: number; a: number; v: number[]; sr: string; ar: string | number;
}

interface CompData {
  slug: string;
  compId: number;
  name: string;
  type: string;
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
  fetchedAt: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────

/** 比赛 region 标识 → ISO2 (常规国家全名 or 已是 ISO2 都接受) */
function regionToIso2(region: string): string {
  if (!region) return '';
  if (region.length === 2) return region.toLowerCase();
  // 走 country_flags 的 countryToIso2,但这里 region 是 cubing.com 自描述
  // 简单映射常见值,降级 fallback 给 Flag 组件
  const map: Record<string, string> = {
    'China': 'cn',
    'Hong Kong, China': 'hk',
    'Chinese Taipei': 'tw',
    'Taiwan, China': 'tw',
    'Macau, China': 'mo',
    'United States': 'us',
    'United Kingdom': 'gb',
    'Korea': 'kr',
    'Japan': 'jp',
  };
  return map[region] || region.toLowerCase();
}

/** 把 result 的 b/a 与 sr/ar(若实时已被 server 打标记) 拍平成 PR 标志结构。
 *  PR 判定: 比赛之前 WCA 的 PB(=刚 fetch 到的 PbByEvent[event].single/.average.best)。
 *  注: WCA 已收录该比赛的话,PB 会包含本比赛的成绩,此时只有“最好那把”相等 = PR;
 *  比赛进行中的话,PB 不包含,首次 sub-PB 就算 PR。 */
function classifyPr(result: LiveResult, pb: PbByEvent | null): { singlePr: boolean; averagePr: boolean } {
  if (!pb) return { singlePr: false, averagePr: false };
  const entry = pb[result.e];
  if (!entry) {
    // 之前没拿过该项目 PR ⇒ 任意有效成绩都算 PR
    return { singlePr: result.b > 0, averagePr: result.a > 0 };
  }
  const sBest = entry.single?.best ?? Infinity;
  const aBest = entry.average?.best ?? Infinity;
  return {
    singlePr: result.b > 0 && result.b <= sBest,
    averagePr: result.a > 0 && result.a <= aBest,
  };
}

/** 把 cubing.com 的 centiseconds 格式化为显示字符串。
 *  注意 cubing.com 的 v[]/b/a 编码与 WCA 不完全一致:
 *    - 普通项目: centiseconds (单/平均都是)
 *    - FMC (333fm): single 是 raw moves; average 是 moves×100
 *    - MBLD (333mbf): 比赛中 cubing.com 用 1:DD/AA TIME 字符串,这里我们暂时按数字渲染
 *    - DNF = -1, DNS = -2, 空 = 0 → "" */
function formatLive(value: number, eventId: string, isAverage: boolean): string {
  if (value === -1) return 'DNF';
  if (value === -2) return 'DNS';
  if (value === 0) return '';

  if (eventId === '333fm') {
    if (!isAverage) return String(value);
    return (value / 100).toFixed(2);
  }
  if (eventId === '333mbf') {
    // raw encoding very rarely shows up live; fallback "x/y mm:ss" if possible
    return String(value);
  }

  // centiseconds → m:ss.cc / s.cc
  const total = value / 100;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  if (m > 0) {
    const sStr = s.toFixed(2).padStart(5, '0');
    return `${m}:${sStr}`;
  }
  return s.toFixed(2);
}

/** 每个 round 的稳定 key: "<event>:<round>"  */
function roundKey(e: string, r: string): string { return `${e}:${r}`; }

/** Round 状态 → 中英描述 (Open / Finished / Live) */
function statusLabel(rd: RoundMeta, isZh: boolean): string {
  const map = ['Open', 'Finished', 'Live'];
  const en = map[rd.s] || '';
  if (!isZh) return en;
  return ({ 'Open': '进行中', 'Finished': '已结束', 'Live': '实时' } as Record<string, string>)[en] || en;
}

// ─── 组件 ─────────────────────────────────────────────────────────────────

export default function CompDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<CompData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PR map: wcaid → PbByEvent. null = fetched, no data.
  const [pbVer, setPbVer] = useState(0); // bump to force re-render after prefetch
  const [openedCuber, setOpenedCuber] = useState<number | null>(null);

  // 当前选 round
  const eventParam = searchParams.get('event') || '';
  const roundParam = searchParams.get('round') || '';
  const filterParam = searchParams.get('filter') || 'all';

  // ── fetch comp data ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}`));
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setData(j);
      // 记录最近浏览
      rememberRecent(j.slug, j.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    load().finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── 默认选 round: 优先 finished 最近一个 3x3 round,否则第一个有数据的 round ──

  const defaultRoundKey = useMemo(() => {
    if (!data) return null;
    const has = (k: string) => (data.resultsByRound[k] || []).length > 0;
    // priority: 3x3 final > 3x3 latest round > any latest round
    for (const ev of data.events) {
      if (ev.i !== '333') continue;
      for (let i = ev.rs.length - 1; i >= 0; i--) {
        const k = roundKey(ev.i, ev.rs[i].i);
        if (has(k)) return k;
      }
    }
    for (const ev of data.events) {
      for (let i = ev.rs.length - 1; i >= 0; i--) {
        const k = roundKey(ev.i, ev.rs[i].i);
        if (has(k)) return k;
      }
    }
    return null;
  }, [data]);

  // sync URL → state defaults
  useEffect(() => {
    if (!data || !defaultRoundKey) return;
    if (!eventParam || !roundParam) {
      const [e, r] = defaultRoundKey.split(':');
      const next = new URLSearchParams(searchParams);
      next.set('event', e);
      next.set('round', r);
      setSearchParams(next, { replace: true });
    }
  }, [data, defaultRoundKey, eventParam, roundParam, searchParams, setSearchParams]);

  // ── 当前 round + filter ────────────────────────────────────────────────

  const currentRound = useMemo(() => {
    if (!data || !eventParam || !roundParam) return null;
    const ev = data.events.find(e => e.i === eventParam);
    if (!ev) return null;
    const rd = ev.rs.find(r => r.i === roundParam);
    return rd ? { ev, rd } : null;
  }, [data, eventParam, roundParam]);

  const filteredResults = useMemo(() => {
    if (!data || !currentRound) return [];
    const key = roundKey(currentRound.ev.i, currentRound.rd.i);
    const all = data.resultsByRound[key] || [];
    if (filterParam === 'all') return all;
    // 简单 filter: females / newcomers / children — server 端 cubing.com 没传过来这些 flag,
    // 暂时全部返回 all (留作 TODO)。
    return all;
  }, [data, currentRound, filterParam]);

  // ── prefetch PRs for current round ────────────────────────────────────

  useEffect(() => {
    if (!data || !currentRound) return;
    const key = roundKey(currentRound.ev.i, currentRound.rd.i);
    const results = data.resultsByRound[key] || [];
    const wcaIds = results
      .map(r => data.users[String(r.n)]?.wcaid)
      .filter((id): id is string => !!id);
    if (wcaIds.length === 0) return;
    let cancelled = false;
    prefetchPbs(wcaIds).then(() => { if (!cancelled) setPbVer(v => v + 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [data, currentRound]);

  // 同步从 cache 读 PR (sync) — 渲染时调
  const getPbSync = useCallback((wcaid: string): PbByEvent | null => {
    if (!wcaid) return null;
    // fetchPb 立即返回 promise,缓存的 promise 同步含 `.then` 但 settled value 只能异步取
    // 用 pbVer 触发重渲染后 promise 已 resolve,这里依靠 promise 的内部 state
    let result: PbByEvent | null = null;
    fetchPb(wcaid).then(v => { result = v; });
    // 等待 microtask
    // 不实用; 改为提供 hook
    return result;
  }, []);
  // 上面的 sync 写法不稳。改成 state map 在 useEffect prefetch 后写入。
  const [pbMap, setPbMap] = useState<Record<string, PbByEvent | null>>({});

  useEffect(() => {
    if (!data) return;
    // 当 pbVer 改变时, 把 cache 里所有 wcaid 的结果 dump 进 pbMap
    const ids = Object.values(data.users).map(u => u.wcaid).filter(Boolean);
    Promise.all(ids.map(async id => [id, await fetchPb(id)] as const))
      .then(pairs => {
        const obj: Record<string, PbByEvent | null> = {};
        for (const [id, pb] of pairs) obj[id] = pb;
        setPbMap(obj);
      });
  }, [data, pbVer]);
  void getPbSync;

  // ── handlers ───────────────────────────────────────────────────────────

  const onChangeRound = (value: string) => {
    const [e, r] = value.split(':');
    if (!e || !r) return;
    const next = new URLSearchParams(searchParams);
    next.set('event', e);
    next.set('round', r);
    setSearchParams(next, { replace: false });
  };

  const onChangeFilter = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('filter', value);
    setSearchParams(next, { replace: false });
  };

  // ── 渲染 ───────────────────────────────────────────────────────────────

  if (loading) return <div className="comp-detail-page"><div className="comp-loading">{isZh ? '加载中…' : 'Loading…'}</div></div>;
  if (error || !data) {
    return (
      <div className="comp-detail-page">
        <Link to="/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
        <div className="comp-err comp-err-block">
          <div className="comp-err-title">{isZh ? '加载失败' : 'Failed to load'}</div>
          <div className="comp-err-detail">{error || 'No data'}</div>
          <button type="button" className="comp-go-btn" onClick={refresh}>{isZh ? '重试' : 'Retry'}</button>
        </div>
      </div>
    );
  }

  const roundOptions = data.events
    .flatMap(ev => ev.rs.map(rd => ({ ev, rd, key: roundKey(ev.i, rd.i) })))
    .filter(o => (data.resultsByRound[o.key] || []).length > 0 || o.rd.s === 2);

  const filterOptions = [
    { value: 'all', labelZh: '全部', labelEn: 'All' },
    { value: 'females', labelZh: '女选手', labelEn: 'Females' },
    { value: 'children', labelZh: '儿童组', labelEn: 'Children' },
    { value: 'newcomers', labelZh: '新人组', labelEn: 'New Comers' },
  ];

  return (
    <div className="comp-detail-page">
      <div className="comp-top-bar">
        <LangToggle variant="fixed" />
        <ThemeToggle />
      </div>

      <header className="comp-detail-header">
        <Link to="/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
        <h1 className="comp-detail-title">{data.name}</h1>
        <div className="comp-detail-meta">
          <a
            href={`https://cubing.com/live/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="comp-detail-link"
            title="cubing.com"
          >
            cubing.com <ExternalLink size={12} />
          </a>
          <span className="comp-detail-fetched">
            {isZh ? '更新于' : 'Updated'} {new Date(data.fetchedAt).toLocaleTimeString()}
          </span>
          <button type="button" className="comp-refresh-btn" onClick={refresh} disabled={refreshing} title={isZh ? '刷新' : 'Refresh'}>
            <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} />
          </button>
        </div>
      </header>

      <div className="comp-selectors">
        <select
          className="comp-select comp-round-select"
          value={currentRound ? roundKey(currentRound.ev.i, currentRound.rd.i) : ''}
          onChange={e => onChangeRound(e.target.value)}
        >
          {roundOptions.map(o => (
            <option key={o.key} value={o.key}>
              {eventDisplayName(o.ev.i, isZh)} - {o.rd.name}
              {o.rd.s === 1 ? ` - ${isZh ? '已结束' : 'Finished'}` : o.rd.s === 2 ? ` - ${isZh ? '实时' : 'Live'}` : ''}
              {' '}({o.rd.rn})
            </option>
          ))}
        </select>

        <select
          className="comp-select comp-filter-select"
          value={filterParam}
          onChange={e => onChangeFilter(e.target.value)}
          disabled
          title={isZh ? '该过滤器待 cubing.com 数据中加入选手 metadata 后启用' : 'Disabled until cubing.com exposes per-cuber tags'}
        >
          {filterOptions.map(f => (
            <option key={f.value} value={f.value}>{isZh ? f.labelZh : f.labelEn}</option>
          ))}
        </select>
      </div>

      {currentRound && (
        <div className="comp-round-banner">
          <span className="comp-round-banner-title">
            {eventDisplayName(currentRound.ev.i, isZh)} - {currentRound.rd.name}
          </span>
          <span className="comp-round-banner-status">
            {statusLabel(currentRound.rd, isZh)}
            {' · '}
            {filteredResults.length} {isZh ? '人' : 'results'}
          </span>
        </div>
      )}

      <ResultsTable
        results={filteredResults}
        users={data.users}
        round={currentRound?.rd}
        isZh={isZh}
        pbMap={pbMap}
        onClickCuber={n => setOpenedCuber(n)}
      />

      {openedCuber !== null && (
        <CuberModal
          number={openedCuber}
          data={data}
          isZh={isZh}
          pbMap={pbMap}
          onClose={() => setOpenedCuber(null)}
        />
      )}
    </div>
  );
}

// ─── ResultsTable ─────────────────────────────────────────────────────────

interface ResultsTableProps {
  results: LiveResult[];
  users: Record<string, User>;
  round: RoundMeta | undefined;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  onClickCuber: (number: number) => void;
}

function ResultsTable({ results, users, round, isZh, pbMap, onClickCuber }: ResultsTableProps) {
  if (!round) return null;
  const isAverageFormat = round.f === 'a' || round.f === 'm' || round.f === '';
  const showAvg = isAverageFormat;
  const attemptCount = round.f === 'a' || round.f === '' ? 5 : round.f === 'm' ? 3 : parseInt(round.f, 10) || 1;

  return (
    <div className="comp-table-wrap">
      <table className="comp-table">
        <thead>
          <tr>
            <th className="th-place">{isZh ? '名次' : 'Place'}</th>
            <th className="th-no">{isZh ? '号' : 'No.'}</th>
            <th className="th-person">{isZh ? '选手' : 'Person'}</th>
            {showAvg && <th className="th-avg">{isZh ? '平均' : 'Average'}</th>}
            <th className="th-best">{isZh ? '单次' : 'Best'}</th>
            <th className="th-region">{isZh ? '地区' : 'Region'}</th>
            <th className="th-detail" colSpan={attemptCount}>{isZh ? '详情' : 'Detail'}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            const u = users[String(r.n)];
            if (!u) return null;
            const pb = pbMap[u.wcaid];
            const { singlePr, averagePr } = classifyPr(r, pb);
            const isOdd = idx % 2 === 1;
            return (
              <tr key={r.i} className={isOdd ? 'row-odd' : ''}>
                <td className="td-place">{r.b === 0 ? '-' : (idx + 1)}</td>
                <td className="td-no">{r.n}</td>
                <td className="td-person">
                  <button type="button" className="cuber-link" onClick={() => onClickCuber(r.n)}>
                    {displayCuberName(u.name, isZh)}
                  </button>
                </td>
                {showAvg && (
                  <td className={`td-avg${averagePr ? ' is-pr' : ''}`} title={averagePr ? (isZh ? '平均 PR' : 'Average PR') : undefined}>
                    {formatLive(r.a, r.e, true)}
                  </td>
                )}
                <td className={`td-best${singlePr ? ' is-pr' : ''}`} title={singlePr ? (isZh ? '单次 PR' : 'Single PR') : undefined}>
                  {formatLive(r.b, r.e, false)}
                </td>
                <td className="td-region">
                  <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                  <span className="region-name">{u.region}</span>
                </td>
                {Array.from({ length: attemptCount }).map((_, i) => (
                  <td key={i} className="td-attempt">{formatLive(r.v[i] ?? 0, r.e, false)}</td>
                ))}
              </tr>
            );
          })}
          {results.length === 0 && (
            <tr><td colSpan={6 + attemptCount} className="comp-empty">{isZh ? '此轮暂无成绩' : 'No results yet'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── CuberModal: 选手所有轮成绩 ───────────────────────────────────────────

interface CuberModalProps {
  number: number;
  data: CompData;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  onClose: () => void;
}

function CuberModal({ number, data, isZh, pbMap, onClose }: CuberModalProps) {
  const u = data.users[String(number)];
  // 收集该选手所有 round 的结果, 按 event/round 顺序
  const rows = useMemo(() => {
    if (!u) return [];
    const out: { ev: EventMeta; rd: RoundMeta; result: LiveResult }[] = [];
    for (const ev of data.events) {
      // 找到该 ev 该选手任何一行 (用 number 匹配)
      // 但要按 round 倒序展示更直观: final > semi > 2 > 1
      const evRows: { ev: EventMeta; rd: RoundMeta; result: LiveResult }[] = [];
      for (const rd of ev.rs) {
        const arr = data.resultsByRound[roundKey(ev.i, rd.i)] || [];
        const hit = arr.find(r => r.n === number);
        if (hit) evRows.push({ ev, rd, result: hit });
      }
      // 按 round 在 ev.rs 中位置倒序 (final 在最前面)
      evRows.reverse();
      out.push(...evRows);
    }
    return out;
  }, [u, data, number]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!u) return null;
  const pb = pbMap[u.wcaid];

  // 按 event 分组渲染
  const groups: { ev: EventMeta; entries: typeof rows }[] = [];
  let cur: { ev: EventMeta; entries: typeof rows } | null = null;
  for (const row of rows) {
    if (!cur || cur.ev.i !== row.ev.i) {
      cur = { ev: row.ev, entries: [] };
      groups.push(cur);
    }
    cur.entries.push(row);
  }

  return (
    <div className="comp-modal-backdrop" onClick={onClose}>
      <div className="comp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="comp-modal-header">
          <div className="comp-modal-title">
            <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
            <span className="cuber-link cuber-link-static">{displayCuberName(u.name, isZh)}</span>
            {u.wcaid && (
              <a
                className="comp-modal-wcaid"
                href={`https://www.worldcubeassociation.org/persons/${u.wcaid}`}
                target="_blank"
                rel="noopener noreferrer"
                title="WCA"
              >
                {u.wcaid} <ExternalLink size={12} />
              </a>
            )}
            <span className="comp-modal-region">{u.region}</span>
          </div>
          <button type="button" className="comp-modal-close" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </header>
        <div className="comp-modal-body">
          {groups.length === 0 ? (
            <div className="comp-empty">{isZh ? '暂无成绩' : 'No results'}</div>
          ) : (
            groups.map(g => (
              <div key={g.ev.i} className="comp-modal-group">
                <h3 className="comp-modal-group-title">{eventDisplayName(g.ev.i, isZh)}</h3>
                <table className="comp-modal-table">
                  <thead>
                    <tr>
                      <th>{isZh ? '轮次' : 'Round'}</th>
                      <th>{isZh ? '名次' : 'Place'}</th>
                      <th>{isZh ? '单次' : 'Best'}</th>
                      <th>{isZh ? '平均' : 'Average'}</th>
                      <th colSpan={5}>{isZh ? '详情' : 'Detail'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.entries.map(en => {
                      const { result } = en;
                      const isAverageFormat = en.rd.f === 'a' || en.rd.f === 'm' || en.rd.f === '';
                      const { singlePr, averagePr } = classifyPr(result, pb);
                      // place: locate cuber within round results sorted as-displayed
                      const arr = data.resultsByRound[roundKey(en.ev.i, en.rd.i)] || [];
                      const idx = arr.findIndex(rr => rr.n === number);
                      const place = idx >= 0 && result.b !== 0 ? idx + 1 : '-';
                      return (
                        <tr key={`${en.ev.i}:${en.rd.i}`}>
                          <td>{en.rd.name}</td>
                          <td>{place}</td>
                          <td className={singlePr ? 'is-pr' : ''}>{formatLive(result.b, result.e, false)}</td>
                          <td className={averagePr && isAverageFormat ? 'is-pr' : ''}>
                            {isAverageFormat ? formatLive(result.a, result.e, true) : ''}
                          </td>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <td key={i}>{formatLive(result.v[i] ?? 0, result.e, false)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
        <footer className="comp-modal-footer">
          <button type="button" className="comp-modal-close-btn" onClick={onClose}>
            {isZh ? '关闭' : 'Close'}
          </button>
        </footer>
      </div>
    </div>
  );
}
