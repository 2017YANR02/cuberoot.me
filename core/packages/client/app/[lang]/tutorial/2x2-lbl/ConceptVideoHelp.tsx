'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Play } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import VideoProgress from '../components/VideoProgress';
import './concept-video.css';

type Text = { zh: string; en: string };
export type ConceptVideoFrame = { time: number; playing: boolean; seekVersion: number; reducedMotion: boolean };
type Video = { title: Text; duration: number; scene: (frame: ConceptVideoFrame) => ReactNode };

function ConceptVideo({ title, duration, scene, onClose }: Video & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [time, setTime] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const clock = useRef(0);
  const interacted = useRef(false);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const backdrop = useModalDismiss(close);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(preference.matches);
    syncMotion();
    preference.addEventListener('change', syncMotion);
    const start = window.setTimeout(() => {
      if (!interacted.current && !preference.matches && !document.hidden) setPlaying(true);
    }, 1000);
    return () => {
      clearTimeout(start);
      preference.removeEventListener('change', syncMotion);
      element.close();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let request = requestAnimationFrame(function tick(now) {
      if (!document.hidden) {
        clock.current = Math.min(duration, clock.current + Math.min(50, now - last));
        setTime(clock.current);
      }
      last = now;
      if (clock.current >= duration) setPlaying(false);
      else request = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(request);
  }, [duration, playing]);

  const seek = (next: number) => {
    interacted.current = true;
    clock.current = next;
    setTime(next);
    setSeekVersion(version => version + 1);
  };

  return <dialog ref={dialog} className="course-demo-dialog concept-video-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }} {...backdrop}>
    <div className="course-demo-panel concept-video-panel" data-site-surface="popover">
      <header>
        <h2 id={titleId}>{tr(title)}</h2>
        <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭视频', en: 'Close video' })} onClick={close} />
      </header>
      {scene({ time, playing, seekVersion, reducedMotion })}
      <VideoProgress time={time} duration={duration} playing={playing} onSeek={seek} onReplay={() => seek(0)}
        onPlayingChange={value => {
          interacted.current = true;
          setPlaying(value && clock.current < duration);
        }} />
    </div>
  </dialog>;
}

export function ConceptVideoScene({ compare, caption, artRef, children }: {
  compare: boolean; caption: Text; artRef?: RefObject<HTMLDivElement | null>; children: ReactNode;
}) {
  return <div className="concept-video-scene" data-tutorial-mode="timeline" data-tutorial-layout={compare ? 'D' : 'A'}>
    <div ref={artRef} className="concept-video-art" data-compare={compare}>{children}</div>
    <p className="concept-video-caption" aria-live="polite">{tr(caption)}</p>
  </div>;
}

export default function ConceptVideoHelp({ label, ...video }: Video & { label: Text }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="btn-secondary course-question-heading-action concept-video-open"
      aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Play size={15} aria-hidden="true" />{tr(label)}
    </button>
    {open && createPortal(<ConceptVideo {...video} onClose={() => setOpen(false)} />, document.body)}
  </>;
}
