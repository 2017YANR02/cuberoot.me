'use client';
// 点击任意一把成绩 → 统一弹窗(替代旧的「有罚才弹 / 没罚直接跳」+ 铅笔编辑模式)。
// 分区(自上而下):
//   ① 复盘 + 动画演示:有复盘→直接内嵌 3D 播放器(ReconPlayerCanvas,画面内播放/暂停浮层)+ 解法文本(SolutionView,点字 scrub),
//      顶部「查看完整复盘」跳详情页;没复盘→/recon/submit 预填「去复盘」(带上已填视频)。
//   ② 判罚原因:有罚时只读展示(没填原因显示「未记录」)。
//   ③ 比赛视频:复盘自带 videoUrl(随复盘一并取)+ 已批准 + 待审核,以封面展示;登录用户可粘贴链接(非管理员→待审核)。
//   ④ 编辑(登录用户):直接展开 操作下拉(原始/改判/罚时)+ 原因 + 保存(不再藏在折叠后)。
//      管理员/本人罚时即时;其余进待审核(沿用 result-watch 提议/审核流)。
//   ⑤ 编辑变更记录(管理员):打开整条变更记录编辑模态(onEditRecord)。
// 触发件用真 <button>(iOS Safari tap 可靠),浮层 portal 到 body + position:fixed,逃出表格 overflow 裁切;
// 结构/定位内联(dev CSS HMR 滞后也不塌),配色走主题 token。

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { parseHumanResult } from '@/lib/result-watch-api';
import { maxPenaltySteps, canPenalizeAttempt, PENALTY_STEP_CS } from '@cuberoot/shared/result-penalty';
import { getRecon } from '@/lib/recon-api';
import type { ReconSolve } from '@cuberoot/shared';
import { VideoCoverThumb } from '@/components/VideoCoverThumb';
import ReconPlayerCanvas, { loadReconEngine, type ReconEngine } from '@/components/recon/ReconPlayerCanvas';
import SolutionView from '@/components/SolutionView';
import { SolveValue } from './SolveValue';
import { AttemptBelow } from './AttemptBelow';

// 弹窗基准宽:窄屏自动夹到 100vw - 16(见 boxStyle width 的 min())。
const BASE_W = 480;
const MARGIN = 8;
const PLAYER_H = 252;

const uniq = (a: string[]): string[] => Array.from(new Set(a));
const splitLines = (s: string | undefined): string[] => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

// 复盘懒取(点开才拉),模块级缓存按 reconId 去重。整条 ReconSolve 复用:既给播放器(打乱/解法/项目),也给视频封面。
const reconCache = new Map<number, Promise<ReconSolve | null>>();
function loadRecon(id: number): Promise<ReconSolve | null> {
  let p = reconCache.get(id);
  if (!p) {
    p = getRecon(id).catch(() => null);
    reconCache.set(id, p);
  }
  return p;
}

// 把视频链接拼进 /recon/submit 预填 URL(无复盘时,「去复盘」带上已知视频)。
function withVideoParam(href: string, video: string): string {
  if (!video.trim()) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}video=${encodeURIComponent(video)}`;
}

// 触发 <button> 的 UA 复位:不碰 font-variant-numeric(.wp-att 提供 tabular-nums)、不碰 color/text-align
// (由 .wp-att-recon/.wp-att-tonew + .wp-att 类控制)→ 数字对齐与颜色提示不受影响。
const triggerReset: CSSProperties = {
  appearance: 'none', WebkitAppearance: 'none',
  background: 'none', border: 0, margin: 0, padding: 0,
  fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', cursor: 'pointer',
  position: 'relative',
};

const backdropStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 199, background: 'transparent' };
const boxStyle: CSSProperties = {
  position: 'fixed', transform: 'translateX(-50%)', zIndex: 200,
  width: `min(${BASE_W}px, calc(100vw - ${2 * MARGIN}px))`,
  padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
  background: 'var(--popover)', border: '1px solid var(--border-default)', borderRadius: 12,
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.34)', textAlign: 'left', whiteSpace: 'normal', cursor: 'default',
  maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
};
// 关闭条:sticky 顶到弹窗内滚动容器顶,负边距铺满内边距、popover 背景遮住下滚内容;× 靠右。
const closeBarStyle: CSSProperties = {
  position: 'sticky', top: 0, zIndex: 3,
  display: 'flex', justifyContent: 'flex-end',
  margin: '-6px -6px 0', padding: '2px 2px 0',
  background: 'var(--popover)',
};
const closeBtnStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, padding: 0, flexShrink: 0, cursor: 'pointer',
  background: 'none', border: 'none', color: 'var(--muted-foreground)', borderRadius: 6,
};
const actionStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  padding: '7px 9px', borderRadius: 7, textDecoration: 'none',
  color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 600,
};
const reasonStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  padding: '7px 9px 5px', marginTop: 1, borderTop: '1px solid var(--border-default)',
};
const reasonLabelStyle: CSSProperties = { fontSize: '0.66rem', color: 'var(--muted-foreground)' };
const reasonTextStyle: CSSProperties = { fontSize: '0.82rem', color: 'var(--foreground)', lineHeight: 1.35 };
const reasonEmptyStyle: CSSProperties = { fontSize: '0.82rem', color: 'var(--muted-foreground)', fontStyle: 'italic', lineHeight: 1.35 };

// ── 复盘(播放器 + 解法)区 ──
const reconSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 3px 2px' };
const reconHeaderStyle: CSSProperties = { ...actionStyle, padding: '4px 6px' };
const playerWrapStyle: CSSProperties = {
  position: 'relative', width: '100%', height: PLAYER_H,
  borderRadius: 9, overflow: 'hidden', background: 'var(--background)', border: '1px solid var(--border-default)',
};
const playerLoadingStyle: CSSProperties = {
  ...playerWrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--muted-foreground)', fontSize: '0.8rem',
};
// 打乱行(解法前):等宽、可换行,与详情页 .detail-scramble-line 同观感。
const scrambleLineStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.45,
  color: 'var(--foreground)', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  padding: '6px 8px', borderRadius: 7, background: 'var(--muted, var(--background))',
};
// 解法不再内部纵向截断(用户要求内容完整不遮挡):只在超长单行时横向滚动,整体高度交给弹窗外层。
const solutionWrapStyle: CSSProperties = { overflowX: 'auto' };

// ── 编辑区样式 ──
const editLabelStyle: CSSProperties = {
  display: 'block', padding: '7px 9px 2px', marginTop: 1, borderTop: '1px solid var(--border-default)',
  color: 'var(--muted-foreground)', fontSize: '0.74rem',
};
const formStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, padding: '2px 3px 2px' };
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
const recordBtnStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
  padding: '7px 9px', marginTop: 1, borderTop: '1px solid var(--border-default)',
  background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left',
};

// ── 比赛视频区 ──
const videoSectionStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5,
  padding: '7px 9px 6px', marginTop: 1, borderTop: '1px solid var(--border-default)',
};
const videoThumbsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const videoAddRowStyle: CSSProperties = { display: 'flex', gap: 6, alignItems: 'stretch' };
const videoAddBtnStyle: CSSProperties = {
  flexShrink: 0, padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  background: 'var(--accent)', color: 'var(--accent-foreground, #fff)', border: 'none', borderRadius: 6,
};

export function AttemptPopover({
  value, eventId, penalty, penaltyNote, format, cls, oldValues, rankBadge, reconHref, hasRecon, reconId,
  canEdit, isAdmin, isOwner, onEdit, onSetOriginal, onSetPenalty, onEditRecord, video,
  reconClassName = 'wp-att-recon', plainClassName = 'wp-att-tonew', showOldBelow = true,
}: {
  value: number;
  eventId: string;
  penalty?: number;
  penaltyNote?: string | null;
  format: (v: number) => string;
  cls?: string;
  oldValues: number[];
  rankBadge?: React.ReactNode;
  reconHref: string;             // 复盘目标:有复盘→详情,没复盘→/recon/submit 预填
  hasRecon: boolean;
  reconId?: number;              // 有复盘时:点开懒取整条复盘,内嵌播放器 + 解法 + 视频封面
  canEdit?: boolean;             // 任何登录用户:可展开编辑/提议
  isAdmin?: boolean;             // 管理员:任意改动即时
  isOwner?: boolean;             // 本人:罚时即时
  onEdit?: (newValue: number, note?: string) => Promise<void> | void;
  onSetOriginal?: (originalValue: number, note?: string) => Promise<void> | void;
  onSetPenalty?: (penaltyCs: number, note?: string) => Promise<void> | void;
  onEditRecord?: () => void;     // 管理员:打开整条变更记录编辑模态
  // 比赛视频(逐把链接):approved=已批准(本把),pending=待审核(本把),onAdd=提交一条链接(非管理员→pending)。
  video?: {
    approved?: string;
    pending?: string;
    onAdd?: (url: string) => Promise<void> | void;
  };
  // 触发件命中/未命中复盘的可点提示类:选手页默认 wp-att-recon/wp-att-tonew(--wp-accent==--accent),
  // comp 直播页传共享 att-trig-recon/att-trig-plain(同 --accent,见 result-change.css)。
  reconClassName?: string;
  plainClassName?: string;
  // 被改那把的旧值堆到下方(绝对定位,需所在格 position:relative + 留底部空间)。comp 表格行高紧,传 false 关掉。
  showOldBelow?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mode, setMode] = useState<'orig' | 'next' | 'penalty'>('orig');
  const [orig, setOrig] = useState('');
  const [next, setNext] = useState('');
  const [pen, setPen] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconSolve, setReconSolve] = useState<ReconSolve | null>(null);
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const [vidInput, setVidInput] = useState('');
  const [vidBusy, setVidBusy] = useState(false);
  const [engine] = useState<ReconEngine>(() => loadReconEngine());

  const pn = penalty ?? 0;
  const reason = penaltyNote?.trim();
  const maxPenaltyCount = maxPenaltySteps(eventId, value);
  const allowPenalty = canPenalizeAttempt(eventId, value);
  const pendingForMode = !isAdmin && !(mode === 'penalty' && isOwner);

  // 复盘内嵌:打乱 / 解法 / 项目(详情页同源取法),只在懒取到 reconSolve 后渲染播放器。
  const reconScramble = reconSolve ? (reconSolve.optimalScramble || reconSolve.wcaScramble || '') : '';
  const reconSolution = reconSolve ? (reconSolve.solution || reconSolve.recon || '') : '';
  const reconEvent = reconSolve?.event || eventId;
  const showReconSection = hasRecon && !!reconId;

  // 视频:已批准(本把)+ 复盘自带 + 本次刚加 → 确认封面;待审核单独标记。
  const reconVideos = reconSolve ? splitLines(reconSolve.videoUrl) : [];
  const approvedVideos = splitLines(video?.approved);
  const pendingVideos = splitLines(video?.pending);
  const confirmedVideos = uniq([...reconVideos, ...approvedVideos, ...justAdded]);
  const pendingOnlyVideos = uniq(pendingVideos).filter((u) => !confirmedVideos.includes(u));
  const canAddVideo = !!canEdit && !!video?.onAdd;
  const showVideoSection = confirmedVideos.length > 0 || pendingOnlyVideos.length > 0 || canAddVideo;
  // 无复盘时「去复盘」带上已知视频(已批准 + 本次刚加)→ /recon/submit 预填。
  const reconLinkHref = hasRecon ? reconHref : withVideoParam(reconHref, uniq([...approvedVideos, ...justAdded]).join('\n'));

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const effW = Math.min(BASE_W, window.innerWidth - 2 * MARGIN);
    const halfW = effW / 2;
    const h = popRef.current?.offsetHeight ?? 280; // 首帧估值,挂载后用实测高度
    const left = Math.min(Math.max(r.left + r.width / 2, halfW + MARGIN), window.innerWidth - halfW - MARGIN);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - MARGIN) {
      const above = r.top - 6 - h;
      top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - h - MARGIN);
    }
    setPos({ top, left });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setMode('orig'); setOrig(''); setNext(''); setPen('1'); setNote('');
    setVidInput('');
  }, []);

  // 有复盘:点开懒取整条复盘(缓存按 reconId 去重)→ 内嵌播放器 + 解法 + 视频封面。
  useEffect(() => {
    if (!open || !reconId) return;
    let alive = true;
    void loadRecon(reconId).then((s) => { if (alive) setReconSolve(s); });
    return () => { alive = false; };
  }, [open, reconId]);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onMove = () => reposition();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, reposition, close]);

  // 编辑模式切换、复盘/视频加载后高度变化 → 重新定位(翻转/夹取)。
  useEffect(() => {
    if (open) reposition();
  }, [mode, open, reposition, reconSolve, justAdded.length, showVideoSection]);

  const toggle = () => {
    if (open) { close(); return; }
    // 编辑表单直接展开(不再藏在折叠后):打开即初始化罚时档位/原因默认值。
    setMode('orig');
    setPen(pn > 0 ? String(Math.round(pn / PENALTY_STEP_CS)) : '1');
    setNote(penaltyNote ?? '');
    reposition();
    setOpen(true);
  };

  const addVideo = async () => {
    const u = vidInput.trim();
    if (!u || !video?.onAdd) return;
    setVidBusy(true);
    try {
      await video.onAdd(u);
      setJustAdded((prev) => (prev.includes(u) ? prev : [...prev, u]));
      setVidInput('');
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setVidBusy(false);
    }
  };

  const save = async () => {
    const n = note.trim() || undefined;
    let action: (() => Promise<void> | void) | null = null;
    if (mode === 'orig') {
      const po = parseHumanResult(orig, eventId);
      if (po != null && po !== value) action = () => onSetOriginal?.(po, n);
    } else if (mode === 'next') {
      const px = parseHumanResult(next, eventId);
      if (px != null && px !== value) action = () => onEdit?.(px, n);
    } else {
      const penCs = pen === '' ? 0 : Number(pen) * PENALTY_STEP_CS;
      const noteChanged = n !== (penaltyNote ?? undefined);
      if (penCs !== pn || noteChanged) action = () => onSetPenalty?.(penCs, n);
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
      <button
        type="button"
        ref={anchorRef}
        className={`${cls ?? ''} ${hasRecon ? reconClassName : plainClassName}`}
        style={triggerReset}
        title={tr({ zh: '点击查看 / 复盘 / 编辑', en: 'Click to view / reconstruct / edit' })}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      ><SolveValue value={value} penalty={penalty} format={format} note={pn > 0 ? penaltyNote : undefined} />{rankBadge}{showOldBelow && <AttemptBelow oldValues={oldValues} format={format} />}</button>
      {open && pos && createPortal(
        <>
          <div style={backdropStyle} onClick={close} />
          <div ref={popRef} style={{ ...boxStyle, top: pos.top, left: pos.left }} role="dialog" onClick={(e) => e.stopPropagation()}>
            <div style={closeBarStyle}>
              <button type="button" style={closeBtnStyle} onClick={close} aria-label={tr({ zh: '关闭', en: 'Close' })}>
                <X size={16} />
              </button>
            </div>
            {/* ① 复盘 + 动画演示(内嵌播放器 + 解法);没复盘 → 去复盘 */}
            {showReconSection ? (
              <div style={reconSectionStyle}>
                <Link
                  href={reconHref}
                  prefetch={false}
                  className="wp-att-menu-action"
                  style={reconHeaderStyle}
                  onClick={close}
                >
                  <span>{tr({ zh: '查看完整复盘', en: 'Full reconstruction' })}</span>
                  <ChevronRight size={15} style={{ flexShrink: 0, opacity: 0.55 }} />
                </Link>
                {reconScramble ? (
                  <>
                    <div style={playerWrapStyle}>
                      <ReconPlayerCanvas
                        event={reconEvent}
                        scramble={reconScramble}
                        displayText={reconSolution}
                        playerRef={playerRef}
                        engine={engine}
                        fillPane
                        hideControls
                      />
                    </div>
                    {/* 解法前先放打乱(用户要求);点解法文字可 scrub 播放器 */}
                    <div style={scrambleLineStyle}>{reconScramble}</div>
                    {reconSolution && (
                      <div style={solutionWrapStyle}>
                        <SolutionView text={reconSolution} playerRef={playerRef} />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={playerLoadingStyle}>{tr({ zh: '载入复盘…', en: 'Loading…' })}</div>
                )}
              </div>
            ) : (
              <Link
                href={reconLinkHref}
                prefetch={false}
                className="wp-att-menu-action"
                style={actionStyle}
                onClick={close}
              >
                <span>{tr({ zh: '去复盘', en: 'Reconstruct' })}</span>
                <ChevronRight size={15} style={{ flexShrink: 0, opacity: 0.55 }} />
              </Link>
            )}

            {/* ② 判罚原因(只读) */}
            {pn > 0 && (
              <div style={reasonStyle}>
                <span style={reasonLabelStyle}>{tr({ zh: '判罚原因', en: 'Penalty reason' })}</span>
                {reason
                  ? <span style={reasonTextStyle}>{reason}</span>
                  : <span style={reasonEmptyStyle}>{tr({ zh: '未记录', en: 'not recorded' })}</span>}
              </div>
            )}

            {/* ③ 比赛视频(复盘自带 + 已批准 + 提议;登录用户可粘链接,非管理员待审核) */}
            {showVideoSection && (
              <div style={videoSectionStyle}>
                <span style={reasonLabelStyle}>{tr({ zh: '比赛视频', en: 'Competition video' })}</span>
                {(confirmedVideos.length > 0 || pendingOnlyVideos.length > 0) && (
                  <div style={videoThumbsStyle}>
                    {confirmedVideos.map((u, k) => <VideoCoverThumb key={`c${k}`} url={u} />)}
                    {pendingOnlyVideos.map((u, k) => (
                      <VideoCoverThumb key={`p${k}`} url={u} pending pendingLabel={tr({ zh: '待审核', en: 'pending' })} />
                    ))}
                  </div>
                )}
                {canAddVideo && (
                  <>
                    <div style={videoAddRowStyle}>
                      <input
                        style={inputStyle}
                        placeholder={tr({ zh: '粘贴视频链接(B 站 / 抖音 / YouTube)', en: 'Paste video link' })}
                        value={vidInput}
                        onChange={(e) => setVidInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addVideo(); else if (e.key === 'Escape') close(); }}
                      />
                      <button type="button" style={videoAddBtnStyle} onClick={addVideo} disabled={vidBusy || !vidInput.trim()}>
                        {vidBusy ? '…' : tr({ zh: '添加', en: 'Add' })}
                      </button>
                    </div>
                    {!isAdmin && (
                      <span style={{ fontSize: '0.66rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                        {tr({ zh: '提交后需管理员审核才公开', en: 'Submitted for admin review before going public' })}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ④ 编辑(登录用户)— 直接展开,不藏在折叠后 */}
            {canEdit && (
              <>
                <span style={editLabelStyle}>{isAdmin
                  ? tr({ zh: '编辑这一把(原始 / 改判 / 罚时)', en: 'Edit this solve' })
                  : tr({ zh: '提议修改(需审核;自己的 +2 即时)', en: 'Propose an edit' })}</span>
                <div style={formStyle}>
                  <label style={rowStyle}>
                    <span style={rowLabelStyle}>{tr({ zh: '操作', en: 'Action' })}</span>
                    <select style={inputStyle} value={mode} onChange={(e) => setMode(e.target.value as 'orig' | 'next' | 'penalty')}>
                      {allowPenalty && <option value="penalty">{tr({ zh: '罚时(每档 +2)', en: 'Penalty (+2 each)' })}</option>}
                      <option value="orig">{tr({ zh: '更正前(原始)', en: 'Original (before)' })}</option>
                      <option value="next">{tr({ zh: '更正后(改判)', en: 'Corrected (after)' })}</option>
                    </select>
                  </label>
                  <span style={curStyle}>{tr({ zh: '当前', en: 'now' })} <SolveValue value={value} penalty={penalty} format={format} /></span>
                  {mode === 'orig' && (
                    <label style={rowStyle}>
                      <span style={rowLabelStyle}>{tr({ zh: '原始值(更正前)', en: 'Original value' })}</span>
                      <input style={inputStyle} value={orig} onChange={(e) => setOrig(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }} />
                    </label>
                  )}
                  {mode === 'next' && (
                    <label style={rowStyle}>
                      <span style={rowLabelStyle}>{tr({ zh: '改判为(更正后)', en: 'Corrected to' })}</span>
                      <input style={inputStyle} value={next} onChange={(e) => setNext(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }} />
                    </label>
                  )}
                  {mode === 'penalty' && allowPenalty && (
                    <label style={rowStyle}>
                      <span style={rowLabelStyle}>{tr({ zh: '罚时(每档 +2)', en: 'Penalty (+2 each)' })}</span>
                      <select style={inputStyle} value={pen} onChange={(e) => setPen(e.target.value)}>
                        {Array.from({ length: maxPenaltyCount }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>+{n * 2}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label style={rowStyle}>
                    <span style={rowLabelStyle}>{tr({ zh: '原因', en: 'Reason' })}</span>
                    <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') close(); }} />
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
                  </span>
                </div>
              </>
            )}

            {/* ⑤ 编辑变更记录(管理员) */}
            {isAdmin && onEditRecord && (
              <button type="button" style={recordBtnStyle} onClick={() => { onEditRecord(); close(); }}>
                {tr({ zh: '编辑变更记录…', en: 'Edit change record…' })}
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
