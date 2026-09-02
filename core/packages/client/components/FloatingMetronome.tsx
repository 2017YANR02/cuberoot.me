'use client';

// Draggable site-wide audio center. Music and the metronome survive client-side
// navigation because this panel is mounted next to the desk pet in root chrome.
//
// Tempo reads primarily as TPS (turns per second, one beat = one turn) because
// that is the unit cubers train against; BPM is shown underneath for anyone who
// thinks in it.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronDown, Disc3, ExternalLink, Minus, Pause, Play, Plus,
  SkipBack, SkipForward, Volume2, X,
} from 'lucide-react';
import Link from '@/components/AppLink';
import PillToggle from '@/components/PillToggle/PillToggle';
import {
  useMetronome, setMetronome, subscribeBeat, tapTempo, resetTapTempo,
  bpmToTps, clampBpm, BPM_MIN, BPM_MAX, ACCENT_CHOICES,
} from '@/lib/metronome';
import { persistItem } from '@/lib/safe-storage';
import {
  loadMusicLibrary, musicAssetUrl, nextMusic, playMusic, previousMusic,
  seekMusic, setMusicVolume, toggleMusic, useMusicPlayer,
} from '@/lib/music-player';

const POS_KEY = 'cuberoot.metronome.pos.v1';
const PANEL_W = 300;

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
.cr-metro-dot.is-playing{background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 13%,transparent);}
/* Stacked readout: TPS leads, BPM sits under it. Both nowrap — CJK-width
   browsers wrap "120 BPM" onto its own line if it has to share a row. */
.cr-metro-readout{display:flex;flex-direction:column;gap:1px;flex:1 1 auto;min-width:0;}
.cr-metro-primary{display:flex;align-items:baseline;gap:4px;white-space:nowrap;}
.cr-metro-tps{font:600 21px/1 var(--font-mono,ui-monospace,monospace);
  font-variant-numeric:tabular-nums;}
.cr-metro-unit{font-size:11px;color:var(--muted-foreground);}
.cr-metro-bpm{font-size:11px;line-height:1;white-space:nowrap;
  color:var(--faint-foreground,var(--muted-foreground));font-variant-numeric:tabular-nums;}
.cr-metro-title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:650;}

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

.cr-audio-mode{margin:10px 0 2px;}
.cr-audio-music{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;align-items:center;margin-top:9px;}
.cr-audio-cover{width:64px;aspect-ratio:1;border-radius:10px;object-fit:cover;background:color-mix(in srgb,var(--accent) 14%,var(--card));}
.cr-audio-cover-empty{display:grid;place-items:center;color:var(--accent);}
.cr-audio-copy{min-width:0;display:flex;flex-direction:column;gap:2px;}
.cr-audio-copy strong,.cr-audio-copy span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.cr-audio-copy span{font-size:11px;color:var(--muted-foreground);}
.cr-audio-progress{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;color:var(--muted-foreground);font:10px/1 var(--font-mono,ui-monospace,monospace);}
.cr-audio-progress input,.cr-audio-volume input{min-width:0;width:100%;margin:0;accent-color:var(--accent);}
.cr-audio-controls{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;}
.cr-audio-controls button{width:30px;height:30px;}
.cr-audio-controls .cr-audio-main{width:38px;height:38px;border-radius:50%;color:var(--background);background:var(--foreground);}
.cr-audio-volume{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;color:var(--muted-foreground);}
.cr-audio-open{grid-column:1/-1;width:max-content;display:inline-flex;align-items:center;gap:5px;margin-top:2px;color:var(--accent);font-size:11px;text-decoration:none;}
.cr-audio-open:hover{text-decoration:underline;}
.cr-audio-state{grid-column:1/-1;margin:2px 0;color:var(--muted-foreground);font-size:11px;}

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
  const music = useMusicPlayer();
  const t = (z: string, e: string) => (lang === 'zh' ? z : e);

  const [mode, setMode] = useState<'music' | 'metronome'>('music');
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [beat, setBeat] = useState<{ index: number; accent: boolean } | null>(null);
  const [tapHint, setTapHint] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { void loadMusicLibrary(); }, []);

  // Clamp on restore, not just on resize: a spot saved on a wide desktop lands
  // far off-screen when the same profile opens on a phone.
  useEffect(() => { setPos(clampPos(loadPos() ?? defaultPos(), null)); }, []);

  // Re-clamp against the real card size once it has been measured (the restore
  // above can only estimate, and collapsed/expanded heights differ).
  useLayoutEffect(() => {
    if (!pos || !cardRef.current) return;
    const c = clampPos(pos, cardRef.current);
    if (c.left !== pos.left || c.top !== pos.top) setPos(c);
  }, [pos, collapsed, mode, music.status]);

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
  const track = music.tracks.find((candidate) => candidate.id === music.currentId) ?? null;
  const time = (seconds: number) => {
    const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };

  return (
    <div
      ref={cardRef}
      className={`cr-metro${collapsed ? ' is-collapsed' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ left: pos.left, top: pos.top }}
      role="group"
      aria-label={t('音频中心', 'Audio center')}
    >
      <style>{CSS}</style>

      <div
        className="cr-metro-head cr-metro-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className={mode === 'music' && music.playing ? 'cr-metro-dot is-playing' : dotCls} aria-hidden />
        <span className="cr-metro-readout">
          {mode === 'music' ? (
            <>
              <span className="cr-metro-title">{track?.title ?? t('音乐播放器', 'Music player')}</span>
              {!collapsed && <span className="cr-metro-bpm">{track?.artist ?? t('选择歌曲开始播放', 'Choose a track to begin')}</span>}
            </>
          ) : (
            <>
              <span className="cr-metro-primary">
                <span className="cr-metro-tps">{tps.toFixed(2)}</span>
                <span className="cr-metro-unit">TPS</span>
              </span>
              {!collapsed && <span className="cr-metro-bpm">{s.bpm} BPM</span>}
            </>
          )}
        </span>
        <button
          type="button"
          className="cr-metro-icon cr-metro-play"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => mode === 'music' ? toggleMusic() : setMetronome({ on: !s.on })}
          title={(mode === 'music' ? music.playing : s.on) ? t('暂停', 'Pause') : t('播放', 'Play')}
          aria-label={(mode === 'music' ? music.playing : s.on) ? t('暂停', 'Pause') : t('播放', 'Play')}
        >
          {(mode === 'music' ? music.playing : s.on) ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
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
          <div className="cr-audio-mode">
            <PillToggle
              value={mode === 'metronome'}
              onChange={(value) => setMode(value ? 'metronome' : 'music')}
              offLabel={t('音乐', 'Music')}
              onLabel={t('节拍器', 'Metronome')}
              ariaLabel={t('切换音乐与节拍器', 'Switch music and metronome')}
            />
          </div>

          {mode === 'music' ? (
            <div className="cr-audio-music">
              {track?.cover ? (
                <img className="cr-audio-cover" src={musicAssetUrl(track.cover)} alt={track.title} />
              ) : (
                <span className="cr-audio-cover cr-audio-cover-empty" aria-hidden><Disc3 size={26} /></span>
              )}
              <span className="cr-audio-copy">
                <strong>{track?.title ?? t('曲库待发布', 'Library coming soon')}</strong>
                <span>{track ? (track.artist || t('未知艺术家', 'Unknown artist')) : t('播放器界面已就绪', 'Player interface is ready')}</span>
              </span>
              <div className="cr-audio-progress">
                <span>{time(music.currentTime)}</span>
                <input type="range" min={0} max={Math.max(1, music.duration)} step={0.1}
                  value={Math.min(music.currentTime, Math.max(1, music.duration))}
                  onChange={(e) => seekMusic(Number(e.target.value))}
                  aria-label={t('播放进度', 'Playback progress')} disabled={!track} />
                <span>{time(music.duration)}</span>
              </div>
              <div className="cr-audio-controls">
                <button type="button" onClick={() => { void previousMusic(); }} aria-label={t('上一首', 'Previous track')}>
                  <SkipBack size={17} fill="currentColor" />
                </button>
                <button type="button" className="cr-audio-main" onClick={() => track ? toggleMusic() : void playMusic()}
                  aria-label={music.playing ? t('暂停', 'Pause') : t('播放', 'Play')} disabled={music.tracks.length === 0}>
                  {music.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                </button>
                <button type="button" onClick={() => { void nextMusic(); }} aria-label={t('下一首', 'Next track')}>
                  <SkipForward size={17} fill="currentColor" />
                </button>
              </div>
              <label className="cr-audio-volume">
                <Volume2 size={14} aria-hidden />
                <input type="range" min={0} max={1} step={0.01} value={music.volume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  aria-label={t('音量', 'Volume')} />
                <span>{Math.round(music.volume * 100)}%</span>
              </label>
              {music.status === 'error' && <p className="cr-audio-state">{t('曲库尚未发布', 'Library not published yet')}</p>}
              <Link href="/music" prefetch={false} className="cr-audio-open">
                {t('打开完整播放器', 'Open full player')} <ExternalLink size={12} aria-hidden />
              </Link>
            </div>
          ) : (
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
        </>
      )}
    </div>
  );
}
