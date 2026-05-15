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
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, X as XIcon, RefreshCw } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { Flag } from '../../utils/flag';
import { RecordBadge } from '../../components/RecordBadge';
import { eventDisplayName } from '../../utils/wca_events';
import { displayCuberName } from '../../utils/name_utils';
import { countryToIso2, loadFlagData, compFlagIso2 } from '../../utils/country_flags';
import { countryName } from '../../utils/country_name';
import { localizeCompName } from '../../utils/comp_localize';
import { apiUrl } from '../../utils/api_base';
import { fetchPb, prefetchPbs, type PbByEvent } from './wca_pb';
import WcaEventSelector from '../../components/WcaEventSelector';
import { EventIcon } from '../../components/EventIcon/EventIcon';
import { formatWcaResult } from '../../utils/wca_format_result';
import { rememberRecent } from './CompIndexPage';
import { useLiveStream, applyResultPatch, type LivePatch } from './useLiveStream';
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

interface MembersByFilter {
  females: number[];
  children: number[];
  newcomers: number[];
}

interface CompData {
  slug: string;
  cubingSlug?: string;
  source?: 'cubing' | 'wca';
  availableSources?: ('cubing' | 'wca')[];
  compId: number;
  name: string;
  type: string;
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
  membersByFilter?: MembersByFilter;
  fetchedAt: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────

/** cubing.com region 字符串 → ISO2 (走 utils/country_flags 单一来源,跟 wca-stats / globe 一致) */
function regionToIso2(region: string): string {
  if (!region) return '';
  if (region.length === 2) return region.toLowerCase();
  return countryToIso2(region) || '';
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

/** cubing.com 给的 round.name 是英文,中文模式翻一下。
 *  覆盖常见 "First round" / "Second round" / "Semi Final" / "Quarter Final" / "Final"。 */
const ROUND_NAME_ZH: Record<string, string> = {
  'First round': '初赛',
  'Second round': '复赛',
  'Third round': '第三轮',
  'Quarter Final': '1/4 决赛',
  'Semi Final': '半决赛',
  'Final': '决赛',
};
function roundDisplayName(rdName: string, isZh: boolean): string {
  if (!isZh) return rdName;
  return ROUND_NAME_ZH[rdName] || rdName;
}

/** cubing.com region 字符串 → 显示名:走 utils/country_name 单一来源。 */
function regionDisplay(region: string, isZh: boolean): string {
  if (!region) return '';
  const iso2 = regionToIso2(region);
  if (iso2) return countryName(iso2.toUpperCase(), isZh);
  return region;
}

/** Decode common HTML entities (cubing.com title 里 ' 存成 &#039;) */
function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// ─── 组件 ─────────────────────────────────────────────────────────────────

export default function CompDetailPage() {
  const { slug: rawSlug = '' } = useParams<{ slug: string }>();
  const slug = rawSlug.replace(/-/g, ''); // canonical = WCA ID
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [searchParams, setSearchParams] = useSearchParams();
  // 老 URL (Xuzhou-Zenith-2026) → 重定向到 WCA ID 形态
  useEffect(() => {
    if (rawSlug && rawSlug !== slug) {
      navigate(`/comp/${slug}${window.location.search}`, { replace: true });
    }
  }, [rawSlug, slug, navigate]);

  const [data, setData] = useState<CompData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; filter?: string; done: number; total: number } | null>(null);
  // _flagDataVer 仅用来触发重渲染(loadFlagData 完成后 localizeCompName/countryName 才能查到中文)
  const [, setFlagDataVer] = useState(0);
  useEffect(() => { loadFlagData().then(setFlagDataVer); }, []);
  // PR map: wcaid → PbByEvent. null = fetched, no data.
  const [pbVer, setPbVer] = useState(0); // bump to force re-render after prefetch
  const [openedCuber, setOpenedCuber] = useState<number | null>(null);

  // 当前选 round
  const eventParam = searchParams.get('event') || '';
  const roundParam = searchParams.get('round') || '';
  const filterParam = searchParams.get('filter') || 'all';
  const viewParam = (searchParams.get('view') === 'psych' ? 'psych' : 'live') as 'live' | 'psych';
  const psychEventParam = searchParams.get('psychEvent') || '';
  const sourceParam = searchParams.get('source'); // 'wca' | 'cubing' | null=auto

  // ── fetch comp data ────────────────────────────────────────────────────

  const load = useCallback(() => {
    setError(null);
    setProgress(null);
    return new Promise<void>((resolve) => {
      const q = sourceParam ? `?source=${encodeURIComponent(sourceParam)}` : '';
      const url = apiUrl(`/v1/cubing-live-stream/${encodeURIComponent(slug)}${q}`);
      const es = new EventSource(url);
      let finished = false;
      const fallback = () => {
        // SSE 出错或不可用 → 回退到普通 JSON
        es.close();
        fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}${q}`))
          .then(async r => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
              throw new Error(j.error || `HTTP ${r.status}`);
            }
            return r.json();
          })
          .then(j => {
            setData(j);
            rememberRecent(j.slug, j.name);
          })
          .catch(e => setError((e as Error).message))
          .finally(() => { setProgress(null); resolve(); });
      };
      es.addEventListener('progress', (ev) => {
        try { setProgress(JSON.parse((ev as MessageEvent).data)); } catch {}
      });
      es.addEventListener('done', (ev) => {
        finished = true;
        try {
          const j = JSON.parse((ev as MessageEvent).data) as CompData;
          setData(j);
          rememberRecent(j.slug, j.name);
        } catch (e) {
          setError((e as Error).message);
        }
        es.close();
        setProgress(null);
        resolve();
      });
      es.addEventListener('error', (ev) => {
        try {
          const data = (ev as MessageEvent).data;
          if (data) {
            const j = JSON.parse(data);
            if (j.error) setError(j.error);
          }
        } catch {}
        if (finished) return;
        // 连接错误 (EventSource 默认会重连;此处不让它重连,直接 fallback)
        if (!finished) fallback();
      });
    });
  }, [slug, sourceParam]);

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

  // ── 实时增量: 直连 wss://cubing.com/ws,把 result.new / result.update / round.update / users patch 进 data ──

  const applyPatch = useCallback((patch: LivePatch) => {
    setData(prev => {
      if (!prev) return prev;
      if (patch.kind === 'result.new' || patch.kind === 'result.update') {
        const r = patch.result;
        // 只接收本比赛的事件 (server 会按 competitionId 过滤,这里再防一道)
        if (r.c !== prev.compId) return prev;
        const key = `${r.e}:${r.r}`;
        const arr = prev.resultsByRound[key] || [];
        const nextArr = applyResultPatch(arr, patch);
        return {
          ...prev,
          resultsByRound: { ...prev.resultsByRound, [key]: nextArr },
          fetchedAt: Date.now(),
        };
      }
      if (patch.kind === 'round.update') {
        const ru = patch.round;
        const events = prev.events.map(ev => {
          if (ev.i !== ru.e) return ev;
          return {
            ...ev,
            rs: ev.rs.map(rd => rd.i === ru.i ? { ...rd, ...ru } : rd),
          };
        });
        return { ...prev, events, fetchedAt: Date.now() };
      }
      if (patch.kind === 'users') {
        return { ...prev, users: { ...prev.users, ...patch.users }, fetchedAt: Date.now() };
      }
      return prev;
    });
  }, []);

  const isWca = data?.source === 'wca';
  const wsStatus = useLiveStream({ compId: isWca ? null : (data?.compId ?? null), applyPatch });

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
    let arr = all;
    if (filterParam !== 'all') {
      const members = data.membersByFilter?.[filterParam as keyof MembersByFilter];
      if (members) {
        const set = new Set(members);
        arr = all.filter(r => set.has(r.n));
      }
    }
    // WCA 排名:平均赛制按 avg ASC,best ASC tiebreaker;best-of-N 按 best ASC。
    // DNF (-1) / DNS (-2) / 空 (0) 一律排到最后。
    // 用三态 cmp 而不是减法 — Infinity - Infinity = NaN,会让 tiebreak 失效。
    const f = currentRound.rd.f;
    const byAvg = f === 'a' || f === 'm' || f === '';
    const rankKey = (v: number) => (v > 0 ? v : Infinity);
    const cmp = (a: number, b: number) => a < b ? -1 : a > b ? 1 : 0;
    return arr.slice().sort((x, y) => {
      const primary = byAvg ? cmp(rankKey(x.a), rankKey(y.a)) : cmp(rankKey(x.b), rankKey(y.b));
      if (primary !== 0) return primary;
      return cmp(rankKey(x.b), rankKey(y.b));
    });
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

  const onChangeView = (value: 'live' | 'psych') => {
    const next = new URLSearchParams(searchParams);
    if (value === 'live') next.delete('view');
    else next.set('view', 'psych');
    setSearchParams(next, { replace: false });
  };

  const onChangePsychEvent = (eventId: string) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set('psychEvent', eventId);
    else next.delete('psychEvent');
    setSearchParams(next, { replace: false });
  };

  // Psych Sheet: prefetch PRs for ALL competitors when entering view (cache dedupe handles dupes)
  useEffect(() => {
    if (viewParam !== 'psych' || !data) return;
    const wcaIds = Object.values(data.users).map(u => u.wcaid).filter(Boolean);
    if (wcaIds.length === 0) return;
    let cancelled = false;
    prefetchPbs(wcaIds).then(() => { if (!cancelled) setPbVer(v => v + 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [viewParam, data]);

  // 空 = 选手名单(全部);否则按所选项目 PR 排
  const psychEventId = useMemo(() => {
    if (!data) return '';
    if (psychEventParam && data.events.some(e => e.i === psychEventParam)) return psychEventParam;
    return '';
  }, [data, psychEventParam]);

  // ── 渲染 ───────────────────────────────────────────────────────────────

  if (loading) {
    const pct = progress && progress.total > 0 ? Math.round(100 * progress.done / progress.total) : 0;
    const stepLabel = (() => {
      if (!progress) return isZh ? '加载中…' : 'Loading…';
      const f = progress.filter ? ` · ${progress.filter}` : '';
      const map: Record<string, string> = isZh
        ? { 'meta': '读取比赛元数据', 'cubing.results': '加载成绩', 'cubing.filter': '加载分组成员', 'wca.fetch': '从 WCA 拉取', 'wca.transform': '解析 WCA 数据' }
        : { 'meta': 'Reading metadata', 'cubing.results': 'Loading results', 'cubing.filter': 'Loading filters', 'wca.fetch': 'Fetching WCA data', 'wca.transform': 'Parsing WCA data' };
      return (map[progress.step] || progress.step) + f;
    })();
    return (
      <div className="comp-detail-page">
        <div className="comp-loading">
          <div className="comp-loading-label">{stepLabel} {progress ? `(${progress.done}/${progress.total})` : ''}</div>
          <div className="comp-loading-bar"><div className="comp-loading-bar-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
    );
  }
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

      <div className="comp-table-section">
        <header className="comp-detail-header">
          <Link to="/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
          <h1 className="comp-detail-title">
            {(() => {
              const iso2 = compFlagIso2(slug);
              const href = isWca
                ? `https://www.worldcubeassociation.org/competitions/${data.slug}`
                : `https://cubing.com/live/${data.cubingSlug || data.slug}`;
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comp-detail-title-link"
                  title={isWca ? 'WCA' : 'cubing.com'}
                >
                  {iso2 && <Flag iso2={iso2} className="comp-flag comp-title-flag" />}
                  {localizeCompName(slug, decodeEntities(data.name), isZh)}
                </a>
              );
            })()}
          </h1>
          <div className="comp-detail-meta">
            {data.availableSources && data.availableSources.length > 1 && (
              <div className="comp-source-toggle" role="group" aria-label={isZh ? '数据源' : 'Data source'}>
                {data.availableSources.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`comp-source-btn${data.source === s ? ' is-active' : ''}`}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      if (s === 'wca') next.delete('source'); // wca = 默认,清掉 query
                      else next.set('source', s);
                      setSearchParams(next, { replace: false });
                    }}
                  >
                    {s === 'wca' ? 'WCA' : 'cubing.com'}
                  </button>
                ))}
              </div>
            )}
            <span className="comp-detail-fetched">
              {isZh ? '更新于' : 'Updated'} {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
            {!isWca && <LiveIndicator status={wsStatus} isZh={isZh} />}
            {!isWca && wsStatus !== 'open' && (
              <button type="button" className="comp-refresh-btn" onClick={refresh} disabled={refreshing} title={isZh ? '刷新' : 'Refresh'}>
                <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} />
              </button>
            )}
          </div>
        </header>

        <div className="comp-view-tabs">
          <button
            type="button"
            className={`comp-view-tab${viewParam === 'live' ? ' is-active' : ''}`}
            onClick={() => onChangeView('live')}
          >
            {isZh ? (isWca ? '成绩' : '直播成绩') : (isWca ? 'Results' : 'Live')}
          </button>
          <button
            type="button"
            className={`comp-view-tab${viewParam === 'psych' ? ' is-active' : ''}`}
            onClick={() => onChangeView('psych')}
          >
            {isZh ? '赛前榜' : 'Psych Sheet'}
          </button>
        </div>

        {viewParam === 'live' ? (
          <>
            <div className="comp-selectors">
              <select
                className="comp-select comp-round-select"
                value={currentRound ? roundKey(currentRound.ev.i, currentRound.rd.i) : ''}
                onChange={e => onChangeRound(e.target.value)}
              >
                {roundOptions.map(o => (
                  <option key={o.key} value={o.key}>
                    {eventDisplayName(o.ev.i, isZh)} - {roundDisplayName(o.rd.name, isZh)}
                    {o.rd.s === 1 ? ` - ${isZh ? '已结束' : 'Finished'}` : o.rd.s === 2 ? ` - ${isZh ? '实时' : 'Live'}` : ''}
                    {' '}({o.rd.rn})
                  </option>
                ))}
              </select>

              {!isWca && (
                <select
                  className="comp-select comp-filter-select"
                  value={filterParam}
                  onChange={e => onChangeFilter(e.target.value)}
                >
                  {filterOptions.map(f => (
                    <option key={f.value} value={f.value}>{isZh ? f.labelZh : f.labelEn}</option>
                  ))}
                </select>
              )}
            </div>

            <ResultsTable
              results={filteredResults}
              users={data.users}
              round={currentRound?.rd}
              isZh={isZh}
              pbMap={pbMap}
              onClickCuber={n => setOpenedCuber(n)}
            />
          </>
        ) : (
          <PsychSheet
            data={data}
            isZh={isZh}
            eventId={psychEventId}
            onChangeEvent={onChangePsychEvent}
            pbMap={pbMap}
            onClickCuber={n => setOpenedCuber(n)}
          />
        )}
      </div>

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
                  <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                  <button
                    type="button"
                    className="cuber-link"
                    onClick={() => onClickCuber(r.n)}
                    title={regionDisplay(u.region, isZh)}
                  >
                    {displayCuberName(u.name, isZh)}
                  </button>
                </td>
                {showAvg && (
                  <td className="td-avg">
                    {formatLive(r.a, r.e, true)}
                    {r.ar
                      ? <RecordBadge record={String(r.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                      : averagePr ? <RecordBadge record="PR" variant="inline" /> : null}
                  </td>
                )}
                <td className="td-best">
                  {formatLive(r.b, r.e, false)}
                  {r.sr
                    ? <RecordBadge record={r.sr} variant="inline" iso2={regionToIso2(u.region)} />
                    : singlePr ? <RecordBadge record="PR" variant="inline" /> : null}
                </td>
                {Array.from({ length: attemptCount }).map((_, i) => (
                  <td key={i} className="td-attempt">{formatLive(r.v[i] ?? 0, r.e, false)}</td>
                ))}
              </tr>
            );
          })}
          {results.length === 0 && (
            <tr><td colSpan={5 + attemptCount} className="comp-empty">{isZh ? '此轮暂无成绩' : 'No results yet'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── PsychSheet: 赛前榜 (按 WCA PR 排序) ──────────────────────────────────

interface PsychSheetProps {
  data: CompData;
  isZh: boolean;
  eventId: string;
  onChangeEvent: (id: string) => void;
  pbMap: Record<string, PbByEvent | null>;
  onClickCuber: (number: number) => void;
}

function PsychSheet({ data, isZh, eventId, onChangeEvent, pbMap, onClickCuber }: PsychSheetProps) {
  const availableEvents = useMemo(() => new Set(data.events.map(e => e.i)), [data.events]);

  // 每位选手参赛的项目集合(用于"选手名单"模式右侧 icon 行)
  const userEvents = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const ev of data.events) {
      const inEvent = new Set<number>();
      for (const rd of ev.rs) {
        for (const r of data.resultsByRound[`${ev.i}:${rd.i}`] ?? []) inEvent.add(r.n);
      }
      for (const n of inEvent) {
        if (!map.has(n)) map.set(n, []);
        map.get(n)!.push(ev.i);
      }
    }
    return map;
  }, [data]);

  // eventId 空 → 选手名单(全部 users,按名字字母序);否则按所选项目 PR 排
  const psychRows = useMemo(() => {
    if (!eventId) return [];
    const numbers = new Set<number>();
    for (const rd of data.events.find(e => e.i === eventId)?.rs ?? []) {
      for (const r of data.resultsByRound[`${eventId}:${rd.i}`] ?? []) {
        numbers.add(r.n);
      }
    }
    const rankKey = (v: number | undefined) => (v && v > 0 ? v : Infinity);
    const cmp = (a: number, b: number) => a < b ? -1 : a > b ? 1 : 0;
    const arr = [...numbers]
      .map(n => {
        const u = data.users[String(n)];
        if (!u) return null;
        const pb = u.wcaid ? pbMap[u.wcaid] : null;
        const single = pb?.[eventId]?.single?.best;
        const average = pb?.[eventId]?.average?.best;
        return { n, u, single, average };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    arr.sort((x, y) => {
      const byAvg = cmp(rankKey(x.average), rankKey(y.average));
      if (byAvg !== 0) return byAvg;
      return cmp(rankKey(x.single), rankKey(y.single));
    });
    return arr;
  }, [data, eventId, pbMap]);

  const rosterRows = useMemo(() => {
    if (eventId) return [];
    const all = Object.values(data.users);
    all.sort((a, b) => displayCuberName(a.name, isZh).localeCompare(displayCuberName(b.name, isZh)));
    return all;
  }, [data, eventId, isZh]);

  return (
    <>
      <div className="comp-psych-eventbar">
        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={eventId}
          onSelect={onChangeEvent}
          isZh={isZh}
          allowAll
          onlyAvailable
        />
      </div>
      <div className="comp-table-wrap">
        <table className="comp-table">
          {eventId ? (
            <>
              <thead>
                <tr>
                  <th className="th-place">{isZh ? '名次' : 'Rank'}</th>
                  <th className="th-person">{isZh ? '选手' : 'Person'}</th>
                  <th className="th-avg">{isZh ? '平均 PR' : 'Average PR'}</th>
                  <th className="th-best">{isZh ? '单次 PR' : 'Single PR'}</th>
                </tr>
              </thead>
              <tbody>
                {psychRows.map((row, idx) => {
                  const isOdd = idx % 2 === 1;
                  return (
                    <tr key={row.n} className={isOdd ? 'row-odd' : ''}>
                      <td className="td-place">{idx + 1}</td>
                      <td className="td-person">
                        <Flag iso2={regionToIso2(row.u.region)} className="comp-flag" />
                        <button
                          type="button"
                          className="cuber-link"
                          onClick={() => onClickCuber(row.n)}
                          title={regionDisplay(row.u.region, isZh)}
                        >
                          {displayCuberName(row.u.name, isZh)}
                        </button>
                      </td>
                      <td className="td-avg">{row.average ? formatWcaResult(row.average, eventId, 'average') : '—'}</td>
                      <td className="td-best">{row.single ? formatWcaResult(row.single, eventId, 'single') : '—'}</td>
                    </tr>
                  );
                })}
                {psychRows.length === 0 && (
                  <tr><td colSpan={4} className="comp-empty">{isZh ? '暂无数据' : 'No data'}</td></tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th className="th-place">#</th>
                  <th className="th-person">{isZh ? '选手' : 'Person'}</th>
                  <th>{isZh ? '项目' : 'Events'}</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.map((u, idx) => {
                  const isOdd = idx % 2 === 1;
                  const evs = userEvents.get(u.number) ?? [];
                  return (
                    <tr key={u.number} className={isOdd ? 'row-odd' : ''}>
                      <td className="td-place">{idx + 1}</td>
                      <td className="td-person">
                        <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                        <button
                          type="button"
                          className="cuber-link"
                          onClick={() => onClickCuber(u.number)}
                          title={regionDisplay(u.region, isZh)}
                        >
                          {displayCuberName(u.name, isZh)}
                        </button>
                      </td>
                      <td className="comp-roster-events">
                        {evs.map(e => (
                          <EventIcon key={e} event={e} className="comp-roster-event" title={e} />
                        ))}
                      </td>
                    </tr>
                  );
                })}
                {rosterRows.length === 0 && (
                  <tr><td colSpan={3} className="comp-empty">{isZh ? '暂无数据' : 'No data'}</td></tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </>
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
            <span className="comp-modal-region">{regionDisplay(u.region, isZh)}</span>
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
                          <td>{roundDisplayName(en.rd.name, isZh)}</td>
                          <td>{place}</td>
                          <td>
                            {formatLive(result.b, result.e, false)}
                            {result.sr
                              ? <RecordBadge record={result.sr} variant="inline" iso2={regionToIso2(u.region)} />
                              : singlePr ? <RecordBadge record="PR" variant="inline" /> : null}
                          </td>
                          <td>
                            {isAverageFormat ? formatLive(result.a, result.e, true) : ''}
                            {isAverageFormat && (result.ar
                              ? <RecordBadge record={String(result.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                              : averagePr ? <RecordBadge record="PR" variant="inline" /> : null)}
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

// ─── LiveIndicator ───────────────────────────────────────────────────────

function LiveIndicator({ status, isZh }: { status: import("./useLiveStream").WsStatus; isZh: boolean }) {
  const label = (() => {
    switch (status) {
      case "open":       return isZh ? "实时" : "Live";
      case "connecting": return isZh ? "连接中" : "Connecting";
      case "closed":     return isZh ? "已断开" : "Disconnected";
      case "error":      return isZh ? "连接失败" : "Error";
      default:           return "";
    }
  })();
  if (!label) return null;
  return (
    <span className={`comp-live-indicator status-${status}`} title={isZh ? "wss://cubing.com/ws 实时推送" : "wss://cubing.com/ws live stream"}>
      <span className="comp-live-dot" />
      {label}
    </span>
  );
}
