'use client';
// Person search input — ported from packages/client-vite/src/components/CuberSearchInput.tsx.
// 3-tier query: static index (top cubers) → WCA /persons?q= → WCA ID regex direct lookup.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag } from './Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { searchPersons, getPerson, WCA_ID_REGEX, type WcaPersonLite } from '@/lib/wca-api';
import { loadPersonsIndex, searchLocalPersons, isPersonsIndexReady } from '@cuberoot/shared';
import { ClearButton } from './ClearButton';
import './wca-person-picker.css';
import { tr } from '@/i18n/tr';

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
  /** The caller persists an unmatched query as a name, so explain that it is valid input. */
  allowFreeText?: boolean;
  /** 输入框的初始文字。改名 / 回填场景用:框里先摆着当前用的名字,不用让人重打一遍。
   *  只取挂载那一次(之后归输入框自己管),换初值请给组件换 key。 */
  defaultQuery?: string;
  /** 挂载后立即聚焦并展开候选。编辑已有姓名时使用。 */
  autoOpen?: boolean;
  /** 外层需要保留自己的删除动作时，可隐藏搜索框内置的清除按钮。 */
  showClearButton?: boolean;
  /** Hide WCA people already represented by another result source in a combined search. */
  excludeIds?: readonly string[];
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
  value, onChange, staticCubers = [], matchCount, placeholder, isZh, className,
  onQueryChange, allowFreeText = false, defaultQuery, autoOpen = false, showClearButton = true,
  excludeIds = [],
}: Props) {
  const [query, setQuery] = useState(defaultQuery ?? '');
  const [open, setOpen] = useState(autoOpen);
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
    const excludedIds = new Set(excludeIds.map(id => id.toUpperCase()));
    return apiResults.filter(c => !staticIds.has(c.id) && !excludedIds.has(c.id.toUpperCase()));
  }, [apiResults, excludeIds, staticMatches]);

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
          {showClearButton && <ClearButton onClick={handleClear} isZh={isZh} />}
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
        className={`search-control cuber-search-input${query && showClearButton ? ' search-control--with-clear' : ''}`}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onQueryChange?.(e.target.value); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoFocus={autoOpen}
        autoComplete="off"
        spellCheck={false}
      />
      {query && showClearButton && (
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
            <div className="cuber-search-status">{allowFreeText
              ? tr({ zh: '未匹配 WCA 选手,将按输入姓名保存', en: 'No WCA match; the typed name will be saved' })
              : tr({ zh: '未找到选手', en: 'No matches' })}</div>
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
