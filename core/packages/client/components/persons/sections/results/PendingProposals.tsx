'use client';
// 「待审核」标记:任何登录用户对成绩的提议改动(原始/改判/罚时)在管理员批准前,
// 公开可见但标注待审核,不进有效值。管理员可就地批准(→ 上线)/ 驳回(→ 隐藏)。
// 浮层 portal 到 body + position:fixed,逃出成绩表 overflow 裁切;结构样式内联(同 AttemptEditPopover)。

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/i18n/tr';
import {
  formatChangeFieldValue, approveResultChange, rejectResultChange, type ResultChange,
} from '@/lib/result-watch-api';

const POP_W = 280;

const FIELD_LABEL: Record<string, { zh: string; en: string }> = {
  best: { zh: '单次', en: 'Single' },
  average: { zh: '平均', en: 'Average' },
  attempts: { zh: '各次', en: 'Attempts' },
  attempt_penalties: { zh: '罚时', en: 'Penalty' },
  pos: { zh: '名次', en: 'Pos' },
  regional_single_record: { zh: '单次纪录', en: 'Single record' },
  regional_average_record: { zh: '平均纪录', en: 'Average record' },
};

const boxStyle: CSSProperties = {
  position: 'fixed', transform: 'translateX(-50%)', zIndex: 200,
  width: POP_W, padding: 12, display: 'flex', flexDirection: 'column', gap: 9,
  background: 'var(--popover)', border: '1px solid var(--border-default)', borderRadius: 11,
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)', textAlign: 'left', whiteSpace: 'normal', cursor: 'default',
  maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
};
const itemStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 9,
  borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,0.2))',
};
const fieldRowStyle: CSSProperties = { fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5 };
const metaStyle: CSSProperties = { fontSize: '0.68rem', color: 'var(--muted-foreground)' };
const actionsStyle: CSSProperties = { display: 'flex', gap: 6, marginTop: 4 };
const approveBtn: CSSProperties = {
  flex: 1, padding: '4px 8px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
  background: 'var(--accent)', color: 'var(--accent-foreground, #fff)', border: 'none', borderRadius: 6,
};
const rejectBtn: CSSProperties = {
  flex: 1, padding: '4px 8px', fontSize: '0.76rem', cursor: 'pointer',
  background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border-strong)', borderRadius: 6,
};

export function PendingProposals({ pending, eventId, isAdmin, onModerated }: {
  pending: ResultChange[];
  eventId: string;
  isAdmin: boolean;
  onModerated: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const halfW = POP_W / 2;
    const h = popRef.current?.offsetHeight ?? 200;
    const left = Math.min(Math.max(r.left + r.width / 2, halfW + margin), window.innerWidth - halfW - margin);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - margin) {
      const above = r.top - 6 - h;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - h - margin);
    }
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onMove = () => reposition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, reposition]);

  if (pending.length === 0) return null;

  const toggle = () => { if (open) { setOpen(false); return; } reposition(); setOpen(true); };

  const moderate = async (id: number, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      await (action === 'approve' ? approveResultChange : rejectResultChange)(id);
      onModerated();
      setOpen(false);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="wp-pending-chip"
        title={tr({ zh: '有待审核的提议改动 — 点击查看', en: 'Pending proposed change(s) — click to view' })}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >{tr({ zh: '待审核', en: 'Pending' })}</button>
      {open && pos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'transparent' }} onClick={() => setOpen(false)} />
          <span ref={popRef} style={{ ...boxStyle, top: pos.top, left: pos.left }} role="dialog" onClick={(e) => e.stopPropagation()}>
            {pending.map((c, ci) => {
              const fields = c.fields ?? [];
              return (
                <span key={c.id} style={{ ...itemStyle, ...(ci === pending.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}>
                  {fields.map((f, fi) => (
                    <span key={fi} style={fieldRowStyle}>
                      <span style={metaStyle}>{tr(FIELD_LABEL[f.field] ?? { zh: f.field, en: f.field })} </span>
                      <s className="wp-old-result">{formatChangeFieldValue(f.field, f.old, eventId)}</s>
                      {' → '}
                      <strong>{formatChangeFieldValue(f.field, f.new, eventId)}</strong>
                    </span>
                  ))}
                  <span style={metaStyle}>
                    {tr({ zh: '提议人', en: 'by' })} {c.createdBy ?? tr({ zh: '匿名', en: 'anon' })}
                    {c.note ? ` · ${c.note}` : ''}
                  </span>
                  {isAdmin && (
                    <span style={actionsStyle}>
                      <button type="button" style={approveBtn} disabled={busy === c.id} onClick={() => moderate(c.id, 'approve')}>
                        {busy === c.id ? '…' : tr({ zh: '批准', en: 'Approve' })}
                      </button>
                      <button type="button" style={rejectBtn} disabled={busy === c.id} onClick={() => moderate(c.id, 'reject')}>
                        {tr({ zh: '驳回', en: 'Reject' })}
                      </button>
                    </span>
                  )}
                </span>
              );
            })}
          </span>
        </>,
        document.body,
      )}
    </>
  );
}
