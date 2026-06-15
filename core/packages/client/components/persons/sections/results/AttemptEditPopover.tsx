'use client';
// 管理员点单次成绩 → 小浮层,两个方向二选一(或都填):
//  - 更正前(原始):补录该次被 WCA 更正前的旧值 → 旧值划线留在当前值前,当前值不变。
//  - 更正后(改判):把该次正向改判为新值 → 当前值划线,新值成为当前(自动重算单次/平均)。
// 浮层用 portal 渲染到 body + position:fixed,逃出成绩表的 overflow 裁切容器。
// 结构样式全部内联(不依赖外部 CSS):dev 下 CSS HMR 偶发滞后会让浮层失样塌成行内/落页脚,
// 内联保证「定位+盒子」始终成立(配色仍走主题 token var())。
// 渲染逻辑与具体页面解耦:format 由调用方传(选手页 formatWcaResult / comp 页 formatLive)。

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/i18n/tr';
import { parseHumanResult } from '@/lib/result-watch-api';
import { SolveValue } from './SolveValue';

const POP_W = 216;

// 罚时(+2 秒)只对按时间计的项目有意义;FMC(步数)/ MBLD(打包编码)不适用。
const NO_PENALTY_EVENTS = new Set(['333fm', '333mbf', '333mbo']);

const backdropStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 199, background: 'transparent' };
const boxStyle: CSSProperties = {
  position: 'fixed', transform: 'translateX(-50%)', zIndex: 200,
  width: POP_W, padding: 11, display: 'flex', flexDirection: 'column', gap: 7,
  background: 'var(--popover)', border: '1px solid var(--border-default)', borderRadius: 11,
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)', textAlign: 'left', whiteSpace: 'normal', cursor: 'default',
};
const rowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const rowLabelStyle: CSSProperties = { fontSize: '0.7rem', color: 'var(--muted-foreground)' };
const inputStyle: CSSProperties = {
  width: '100%', padding: '5px 7px', fontSize: '0.86rem', fontVariantNumeric: 'tabular-nums',
  background: 'var(--background)', color: 'var(--foreground)',
  border: '1px solid var(--border-strong)', borderRadius: 6,
};
const curStyle: CSSProperties = {
  fontSize: '0.72rem', color: 'var(--faint-foreground)', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};
const actionsStyle: CSSProperties = { display: 'flex', gap: 6, marginTop: 1 };
const saveStyle: CSSProperties = {
  flex: 1, padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  background: 'var(--accent)', color: 'var(--accent-foreground, #fff)', border: 'none', borderRadius: 6,
};
const cancelStyle: CSSProperties = {
  padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer',
  background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border-strong)', borderRadius: 6,
};

export function AttemptEditPopover({
  value, eventId, oldValues, cls, format, penalty, onSetOriginal, onCorrect, onSetPenalty,
}: {
  value: number;
  eventId: string;
  oldValues: number[];
  cls?: string;
  format: (v: number) => string;
  penalty?: number;
  onSetOriginal: (v: number, note?: string) => Promise<void> | void;
  onCorrect: (v: number, note?: string) => Promise<void> | void;
  onSetPenalty?: (penaltyCs: number, note?: string) => Promise<void> | void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [orig, setOrig] = useState('');
  const [next, setNext] = useState('');
  const [pen, setPen] = useState('');        // 罚时档位 = +2 的次数('' = 无,'1'..'8')
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const olds = oldValues.map((ov, k) => (
    <s key={k} className="wp-old-result">{format(ov)}</s>
  ));
  // 罚时:每档 +2 秒,最多选到 base=值−罚时 仍 > 0 的档(再上限 8 档);FMC/MBLD/DNF 不适用。
  const maxPenaltyCount = Math.min(8, Math.floor((value - 1) / 200));
  const allowPenalty = !NO_PENALTY_EVENTS.has(eventId) && value > 0 && maxPenaltyCount >= 1;

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = POP_W / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    setPos({ top: r.bottom + 6, left });
  }, []);

  const close = useCallback(() => { setOpen(false); setOrig(''); setNext(''); setPen(''); setNote(''); }, []);

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
    setPen(penalty && penalty > 0 ? String(Math.round(penalty / 200)) : '');  // 厘秒 → 档位(/200)
    reposition();
    setOpen(true);
  };

  const save = async () => {
    const po = parseHumanResult(orig, eventId);
    const pn = parseHumanResult(next, eventId);
    // 罚时档位 → 厘秒(每档 +2 秒 = 200cs);下拉只给合法档,无需再校验。
    const penCs = pen === '' ? 0 : Number(pen) * 200;
    const curPen = penalty ?? 0;
    const origChanged = po != null && po !== value;
    const nextChanged = pn != null && pn !== value;
    const penChanged = penCs !== curPen;
    if (!origChanged && !nextChanged && !penChanged) { close(); return; }
    const n = note.trim() || undefined;
    setBusy(true);
    try {
      if (origChanged) await onSetOriginal(po as number, n);
      if (nextChanged) await onCorrect(pn as number, n);
      if (penChanged) await onSetPenalty?.(penCs, n);
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
      >{olds}<SolveValue value={value} penalty={penalty} format={format} /></span>
      {open && pos && createPortal(
        <>
          <div style={backdropStyle} onClick={close} />
          <span style={{ ...boxStyle, top: pos.top, left: pos.left }} role="dialog" onClick={(e) => e.stopPropagation()}>
            <label style={rowStyle}>
              <span style={rowLabelStyle}>{tr({ zh: '更正前(原始)', en: 'Original (before)' })}</span>
              <input
                style={inputStyle}
                autoFocus
                value={orig}
                onChange={(e) => setOrig(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
              />
            </label>
            <span style={curStyle}>{tr({ zh: '当前', en: 'now' })} <SolveValue value={value} penalty={penalty} format={format} /></span>
            <label style={rowStyle}>
              <span style={rowLabelStyle}>{tr({ zh: '更正后(改判)', en: 'Corrected (after)' })}</span>
              <input
                style={inputStyle}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
              />
            </label>
            {allowPenalty && (
              <label style={rowStyle}>
                <span style={rowLabelStyle}>{tr({ zh: '罚时(每档 +2)', en: 'Penalty (+2 each)' })}</span>
                <select style={inputStyle} value={pen} onChange={(e) => setPen(e.target.value)}>
                  <option value="">{tr({ zh: '无', en: 'none' })}</option>
                  {Array.from({ length: maxPenaltyCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>+{n * 2}</option>
                  ))}
                </select>
              </label>
            )}
            <label style={rowStyle}>
              <span style={rowLabelStyle}>{tr({ zh: '原因', en: 'Reason' })}</span>
              <input
                style={inputStyle}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
              />
            </label>
            <span style={actionsStyle}>
              <button type="button" style={saveStyle} onClick={save} disabled={busy}>
                {busy ? '…' : tr({ zh: '保存', en: 'Save' })}
              </button>
              <button type="button" style={cancelStyle} onClick={close} disabled={busy}>
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
