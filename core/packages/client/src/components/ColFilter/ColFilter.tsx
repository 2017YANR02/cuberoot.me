import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Filter, X, ArrowUp, ArrowDown } from 'lucide-react';
import './ColFilter.css';

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
}

function useIsMobile(): boolean {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 600);
  useEffect(() => {
    const f = () => setM(window.innerWidth <= 600);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}

export function ColFilter({
  active, onClear, children, align = 'right',
  open: openProp, onOpenChange,
  sortable, sortDir, onSort,
}: Props) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) onOpenChange(nextVal);
    else setInternalOpen(nextVal);
  }, [open, onOpenChange]);
  const isMobile = useIsMobile();
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
    // NOTE: 滚动 / resize 时关掉,避免 popover 漂移与 anchor 脱钩
    const onScrollResize = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

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
          >
            <ArrowUp size={12} /> {t('common.sortAsc')}
          </button>
          <button
            type="button"
            className={`col-filter-sort-btn${sortDir === 'desc' ? ' active' : ''}`}
            onClick={() => { onSort('desc'); setOpen(false); }}
          >
            <ArrowDown size={12} /> {t('common.sortDesc')}
          </button>
        </div>
      )}
      <div className="col-filter-body">{children}</div>
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
