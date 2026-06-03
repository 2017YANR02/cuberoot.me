'use client';

// Ported from packages/client/src/components/ColFilter/ColFilter.tsx.
import { useEffect, useLayoutEffect, useRef, useState, useCallback, createContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Filter, X, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import './ColFilter.css';

/** 给 popover children 用的关闭函数 — 比如 input 内按 Enter / iOS ✓ 时关掉 popover */
export const ColFilterCloseContext = createContext<(() => void) | null>(null);

interface Props {
  active: boolean;
  onClear?: () => void;
  children: ReactNode;
  /** popover 对齐边：默认 right（图标在右侧 / 列偏后时不出屏） */
  align?: 'left' | 'right';
  /** 受控开关——让外层 <th> 任意点击也能开/关此 popup。两者一起传才走受控。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 在 popup 顶端显示"升序/降序"按钮(Notion/Excel 风格统一菜单)。 */
  sortable?: boolean;
  sortDir?: 'asc' | 'desc';
  /** 用户在 popup 里点了排序按钮时回调,sortDir 会被显式设置。 */
  onSort?: (dir: 'asc' | 'desc') => void;
  /** 恢复默认排序回调(可选);传入则在 sort 按钮组显示 ↺ */
  onSortReset?: () => void;
}

export function ColFilter({
  active, onClear, children, align = 'right',
  open: openProp, onOpenChange,
  sortable, sortDir, onSort, onSortReset,
}: Props) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) onOpenChange(nextVal);
    else setInternalOpen(nextVal);
  }, [open, onOpenChange]);
  const isMobile = useIsMobile(600);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      ...(align === 'right'
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    updatePos();
  }, [open, isMobile, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // NOTE: 桌面端外部滚动 / resize 时关 popover(避免漂移与 anchor 脱钩);
    // 手机端跳过这两个监听 —— iOS Safari 软键盘弹出会同时触发 scroll(自动滚到 input)
    // 和 resize(viewport 高度变),activeElement check 在 focus 时机上不稳,直接跳过最稳。
    // 手机端 popover 通常居中/全屏,用户主动点 X 或外部空白关即可。
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    if (!isMobile) {
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onResize);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      if (!isMobile) {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onResize);
      }
    };
  }, [open, isMobile, setOpen]);

  const popover = open ? (
    <div
      ref={popRef}
      className={`col-filter-pop${isMobile ? ' col-filter-pop-modal' : ''}`}
      style={isMobile ? undefined : { position: 'fixed', ...pos }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {sortable && onSort && (
        <div className="col-filter-sort">
          <button
            type="button"
            className={`col-filter-sort-btn${sortDir === 'asc' ? ' active' : ''}`}
            onClick={() => { onSort('asc'); setOpen(false); }}
            aria-label={t('common.sortAsc')}
            title={t('common.sortAsc')}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className={`col-filter-sort-btn${sortDir === 'desc' ? ' active' : ''}`}
            onClick={() => { onSort('desc'); setOpen(false); }}
            aria-label={t('common.sortDesc')}
            title={t('common.sortDesc')}
          >
            <ArrowDown size={14} />
          </button>
          {onSortReset && (
            <button
              type="button"
              className="col-filter-sort-btn"
              onClick={() => { onSortReset(); setOpen(false); }}
              aria-label={t('common.sortReset')}
              title={t('common.sortReset')}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      )}
      <div className="col-filter-body">
        <ColFilterCloseContext.Provider value={() => setOpen(false)}>
          {children}
        </ColFilterCloseContext.Provider>
      </div>
      {active && onClear && (
        <button
          type="button"
          className="col-filter-clear"
          onClick={() => { onClear(); setOpen(false); }}
        >
          <X size={12} /> {t('common.clear')}
        </button>
      )}
    </div>
  ) : null;

  return (
    <span className="col-filter">
      <button
        ref={btnRef}
        type="button"
        className={`col-filter-btn${active ? ' active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="filter"
      >
        <Filter size={12} />
      </button>
      {popover && createPortal(popover, document.body)}
    </span>
  );
}
