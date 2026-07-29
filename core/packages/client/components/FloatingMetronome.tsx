'use client';

// Floating metronome — a draggable panel mounted next to the desk pet (root
// layout), so it keeps ticking across client-side navigation. Opened from the
// desk pet toolbar; the engine itself lives in lib/metronome.ts and is shared
// with the timer page.
//
// Tempo reads primarily as TPS (turns per second, one beat = one turn) because
// that is the unit cubers train against; BPM is shown underneath for anyone who
// thinks in it.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, Plus, Minus, X, ChevronDown } from 'lucide-react';
import {
  useMetronome, setMetronome, subscribeBeat, tapTempo, resetTapTempo,
  bpmToTps, clampBpm, BPM_MIN, BPM_MAX, ACCENT_CHOICES,
} from '@/lib/metronome';
import { persistItem } from '@/lib/safe-storage';

const POS_KEY = 'cuberoot.metronome.pos.v1';
const PANEL_W = 232;

const CSS = `
.cr-metro{position:fixed;z-index:100005;width:${PANEL_W}px;
  font:13px/1.35 ui-sans-serif,system-ui,sans-serif;color:var(--foreground);
  background:var(--popover,var(--card));border:1px solid var(--border-default);
  border-radius:14px;padding:10px 12px 11px;
  box-shadow:0 8px 28px color-mix(in srgb, var(--foreground) 18%, transparent);
  touch-action:none;user-select:none;-webkit-user-select:none;}
.cr-metro.is-collapsed{width:auto;padding:6px 8px 6px 10px;border-radius:999px;}

/* Drag surface: the whole card except the controls (which stop propagation). */
.cr-metro-grab{cursor:grab;}
.cr-metro.is-dragging .cr-metro-grab{cursor:grabbing;}

.cr-metro-head{display:flex;align-items:center;gap:8px;}
.cr-metro-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;
  background:color-mix(in srgb, var(--foreground) 22%, transparent);}
.cr-metro-dot.is-beat{background:var(--accent);}
.cr-metro-dot.is-accent{background:var(--accent);transform:scale(1.5);}
/* Stacked readout: TPS leads, BPM sits under it. Both nowrap — CJK-width
   browsers wrap "120 BPM" onto its own line if it has to share a row. */
.cr-metro-readout{display:flex;flex-direction:column;gap:1px;flex:1 1 auto;min-width:0;}
.cr-metro-primary{display:flex;align-items:baseline;gap:4px;white-space:nowrap;}
.cr-metro-tps{font:600 21px/1 var(--font-mono,ui-monospace,monospace);
  font-variant-numeric:tabular-nums;}
.cr-metro-unit{font-size:11px;color:var(--muted-foreground);}
.cr-metro-bpm{font-size:11px;line-height:1;white-space:nowrap;
  color:var(--faint-foreground,var(--muted-foreground));font-variant-numeric:tabular-nums;}

.cr-metro button{border:0;background:transparent;color:var(--foreground);cursor:pointer;
  display:flex;align-items:center;justify-content:center;padding:0;
  font:inherit;border-radius:8px;transition:background .15s,color .15s;}
.cr-metro button:hover{background:color-mix(in srgb, var(--foreground) 9%, transparent);}
.cr-metro-icon{width:26px;height:26px;flex:0 0 auto;}
.cr-metro-play{width:30px;height:30px;border-radius:50%;
  background:color-mix(in srgb, var(--accent) 14%, transparent);color:var(--accent);}
.cr-metro-play:hover{background:color-mix(in srgb, var(--accent) 22%, transparent);}

.cr-metro-row{display:flex;align-items:center;gap:6px;margin-top:9px;}
.cr-metro-row input[type=range]{flex:1 1 auto;min-width:0;margin:0;accent-color:var(--accent);}
.cr-metro-tap{padding:0 9px;height:26px;font-size:12px;
  border:1px solid var(--border-default);border-radius:8px;}
.cr-metro-tap.is-armed{border-color:var(--accent);color:var(--accent);}

.cr-metro-accents{display:flex;align-items:center;gap:4px;margin-top:9px;}
.cr-metro-accents .lbl{font-size:11px;color:var(--muted-foreground);margin-right:2px;}
.cr-metro-accents button{height:22px;padding:0 8px;font-size:11px;border-radius:7px;
  color:var(--muted-foreground);font-variant-numeric:tabular-nums;}
.cr-metro-accents button.is-on{background:color-mix(in srgb, var(--accent) 14%, transparent);
  color:var(--accent);}

@media (max-width:480px){
  .cr-metro{width:min(${PANEL_W}px, calc(100vw - 24px));}
}
@media print{.cr-metro{display:none;}}
`;

/** Default resting spot: above the desk pet, clear of its drag area. */
function defaultPos(): { left: number; top: number } {
  const w = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const h = typeof window === 'undefined' ? 768 : window.innerHeight;
  return { left: Math.max(12, w - PANEL_W - 20), top: Math.max(12, h - 260) };
}

function loadPos(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left?: number; top?: number };
    if (typeof p.left !== 'number' || typeof p.top !== 'number') return null;
    return { left: p.left, top: p.top };
  } catch {
    return null;
  }
}

function clampPos(p: { left: number; top: number }, el: HTMLElement | null): { left: number; top: number } {
  const w = el?.offsetWidth ?? PANEL_W;
  const h = el?.offsetHeight ?? 120;
  return {
    left: Math.max(6, Math.min(window.innerWidth - w - 6, p.left)),
    top: Math.max(6, Math.min(window.innerHeight - h - 6, p.top)),
  };
}

export default function FloatingMetronome({ lang, onClose }: { lang: 'zh' | 'en'; onClose: () => void }) {
  const s = useMetronome();
  const t = (z: string, e: string) => (lang === 'zh' ? z : e);

  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [beat, setBeat] = useState<{ index: number; accent: boolean } | null>(null);
  const [tapHint, setTapHint] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Clamp on restore, not just on resize: a spot saved on a wide desktop lands
  // far off-screen when the same profile opens on a phone.
  useEffect(() => { setPos(clampPos(loadPos() ?? defaultPos(), null)); }, []);

  // Re-clamp against the real card size once it has been measured (the restore
  // above can only estimate, and collapsed/expanded heights differ).
  useLayoutEffect(() => {
    if (!pos || !cardRef.current) return;
    const c = clampPos(pos, cardRef.current);
    if (c.left !== pos.left || c.top !== pos.top) setPos(c);
  }, [pos, collapsed]);

  // Keep the card on screen when the viewport shrinks (rotate / resize).
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p, cardRef.current) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Visual pulse — flip a short-lived class per beat, cleared well before the
  // next one lands. A fixed hold would leave the dot permanently lit at the top
  // of the range, where beats are only 33ms apart.
  const holdMs = Math.max(16, Math.min(70, (60000 / s.bpm) * 0.5));
  useEffect(() => {
    let clear: number | null = null;
    const off = subscribeBeat((e) => {
      setBeat(e);
      if (clear != null) window.clearTimeout(clear);
      clear = window.setTimeout(() => setBeat(null), holdMs);
    });
    return () => {
      off();
      if (clear != null) window.clearTimeout(clear);
    };
  }, [holdMs]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPos(clampPos({ left: e.clientX - d.dx, top: e.clientY - d.dy }, cardRef.current));
  }, []);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    setPos((p) => {
      if (p) persistItem(POS_KEY, JSON.stringify(p));
      return p;
    });
  }, []);

  const nudge = (delta: number) => setMetronome({ bpm: clampBpm(s.bpm + delta) });

  const onTap = () => {
    const bpm = tapTempo();
    setTapHint(true);
    if (bpm != null) setMetronome({ bpm });
    window.setTimeout(() => setTapHint(false), 3000);
  };

  // Position is measured after mount; render nothing on the first pass rather
  // than flashing the panel at the top-left corner.
  if (!pos) return null;

  const tps = bpmToTps(s.bpm);
  const dotCls = beat ? (beat.accent ? 'cr-metro-dot is-accent' : 'cr-metro-dot is-beat') : 'cr-metro-dot';

  return (
    <div
      ref={cardRef}
      className={`cr-metro${collapsed ? ' is-collapsed' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ left: pos.left, top: pos.top }}
      role="group"
      aria-label={t('节拍器', 'Metronome')}
    >
      <style>{CSS}</style>

      <div
        className="cr-metro-head cr-metro-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className={dotCls} aria-hidden />
        <span className="cr-metro-readout">
          <span className="cr-metro-primary">
            <span className="cr-metro-tps">{tps.toFixed(2)}</span>
            <span className="cr-metro-unit">TPS</span>
          </span>
          {!collapsed && <span className="cr-metro-bpm">{s.bpm} BPM</span>}
        </span>
        <button
          type="button"
          className="cr-metro-icon cr-metro-play"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMetronome({ on: !s.on })}
          title={s.on ? t('停止', 'Stop') : t('开始', 'Start')}
          aria-label={s.on ? t('停止', 'Stop') : t('开始', 'Start')}
        >
          {s.on ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
        </button>
        <button
          type="button"
          className="cr-metro-icon"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? t('展开', 'Expand') : t('收起', 'Collapse')}
          aria-label={collapsed ? t('展开', 'Expand') : t('收起', 'Collapse')}
        >
          <ChevronDown size={15} style={collapsed ? { transform: 'rotate(180deg)' } : undefined} />
        </button>
        <button
          type="button"
          className="cr-metro-icon"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => { setMetronome({ on: false }); onClose(); }}
          title={t('关闭', 'Close')}
          aria-label={t('关闭', 'Close')}
        >
          <X size={15} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="cr-metro-row">
            <button
              type="button" className="cr-metro-icon" onClick={() => nudge(-1)}
              title={t('慢一点', 'Slower')} aria-label={t('慢一点', 'Slower')}
            >
              <Minus size={14} />
            </button>
            <input
              type="range" min={BPM_MIN} max={BPM_MAX} step={1} value={s.bpm}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => setMetronome({ bpm: Number(e.target.value) })}
              aria-label={t('速度', 'Tempo')}
            />
            <button
              type="button" className="cr-metro-icon" onClick={() => nudge(1)}
              title={t('快一点', 'Faster')} aria-label={t('快一点', 'Faster')}
            >
              <Plus size={14} />
            </button>
            <button
              type="button" className={`cr-metro-tap${tapHint ? ' is-armed' : ''}`}
              onClick={onTap} onBlur={resetTapTempo}
              title={t('连续敲击设定速度', 'Tap repeatedly to set the tempo')}
            >
              {t('敲击', 'Tap')}
            </button>
          </div>

          <div className="cr-metro-accents">
            <span className="lbl">{t('重音', 'Accent')}</span>
            {ACCENT_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                className={s.accent === n ? 'is-on' : undefined}
                onClick={() => setMetronome({ accent: n })}
                title={n === 0
                  ? t('每拍相同', 'Every beat the same')
                  : t(`每 ${n} 拍一个强拍`, `Accent every ${n} beats`)}
              >
                {n === 0 ? t('关', 'Off') : n}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
