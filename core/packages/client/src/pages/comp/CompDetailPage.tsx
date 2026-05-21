/**
 * /comp/:slug — cubing.com 单场比赛直播视图
 *
 * 数据流: GET /v1/cubing-live/:slug → 一次性 server 端 scrape + WS 抓 users+全 round 成绩。
 * 主体 UI: 上方 round 下拉(分组,按 events 顺序) + filter 下拉; 下方成绩表;
 *         点击选手名 → 弹该选手所有 round 的全部成绩。
 * PR 标志: 启动后异步 prefetch 该 round 所有 WCA ID 的 personal_records,
 *         result.b/.a ≤ pre-comp PR(或本比赛之前的更优) → 标黄。
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, X as XIcon, RefreshCw, Info } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { Flag } from '../../utils/flag';
import { RecordBadge } from '../../components/RecordBadge';
import { eventDisplayName } from '../../utils/wca_events';
import { displayCuberName } from '../../utils/name_utils';
import { countryToIso2, loadFlagData, compFlagIso2 } from '../../utils/country_flags';
import { countryName } from '../../utils/country_name';
import { localizeCompName } from '../../utils/comp_localize';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { apiUrl } from '../../utils/api_base';
import { useAuthStore, ADMIN_WCA_IDS } from '../../stores/auth_store';
import { fetchPb, prefetchPbs, type PbByEvent } from './wca_pb';
import { fetchCompInfo, fetchCompRounds, fetchCubingZh, type CompInfo, type CubingZhMeta } from '../../utils/comp_wcif';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { formatDateRangeIso, toIsoDate } from '../../utils/date_range';
import { localizeCity } from '../../utils/city_localize';
import WcaEventSelector from '../../components/WcaEventSelector';
import { EventIcon } from '../../components/EventIcon/EventIcon';
import { formatWcaResult } from '../../utils/wca_format_result';
import { rememberRecent } from './CompIndexPage';
import { useLiveStream, applyResultPatch, type LivePatch } from './useLiveStream';
import { useWcaLiveStream, type WcaLiveRoundUpdate } from './useWcaLiveStream';
import './comp.css';

// ─── 类型(与 server 端 cubing_live.ts 保持一致) ─────────────────────────

interface User {
  number: number;
  name: string;
  wcaid: string;
  region: string;
  // server 端 enrichComp 已解析填充 — WS patch 时拿这两个字段直接做 tag 推断,免再 fetch 国家/洲映射.
  countryId?: string;
  continentId?: string;
}

interface CompRecordsSnapshot {
  wr: Record<string, number>;  // "event|isAvg" → value
  cr: Record<string, number>;  // "event|isAvg|continent_id" → value
  nr: Record<string, number>;  // "event|isAvg|country_id" → value
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
  liveId?: string; // WCA Live 内部 id (订阅用)
}

interface EventMeta {
  i: string;
  name: string;
  rs: RoundMeta[];
}

interface LiveResult {
  i: number; c: number; n: number; e: string; r: string; f: string;
  b: number; a: number; v: number[]; sr: string; ar: string | number;
  // wca_db 路径预先计算的历史 PR 标志(comp_date 之前累积 PB 比较 + 同比赛内按 round 顺序)
  pS?: boolean; pA?: boolean;
}

interface MembersByFilter {
  females: number[];
  children: number[];
  newcomers: number[];
}

type SourceId = 'cubing' | 'wca' | 'wca_live' | 'wca_db';
interface CompData {
  slug: string;
  cubingSlug?: string;
  wcaLiveId?: string;
  source?: SourceId;
  availableSources?: SourceId[];
  compId: number;
  name: string;
  type: string;
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
  membersByFilter?: MembersByFilter;
  fetchedAt: number;
  /** wca_db 路径预填:每选手本比赛前累积 PB(centiseconds).Psych Sheet 直接消费,避免逐选手调 WCA API 触发 429. */
  personalRecords?: Record<string, Record<string, { single?: number; average?: number }>>;
  /** cubing / wca_live 路径预填:WR/CR/NR 快照(仅本场涉及国家/洲),WS patch 用. */
  currentRecords?: CompRecordsSnapshot;
}

// ─── helpers ──────────────────────────────────────────────────────────────

/** cubing.com region 字符串 → ISO2 (走 utils/country_flags 单一来源,跟 wca-stats / globe 一致) */
function regionToIso2(region: string): string {
  if (!region) return '';
  if (region.length === 2) return region.toLowerCase();
  return countryToIso2(region) || '';
}

/** 把 result 的 b/a 与 sr/ar(若实时已被 server 打标记) 拍平成 PR 标志结构。
 *  优先级:
 *    1. server 历史 PR(result.pS/pA) — wca_db 路径在响应时已按本比赛日期计算好,精确反映"当时"是否 PR.
 *    2. 回退到 WCA REST 当前 PR 比较 — 用于 cubing / wca_live / wca 实时源,数据无历史时只能比当前 PR.
 *       注意:对很老的比赛,选手当前 PR 远好于当年成绩,此路径会漏标 — 必须靠 wca_db 路径补.
 *  注: WCA 已收录该比赛的话,PB 会包含本比赛的成绩,此时只有"最好那把"相等 = PR;
 *  比赛进行中的话,PB 不包含,首次 sub-PB 就算 PR。 */
/** 给 WS 实时推送的成绩做 record tag 推断 — 跟 server enrichComp/inferTag 同款逻辑.
 *  cubing.com / WCA Live 在 WCA 公示前 sr/ar 通常为空,但成绩可能已破纪录;snapshot 来自
 *  comp 初次 fetch 时 server 算好回传的 CompRecordsSnapshot. */
function inferLiveRecordTag(
  value: number,
  eventId: string,
  isAvg: boolean,
  user: User | undefined,
  snapshot: CompRecordsSnapshot | undefined,
): string {
  if (!snapshot || !value || value <= 0) return '';
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const wrMin = snapshot.wr[k];
  if (wrMin !== undefined && value <= wrMin) return 'WR';
  if (!user) return '';
  if (user.continentId) {
    const crMin = snapshot.cr[`${k}|${user.continentId}`];
    if (crMin !== undefined && value <= crMin) return 'CR';
  }
  if (user.countryId) {
    const nrMin = snapshot.nr[`${k}|${user.countryId}`];
    if (nrMin !== undefined && value <= nrMin) return 'NR';
  }
  return '';
}

function classifyPr(result: LiveResult, pb: PbByEvent | null): { singlePr: boolean; averagePr: boolean } {
  // server 已算好,直接用(undefined = wca_db 之外的源,继续走 WCA REST 回退)
  if (result.pS !== undefined || result.pA !== undefined) {
    return { singlePr: !!result.pS, averagePr: !!result.pA };
  }
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
  const user = useAuthStore(s => s.user);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
  // 老 URL (Xuzhou-Zenith-2026) → 重定向到 WCA ID 形态
  useEffect(() => {
    if (rawSlug && rawSlug !== slug) {
      navigate(`/wca/comp/${slug}${window.location.search}`, { replace: true });
    }
  }, [rawSlug, slug, navigate]);

  const [data, setData] = useState<CompData | null>(null);
  const compNameTitle = data ? localizeCompName(slug, data.name, isZh) : slug;
  useDocumentTitle(compNameTitle, compNameTitle);
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
  const [compInfo, setCompInfo] = useState<CompInfo | null>(null);
  const [cubingZh, setCubingZh] = useState<CubingZhMeta | null>(null);
  const [compRounds, setCompRounds] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!slug) return;
    let cancel = false;
    fetchCompInfo(slug).then(info => { if (!cancel) setCompInfo(info); }).catch(() => {});
    fetchCompRounds(slug).then(wcif => {
      if (cancel) return;
      const counts: Record<string, number> = {};
      for (const [eid, formats] of Object.entries(wcif)) counts[eid] = formats.length;
      if (Object.keys(counts).length > 0) setCompRounds(counts);
    }).catch(() => {});
    return () => { cancel = true; };
  }, [slug]);
  useEffect(() => {
    if (!slug || !isZh || compInfo?.country_iso2?.toLowerCase() !== 'cn') {
      setCubingZh(null);
      return;
    }
    let cancel = false;
    fetchCubingZh(slug).then(meta => { if (!cancel) setCubingZh(meta); }).catch(() => {});
    return () => { cancel = true; };
  }, [slug, isZh, compInfo]);

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
      // 任一来源先返回成绩(wca_db / SSE done)就 finish,其它路径自动作废.
      let done = false;
      let es: EventSource | null = null;
      const finishWith = async (j: CompData) => {
        if (done) return;
        done = true;
        // 等中文名 map(comp_names_zh.json + /v1/cn-comp-names 兜底)合并完才首渲,
        // 否则中文模式下会"先英文后中文"闪一下。main.tsx 启动即 fire 过一次,
        // 这里 await 通常立刻 resolve。
        await loadFlagData();
        setData(j);
        rememberRecent(j.slug, j.name);
        setProgress(null);
        if (es) { try { es.close(); } catch { /* ignore */ } }
        resolve();
      };
      const failWith = (msg: string) => {
        if (done) return;
        done = true;
        setError(msg);
        setProgress(null);
        if (es) { try { es.close(); } catch { /* ignore */ } }
        resolve();
      };

      // SSE 主路径 (cubing/wca_live 实时源用 progress 显示).
      const startSse = () => {
        const q = sourceParam ? `?source=${encodeURIComponent(sourceParam)}` : '';
        const url = apiUrl(`/v1/cubing-live-stream/${encodeURIComponent(slug)}${q}`);
        es = new EventSource(url);
        const fallback = () => {
          if (done) return;
          es?.close();
          fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}${q}`))
            .then(async r => {
              if (!r.ok) {
                const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
                throw new Error(j.error || `HTTP ${r.status}`);
              }
              return r.json();
            })
            .then(j => finishWith(j))
            .catch(e => failWith((e as Error).message));
        };
        es.addEventListener('progress', (ev) => {
          if (done) return;
          try { setProgress(JSON.parse((ev as MessageEvent).data)); } catch { /* ignore */ }
        });
        es.addEventListener('done', (ev) => {
          try {
            const j = JSON.parse((ev as MessageEvent).data) as CompData;
            finishWith(j);
          } catch (e) {
            failWith((e as Error).message);
          }
        });
        es.addEventListener('error', (ev) => {
          if (done) return;
          try {
            const data = (ev as MessageEvent).data;
            if (data) {
              const j = JSON.parse(data);
              if (j.error) setError(j.error);
            }
          } catch { /* ignore */ }
          fallback();
        });
      };

      // wca_db fast-path 和 SSE 并发竞速:
      // - 过去比赛 wca_db 通常 100~200ms 出货(HTTP cache 命中即 instant),SSE 在 server 端也走 wca_db
      //   同款 inflight dedup,client 一收到 wca_db 数据就关掉 SSE.
      // - 未来比赛 wca_db 502/null,SSE 兜底 ~3s 完整跑.
      // 不再串行等 1.2s RTT 才开 SSE — 那是 upcoming 比赛打开慢的主因.
      // 用户显式选 cubing/wca_live/wca 时直接走 SSE,跳过 wca_db preflight.
      if (!sourceParam || sourceParam === 'wca_db') {
        // URL 已选定 event+round 时,?only=event:round 轻量请求(~3KB)优先命中
        if (eventParam && roundParam) {
          const only = `${encodeURIComponent(eventParam)}:${encodeURIComponent(roundParam)}`;
          fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}?source=wca_db&only=${only}`))
            .then(r => r.ok ? r.json() : null)
            .then(j => { if (j) finishWith(j); })
            .catch(() => { /* ignore */ });
        }
        fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}?source=wca_db`))
          .then(r => r.ok ? r.json() : null)
          .then(j => { if (j) finishWith(j); })
          .catch(() => { /* ignore */ });
      }
      startSse();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sourceParam]);
  // 故意不依赖 eventParam/roundParam:它们只用于首屏 trimmed 请求,
  // 用户切换轮次后 full 数据已在内存,不需要再发请求.

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
        // WS 推送的 sr/ar 在 WCA 公示前通常为空 — 拿 server 给的 currentRecords 快照推断,
        // 跟初次 HTTP 快照里 server enrichComp 同款.已有 tag 的不动.
        const u = prev.users[String(r.n)];
        if (r.b > 0 && !r.sr) {
          const tag = inferLiveRecordTag(r.b, r.e, false, u, prev.currentRecords);
          if (tag) r.sr = tag;
        }
        if (r.a > 0 && !r.ar) {
          const tag = inferLiveRecordTag(r.a, r.e, true, u, prev.currentRecords);
          if (tag) r.ar = tag;
        }
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

  // wca_db (本地 WCA dump) 是 wca REST 的 fast-path,UI 上当作 wca 同等待:
  // 没有 live 推送、和 wca 共享同一个标题链接 (worldcubeassociation.org)。
  const isWca = data?.source === 'wca' || data?.source === 'wca_db';
  const isWcaLive = data?.source === 'wca_live';
  const isCubing = data?.source === 'cubing';

  // cubing.com WS (只在 cubing 源)
  const cubingWsStatus = useLiveStream({ compId: isCubing ? (data?.compId ?? null) : null, applyPatch });

  // WCA Live subscription (只在 wca_live 源)
  const wcaLiveRounds = useMemo(() => {
    if (!isWcaLive || !data) return [];
    const out: { liveId: string; eventId: string; roundTypeId: string; format: string }[] = [];
    for (const ev of data.events) {
      for (const rd of ev.rs) {
        if (rd.liveId) out.push({ liveId: rd.liveId, eventId: ev.i, roundTypeId: rd.i, format: rd.f });
      }
    }
    return out;
  }, [isWcaLive, data]);
  const wcaLiveNumMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    for (const u of Object.values(data.users)) {
      if (u.wcaid) map.set(u.wcaid, u.number);
    }
    return map;
  }, [data]);
  const onWcaLiveUpdate = useCallback((update: WcaLiveRoundUpdate) => {
    setData(prev => {
      if (!prev) return prev;
      const key = `${update.eventId}:${update.roundTypeId}`;
      // WCA Live subscription 推整轮 — 给每条空 sr/ar 用 snapshot 推断 (跟 WS / 初次 HTTP 同款).
      for (const r of update.rows) {
        const u = prev.users[String(r.n)];
        if (r.b > 0 && !r.sr) {
          const tag = inferLiveRecordTag(r.b, r.e, false, u, prev.currentRecords);
          if (tag) r.sr = tag;
        }
        if (r.a > 0 && !r.ar) {
          const tag = inferLiveRecordTag(r.a, r.e, true, u, prev.currentRecords);
          if (tag) r.ar = tag;
        }
      }
      return {
        ...prev,
        resultsByRound: { ...prev.resultsByRound, [key]: update.rows },
        fetchedAt: Date.now(),
      };
    });
  }, []);
  const wcaLiveStatus = useWcaLiveStream({
    rounds: wcaLiveRounds,
    numByWcaId: wcaLiveNumMap,
    onRoundUpdate: onWcaLiveUpdate,
  });

  const wsStatus = isWcaLive ? wcaLiveStatus : cubingWsStatus;

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

  // 后续 round 出现过的选手 = 晋级的人,在当前 round 表里浅绿色高亮
  // 决赛(最后一轮)没有"后续"——退化为高亮前三名(同绿色)
  const advancers = useMemo(() => {
    if (!data || !currentRound) return new Set<number>();
    const rs = currentRound.ev.rs;
    const idx = rs.findIndex(r => r.i === currentRound.rd.i);
    if (idx < 0) return new Set<number>();
    const set = new Set<number>();
    if (idx >= rs.length - 1) {
      // filteredResults 已按 WCA 排名排好;取前 3 + 任何与第 3 名同 (avg, best) 的并列
      const f = currentRound.rd.f;
      const byAvg = f === 'a' || f === 'm' || f === '';
      const keyOf = (r: LiveResult) => byAvg ? `${r.a}|${r.b}` : `${r.b}`;
      const valid = filteredResults.filter(r => r.b > 0);
      if (valid.length === 0) return set;
      const limit = Math.min(3, valid.length);
      const thirdKey = keyOf(valid[limit - 1]);
      for (let i = 0; i < valid.length; i++) {
        if (i < limit) set.add(valid[i].n);
        else if (keyOf(valid[i]) === thirdKey) set.add(valid[i].n);
        else break;
      }
      return set;
    }
    for (let i = idx + 1; i < rs.length; i++) {
      const key = roundKey(currentRound.ev.i, rs[i].i);
      for (const r of data.resultsByRound[key] || []) set.add(r.n);
    }
    return set;
  }, [data, currentRound, filteredResults]);

  // ── prefetch PRs for current round ────────────────────────────────────
  // wca_db 源 server 已经给了 LiveResult.pS / pA 历史 PR 标志,classifyPr 优先用 server flag.
  // 跳过 client 端 WCA API prefetch — 否则 WC2019 这种大型赛事几千选手并发 fetch 直接触发 429.

  useEffect(() => {
    if (!data || !currentRound) return;
    if (data.source === 'wca_db') return;
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
    // wca_db 路径:server 已经把比赛前 PB 塞进 data.personalRecords,直接转 pbMap 给 Psych Sheet 用.
    // 不发 client → WCA API 请求.rank 字段填 0(Psych Sheet 只用 best 值排序,不显示 rank).
    if (data.source === 'wca_db') {
      const obj: Record<string, PbByEvent | null> = {};
      for (const [wcaId, byEvent] of Object.entries(data.personalRecords ?? {})) {
        const pb: PbByEvent = {};
        for (const [ev, slot] of Object.entries(byEvent)) {
          pb[ev] = {
            single: slot.single ? { best: slot.single, world_rank: 0, continental_rank: 0, national_rank: 0 } : undefined,
            average: slot.average ? { best: slot.average, world_rank: 0, continental_rank: 0, national_rank: 0 } : undefined,
          };
        }
        obj[wcaId] = pb;
      }
      setPbMap(obj);
      return;
    }
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
  // wca_db 路径 server 已经给了 personalRecords,跳过 prefetch.
  useEffect(() => {
    if (viewParam !== 'psych' || !data) return;
    if (data.source === 'wca_db') return;
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
        ? { 'meta': '读取比赛元数据', 'cubing.results': '加载成绩', 'cubing.filter': '加载分组成员', 'wca.fetch': '从 WCA 拉取', 'wca.transform': '解析 WCA 数据', 'wca_live.results': '从 WCA Live 拉取', 'wca_db.query': '从 WCA 数据库读取', 'wca_db.transform': '解析 WCA 数据' }
        : { 'meta': 'Reading metadata', 'cubing.results': 'Loading results', 'cubing.filter': 'Loading filters', 'wca.fetch': 'Fetching WCA data', 'wca.transform': 'Parsing WCA data', 'wca_live.results': 'Loading from WCA Live', 'wca_db.query': 'Querying WCA database', 'wca_db.transform': 'Parsing WCA data' };
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
        <Link to="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
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
  // 比赛已完全结束时,每条 round 都标"已结束"是冗余信息 — 整体折叠掉.
  // 部分结束时仍标(区分已开 vs 待开).rd.s===2 (实时) 独立显示不受影响.
  const allRoundsFinished = roundOptions.length > 0 && roundOptions.every(o => o.rd.s === 1);

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
          <Link to="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
          <h1 className="comp-detail-title">
            {(() => {
              const iso2 = compFlagIso2(slug);
              const href = isWca
                ? `https://www.worldcubeassociation.org/competitions/${data.slug}`
                : isWcaLive
                  ? `https://live.worldcubeassociation.org/competitions/${data.slug}`
                  : `https://cubing.com/live/${data.cubingSlug || data.slug}`;
              const titleLabel = isWca ? 'WCA' : isWcaLive ? 'WCA Live' : 'cubing.com';
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comp-detail-title-link"
                  title={titleLabel}
                >
                  {iso2 && <Flag iso2={iso2} className="comp-flag comp-title-flag" />}
                  {localizeCompName(slug, decodeEntities(data.name), isZh)}
                </a>
              );
            })()}
          </h1>
          <div className="comp-detail-meta">
            {isAdmin && data.availableSources && data.availableSources.length > 1 && (
              <div className="comp-source-toggle" role="group" aria-label={isZh ? '数据源' : 'Data source'}>
                {data.availableSources.map(s => {
                  const label = s === 'wca' || s === 'wca_db' ? 'WCA' : s === 'wca_live' ? 'WCA Live' : 'cubing.com';
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`comp-source-btn${data.source === s ? ' is-active' : ''}`}
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('source', s);
                        setSearchParams(next, { replace: false });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
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

        {compInfo && <CompInfoPanel info={compInfo} isZh={isZh} cubingZh={cubingZh} rounds={compRounds} />}

        <div className="comp-view-tabs">
          <button
            type="button"
            className={`comp-view-tab${viewParam === 'live' ? ' is-active' : ''}`}
            onClick={() => onChangeView('live')}
          >
            {isZh ? '成绩' : (isWca ? 'Results' : 'Live')}
          </button>
          <button
            type="button"
            className={`comp-view-tab${viewParam === 'psych' ? ' is-active' : ''}`}
            onClick={() => onChangeView('psych')}
          >
            {isZh ? '预排名' : 'Psych Sheet'}
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
                    {o.rd.s === 2 ? ` - ${isZh ? '实时' : 'Live'}` : (!allRoundsFinished && o.rd.s === 1 ? ` - ${isZh ? '已结束' : 'Finished'}` : '')}
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
              advancers={advancers}
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

// ─── CompInfoPanel: 比赛元数据(日期/城市/地址/详情/网站) ─────────────────

function CompInfoPanel({
  info, isZh, cubingZh, rounds,
}: { info: CompInfo; isZh: boolean; cubingZh: CubingZhMeta | null; rounds: Record<string, number> | null }) {
  const dateStr = info.start_date ? formatDateRangeIso(info.start_date, info.end_date) : '';
  const country = info.country_iso2 ? countryName(info.country_iso2.toUpperCase(), isZh) : '';
  const cityStr = [info.city ? localizeCity(info.city, isZh) : '', country].filter(Boolean).join(isZh ? '、' : ', ');
  // 截止/报名类条目过了今天就 past — 收纳到折叠区,日期(比赛日)永远显示
  const todayIso = toIsoDate(new Date());
  const isPast = (iso: string) => !!iso && iso.slice(0, 10) < todayIso;
  const rows: { label: string; value: React.ReactNode; past?: boolean }[] = [];
  if (dateStr) rows.push({ label: isZh ? '日期' : 'Date', value: dateStr });
  const regOpenIso = info.registration_open ? toIsoDate(new Date(info.registration_open)) : '';
  const regCloseIso = info.registration_close ? toIsoDate(new Date(info.registration_close)) : '';
  if (regOpenIso && regCloseIso) {
    rows.push({
      label: isZh ? '报名时间' : 'Registration',
      value: formatDateRangeIso(regOpenIso, regCloseIso),
      past: isPast(regCloseIso),
    });
  }
  if (cubingZh?.withdrawDeadline) {
    rows.push({ label: '退赛截止', value: cubingZh.withdrawDeadline, past: isPast(cubingZh.withdrawDeadline) });
  }
  if (cubingZh?.reopenAt) {
    rows.push({ label: '重开报名', value: cubingZh.reopenAt, past: isPast(cubingZh.reopenAt) });
  }
  if (info.event_change_deadline_date) {
    const d = toIsoDate(new Date(info.event_change_deadline_date));
    rows.push({ label: isZh ? '修改截止' : 'Event change deadline', value: d, past: isPast(d) });
  }
  if (info.waiting_list_deadline_date) {
    const d = toIsoDate(new Date(info.waiting_list_deadline_date));
    rows.push({ label: isZh ? '候补截止' : 'Waiting list deadline', value: d, past: isPast(d) });
  }
  // 中文 + cubingZh.location 时,地点字符串已含市/省,城市行冗余,省掉
  if (cityStr && !(isZh && cubingZh?.location)) {
    rows.push({ label: isZh ? '城市' : 'City', value: cityStr });
  }
  if (cubingZh?.location) {
    rows.push({ label: '地点', value: cubingZh.location });
  } else {
    if (info.venue_address) rows.push({ label: isZh ? '地址' : 'Address', value: info.venue_address });
    if (info.venue_details) rows.push({ label: isZh ? '详情' : 'Details', value: info.venue_details });
  }
  if (info.website) {
    rows.push({
      label: isZh ? '网站' : 'Website',
      value: (
        <a href={info.website} target="_blank" rel="noopener noreferrer" className="comp-info-link">
          {info.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          <ExternalLink size={12} />
        </a>
      ),
    });
  }
  if (rounds && Object.keys(rounds).length > 0) {
    const orderSet = new Set<string>(WCA_EVENT_ORDER);
    const order: string[] = [...WCA_EVENT_ORDER, ...Object.keys(rounds).filter(e => !orderSet.has(e))];
    const ordered = order.filter(e => rounds[e] != null);
    rows.push({
      label: isZh ? '项目' : 'Events',
      value: (
        <span className="comp-info-events">
          {ordered.map(eid => (
            <span key={eid} className="comp-info-event">
              <EventIcon event={eid} className="comp-info-event-icon" title={eventDisplayName(eid, isZh)} />
              <span className="comp-info-event-rounds">{rounds[eid]}</span>
            </span>
          ))}
        </span>
      ),
    });
  }
  if (rows.length === 0) return null;
  const activeRows = rows.filter(r => !r.past);
  const pastRows = rows.filter(r => r.past);
  return (
    <CompInfoRows activeRows={activeRows} pastRows={pastRows} isZh={isZh} />
  );
}

function CompInfoRows({
  activeRows, pastRows, isZh,
}: {
  activeRows: { label: string; value: React.ReactNode }[];
  pastRows: { label: string; value: React.ReactNode }[];
  isZh: boolean;
}) {
  return (
    <dl className="comp-info-panel">
      {activeRows.map((r, i) => (
        <div key={r.label} className="comp-info-row">
          <dt className="comp-info-label">{r.label}</dt>
          <dd className="comp-info-value">
            {r.value}
            {i === 0 && pastRows.length > 0 && (
              <PastRowsPopover rows={pastRows} isZh={isZh} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PastRowsPopover({
  rows, isZh,
}: { rows: { label: string; value: React.ReactNode }[]; isZh: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span
      ref={ref}
      className="comp-info-past-popover"
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="comp-info-past-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={isZh ? `已过期 ${rows.length} 项` : `${rows.length} past`}
      >
        <Info size={14} />
      </button>
      <div className="comp-info-past-panel" role="dialog">
        <dl className="comp-info-past-list">
          {rows.map(r => (
            <div key={r.label} className="comp-info-past-item">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </span>
  );
}

// ─── ResultsTable ─────────────────────────────────────────────────────────

interface ResultsTableProps {
  results: LiveResult[];
  users: Record<string, User>;
  round: RoundMeta | undefined;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  advancers?: Set<number>;
  onClickCuber: (number: number) => void;
}

function ResultsTable({ results, users, round, isZh, pbMap, advancers, onClickCuber }: ResultsTableProps) {
  if (!round) return null;
  const isAverageFormat = round.f === 'a' || round.f === 'm' || round.f === '';
  const showAvg = isAverageFormat;
  // HTH 比赛单 round 可能有 14~30 个 attempt,以 format 推断的 5 不够。
  // 取本 round 所有 row 的实际最大 attempt 数兜底。
  const formatAttempts = round.f === 'a' || round.f === '' ? 5 : round.f === 'm' ? 3 : parseInt(round.f, 10) || 1;
  const maxRowAttempts = results.reduce((m, r) => Math.max(m, r.v.length), 0);
  const attemptCount = Math.max(formatAttempts, maxRowAttempts);

  return (
    <div className="comp-table-wrap">
      <table className="comp-table">
        <thead>
          <tr>
            <th className="th-place">{isZh ? '名次' : 'Place'}</th>
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
            const advanced = advancers?.has(r.n);
            const cls = [advanced ? 'row-advanced' : '', isOdd ? 'row-odd' : ''].filter(Boolean).join(' ');
            return (
              <tr key={r.i || `${r.n}:${idx}`} className={cls}>
                <td className="td-place">{r.b === 0 ? '-' : (idx + 1)}</td>
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
                    <span className="record-num-cell">
                      {formatLive(r.a, r.e, true)}
                      {r.ar
                        ? <RecordBadge record={String(r.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                        : averagePr ? <RecordBadge record="PR" variant="inline" /> : null}
                    </span>
                  </td>
                )}
                <td className="td-best">
                  <span className="record-num-cell">
                    {formatLive(r.b, r.e, false)}
                    {r.sr
                      ? <RecordBadge record={r.sr} variant="inline" iso2={regionToIso2(u.region)} />
                      : singlePr ? <RecordBadge record="PR" variant="inline" /> : null}
                  </span>
                </td>
                {Array.from({ length: attemptCount }).map((_, i) => (
                  <td key={i} className="td-attempt">{formatLive(r.v[i] ?? 0, r.e, false)}</td>
                ))}
              </tr>
            );
          })}
          {results.length === 0 && (
            <tr><td colSpan={4 + attemptCount} className="comp-empty">{isZh ? '此轮暂无成绩' : 'No results yet'}</td></tr>
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
    all.sort((a, b) => a.number - b.number);
    return all;
  }, [data, eventId]);

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
