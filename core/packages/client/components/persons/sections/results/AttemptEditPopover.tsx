'use client';
// 管理员点单次成绩 → 小浮层,先用「操作」下拉选一种,再填对应输入:
//  - 更正前(原始):补录该次被 WCA 更正前的旧值 → 旧值划线留在当前值前,当前值不变。
//  - 更正后(改判):把该次正向改判为新值 → 当前值划线,新值成为当前(自动重算单次/平均)。
//  - 罚时(每档 +2):该次实为 base+2N,展开成 base⁺ᴺ(纯展示,不改值)。
// 浮层用 portal 渲染到 body + position:fixed,逃出成绩表的 overflow 裁切容器。
// 结构样式全部内联(不依赖外部 CSS):dev 下 CSS HMR 偶发滞后会让浮层失样塌成行内/落页脚,
// 内联保证「定位+盒子」始终成立(配色仍走主题 token var())。
// 渲染逻辑与具体页面解耦:format 由调用方传(选手页 formatWcaResult / comp 页 formatLive)。

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/i18n/tr';
import { parseHumanResult } from '@/lib/result-watch-api';
import { maxPenaltySteps, canPenalizeAttempt, PENALTY_STEP_CS } from '@cuberoot/shared/result-penalty';
import { SolveValue } from './SolveValue';

const POP_W = 216;

const backdropStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 199, background: 'transparent' };
const boxStyle: CSSProperties = {
  position: 'fixed', transform: 'translateX(-50%)', zIndex: 200,
  width: POP_W, padding: 11, display: 'flex', flexDirection: 'column', gap: 7,
  background: 'var(--popover)', border: '1px solid var(--border-default)', borderRadius: 11,
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)', textAlign: 'left', whiteSpace: 'normal', cursor: 'default',
  maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
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
  value, eventId, oldValues, cls, format, penalty, isAdmin, isOwner, onSetOriginal, onCorrect, onSetPenalty,
}: {
  value: number;
  eventId: string;
  oldValues: number[];
  cls?: string;
  format: (v: number) => string;
  penalty?: number;
  isAdmin?: boolean;       // 管理员:任何改动即时生效
  isOwner?: boolean;       // 本人页面:罚时即时生效(其余改动仍需审核)
  onSetOriginal: (v: number, note?: string) => Promise<void> | void;
  onCorrect: (v: number, note?: string) => Promise<void> | void;
  onSetPenalty?: (penaltyCs: number, note?: string) => Promise<void> | void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const initialMode = 'orig' as const;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [orig, setOrig] = useState('');
  const [next, setNext] = useState('');
  const [pen, setPen] = useState('');        // 罚时档位 = +2 的次数('' = 无,'1'..'8')
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'orig' | 'next' | 'penalty'>(initialMode); // 先选操作再填
  const [busy, setBusy] = useState(false);

  const olds = oldValues.map((ov, k) => (
    <s key={k} className="wp-old-result">{format(ov)}</s>
  ));
  // 罚时:每档 +2 秒,最多选到 base=值−罚时 仍 > 0 的档(再上限 8 档);FMC/MBLD/DNF 不适用。
  const maxPenaltyCount = maxPenaltySteps(eventId, value);
  const allowPenalty = canPenalizeAttempt(eventId, value);
  // 该操作是否需管理员审核:管理员永远即时;本人罚时即时;其余(改别人、或任何原始/改判)= 待审核。
  const pendingForMode = !isAdmin && !(mode === 'penalty' && isOwner);

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const halfW = POP_W / 2;
    const h = popRef.current?.offsetHeight ?? 260; // 首帧用估值,挂载后用实测高度
    const left = Math.min(Math.max(r.left + r.width / 2, halfW + margin), window.innerWidth - halfW - margin);
    // 默认放在 solve 下方;下方放不下就翻到上方;都放不下就夹进视口。
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - margin) {
      const above = r.top - 6 - h;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - h - margin);
    }
    setPos({ top, left });
  }, []);

  const close = useCallback(() => { setOpen(false); setMode(initialMode); setOrig(''); setNext(''); setPen(''); setNote(''); }, [initialMode]);

  useEffect(() => {
    if (!open) return;
    reposition(); // 挂载后按实测高度再定位一次(翻转/夹取生效)
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
    setMode(initialMode);
    setPen(penalty && penalty > 0 ? String(Math.round(penalty / PENALTY_STEP_CS)) : '');  // 厘秒 → 档位
    reposition();
    setOpen(true);
  };

  const save = async () => {
    const n = note.trim() || undefined;
    let action: (() => Promise<void> | void) | null = null;
    if (mode === 'orig') {
      const po = parseHumanResult(orig, eventId);
      if (po != null && po !== value) action = () => onSetOriginal(po, n);
    } else if (mode === 'next') {
      const pn = parseHumanResult(next, eventId);
      if (pn != null && pn !== value) action = () => onCorrect(pn, n);
    } else {
      const penCs = pen === '' ? 0 : Number(pen) * PENALTY_STEP_CS; // 每档 +2 秒 = 200cs;下拉只给合法档
      if (penCs !== (penalty ?? 0)) action = () => onSetPenalty?.(penCs, n);
    }
    if (!action) { close(); return; }
    setBusy(true);
    try {
      await action();
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
        title={isAdmin
          ? tr({ zh: '点击改这一次(原始 / 改判 / 罚时)', en: 'Edit this solve (original / corrected / penalty)' })
          : tr({ zh: '点击提议改这一次(需管理员审核)', en: 'Propose an edit (needs admin review)' })}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >{olds}<SolveValue value={value} penalty={penalty} format={format} /></span>
      {open && pos && createPortal(
        <>
          <div style={backdropStyle} onClick={close} />
          <span ref={popRef} style={{ ...boxStyle, top: pos.top, left: pos.left }} role="dialog" onClick={(e) => e.stopPropagation()}>
            <label style={rowStyle}>
              <span style={rowLabelStyle}>{tr({ zh: '操作', en: 'Action' })}</span>
              <select style={inputStyle} value={mode} onChange={(e) => setMode(e.target.value as 'orig' | 'next' | 'penalty')}>
                <option value="orig">{tr({ zh: '更正前(原始)', en: 'Original (before)' })}</option>
                <option value="next">{tr({ zh: '更正后(改判)', en: 'Corrected (after)' })}</option>
                {allowPenalty && <option value="penalty">{tr({ zh: '罚时(每档 +2)', en: 'Penalty (+2 each)' })}</option>}
              </select>
            </label>
            <span style={curStyle}>{tr({ zh: '当前', en: 'now' })} <SolveValue value={value} penalty={penalty} format={format} /></span>
            {mode === 'orig' && (
              <label style={rowStyle}>
                <span style={rowLabelStyle}>{tr({ zh: '原始值(更正前)', en: 'Original value' })}</span>
                <input
                  style={inputStyle}
                  autoFocus
                  value={orig}
                  onChange={(e) => setOrig(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
                />
              </label>
            )}
            {mode === 'next' && (
              <label style={rowStyle}>
                <span style={rowLabelStyle}>{tr({ zh: '改判为(更正后)', en: 'Corrected to' })}</span>
                <input
                  style={inputStyle}
                  autoFocus
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }}
                />
              </label>
            )}
            {mode === 'penalty' && allowPenalty && (
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
            {pendingForMode && (
              <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {tr({ zh: '提交后需管理员审核才上线', en: 'Submitted for admin review before going live' })}
              </span>
            )}
            <span style={actionsStyle}>
              <button type="button" style={saveStyle} onClick={save} disabled={busy}>
                {busy ? '…' : (pendingForMode ? tr({ zh: '提交', en: 'Submit' }) : tr({ zh: '保存', en: 'Save' }))}
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
