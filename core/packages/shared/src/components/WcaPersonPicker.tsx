// NOTE: WCA 选手选择器 React 组件 — 从 wca_person_picker.js (214行 DOM 操作) 改写
// 支持 modal / inline 两种模式，内部调用 searchPersons API

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchPersons } from '../api/wca_search';
import { loadPersonsIndex, searchLocalPersons } from '../api/persons_index';
import type { WcaPerson } from '../types';
import './WcaPersonPicker.css';

// NOTE: debounce 延迟（毫秒）— 中文输入 1 字符起搜，英文 2 字符
const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN_EN = 2;
const MIN_QUERY_LEN_ZH = 1;

interface Props {
  /** 模式：modal = 全屏遮罩 + 居中面板，inline = 相对定位 dropdown */
  mode: 'modal' | 'inline';
  /** 选中选手后的回调 */
  onSelect: (person: WcaPerson) => void;
  /** 关闭回调（modal 模式下点击遮罩/Esc 触发） */
  onClose?: () => void;
  /** 搜索框占位文字 */
  placeholder?: string;
  /** 是否可见（受外部控制） */
  open?: boolean;
  /** 自定义搜索源；不传则用默认（本地 persons_search.json.gz + WCA API fallback） */
  searchFn?: (query: string) => WcaPerson[] | Promise<WcaPerson[]>;
  /** 受控初始值；非空时输入框预填，并自动跑一次搜索 */
  initialQuery?: string;
  /** 输入和搜索结果完全匹配某一项时（WCA ID / 名字 / 名字括号内中文）自动 onSelect */
  autoConfirmExact?: boolean;
}

// NOTE: 判断是否包含中文（用于降低最小搜索长度）
function hasChinese(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

// NOTE: 国旗渲染 — 用本地 flag-icons CSS 类（见 client-vite/src/index.css 的 import）
// Chinese Taipei (iso2=tw) 用 WCA 专用梅花旗 SVG，与 WcaStatsPage / tools/i18n 一致

export function WcaPersonPicker({
  mode,
  onSelect,
  onClose,
  placeholder = 'Search WCA player…',
  open = true,
  searchFn,
  initialQuery,
  autoConfirmExact = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<WcaPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  // 异步 API 回包到达时校验是否仍是最新 query —— 防止 typo→快速改回时被旧请求覆盖
  const lastQueryRef = useRef('');
  // autoConfirmExact 不能在同一 render cycle 调用 onSelect → 用 ref 标记 + effect 触发
  const autoSelectRef = useRef<WcaPerson | null>(null);

  // 后台预拉本地 persons 索引（仅默认搜索源用得着）
  useEffect(() => {
    if (!open || searchFn) return;
    loadPersonsIndex().catch(() => { /* 失败时 fallback 到 WCA API */ });
  }, [open, searchFn]);

  // NOTE: 面板打开时自动聚焦搜索框 — 立即 focus 一次（避免漏掉首次输入）
  // 100ms 兜底：移动端动画期间立即 focus 可能被打断
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open]);

  // NOTE: Esc 键关闭（仅 modal 模式）
  useEffect(() => {
    if (!open || mode !== 'modal') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, mode, onClose]);

  // 搜索：调用自定义 searchFn 或默认（本地索引 + WCA API fallback）
  const doSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    lastQueryRef.current = trimmed;
    const minLen = hasChinese(trimmed) ? MIN_QUERY_LEN_ZH : MIN_QUERY_LEN_EN;
    if (trimmed.length < minLen) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchFn) {
      const r = searchFn(trimmed);
      if (Array.isArray(r)) {
        setLoading(false);
        setHasSearched(true);
        setResults(r);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setHasSearched(true);
        const persons = await r;
        if (lastQueryRef.current !== trimmed) return;
        setResults(persons);
        setLoading(false);
      }, DEBOUNCE_MS);
      return;
    }

    const local = searchLocalPersons(trimmed, 20);
    if (local && local.length > 0) {
      setLoading(false);
      setHasSearched(true);
      setResults(local);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setHasSearched(true);
      const persons = await searchPersons(trimmed);
      if (lastQueryRef.current !== trimmed) return;
      setResults(persons);
      setLoading(false);
    }, DEBOUNCE_MS);
  }, [searchFn]);

  // 跑一次初始搜索（initialQuery 非空时）
  useEffect(() => {
    if (open && initialQuery) doSearch(initialQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  }, [doSearch]);

  const onItemClick = useCallback((person: WcaPerson) => {
    onSelect(person);
    // NOTE: 选中后重置状态
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, [onSelect]);

  // autoConfirmExact: 输入完全匹配某一项（WCA ID / 名字主体 / 括号内中文）时自动 onSelect
  useEffect(() => {
    if (!autoConfirmExact || results.length === 0) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const exact = results.find(p => {
      if (p.wcaId.toLowerCase() === lower) return true;
      const stripped = p.name.replace(/\s*[（(].*?[)）]\s*/g, '').trim().toLowerCase();
      if (stripped === lower) return true;
      const m = p.name.match(/[（(]([^)）]+)[)）]/);
      if (m && m[1] === trimmed) return true;
      return false;
    });
    if (exact && autoSelectRef.current?.wcaId !== exact.wcaId) {
      autoSelectRef.current = exact;
      onItemClick(exact);
    }
  }, [results, query, autoConfirmExact, onItemClick]);

  if (!open) return null;

  // NOTE: 搜索面板内容（modal / inline 共用）
  const panel = (
    <div className="wca-pp-panel">
      <div className="wca-pp-input-wrap">
        <input
          ref={inputRef}
          className="wca-pp-input"
          type="text"
          value={query}
          onChange={onInputChange}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      <div className="wca-pp-results">
        {loading && (
          <div className="wca-pp-status">
            <span className="wca-pp-spinner" />
          </div>
        )}
        {!loading && hasSearched && results.length === 0 && (
          <div className="wca-pp-status">No results found</div>
        )}
        {!loading && results.map((p) => (
          <button
            key={p.wcaId}
            className="wca-pp-item"
            onClick={() => onItemClick(p)}
          >
            {p.avatarUrl ? (
              <img className="wca-pp-avatar" src={p.avatarUrl} alt="" />
            ) : (
              <span className="wca-pp-avatar" />
            )}
            {p.iso2 && (
              p.iso2 === 'tw'
                ? <img className="wca-pp-flag" src="/tools/assets/images/ChineseTaipei.svg" alt="Chinese Taipei" />
                : <span className={`fi fi-${p.iso2} wca-pp-flag`} aria-label={p.iso2} />
            )}
            <div className="wca-pp-info">
              <span className="wca-pp-name">{p.name}</span>
              <span className="wca-pp-id">{p.wcaId}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // NOTE: Modal 模式用 React portal 渲染到 document.body
  if (mode === 'modal') {
    return createPortal(
      <div
        className="wca-pp-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        {panel}
      </div>,
      document.body
    );
  }

  // NOTE: Inline 模式直接渲染
  return <div className="wca-pp-inline">{panel}</div>;
}
