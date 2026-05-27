'use client';

/**
 * /wca/comp/[slug] — full port of packages/client/src/pages/comp/CompDetailPage.tsx.
 * Live WS (cubing.com + WCA Live) + Psych Sheet + record badges + round/cuber modals.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, X as XIcon, RefreshCw, Info, Shuffle, Copy, Check } from 'lucide-react';
import HeaderToggles from '@/components/HeaderToggles';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';
import { displayCuberName } from '@/lib/cuber-name-display';
import { countryToIso2, loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { localizeCompName } from '@/lib/comp-localize';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiUrl } from '@/lib/api-base';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { fetchPb, prefetchPbs, type PbByEvent } from '@/lib/wca-pb';
import { fetchCompInfo, fetchCubingZh, type CompInfo, type CubingZhMeta } from '@/lib/comp-wcif';
import { formatDateRangeIso, toIsoDate } from '@/lib/wca-date';
import { localizeCity } from '@/lib/city-localize';
import WcaEventSelector from '@/components/WcaEventSelector';
import type { CompPersonalRecordSlot } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon';
import { formatWcaResult } from '@/lib/wca-format-result';
import { rememberRecent } from '../page';
import { useLiveStream, applyResultPatch, type LivePatch, type WsStatus } from '@/hooks/useLiveStream';
import { useWcaLiveStream, type WcaLiveRoundUpdate } from '@/hooks/useWcaLiveStream';
import '../comp.css';

interface User {
  number: number;
  name: string;
  wcaid: string;
  region: string;
  countryId?: string;
  continentId?: string;
  eventIds?: string[];
}

interface CompRecordsSnapshot {
  wr: Record<string, number>;
  cr: Record<string, number>;
  nr: Record<string, number>;
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
  liveId?: string;
}

interface EventMeta {
  i: string;
  name: string;
  rs: RoundMeta[];
}

interface LiveResult {
  i: number; c: number; n: number; e: string; r: string; f: string;
  b: number; a: number; v: number[]; sr: string; ar: string | number;
  pS?: number; pA?: number;
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
  personalRecords?: Record<string, Record<string, CompPersonalRecordSlot>>;
  currentRecords?: CompRecordsSnapshot;
}

function regionToIso2(region: string): string {
  if (!region) return '';
  if (region.length === 2) return region.toLowerCase();
  return countryToIso2(region) || '';
}

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

function classifyPr(result: LiveResult, pb: PbByEvent | null): { singleRank: number | null; averageRank: number | null } {
  if (result.pS !== undefined || result.pA !== undefined) {
    return {
      singleRank: result.pS ?? null,
      averageRank: result.pA ?? null,
    };
  }
  if (!pb) return { singleRank: null, averageRank: null };
  const entry = pb[result.e];
  if (!entry) {
    return {
      singleRank: result.b > 0 ? 1 : null,
      averageRank: result.a > 0 ? 1 : null,
    };
  }
  const sBest = entry.single?.best ?? Infinity;
  const aBest = entry.average?.best ?? Infinity;
  return {
    singleRank: (result.b > 0 && result.b <= sBest) ? 1 : null,
    averageRank: (result.a > 0 && result.a <= aBest) ? 1 : null,
  };
}

function prBadgeFor(rank: number | null | undefined): string | null {
  if (!rank) return null;
  return rank === 1 ? 'PR' : `PR${rank}`;
}

function formatLive(value: number, eventId: string, isAverage: boolean): string {
  return formatWcaResult(value, eventId, isAverage ? 'average' : 'single', { zero: 'empty' });
}

function roundKey(e: string, r: string): string { return `${e}:${r}`; }

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

function regionDisplay(region: string, isZh: boolean): string {
  if (!region) return '';
  const iso2 = regionToIso2(region);
  if (iso2) return countryName(iso2.toUpperCase(), isZh);
  return region;
}

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

export default function CompDetailPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = (Array.isArray(params?.slug) ? params.slug[0] : params?.slug) ?? '';
  const slug = rawSlug.replace(/-/g, '');
  const router = useRouter();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const searchParams = useSearchParams();
  const user = useAuthStore(s => s.user);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);

  const setSearchParams = useCallback((next: URLSearchParams, opts?: { replace?: boolean }) => {
    const qs = next.toString();
    const url = qs ? `/wca/comp/${slug}?${qs}` : `/wca/comp/${slug}`;
    if (opts?.replace) router.replace(url);
    else router.push(url);
  }, [router, slug]);

  useEffect(() => {
    if (rawSlug && rawSlug !== slug) {
      const qs = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/wca/comp/${slug}${qs}`);
    }
  }, [rawSlug, slug, router]);

  const [data, setData] = useState<CompData | null>(null);
  const compNameTitle = data ? localizeCompName(slug, data.name, isZh) : slug;
  useDocumentTitle(compNameTitle, compNameTitle);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; filter?: string; done: number; total: number } | null>(null);
  const [, setFlagDataVer] = useState(0);
  useEffect(() => { loadFlagData().then(setFlagDataVer); }, []);

  const [pbVer, setPbVer] = useState(0);
  type ModalState =
    | { kind: 'round'; number: number; eventId: string; roundId: string }
    | { kind: 'all'; number: number };
  const [modal, setModal] = useState<ModalState | null>(null);
  const [compInfo, setCompInfo] = useState<CompInfo | null>(null);
  const [cubingZh, setCubingZh] = useState<CubingZhMeta | null>(null);
  useEffect(() => {
    if (!slug) return;
    let cancel = false;
    fetchCompInfo(slug).then(info => { if (!cancel) setCompInfo(info); }).catch(() => {});
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

  const eventParam = searchParams?.get('event') || '';
  const roundParam = searchParams?.get('round') || '';
  const filterParam = searchParams?.get('filter') || 'all';
  const viewParam = (searchParams?.get('view') === 'psych' ? 'psych' : 'live') as 'live' | 'psych';
  const isPsych = viewParam === 'psych';
  const psychEventParam = searchParams?.get('psychEvent') || '';
  const sourceParam = searchParams?.get('source');

  const load = useCallback(() => {
    setError(null);
    setProgress(null);
    return new Promise<void>((resolve) => {
      let done = false;
      let resolved = false;
      let es: EventSource | null = null;
      const apiAbort = new AbortController();
      const resolveOnce = () => { if (!resolved) { resolved = true; resolve(); } };
      const finishWith = (j: CompData, partial = false) => {
        if (done) return;
        setData(j);
        rememberRecent(j.slug, j.name);
        setProgress(null);
        resolveOnce();
        if (partial) return;
        done = true;
        if (es) { try { es.close(); } catch { /* ignore */ } }
        try { apiAbort.abort(); } catch { /* ignore */ }
      };
      const failWith = (msg: string) => {
        if (done) return;
        done = true;
        setError(msg);
        setProgress(null);
        if (es) { try { es.close(); } catch { /* ignore */ } }
        resolveOnce();
      };

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
            const dataStr = (ev as MessageEvent).data;
            if (dataStr) {
              const j = JSON.parse(dataStr);
              if (j.error) setError(j.error);
            }
          } catch { /* ignore */ }
          fallback();
        });
      };

      if (!sourceParam) {
        fetch(`/stats/comp/${encodeURIComponent(slug)}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(j => { if (j) finishWith(j); })
          .catch(() => { /* ignore */ });
        const onlyParam = eventParam && roundParam
          ? `${encodeURIComponent(eventParam)}:${encodeURIComponent(roundParam)}`
          : 'auto';
        fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}?only=${onlyParam}`), { signal: apiAbort.signal })
          .then(r => r.ok ? r.json() : null)
          .then(j => { if (j) finishWith(j, /* partial */ true); })
          .catch(() => { /* ignore */ });
        fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(slug)}`), { signal: apiAbort.signal })
          .then(r => r.ok ? r.json() : null)
          .then(j => { if (j) finishWith(j); })
          .catch(() => { /* ignore */ });
      }
      startSse();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const applyPatch = useCallback((patch: LivePatch) => {
    setData(prev => {
      if (!prev) return prev;
      if (patch.kind === 'result.new' || patch.kind === 'result.update') {
        const r = patch.result as LiveResult;
        if (r.c !== prev.compId) return prev;
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
        const nextArr = applyResultPatch(arr, patch) as LiveResult[];
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
        const mergedUsers: typeof prev.users = { ...prev.users };
        for (const [k, wsUser] of Object.entries(patch.users)) {
          mergedUsers[k] = { ...prev.users[k], ...wsUser };
        }
        return { ...prev, users: mergedUsers, fetchedAt: Date.now() };
      }
      return prev;
    });
  }, []);

  const isWca = data?.source === 'wca' || data?.source === 'wca_db';
  const isWcaLive = data?.source === 'wca_live';
  const isCubing = data?.source === 'cubing';

  const cubingWsStatus = useLiveStream({ compId: isCubing ? (data?.compId ?? null) : null, applyPatch });

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
      const rows = update.rows as LiveResult[];
      for (const r of rows) {
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
        resultsByRound: { ...prev.resultsByRound, [key]: rows },
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

  const defaultRoundKey = useMemo(() => {
    if (!data) return null;
    const has = (k: string) => (data.resultsByRound[k] || []).length > 0;
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

  useEffect(() => {
    if (!data || !defaultRoundKey) return;
    if (!eventParam || !roundParam) {
      const [e, r] = defaultRoundKey.split(':');
      const next = new URLSearchParams(searchParams ? searchParams.toString() : '');
      next.set('event', e);
      next.set('round', r);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, defaultRoundKey]);

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

  const advancers = useMemo(() => {
    if (!data || !currentRound) return new Set<number>();
    const rs = currentRound.ev.rs;
    const idx = rs.findIndex(r => r.i === currentRound.rd.i);
    if (idx < 0) return new Set<number>();
    const f = currentRound.rd.f;
    const byAvg = f === 'a' || f === 'm' || f === '';
    const keyOf = (r: LiveResult) => byAvg ? `${r.a}|${r.b}` : `${r.b}`;
    const topN = (n: number): Set<number> => {
      const out = new Set<number>();
      const valid = filteredResults.filter(r => r.b > 0);
      if (valid.length === 0) return out;
      const limit = Math.min(n, valid.length);
      const cutoffKey = keyOf(valid[limit - 1]);
      for (let i = 0; i < valid.length; i++) {
        if (i < limit) out.add(valid[i].n);
        else if (keyOf(valid[i]) === cutoffKey) out.add(valid[i].n);
        else break;
      }
      return out;
    };
    if (idx >= rs.length - 1) return topN(3);
    const set = new Set<number>();
    for (let i = idx + 1; i < rs.length; i++) {
      const key = roundKey(currentRound.ev.i, rs[i].i);
      for (const r of data.resultsByRound[key] || []) set.add(r.n);
    }
    if (set.size > 0) return set;
    const nextN = rs[idx + 1]?.n ?? 0;
    if (nextN > 0) return topN(nextN);
    return set;
  }, [data, currentRound, filteredResults]);

  useEffect(() => {
    if (!data || !currentRound) return;
    if (data.source === 'wca_db') return;
    if (data.personalRecords) return;
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

  const [pbMap, setPbMap] = useState<Record<string, PbByEvent | null>>({});

  useEffect(() => {
    if (!data) return;
    if (data.personalRecords) {
      const obj: Record<string, PbByEvent | null> = {};
      for (const [wcaId, byEvent] of Object.entries(data.personalRecords)) {
        const pb: PbByEvent = {};
        for (const [ev, slot] of Object.entries(byEvent)) {
          pb[ev] = {
            single: slot.single ? { best: slot.single, world_rank: 0, continental_rank: 0, national_rank: 0, recordTag: slot.singleTag } : undefined,
            average: slot.average ? { best: slot.average, world_rank: 0, continental_rank: 0, national_rank: 0, recordTag: slot.averageTag } : undefined,
          };
        }
        obj[wcaId] = pb;
      }
      setPbMap(obj);
      return;
    }
    const ids = Object.values(data.users).map(u => u.wcaid).filter(Boolean);
    Promise.all(ids.map(async id => [id, await fetchPb(id)] as const))
      .then(pairs => {
        const obj: Record<string, PbByEvent | null> = {};
        for (const [id, pb] of pairs) obj[id] = pb;
        setPbMap(obj);
      });
  }, [data, pbVer]);

  const onChangeRound = (value: string) => {
    const [e, r] = value.split(':');
    if (!e || !r) return;
    const next = new URLSearchParams(searchParams ? searchParams.toString() : '');
    next.set('event', e);
    next.set('round', r);
    setSearchParams(next);
  };

  const onChangeFilter = (value: string) => {
    const next = new URLSearchParams(searchParams ? searchParams.toString() : '');
    next.set('filter', value);
    setSearchParams(next);
  };

  const onChangeView = (value: 'live' | 'psych') => {
    const next = new URLSearchParams(searchParams ? searchParams.toString() : '');
    if (value === 'live') next.delete('view');
    else next.set('view', 'psych');
    setSearchParams(next);
  };

  const onChangePsychEvent = (eventId: string) => {
    const next = new URLSearchParams(searchParams ? searchParams.toString() : '');
    if (eventId) next.set('psychEvent', eventId);
    else next.delete('psychEvent');
    setSearchParams(next);
  };

  useEffect(() => {
    if (viewParam !== 'psych' || !data) return;
    if (data.personalRecords) return;
    const wcaIds = Object.values(data.users).map(u => u.wcaid).filter(Boolean);
    if (wcaIds.length === 0) return;
    let cancelled = false;
    prefetchPbs(wcaIds).then(() => { if (!cancelled) setPbVer(v => v + 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [viewParam, data]);

  const psychEventId = useMemo(() => {
    if (!data) return '';
    if (psychEventParam && data.events.some(e => e.i === psychEventParam)) return psychEventParam;
    return '';
  }, [data, psychEventParam]);

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
        <Link href="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
        <div className="comp-err comp-err-block">
          <div className="comp-err-title">{isZh ? '加载失败' : 'Failed to load'}</div>
          <div className="comp-err-detail">{error || 'No data'}</div>
          <button type="button" className="comp-go-btn" onClick={refresh}>{isZh ? '重试' : 'Retry'}</button>
        </div>
      </div>
    );
  }

  const availableEventIds = new Set(data.events.filter(e => isWcaEvent(e.i)).map(e => e.i));
  const nonWcaEvents = data.events
    .filter(e => !isWcaEvent(e.i))
    .map(e => ({ id: e.i, iconClass: '', textLabel: eventDisplayName(e.i, isZh) }));
  const validRoundsFor = (eventId: string) => {
    const ev = data.events.find(e => e.i === eventId);
    if (!ev) return [];
    return ev.rs.filter(rd =>
      (data.resultsByRound[roundKey(ev.i, rd.i)] || []).length > 0 || rd.s === 2
    );
  };
  const eventBadges: Record<string, string> = {};
  const eventTopBadges: Record<string, string> = {};
  for (const ev of data.events) {
    const rounds = validRoundsFor(ev.i);
    const total = rounds.length > 0 ? rounds.length : ev.rs.length;
    if (total > 0) eventTopBadges[ev.i] = `${total}`;
  }
  if (eventParam && roundParam) {
    const rounds = validRoundsFor(eventParam);
    const idx = rounds.findIndex(rd => rd.i === roundParam);
    if (idx >= 0) eventBadges[eventParam] = `${idx + 1}`;
  }
  const onSelectEvent = (newEventId: string) => {
    const ev = data.events.find(e => e.i === newEventId);
    if (!ev) return;
    const valid = validRoundsFor(newEventId);
    const cycleRounds = valid.length > 0 ? valid : ev.rs;
    if (cycleRounds.length === 0) return;
    if (newEventId === eventParam) {
      const curIdx = cycleRounds.findIndex(rd => rd.i === roundParam);
      const nextIdx = (curIdx + 1) % cycleRounds.length;
      onChangeRound(roundKey(newEventId, cycleRounds[nextIdx].i));
    } else {
      onChangeRound(roundKey(newEventId, cycleRounds[0].i));
    }
  };

  const filterOptions = [
    { value: 'all', labelZh: '全部', labelEn: 'All' },
    { value: 'females', labelZh: '女选手', labelEn: 'Females' },
    { value: 'children', labelZh: '儿童组', labelEn: 'Children' },
    { value: 'newcomers', labelZh: '新人组', labelEn: 'New Comers' },
  ];

  return (
    <div className="comp-detail-page">
      <HeaderToggles className="comp-top-bar" />

      <div className="comp-table-section">
        <header className="comp-detail-header">
          <Link href="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
          <h1 className="comp-detail-title">
            {(() => {
              const iso2 = compFlagIso2(slug);
              const cubingSlug = data.cubingSlug || decodeEntities(data.name).trim().replace(/\s+/g, '-');
              const cubingUrl = `https://cubing.com/competition/${cubingSlug}`;
              const wcaUrl = `https://www.worldcubeassociation.org/competitions/${data.slug}`;
              return (
                <>
                  {iso2 && <Flag iso2={iso2} className="comp-flag comp-title-flag" />}
                  <a
                    href={wcaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="comp-detail-title-name"
                  >
                    {localizeCompName(slug, decodeEntities(data.name), isZh)}
                  </a>
                  <a href={wcaUrl} target="_blank" rel="noopener noreferrer" className="comp-title-icon" title="WCA">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/upstream/wca.svg" alt="WCA" />
                  </a>
                  {iso2 === 'cn' && (
                    <a href={cubingUrl} target="_blank" rel="noopener noreferrer" className="comp-title-icon" title="cubing.com">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/upstream/cubingcom.ico" alt="cubing.com" />
                    </a>
                  )}
                  <Link
                    href={`/scramble/gen?comp=${encodeURIComponent(slug)}`}
                    className="comp-title-icon comp-title-icon-lucide"
                    title={isZh ? '查看打乱' : 'View scrambles'}
                    aria-label={isZh ? '查看打乱' : 'View scrambles'}
                  >
                    <Shuffle size={18} strokeWidth={1.75} />
                  </Link>
                </>
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
                        const next = new URLSearchParams(searchParams ? searchParams.toString() : '');
                        next.set('source', s);
                        setSearchParams(next);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {!isWca && (
              <span className="comp-detail-fetched">
                {isZh ? '更新于' : 'Updated'} {new Date(data.fetchedAt).toLocaleTimeString()}
              </span>
            )}
            {!isWca && <LiveIndicator status={wsStatus} isZh={isZh} />}
            {!isWca && wsStatus !== 'open' && (
              <button type="button" className="comp-refresh-btn" onClick={refresh} disabled={refreshing} title={isZh ? '刷新' : 'Refresh'}>
                <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} />
              </button>
            )}
          </div>
        </header>

        {compInfo && <CompInfoPanel info={compInfo} isZh={isZh} cubingZh={cubingZh} />}

        <div className="comp-event-bar">
          <WcaEventSelector
            availableEvents={availableEventIds}
            selectedEvent={isPsych ? psychEventId : eventParam}
            onSelect={isPsych ? onChangePsychEvent : onSelectEvent}
            isZh={isZh}
            onlyAvailable
            allowAll={isPsych}
            badges={isPsych ? {} : eventBadges}
            topBadges={isPsych ? {} : eventTopBadges}
            appendEvents={nonWcaEvents}
          />
        </div>

        <div className="comp-view-tabs">
          <button
            type="button"
            className={`comp-view-tab${!isPsych ? ' is-active' : ''}`}
            onClick={() => onChangeView('live')}
          >
            {isZh ? '成绩' : (isWca ? 'Results' : 'Live')}
          </button>
          <button
            type="button"
            className={`comp-view-tab${isPsych ? ' is-active' : ''}`}
            onClick={() => onChangeView('psych')}
          >
            {isZh ? '预排名' : 'Psych Sheet'}
          </button>
        </div>

        {!isPsych ? (
          <>
            <div className="comp-selectors">
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
              compIso2={compFlagIso2(slug)}
              onClickCuber={n => {
                if (currentRound) {
                  setModal({ kind: 'round', number: n, eventId: currentRound.ev.i, roundId: currentRound.rd.i });
                } else {
                  setModal({ kind: 'all', number: n });
                }
              }}
            />
          </>
        ) : (
          <PsychSheet
            data={data}
            isZh={isZh}
            eventId={psychEventId}
            pbMap={pbMap}
            onClickCuber={n => setModal({ kind: 'all', number: n })}
          />
        )}
      </div>

      {modal?.kind === 'round' && (
        <RoundResultModal
          number={modal.number}
          eventId={modal.eventId}
          roundId={modal.roundId}
          data={data}
          compName={compNameTitle}
          isZh={isZh}
          pbMap={pbMap}
          onShowAll={() => setModal({ kind: 'all', number: modal.number })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'all' && (
        <CuberModal
          number={modal.number}
          data={data}
          isZh={isZh}
          pbMap={pbMap}
          onSelectRound={(eventId, roundId) => setModal({ kind: 'round', number: modal.number, eventId, roundId })}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CompInfoPanel({
  info, isZh, cubingZh,
}: { info: CompInfo; isZh: boolean; cubingZh: CubingZhMeta | null }) {
  const dateStr = info.start_date ? formatDateRangeIso(info.start_date, info.end_date) : '';
  const country = info.country_iso2 ? countryName(info.country_iso2.toUpperCase(), isZh) : '';
  const cityStr = [info.city ? localizeCity(info.city, isZh) : '', country].filter(Boolean).join(isZh ? '、' : ', ');
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
  if (cityStr && !(isZh && cubingZh?.location)) {
    rows.push({ label: isZh ? '城市' : 'City', value: cityStr });
  }
  if (cubingZh?.location) {
    rows.push({ label: '地点', value: cubingZh.location });
  } else {
    if (info.venue_address) rows.push({ label: isZh ? '地址' : 'Address', value: info.venue_address });
    if (info.venue_details) rows.push({ label: isZh ? '详情' : 'Details', value: info.venue_details });
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

interface ResultsTableProps {
  results: LiveResult[];
  users: Record<string, User>;
  round: RoundMeta | undefined;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  advancers?: Set<number>;
  onClickCuber: (number: number) => void;
  compIso2?: string;
}

function ResultsTable({ results, users, round, isZh, pbMap, advancers, onClickCuber, compIso2 }: ResultsTableProps) {
  if (!round) return null;
  const isAverageFormat = round.f === 'a' || round.f === 'm' || round.f === '';
  const showAvg = isAverageFormat;
  const formatAttempts = round.f === 'a' || round.f === '' ? 5 : round.f === 'm' ? 3 : parseInt(round.f, 10) || 1;
  const maxRowAttempts = results.reduce((m, r) => Math.max(m, r.v.length), 0);
  const attemptCount = Math.max(formatAttempts, maxRowAttempts);

  return (
    <div className="comp-table-wrap">
      <table className={`comp-table${compIso2 === 'cn' && isZh ? ' comp-table-cn' : ''}`}>
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
            const { singleRank, averageRank } = classifyPr(r, pb);
            const singleBadge = prBadgeFor(singleRank);
            const averageBadge = prBadgeFor(averageRank);
            const isOdd = idx % 2 === 1;
            const advanced = advancers?.has(r.n);
            const cls = [advanced ? 'row-advanced' : '', isOdd ? 'row-odd' : ''].filter(Boolean).join(' ');
            return (
              <tr
                key={r.i || `${r.n}:${idx}`}
                className={`${cls} comp-row-clickable`}
                onClick={() => onClickCuber(r.n)}
              >
                <td className="td-place">{r.b === 0 ? '-' : (idx + 1)}</td>
                <td className="td-person">
                  <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                  <span
                    className="cuber-name"
                    title={regionDisplay(u.region, isZh)}
                  >
                    {displayCuberName(u.name, isZh)}
                  </span>
                </td>
                {showAvg && (
                  <td className="td-avg">
                    <span className="record-num-cell">
                      {formatLive(r.a, r.e, true)}
                      {r.ar
                        ? <RecordBadge record={String(r.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                        : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null}
                    </span>
                  </td>
                )}
                <td className="td-best">
                  <span className="record-num-cell">
                    {formatLive(r.b, r.e, false)}
                    {r.sr
                      ? <RecordBadge record={r.sr} variant="inline" iso2={regionToIso2(u.region)} />
                      : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                  </span>
                </td>
                {Array.from({ length: attemptCount }).map((_, i) => (
                  <td key={i} className={`td-attempt ${isAo5Bracketed(r.v, i) ? 'td-attempt-trimmed' : ''}`}>
                    {formatLive(r.v[i] ?? 0, r.e, false)}
                  </td>
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

interface PsychSheetProps {
  data: CompData;
  isZh: boolean;
  eventId: string;
  pbMap: Record<string, PbByEvent | null>;
  onClickCuber: (number: number) => void;
}

function PsychSheet({ data, isZh, eventId, pbMap, onClickCuber }: PsychSheetProps) {
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
    if (map.size === 0) {
      for (const u of Object.values(data.users)) {
        if (u.eventIds?.length) map.set(u.number, [...u.eventIds]);
      }
    }
    return map;
  }, [data]);

  const psychRows = useMemo(() => {
    if (!eventId) return [];
    const numbers = new Set<number>();
    for (const rd of data.events.find(e => e.i === eventId)?.rs ?? []) {
      for (const r of data.resultsByRound[`${eventId}:${rd.i}`] ?? []) {
        numbers.add(r.n);
      }
    }
    if (numbers.size === 0) {
      for (const u of Object.values(data.users)) {
        if (u.eventIds?.includes(eventId)) numbers.add(u.number);
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
        const singleTag = pb?.[eventId]?.single?.recordTag;
        const averageTag = pb?.[eventId]?.average?.recordTag;
        return { n, u, single, average, singleTag, averageTag };
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
                  <tr
                    key={row.n}
                    className={`${isOdd ? 'row-odd' : ''} comp-row-clickable`}
                    onClick={() => onClickCuber(row.n)}
                  >
                    <td className="td-place">{idx + 1}</td>
                    <td className="td-person">
                      <Flag iso2={regionToIso2(row.u.region)} className="comp-flag" />
                      <span
                        className="cuber-name"
                        title={regionDisplay(row.u.region, isZh)}
                      >
                        {displayCuberName(row.u.name, isZh)}
                      </span>
                    </td>
                    <td className="td-avg">
                      {row.average ? (
                        <span className="record-num-cell">
                          {formatWcaResult(row.average, eventId, 'average')}
                          {row.averageTag && <RecordBadge record={row.averageTag} variant="inline" iso2={regionToIso2(row.u.region)} />}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="td-best">
                      {row.single ? (
                        <span className="record-num-cell">
                          {formatWcaResult(row.single, eventId, 'single')}
                          {row.singleTag && <RecordBadge record={row.singleTag} variant="inline" iso2={regionToIso2(row.u.region)} />}
                        </span>
                      ) : '—'}
                    </td>
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
                  <tr
                    key={u.number}
                    className={`${isOdd ? 'row-odd' : ''} comp-row-clickable`}
                    onClick={() => onClickCuber(u.number)}
                  >
                    <td className="td-place">{idx + 1}</td>
                    <td className="td-person">
                      <Flag iso2={regionToIso2(u.region)} className="comp-flag" />
                      <span
                        className="cuber-name"
                        title={regionDisplay(u.region, isZh)}
                      >
                        {displayCuberName(u.name, isZh)}
                      </span>
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
  );
}

interface CuberModalProps {
  number: number;
  data: CompData;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  onSelectRound: (eventId: string, roundId: string) => void;
  onClose: () => void;
}

function CuberModal({ number, data, isZh, pbMap, onSelectRound, onClose }: CuberModalProps) {
  const u = data.users[String(number)];
  const rows = useMemo(() => {
    if (!u) return [];
    const out: { ev: EventMeta; rd: RoundMeta; result: LiveResult }[] = [];
    for (const ev of data.events) {
      const evRows: { ev: EventMeta; rd: RoundMeta; result: LiveResult }[] = [];
      for (const rd of ev.rs) {
        const arr = data.resultsByRound[roundKey(ev.i, rd.i)] || [];
        const hit = arr.find(r => r.n === number);
        if (hit) evRows.push({ ev, rd, result: hit });
      }
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
            {u.wcaid ? (
              <Link
                href={`/wca/persons/${u.wcaid}`}
                className="cuber-link-modal"
                onClick={onClose}
              >
                {displayCuberName(u.name, isZh)}
              </Link>
            ) : (
              <span className="cuber-link-static">{displayCuberName(u.name, isZh)}</span>
            )}
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
                      const { singleRank, averageRank } = classifyPr(result, pb);
                      const singleBadge = prBadgeFor(singleRank);
                      const averageBadge = prBadgeFor(averageRank);
                      const arr = data.resultsByRound[roundKey(en.ev.i, en.rd.i)] || [];
                      const idx = arr.findIndex(rr => rr.n === number);
                      const place = idx >= 0 && result.b !== 0 ? idx + 1 : '-';
                      return (
                        <tr
                          key={`${en.ev.i}:${en.rd.i}`}
                          className="comp-modal-row-clickable"
                          onClick={() => onSelectRound(en.ev.i, en.rd.i)}
                        >
                          <td>{roundDisplayName(en.rd.name, isZh)}</td>
                          <td>{place}</td>
                          <td>
                            {formatLive(result.b, result.e, false)}
                            {result.sr
                              ? <RecordBadge record={result.sr} variant="inline" iso2={regionToIso2(u.region)} />
                              : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                          </td>
                          <td>
                            {isAverageFormat ? formatLive(result.a, result.e, true) : ''}
                            {isAverageFormat && (result.ar
                              ? <RecordBadge record={String(result.ar)} variant="inline" iso2={regionToIso2(u.region)} />
                              : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null)}
                          </td>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <td key={i} className={`td-attempt ${isAo5Bracketed(result.v, i) ? 'td-attempt-trimmed' : ''}`}>
                              {formatLive(result.v[i] ?? 0, result.e, false)}
                            </td>
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
      </div>
    </div>
  );
}

interface RoundResultModalProps {
  number: number;
  eventId: string;
  roundId: string;
  data: CompData;
  compName: string;
  isZh: boolean;
  pbMap: Record<string, PbByEvent | null>;
  onShowAll: () => void;
  onClose: () => void;
}

function RoundResultModal({ number, eventId, roundId, data, compName, isZh, pbMap, onShowAll, onClose }: RoundResultModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'done' | 'nothing' | 'error'>('idle');

  const prefetchRef = useRef<Promise<{ cn: string; en: string; url: string } | null> | null>(null);
  const prefetchKeyRef = useRef<string>('');
  const hasEventsRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const u = data.users[String(number)];
    const ev = data.events.find(e => e.i === eventId);
    const rd = ev?.rs.find(r => r.i === roundId);
    const arr = data.resultsByRound[roundKey(eventId, roundId)] || [];
    const result = arr.find(rr => rr.n === number);
    if (!u || !ev || !rd || !result) return;

    const pb = pbMap[u.wcaid];
    const { singleRank, averageRank } = classifyPr(result, pb);
    const singleTagForCopy = result.sr ? String(result.sr) : (singleRank ? 'PR' : '');
    const avgTagForCopy = result.ar ? String(result.ar) : (averageRank ? 'PR' : '');

    const personIso2 = regionToIso2(u.region).toUpperCase();
    const compNameZh = localizeCompName(data.slug, decodeEntities(data.name), true);
    const compNameEn = localizeCompName(data.slug, decodeEntities(data.name), false);
    const compIso2 = compFlagIso2(data.slug);
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const events: Array<Record<string, unknown>> = [];
    if (singleTagForCopy && result.b > 0) {
      events.push({
        tag: singleTagForCopy, rec_type: 'single', attempt_result: result.b,
        event_id: result.e, person_name: u.name, person_iso2: personIso2,
        comp_name: compNameZh, comp_name_en: compNameEn, comp_iso2: compIso2,
        url, previous_pr: pb?.[result.e]?.single?.best ?? null, pr_rank: singleRank,
      });
    }
    if (avgTagForCopy && result.a > 0) {
      events.push({
        tag: avgTagForCopy, rec_type: 'average', attempt_result: result.a,
        event_id: result.e, person_name: u.name, person_iso2: personIso2,
        comp_name: compNameZh, comp_name_en: compNameEn, comp_iso2: compIso2,
        url, previous_pr: pb?.[result.e]?.average?.best ?? null, pr_rank: averageRank,
      });
    }
    hasEventsRef.current = events.length > 0;
    if (events.length === 0) return;

    const key = JSON.stringify(events);
    if (key === prefetchKeyRef.current) return;
    prefetchKeyRef.current = key;

    prefetchRef.current = fetch(apiUrl('/v1/wca/format-record'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    })
      .then(async r => {
        if (!r.ok) return null;
        const json = await r.json() as { cn: string; en: string; url: string; error?: string };
        return json.error ? null : json;
      })
      .catch(() => null);
  }, [data, number, eventId, roundId, pbMap]);

  const u = data.users[String(number)];
  const ev = data.events.find(e => e.i === eventId);
  const rd = ev?.rs.find(r => r.i === roundId);
  const arr = data.resultsByRound[roundKey(eventId, roundId)] || [];
  const result = arr.find(rr => rr.n === number);
  const idx = arr.findIndex(rr => rr.n === number);

  if (!u || !ev || !rd || !result) return null;

  const pb = pbMap[u.wcaid];
  const { singleRank, averageRank } = classifyPr(result, pb);
  const singleBadge = prBadgeFor(singleRank);
  const averageBadge = prBadgeFor(averageRank);
  const isAverageFormat = rd.f === 'a' || rd.f === 'm' || rd.f === '';
  const place = idx >= 0 && result.b !== 0 ? idx + 1 : null;
  const iso2 = regionToIso2(u.region);
  const attempts = result.v.filter(v => v !== 0);

  const singleTagForCopy = result.sr ? String(result.sr) : (singleRank ? 'PR' : '');
  const avgTagForCopy = result.ar ? String(result.ar) : (averageRank ? 'PR' : '');
  const canCopy = (singleTagForCopy && result.b > 0) || (avgTagForCopy && result.a > 0);

  async function handleCopy() {
    if (!hasEventsRef.current || !prefetchRef.current) {
      setCopyState('nothing');
      setTimeout(() => setCopyState('idle'), 1500);
      return;
    }
    setCopyState('copying');
    try {
      const json = await prefetchRef.current;
      if (!json) throw new Error('prefetch failed');
      const text = `${isZh ? json.cn : json.en}\n${json.url}`;
      await navigator.clipboard.writeText(text);
      setCopyState('done');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (e) {
      console.error('[comp copy] failed:', e);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  return (
    <div className="comp-modal-backdrop comp-modal-backdrop-2" onClick={onClose}>
      <div className="comp-round-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="comp-modal-header">
          <div className="comp-modal-title">
            <Flag iso2={iso2} className="comp-flag" />
            {u.wcaid ? (
              <Link
                href={`/wca/persons/${u.wcaid}`}
                className="cuber-link-modal"
                onClick={onClose}
              >
                {displayCuberName(u.name, isZh)}
              </Link>
            ) : (
              <span>{displayCuberName(u.name, isZh)}</span>
            )}
            {place !== null && <span className="comp-round-modal-place">#{place}</span>}
          </div>
          <button type="button" className="comp-modal-close" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </header>
        <div className="comp-round-modal-body">
          <div className="comp-round-modal-subtitle">
            {compName}, {eventDisplayName(ev.i, isZh)}{isZh ? '' : ' '}{roundDisplayName(rd.name, isZh)}
          </div>
          <section className="comp-round-modal-section">
            <div className="comp-round-modal-label">{isZh ? '详情' : 'Attempts'}</div>
            <div className="comp-round-modal-value">
              {attempts.length === 0
                ? '—'
                : (() => {
                    const isAo5 = rd.f === 'a' && attempts.length === 5;
                    if (!isAo5) return attempts.map(v => formatLive(v, result.e, false)).join(', ');
                    let bestIdx = -1, worstIdx = -1;
                    let bestVal = Infinity, worstVal = -Infinity;
                    let dnfIdx = -1;
                    attempts.forEach((v, i) => {
                      if (v === -1 || v === -2) { if (dnfIdx < 0) dnfIdx = i; return; }
                      if (v > 0 && v < bestVal) { bestVal = v; bestIdx = i; }
                      if (v > 0 && v > worstVal) { worstVal = v; worstIdx = i; }
                    });
                    if (dnfIdx >= 0) worstIdx = dnfIdx;
                    return attempts.map((v, i) => {
                      const s = formatLive(v, result.e, false);
                      return (i === bestIdx || i === worstIdx) ? `(${s})` : s;
                    }).join(', ');
                  })()}
            </div>
          </section>
          <section className="comp-round-modal-section">
            <div className="comp-round-modal-label">{isZh ? '平均' : 'Average'}</div>
            <div className="comp-round-modal-value">
              {isAverageFormat && result.a !== 0 ? (
                <span className="record-num-cell">
                  {formatLive(result.a, result.e, true)}
                  {result.ar
                    ? <RecordBadge record={String(result.ar)} variant="inline" iso2={iso2} />
                    : averageBadge ? <RecordBadge record={averageBadge} variant="inline" /> : null}
                </span>
              ) : '—'}
            </div>
          </section>
          <section className="comp-round-modal-section">
            <div className="comp-round-modal-label">{isZh ? '单次' : 'Best'}</div>
            <div className="comp-round-modal-value">
              {result.b !== 0 ? (
                <span className="record-num-cell">
                  {formatLive(result.b, result.e, false)}
                  {result.sr
                    ? <RecordBadge record={result.sr} variant="inline" iso2={iso2} />
                    : singleBadge ? <RecordBadge record={singleBadge} variant="inline" /> : null}
                </span>
              ) : '—'}
            </div>
          </section>
        </div>
        <footer className="comp-modal-footer comp-round-modal-footer">
          {canCopy && (
            <button
              type="button"
              className="comp-modal-copy-btn"
              onClick={handleCopy}
              disabled={copyState === 'copying'}
              title={isZh ? '复制为推送文案' : 'Copy as push text'}
            >
              {copyState === 'done' ? <Check size={14} /> : <Copy size={14} />}
              <span>
                {copyState === 'done'
                  ? (isZh ? '已复制' : 'Copied')
                  : copyState === 'error'
                    ? (isZh ? '失败' : 'Failed')
                    : copyState === 'nothing'
                      ? (isZh ? '无可复制' : 'Nothing')
                      : copyState === 'copying'
                        ? (isZh ? '复制中…' : 'Copying…')
                        : (isZh ? '复制' : 'Copy')}
              </span>
            </button>
          )}
          <button type="button" className="comp-modal-close-btn" onClick={onShowAll}>
            {isZh ? '所有' : 'All'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function LiveIndicator({ status, isZh }: { status: WsStatus; isZh: boolean }) {
  const label = (() => {
    switch (status) {
      case 'open':       return isZh ? '实时' : 'Live';
      case 'connecting': return isZh ? '连接中' : 'Connecting';
      case 'closed':     return isZh ? '已断开' : 'Disconnected';
      case 'error':      return isZh ? '连接失败' : 'Error';
      default:           return '';
    }
  })();
  if (!label) return null;
  return (
    <span className={`comp-live-indicator status-${status}`} title={isZh ? 'wss://cubing.com/ws 实时推送' : 'wss://cubing.com/ws live stream'}>
      <span className="comp-live-dot" />
      {label}
    </span>
  );
}
