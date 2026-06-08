'use client';

/**
 * DrillModal — pick a single OLL or PLL case to drill repeatedly.
 *
 * Reuses the trainer-subset-modal CSS so the chips/grid/group layout matches
 * the existing TrainerSubsetModal.
 */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { OLL_CASES } from '../_lib/scramble/algs/oll_cases';
import { PLL_CASES } from '../_lib/scramble/algs/pll_cases';
import type { DrillType } from '../_lib/scramble/drill';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface Props {
  isZh: boolean;
  initialType?: DrillType;
  activeCase?: { type: DrillType; id: string } | null;
  onPick: (type: DrillType, caseId: string) => void;
  onExit: () => void;
  onClose: () => void;
}

export default function DrillModal({
  isZh,
  initialType,
  activeCase,
  onPick,
  onExit,
  onClose,
}: Props) {
  const [type, setType] = useState<DrillType>(initialType ?? activeCase?.type ?? 'oll');
  const [searchQuery, setSearchQuery] = useState('');
  const titleId = useId();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile(480);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    setSearchQuery('');
  }, [type]);

  const groups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = (c: { id: string; name: string }) =>
      !q || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);

    if (type === 'pll') {
      const cases = (PLL_CASES as readonly { id: string; name: string }[]).filter(matches);
      return [{ name: '', cases }];
    }
    const map = new Map<string, { id: string; name: string; group: string }[]>();
    for (const c of OLL_CASES) {
      if (!matches(c)) continue;
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries()).map(([name, cases]) => ({ name, cases }));
  }, [type, searchQuery]);

  const total = type === 'oll' ? OLL_CASES.length : PLL_CASES.length;
  const matchedCount = groups.reduce((n, g) => n + g.cases.length, 0);
  const activeId = activeCase && activeCase.type === type ? activeCase.id : null;

  const gridStyle: CSSProperties | undefined = isMobile
    ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }
    : undefined;
  const chipStyle: CSSProperties | undefined = isMobile
    ? {
        minHeight: 44,
        minWidth: 44,
        padding: '10px 8px',
        fontSize: 14,
        justifyContent: 'center',
      }
    : undefined;
  const bodyStyle: CSSProperties | undefined = isMobile
    ? { maxHeight: '55dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
    : undefined;
  const searchStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#1a1a1d',
    color: '#ededed',
    border: '1px solid #444',
    borderRadius: 6,
    padding: isMobile ? '10px 12px' : '6px 10px',
    fontSize: isMobile ? 16 : 13,
    marginBottom: 10,
  };

  const searchPlaceholder = i18n.language === 'zh-Hant' ? (type === 'oll' ? '搜尋 (例如 21)' : '搜尋 (例如 T)') : (isZh
      ? type === 'oll' ? '搜索 (例如 21)' : '搜索 (例如 T)'
      : type === 'oll' ? 'Search (e.g. 21)' : 'Search (e.g. T)');

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal trainer-subset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          {tr({ zh: '专项练习', en: 'Drill mode',
              zhHant: "專項練習"
        })}
          <span className="trainer-subset-count"> ({total})</span>
        </h2>

        <div className="trainer-subset-toolbar">
          <button
            ref={firstButtonRef}
            type="button"
            className={type === 'oll' ? 'primary' : ''}
            onClick={() => setType('oll')}
          >
            OLL
          </button>
          <button
            type="button"
            className={type === 'pll' ? 'primary' : ''}
            onClick={() => setType('pll')}
          >
            PLL
          </button>
          {activeCase && (
            <button type="button" onClick={() => { onExit(); onClose(); }}>
              {i18n.language === 'zh-Hant' ? (`退出專項 (${activeCase.id})`) : (isZh ? `退出专项 (${activeCase.id})` : `Exit drill (${activeCase.id})`)}
            </button>
          )}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={tr({ zh: '搜索 case', en: 'Search cases',
              zhHant: "搜尋 case"
        })}
          style={searchStyle}
        />

        <div className="trainer-subset-body" style={bodyStyle}>
          {matchedCount === 0 ? (
            <div style={{ color: '#888', fontSize: 13, padding: '12px 4px' }}>
              {tr({ zh: '无匹配结果', en: 'No matches',
                  zhHant: "無匹配結果"
            })}
            </div>
          ) : (
            groups.map((g, gi) => (
              g.cases.length === 0 ? null : (
                <div key={gi} className="trainer-case-group">
                  {g.name && <h3 className="trainer-case-group-title">{g.name}</h3>}
                  <div className="trainer-case-grid" style={gridStyle}>
                    {g.cases.map(c => {
                      const checked = activeId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`trainer-case-chip ${checked ? 'checked' : ''}`}
                          style={chipStyle}
                          onClick={() => { onPick(type, c.id); onClose(); }}
                          title={c.id}
                        >
                          <span className="trainer-case-chip-label">
                            {type === 'oll' ? c.id.replace(/^OLL /, '') : c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ))
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>{tr({ zh: '关闭', en: 'Close',
              zhHant: "關閉"
        })}</button>
        </div>
      </div>
    </div>
  );
}
