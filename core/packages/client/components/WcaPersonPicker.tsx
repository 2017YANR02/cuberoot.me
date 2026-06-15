'use client';
// Person search input — ported from packages/client-vite/src/components/CuberSearchInput.tsx.
// 3-tier query: static index (top cubers) → WCA /persons?q= → WCA ID regex direct lookup.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag } from './Flag';
import { displayCuberName } from '@/lib/name-utils';
import { searchPersons, getPerson, WCA_ID_REGEX, type WcaPersonLite } from '@/lib/wca-api';
import { loadPersonsIndex, searchLocalPersons, isPersonsIndexReady } from '@cuberoot/shared';
import { ClearButton } from './ClearButton';
import './wca-person-picker.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface Props {
  value: WcaPersonLite | null;
  onChange: (cuber: WcaPersonLite | null) => void;
  /** Optional static index of "top cubers" for instant matches. */
  staticCubers?: WcaPersonLite[];
  matchCount?: number | null;
  placeholder?: string;
  isZh?: boolean;
  className?: string;
  /** Fires with the live query text as the user types (and '' on clear).
   *  Lets callers treat the typed text as free-text input when no person is picked. */
  onQueryChange?: (q: string) => void;
}

const DEBOUNCE_MS = 300;
const MAX_STATIC = 5;
const MAX_API = 5;
// 本地全量索引(28万选手)先扫这么多候选, 再按相关性排序取前 MAX_LOCAL.
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

export function WcaPersonPicker({
  value, onChange, staticCubers = [], matchCount, placeholder, isZh, className, onQueryChange,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [apiResults, setApiResults] = useState<WcaPersonLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexReady, setIndexReady] = useState(() => isPersonsIndexReady());
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const staticMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as WcaPersonLite[];
    const seen = new Set<string>();
    const out: WcaPersonLite[] = [];
    for (const c of staticCubers) {
      if (out.length >= MAX_STATIC) break;
      if (seen.has(c.id)) continue;
      const haystack = `${c.name.toLowerCase()} ${c.id.toLowerCase()}`;
      if (haystack.includes(q)) {
        seen.add(c.id);
        out.push(c);
      }
    }
    return out;
  }, [query, staticCubers]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setApiResults([]); setLoading(false); return; }

    // WCA ID → 直查(本地索引不含成绩页校验, 走 API 拿权威条目)
    if (WCA_ID_REGEX.test(q.toUpperCase())) {
      setLoading(true);
      const handle = window.setTimeout(async () => {
        try {
          const p = await getPerson(q.toUpperCase());
          setApiResults(p ? [p] : []);
        } finally { setLoading(false); }
      }, DEBOUNCE_MS);
      return () => window.clearTimeout(handle);
    }

    // 本地全量索引秒搜(中文 / 单字符都行);未加载完返回 null → fallback WCA API
    const local = searchLocalPersons(q, LOCAL_SCAN);
    if (local) {
      const ql = q.toLowerCase();
      const mapped = local.map(p => ({ id: p.wcaId, name: p.name, country_iso2: p.iso2 }));
      mapped.sort((a, b) => localScore(a, ql) - localScore(b, ql));
      setApiResults(mapped.slice(0, MAX_LOCAL));
      setLoading(false);
      return;
    }

    // 索引未就绪 → WCA API 兜底(防抖)
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const list = await searchPersons(q, MAX_API);
        setApiResults(list);
      } finally { setLoading(false); }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, indexReady]);

  const apiFiltered = useMemo(() => {
    const staticIds = new Set(staticMatches.map(c => c.id));
    return apiResults.filter(c => !staticIds.has(c.id));
  }, [apiResults, staticMatches]);

  const handlePick = (cuber: WcaPersonLite) => {
    onChange(cuber);
    setQuery('');
    setApiResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setApiResults([]);
    setOpen(false);
  };

  if (value) {
    return (
      <div ref={wrapRef} className={`cuber-search ${className ?? ''}`.trim()}>
        <div className="cuber-search-chip">
          <Flag iso2={value.country_iso2} className="cuber-search-flag" />
          <span className="cuber-search-chip-name">{displayCuberName(value.name, !!isZh)}</span>
          <span className="cuber-search-chip-id">{value.id}</span>
          {typeof matchCount === 'number' && (
            <span className="cuber-search-chip-count">
              {(isZh ? `${matchCount} 场` : `${matchCount} ${matchCount === 1 ? 'comp' : 'comps'}`)}
            </span>
          )}
          <ClearButton onClick={handleClear} isZh={isZh} />
        </div>
      </div>
    );
  }

  const showDropdown = open && (loading || staticMatches.length > 0 || apiFiltered.length > 0 || query.trim().length > 0);
  return (
    <div ref={wrapRef} className={`cuber-search ${className ?? ''}`.trim()}>
      <input
        ref={inputRef}
        type="text"
        className={`search-box${query ? ' cuber-search-input--with-clear' : ''}`}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onQueryChange?.(e.target.value); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <ClearButton
          onClick={() => { setQuery(''); setApiResults([]); onQueryChange?.(''); inputRef.current?.focus(); }}
          isZh={isZh}
          preserveFocus
        />
      )}
      {showDropdown && (
        <div className="cuber-search-popup">
          {staticMatches.length > 0 && (
            <div className="cuber-search-section">
              <div className="cuber-search-section-label">★ {tr({ zh: '顶尖选手', en: 'Top cubers'
            })}</div>
              {staticMatches.map(c => (
                <CuberRow key={`s-${c.id}`} cuber={c} isZh={isZh} onPick={handlePick} />
              ))}
            </div>
          )}
          {apiFiltered.length > 0 && (
            <div className="cuber-search-section">
              {apiFiltered.map(c => (
                <CuberRow key={`a-${c.id}`} cuber={c} isZh={isZh} onPick={handlePick} />
              ))}
            </div>
          )}
          {loading && (
            <div className="cuber-search-status">{tr({ zh: '搜索中…', en: 'Searching…'
            })}</div>
          )}
          {!loading && staticMatches.length === 0 && apiFiltered.length === 0 && query.trim().length > 0 && (
            <div className="cuber-search-status">{tr({ zh: '未找到选手', en: 'No matches'
            })}</div>
          )}
        </div>
      )}
    </div>
  );
}

function CuberRow({ cuber, isZh, onPick }: {
  cuber: WcaPersonLite;
  isZh?: boolean;
  onPick: (c: WcaPersonLite) => void;
}) {
  return (
    <button type="button" className="cuber-search-item" onClick={() => onPick(cuber)}>
      <Flag iso2={cuber.country_iso2} className="cuber-search-flag" />
      <span className="cuber-search-item-main">
        <span className="cuber-search-item-name">{displayCuberName(cuber.name, !!isZh)}</span>
        <span className="cuber-search-item-id">{cuber.id}</span>
      </span>
    </button>
  );
}
