// NOTE: WCA 选手选择器 React 组件 — 从 wca_person_picker.js (214行 DOM 操作) 改写
// 支持 modal / inline 两种模式，内部调用 searchPersons API

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchPersons } from '../api/wca_search';
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
}

// NOTE: 判断是否包含中文（用于降低最小搜索长度）
function hasChinese(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

// NOTE: 国旗 emoji 从 ISO 3166 alpha-2 转换
function flagUrl(iso2: string): string {
  if (!iso2) return '';
  return `https://flagcdn.com/w40/${iso2}.png`;
}

export function WcaPersonPicker({
  mode,
  onSelect,
  onClose,
  placeholder = 'Search WCA player…',
  open = true,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WcaPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // NOTE: 面板打开时自动聚焦搜索框
  useEffect(() => {
    if (open && inputRef.current) {
      // NOTE: 延迟聚焦 — 等 CSS 动画开始后再 focus，避免移动端键盘弹出导致动画卡顿
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
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

  // NOTE: 搜索逻辑 — debounce + 最小字符数
  const doSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    const minLen = hasChinese(trimmed) ? MIN_QUERY_LEN_ZH : MIN_QUERY_LEN_EN;
    if (trimmed.length < minLen) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setHasSearched(true);
      const persons = await searchPersons(trimmed);
      setResults(persons);
      setLoading(false);
    }, DEBOUNCE_MS);
  }, []);

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
              <img className="wca-pp-flag" src={flagUrl(p.iso2)} alt={p.iso2} />
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
