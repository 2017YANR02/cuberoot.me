'use client';
// 管理员点单次成绩 → 小浮层,两个方向二选一(或都填):
//  - 更正前(原始):补录该次被 WCA 更正前的旧值 → 旧值划线留在当前值前,当前值不变。
//  - 更正后(改判):把该次正向改判为新值 → 当前值划线,新值成为当前(自动重算单次/平均)。
// 浮层用 portal 渲染到 body + position:fixed,逃出成绩表的 overflow 裁切容器
// (wp-table-scroll / wp-tabs-card),否则会被切掉或挤成行内。
// 渲染逻辑与具体页面解耦:format 由调用方传(选手页 formatWcaResult / comp 页 formatLive)。

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/i18n/tr';
import { parseHumanResult } from '@/lib/result-watch-api';
import './result-change.css';

const POP_W = 216;

export function AttemptEditPopover({
  value, eventId, oldValues, cls, format, onSetOriginal, onCorrect,
}: {
  value: number;
  eventId: string;
  oldValues: number[];
  cls?: string;
  format: (v: number) => string;
  onSetOriginal: (v: number) => Promise<void> | void;
  onCorrect: (v: number) => Promise<void> | void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [orig, setOrig] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const formatted = format(value);
  const olds = oldValues.map((ov, k) => (
    <s key={k} className="wp-old-result">{format(ov)}</s>
  ));

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = POP_W / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    setPos({ top: r.bottom + 6, left });
  }, []);

  const close = useCallback(() => { setOpen(false); setOrig(''); setNext(''); }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = () => reposition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, reposition]);

  const toggle = () => {
    if (open) { close(); return; }
    reposition();
    setOpen(true);
  };

  const save = async () => {
    const po = parseHumanResult(orig, eventId);
    const pn = parseHumanResult(next, eventId);
    if ((po == null || po === value) && (pn == null || pn === value)) { close(); return; }
    setBusy(true);
    try {
      if (po != null && po !== value) await onSetOriginal(po);
      if (pn != null && pn !== value) await onCorrect(pn);
      close();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={`${cls ?? ''} wp-att-editable`}
        title={tr({ zh: '点击改这一次(原始 / 改判)', en: 'Edit this solve (original / corrected)' })}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >{olds}{formatted}</span>
      {open && pos && createPortal(
        <>
          <div className="wp-att-pop-backdrop" onClick={close} />
          <span className="wp-att-pop" style={{ top: pos.top, left: pos.left }} role="dialog" onClick={(e) => e.stopPropagation()}>
            <label className="wp-att-pop-row">
              <span>{tr({ zh: '更正前(原始)', en: 'Original (before)' })}</span>
              <input
                autoFocus
                value={orig}
                onChange={(e) => setOrig(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
              />
            </label>
            <span className="wp-att-pop-cur">{tr({ zh: '当前', en: 'now' })} {formatted}</span>
            <label className="wp-att-pop-row">
              <span>{tr({ zh: '更正后(改判)', en: 'Corrected (after)' })}</span>
              <input
                value={next}
                onChange={(e) => setNext(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
              />
            </label>
            <span className="wp-att-pop-actions">
              <button type="button" className="wp-att-pop-save" onClick={save} disabled={busy}>
                {busy ? '…' : tr({ zh: '保存', en: 'Save' })}
              </button>
              <button type="button" className="wp-att-pop-cancel" onClick={close} disabled={busy}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
            </span>
          </span>
        </>,
        document.body,
      )}
    </>
  );
}
