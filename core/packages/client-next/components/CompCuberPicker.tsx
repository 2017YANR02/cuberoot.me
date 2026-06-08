'use client';

// Unified competition + cuber search for /wca/comp. Merges CompPicker (type to
// live-filter the calendar by comp name + pick/paste to open a comp) and
// WcaPersonPicker (pick a cuber to filter the calendar to their comps) into one
// box with a two-section dropdown, modeled on the site-search box. Reuses the
// existing comp-search / persons-index data layers and both pickers' CSS — no
// new search engine, no new row styles.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Flag } from './Flag';
import { ClearButton } from './ClearButton';
import { extractWcaIdFromUrl } from './CompPicker';
import { loadComps, searchComps, isCancelledComp, type Comp } from '@/lib/comp-search';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { formatDateRangeIso } from '@/lib/wca-date';
import { displayCuberName } from '@/lib/name-utils';
import { searchPersons, getPerson, WCA_ID_REGEX, type WcaPersonLite } from '@/lib/wca-api';
import { loadPersonsIndex, searchLocalPersons, isPersonsIndexReady } from '@cuberoot/shared';
import './comp-picker.css';
import './wca-person-picker.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

const DEBOUNCE_MS = 300;
const MAX_COMPS = 12;
const MAX_STATIC = 5;
const LOCAL_SCAN = 60;
const MAX_LOCAL = 8;

// 相关性打分: 精确 0 > 前缀 1 > 子串 2;同档保持索引(wca_id 升)序.
function localScore(p: WcaPersonLite, ql: string): number {
  const name = p.name.toLowerCase();
  const id = p.id.toLowerCase();
  if (id === ql || name === ql) return 0;
  const stripped = name.replace(/\s*[（(].*?[)）]\s*/g, '').trim();
  if (stripped === ql) return 0;
  if (name.startsWith(ql) || id.startsWith(ql)) return 1;
  return 2;
}

interface Props {
  /** Comp-name live filter (mirror of the page's compQuery). */
  query: string;
  onQueryChange: (val: string) => void;
  /** Pick a competition from the dropdown → open it. */
  onPickComp: (comp: Comp) => void;
  /** A pasted WCA / cubing.com URL resolves to a bare id → open it. */
  onUrlPaste?: (wcaId: string) => void;
  /** Selected cuber (filters the calendar to their comps); shown as a chip. */
  cuber: WcaPersonLite | null;
  onCuberChange: (cuber: WcaPersonLite | null) => void;
  /** Top-cuber static index for instant name matches. */
  staticCubers?: WcaPersonLite[];
  /** Count shown on the cuber chip (their matching comps). */
  cuberMatchCount?: number | null;
  isZh?: boolean;
  className?: string;
  placeholder?: string;
}

export function CompCuberPicker({
  query, onQueryChange, onPickComp, onUrlPaste,
  cuber, onCuberChange, staticCubers = [], cuberMatchCount,
  isZh, className, placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [compResults, setCompResults] = useState<Comp[]>([]);
  const [cuberApi, setCuberApi] = useState<WcaPersonLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexReady, setIndexReady] = useState(() => isPersonsIndexReady());
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ensureComps = useCallback(async () => {
    if (comps) return comps;
    const loaded = await loadComps();
    setComps(loaded);
    return loaded;
  }, [comps]);

  // 后台预拉本地选手索引(全站共享, 拉过一次后即时命中)
  useEffect(() => {
    if (indexReady) return;
    loadPersonsIndex().then(() => setIndexReady(true)).catch(() => {});
  }, [indexReady]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 比赛搜索
  useEffect(() => {
    let cancelled = false;
    if (!open || !query.trim()) { setCompResults([]); return; }
    (async () => {
      const data = await ensureComps();
      if (cancelled) return;
      setCompResults(searchComps(query, data, MAX_COMPS));
    })();
    return () => { cancelled = true; };
  }, [query, open, ensureComps]);

  // 选手:静态 top-cuber 即时匹配
  const staticMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as WcaPersonLite[];
    const seen = new Set<string>();
    const out: WcaPersonLite[] = [];
    for (const c of staticCubers) {
      if (out.length >= MAX_STATIC) break;
      if (seen.has(c.id)) continue;
      if (`${c.name.toLowerCase()} ${c.id.toLowerCase()}`.includes(q)) { seen.add(c.id); out.push(c); }
    }
    return out;
  }, [query, staticCubers]);

  // 选手:本地全量索引秒搜 → WCA ID 直查 → API 兜底(同 WcaPersonPicker)
  useEffect(() => {
    const q = query.trim();
    if (!open || !q) { setCuberApi([]); setLoading(false); return; }

    if (WCA_ID_REGEX.test(q.toUpperCase())) {
      setLoading(true);
      const handle = window.setTimeout(async () => {
        try { const p = await getPerson(q.toUpperCase()); setCuberApi(p ? [p] : []); }
        finally { setLoading(false); }
      }, DEBOUNCE_MS);
      return () => window.clearTimeout(handle);
    }

    const local = searchLocalPersons(q, LOCAL_SCAN);
    if (local) {
      const ql = q.toLowerCase();
      const mapped = local.map(p => ({ id: p.wcaId, name: p.name, country_iso2: p.iso2 }));
      mapped.sort((a, b) => localScore(a, ql) - localScore(b, ql));
      setCuberApi(mapped.slice(0, MAX_LOCAL));
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = window.setTimeout(async () => {
      try { setCuberApi(await searchPersons(q, 5)); } finally { setLoading(false); }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, open, indexReady]);

  const cuberResults = useMemo(() => {
    const ids = new Set(staticMatches.map(c => c.id));
    return [...staticMatches, ...cuberApi.filter(c => !ids.has(c.id))];
  }, [staticMatches, cuberApi]);

  const pickComp = (c: Comp) => { onPickComp(c); setOpen(false); };
  const pickCuber = (p: WcaPersonLite) => {
    onCuberChange(p);
    onQueryChange('');
    setOpen(false);
    inputRef.current?.blur();
  };

  // 选了选手 → 展示 chip(与 WcaPersonPicker 一致),清掉则回到输入框
  if (cuber) {
    return (
      <div ref={wrapRef} className={`comp-picker ${className ?? ''}`.trim()}>
        <div className="cuber-search-chip">
          <Flag iso2={cuber.country_iso2} className="cuber-search-flag" />
          <span className="cuber-search-chip-name">{displayCuberName(cuber.name, !!isZh)}</span>
          <span className="cuber-search-chip-id">{cuber.id}</span>
          {typeof cuberMatchCount === 'number' && (
            <span className="cuber-search-chip-count">
              {i18n.language === 'zh-Hant' ? (`${cuberMatchCount} 場`) : (isZh ? `${cuberMatchCount} 场` : `${cuberMatchCount} ${cuberMatchCount === 1 ? 'comp' : 'comps'}`)}
            </span>
          )}
          <ClearButton onClick={() => onCuberChange(null)} isZh={isZh} />
        </div>
      </div>
    );
  }

  const showDropdown = open && query.trim() !== ''
    && (cuberResults.length > 0 || compResults.length > 0 || loading);

  return (
    <div ref={wrapRef} className={`comp-picker ${className ?? ''}`.trim()}>
      <input
        ref={inputRef}
        type="text"
        className={query ? 'comp-picker-input--with-clear' : ''}
        value={query}
        onChange={e => {
          const v = e.target.value;
          if (onUrlPaste) {
            const wcaId = extractWcaIdFromUrl(v);
            if (wcaId) { onUrlPaste(wcaId); return; }
          }
          onQueryChange(v);
          setOpen(true);
        }}
        onFocus={() => { setOpen(true); void ensureComps(); }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <ClearButton
          onClick={() => { onQueryChange(''); setOpen(false); inputRef.current?.focus(); }}
          isZh={isZh}
          preserveFocus
        />
      )}
      {showDropdown && (
        <div className="comp-picker-popup">
          {cuberResults.length > 0 && (
            <div className="cuber-search-section">
              <div className="cuber-search-section-label">{tr({ zh: '选手', en: 'Cubers',
                  zhHant: "選手"
            })}</div>
              {cuberResults.map(c => (
                <button key={`p-${c.id}`} type="button" className="cuber-search-item" onClick={() => pickCuber(c)}>
                  <Flag iso2={c.country_iso2} className="cuber-search-flag" />
                  <span className="cuber-search-item-main">
                    <span className="cuber-search-item-name">{displayCuberName(c.name, !!isZh)}</span>
                    <span className="cuber-search-item-id">{c.id}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {compResults.length > 0 && (
            <div className="cuber-search-section">
              <div className="cuber-search-section-label">{tr({ zh: '比赛', en: 'Competitions',
                  zhHant: "比賽"
            })}</div>
              {compResults.map(c => {
                const displayName = localizeCompName(c.id, c.name, !!isZh);
                const cancelled = isCancelledComp(c);
                return (
                  <button
                    key={`c-${c.id}`}
                    type="button"
                    className={`comp-picker-item${cancelled ? ' is-cancelled' : ''}`}
                    onClick={() => pickComp(c)}
                  >
                    <Flag iso2={c.country} />
                    <span className="comp-picker-main">
                      <span className="comp-picker-name">{displayName}</span>
                      <span className="comp-picker-meta">
                        <span className="comp-picker-id">{c.id}</span>
                        {c.city ? <> · {localizeCity(c.city, !!isZh)}</> : null}
                        {' · '}{formatDateRangeIso(c.start_date, c.end_date)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {loading && cuberResults.length === 0 && compResults.length === 0 && (
            <div className="cuber-search-status">{tr({ zh: '搜索中…', en: 'Searching…',
                zhHant: "搜尋中…"
            })}</div>
          )}
        </div>
      )}
    </div>
  );
}
