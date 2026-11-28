'use client';

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react';
import { Info } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { VideoContextMenu } from '@/components/video/VideoContextMenu';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { VideoSettingsButton, useVideoControlsVisibility } from '@/components/video/VideoPlaybackControls';
import { ReviewPlaybackOverlay, type ReviewPlayback } from './ReviewControls';
import { useT } from '@/hooks/useT';

export function VideoStatsStage({ fileName, stats, playback, settingsAvailable = true, settingsItems, settingsSlotRef, frameDecoration, frameAspect, quarterTurn, children, ...props }: ComponentPropsWithoutRef<'div'> & {
  fileName?: string;
  stats?: ReactNode;
  frameDecoration?: ReactNode;
  frameAspect?: number;
  quarterTurn?: boolean;
  settingsAvailable?: boolean;
  settingsItems?: ReactNode;
  settingsSlotRef?: Ref<HTMLDivElement>;
  playback?: ReviewPlayback;
}) {
  const t = useT();
  const visibility = useVideoControlsVisibility(playback?.playing);
  const label = t('详细统计信息', 'Stats for nerds');
  const stage = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number }>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsPanel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!settingsAvailable) setSettingsOpen(false); }, [settingsAvailable]);
  usePopoverDismiss(settingsAvailable && settingsOpen, () => setSettingsOpen(false), settingsPanel, settingsButton);
  useEffect(() => { if (settingsOpen) settingsPanel.current?.focus({ preventScroll: true }); }, [settingsOpen]);

  useEffect(() => {
    setOpen(false);
    setMenu(null);
    setSettingsOpen(false);
    setPosition(null);
    drag.current = null;
    const host = stage.current;
    if (!host || !fileName) return;
    // Listen on the actual stage, including caption controls rendered into it through a portal.
    const showAt = (x: number, y: number) => {
      setSettingsOpen(false);
      const rect = host.getBoundingClientRect();
      setMenu({ x: x - rect.left, y: y - rect.top });
    };
    const insidePopup = (target: EventTarget | null) => target instanceof Element && target.closest('[role="menu"], .video-recon-stats, .lesson-video-menu');
    let hold: ReturnType<typeof setTimeout> | undefined;
    let startX = 0, startY = 0, suppressTap = false;
    const cancelHold = () => { clearTimeout(hold); hold = undefined; };
    const contextMenu = (event: MouseEvent) => {
      cancelHold();
      if (insidePopup(event.target)) return;
      event.preventDefault();
      showAt(event.clientX, event.clientY);
    };
    const pointerDown = (event: PointerEvent) => {
      cancelHold();
      suppressTap = false;
      if (event.pointerType !== 'touch' || !event.isPrimary || insidePopup(event.target) ||
        (event.target instanceof Element && event.target.closest('button, input, select, .lesson-video-controls'))) return;
      startX = event.clientX; startY = event.clientY;
      hold = setTimeout(() => { suppressTap = true; showAt(startX, startY); }, 550);
    };
    const pointerMove = (event: PointerEvent) => {
      if (hold && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancelHold();
    };
    const click = (event: MouseEvent) => {
      if (suppressTap) { suppressTap = false; event.preventDefault(); event.stopPropagation(); }
    };
    host.addEventListener('contextmenu', contextMenu);
    host.addEventListener('pointerdown', pointerDown);
    host.addEventListener('pointermove', pointerMove);
    host.addEventListener('pointerup', cancelHold);
    host.addEventListener('pointercancel', cancelHold);
    host.addEventListener('pointerleave', cancelHold);
    host.addEventListener('click', click, true);
    return () => {
      cancelHold();
      host.removeEventListener('contextmenu', contextMenu);
      host.removeEventListener('pointerdown', pointerDown);
      host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerup', cancelHold);
      host.removeEventListener('pointercancel', cancelHold);
      host.removeEventListener('pointerleave', cancelHold);
      host.removeEventListener('click', click, true);
    };
  }, [fileName]);
  useEffect(() => { if (open) panel.current?.focus({ preventScroll: true }); }, [open]);

  function close() {
    drag.current = null;
    setOpen(false);
    stage.current?.focus({ preventScroll: true });
  }

  function toggleStats() {
    setSettingsOpen(false);
    setMenu(null);
    if (open) close(); else setOpen(true);
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || !panel.current ||
      (event.target instanceof Element && event.target.closest('button'))) return;
    const bounds = panel.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    const host = stage.current;
    const overlay = panel.current;
    if (!active || active.pointerId !== event.pointerId || !host || !overlay) return;
    const bounds = host.getBoundingClientRect();
    const size = overlay.getBoundingClientRect();
    const ratio = (offset: number, available: number) => Math.min(1, Math.max(0, offset / Math.max(1, available)));
    setPosition({
      x: ratio(event.clientX - active.offsetX - bounds.left - host.clientLeft - 8, host.clientWidth - size.width - 16),
      y: ratio(event.clientY - active.offsetY - bounds.top - host.clientTop - 8, host.clientHeight - size.height - 16),
    });
  }

  // Store the position within available space so the panel stays inside the video when it resizes.
  const panelStyle = position ? {
    left: `calc(8px + (100% - 16px) * ${position.x})`,
    top: `calc(8px + (100% - 16px) * ${position.y})`,
    translate: `${-100 * position.x}% ${-100 * position.y}%`,
  } : undefined;

  const gear = settingsAvailable && fileName && <VideoSettingsButton ref={settingsButton} open={settingsOpen} onClick={() => {
    setMenu(null);
    setSettingsOpen(value => !value);
  }} />;

  const player = <div {...props} ref={stage} tabIndex={fileName ? 0 : undefined}
    aria-label={fileName ? t('视频画面', 'Video frame') : undefined} aria-haspopup={fileName ? 'menu' : undefined}
    {...(playback ? visibility.surfaceEvents : undefined)}
    onKeyDown={event => {
      if (!fileName) return;
      if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
        event.preventDefault(); setSettingsOpen(false); setMenu({ x: 8, y: 8 });
      } else if (event.key === 'Escape' && open && !menu) {
        event.preventDefault(); event.stopPropagation(); close();
      }
    }}>
    {children}
    {playback ? <ReviewPlaybackOverlay playback={playback} visibility={visibility} keepVisible={!!menu || settingsOpen}
      settingsButton={gear} /> : (settingsItems || settingsSlotRef) && gear}
    {settingsAvailable && fileName && settingsOpen && <div ref={settingsPanel} className="lesson-video-menu video-recon-settings" role="dialog"
      aria-label={t('播放设置', 'Playback settings')} tabIndex={-1}>
      <div ref={settingsSlotRef}>{settingsItems}</div>
      <button className="lesson-video-button lesson-video-menu-row" type="button" onClick={() => {
        setSettingsOpen(false);
        setOpen(true);
        panel.current?.focus({ preventScroll: true });
      }}><Info aria-hidden /><span>{label}</span></button>
    </div>}
    {fileName && menu && <VideoContextMenu player={stage} position={menu} onClose={setMenu} className="video-recon-context">
      <button className="video-recon-context-action" type="button" role="menuitemcheckbox" aria-checked={open} onClick={toggleStats}><Info size={16} aria-hidden />{label}</button>
    </VideoContextMenu>}
    {fileName && open && <section ref={panel} className="video-recon-stats" role="dialog" aria-label={label} tabIndex={-1} style={panelStyle}>
      <header onPointerDown={startDrag} onPointerMove={moveDrag}
        onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
        onContextMenu={event => event.preventDefault()}>
        <strong>{label}</strong>
        <ClearButton variant="standalone" ariaLabel={t('关闭详细统计信息', 'Close statistics')} onClick={close} />
      </header>
      <dl><dt>{t('文件名', 'File name')}</dt><dd dir="auto">{fileName}</dd></dl>
      {stats}
    </section>}
  </div>;
  return <div className="video-recon-player-frame" hidden={props.hidden} data-media-sized={frameAspect ? '' : undefined}
    data-quarter-turn={frameAspect && quarterTurn || undefined}
    style={frameAspect ? { '--video-frame-aspect': frameAspect } as CSSProperties : undefined}>
    {player}{frameDecoration}
  </div>;
}
