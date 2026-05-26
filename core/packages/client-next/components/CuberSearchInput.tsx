'use client';

/**
 * 选手搜索输入框 — CalendarPage "搜索选手" 专用。
 *
 * Ported from packages/client/src/components/CuberSearchInput.tsx.
 *
 * 三层数据源(查询路径):
 *   1. 静态名字索引 (来自 upcoming_comps.json::top_cubers,~200 人) — 即时下拉,WCA 顶尖选手覆盖
 *   2. WCA API /persons?q= — 名字模糊搜,包含全部 28 万 WCA 注册人
 *   3. WCA ID 直输 (regex 匹配) — 直接调 /persons/{id}
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/name-utils';
import { searchPersons, getPerson, WCA_ID_REGEX, type WcaPersonLite } from '@/lib/wca-api';
import { ClearButton } from '@/components/ClearButton';
import './cuber_search_input.css';

interface Props {
  value: WcaPersonLite | null;
  onChange: (cuber: WcaPersonLite | null) => void;
  /** 静态名字索引——上层组件从 top_cubers JSON 派生 */
  staticCubers: WcaPersonLite[];
  /** 选中后展示的"X 场"提示;父组件计算后传入 */
  matchCount?: number | null;
  placeholder?: string;
  isZh?: boolean;
  className?: string;
}

const DEBOUNCE_MS = 300;
const MAX_STATIC = 5;
const MAX_API = 5;

export function CuberSearchInput({
  value, onChange, staticCubers, matchCount, placeholder, isZh, className,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [apiResults, setApiResults] = useState<WcaPersonLite[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 关闭下拉:点外面
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 静态名字 + WCA ID 子串匹配
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

  // API 搜索 (debounce + WCA ID 直输识别)
  useEffect(() => {
    const q = query.trim();
    if (!q) { setApiResults([]); setLoading(false); return; }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        if (WCA_ID_REGEX.test(q.toUpperCase())) {
          const p = await getPerson(q.toUpperCase());
          setApiResults(p ? [p] : []);
        } else {
          const list = await searchPersons(q, MAX_API);
          setApiResults(list);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  // 静态命中已经覆盖的 ID 不在 API 段重复显示
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

  // ── 选中态: chip 样式,不可编辑;点 × 重新搜 ──────────────────
  if (value) {
    return (
      <div ref={wrapRef} className={`cuber-search ${className ?? ''}`.trim()}>
        <div className="cuber-search-chip">
          <Flag iso2={value.country_iso2} className="cuber-search-flag" />
          <span className="cuber-search-chip-name">{displayCuberName(value.name, !!isZh)}</span>
          <span className="cuber-search-chip-id">{value.id}</span>
          {typeof matchCount === 'number' && (
            <span className="cuber-search-chip-count">
              {isZh ? `${matchCount} 场` : `${matchCount} ${matchCount === 1 ? 'comp' : 'comps'}`}
            </span>
          )}
          <ClearButton onClick={handleClear} isZh={isZh} />
        </div>
      </div>
    );
  }

  // ── 输入态: input + dropdown ──────────────────────────────────
  const showDropdown = open && (loading || staticMatches.length > 0 || apiFiltered.length > 0 || query.trim().length > 0);
  return (
    <div ref={wrapRef} className={`cuber-search ${className ?? ''}`.trim()}>
      <input
        ref={inputRef}
        type="text"
        className={`search-box${query ? ' cuber-search-input--with-clear' : ''}`}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <ClearButton
          onClick={() => { setQuery(''); setApiResults([]); inputRef.current?.focus(); }}
          isZh={isZh}
          preserveFocus
        />
      )}
      {showDropdown && (
        <div className="cuber-search-popup">
          {staticMatches.length > 0 && (
            <div className="cuber-search-section">
              <div className="cuber-search-section-label">★ {isZh ? '顶尖选手' : 'Top cubers'}</div>
              {staticMatches.map(c => (
                <CuberRow key={`s-${c.id}`} cuber={c} isZh={isZh} onPick={handlePick} />
              ))}
            </div>
          )}
          {apiFiltered.length > 0 && (
            <div className="cuber-search-section">
              <div className="cuber-search-section-label">{isZh ? 'WCA 数据库' : 'WCA database'}</div>
              {apiFiltered.map(c => (
                <CuberRow key={`a-${c.id}`} cuber={c} isZh={isZh} onPick={handlePick} />
              ))}
            </div>
          )}
          {loading && (
            <div className="cuber-search-status">{isZh ? '搜索中…' : 'Searching…'}</div>
          )}
          {!loading && staticMatches.length === 0 && apiFiltered.length === 0 && query.trim().length > 0 && (
            <div className="cuber-search-status">{isZh ? '未找到选手' : 'No matches'}</div>
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
