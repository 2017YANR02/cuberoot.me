import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { buildColorTimeline } from '@/lib/video-recon/engine/cube-colors';
import type { TimerReconstructionResult } from '@/lib/video-recon/engine/cube-timer';
import { frameArrow, reviewIndex, steppedTimestamp } from '@/lib/video-recon/engine/frame-review';
import type { PlaybackSpeed } from '@/lib/video-recon/engine/playback-timing';
import { buildProjectedCubeTimeline, projectedCubeAtFrame } from '@/lib/video-recon/engine/projected-cube';
import { poseIsFlagged, projectedWireframe } from '@/lib/video-recon/engine/reconstruction-view';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import type { TimerReplay as ReplayClip } from '@/lib/video-recon/engine/timer-replay';
import { ProjectedCube } from './ProjectedCube';
import { ReviewControls } from './ReviewControls';

export type ReplaySeek = { timestamp: number; revision: number };

export function TimerReplay({ clip, reconstruction, disabled, seekRequest, onPosition }: {
  clip: ReplayClip;
  reconstruction: TimerReconstructionResult;
  disabled?: boolean;
  seekRequest?: ReplaySeek;
  onPosition: (position: number) => void;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = clip.frames[0]?.timestamp ?? clip.start;
  const end = clip.frames.at(-1)?.timestamp ?? start;
  const [position, setPosition] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [drawError, setDrawError] = useState(false);
  const currentPosition = useRef(position);
  const { steps, solved, timeline } = useMemo(() => {
    const steps = reconstruction.result?.steps ?? [];
    const solved = ['solved', 'already_solved'].includes(reconstruction.result?.status ?? '');
    let timeline: ReturnType<typeof buildProjectedCubeTimeline> = [];
    try {
      const colors = buildColorTimeline(reconstruction.config?.scramble ?? '', steps);
      timeline = buildProjectedCubeTimeline(clip.frames, colors, { fps: clip.clockFps, solved, steps });
    } catch { /* The saved clip can be reviewed without a valid cube state. */ }
    return { steps, solved, timeline };
  }, [clip.frames, clip.clockFps, reconstruction]);
  const hasRecording = useMemo(() => clip.frames.some(frame => !!frame.image), [clip.frames]);
  const index = reviewIndex(clip.frames, position);
  const current = clip.frames[index];
  const frame = current?.result.fittedPose?.sourceFrame ?? Math.round(position * clip.clockFps);
  const step = steps.find(step => step.frame_index === frame);
  const pose = solved || frame <= (steps.at(-1)?.frame_index ?? -Infinity) ? projectedCubeAtFrame(timeline, frame) : undefined;

  useEffect(() => { setPlaying(false); setPosition(start); }, [start]);
  useEffect(() => { if (disabled) setPlaying(false); }, [disabled]);
  useEffect(() => {
    if (!seekRequest) return;
    setPlaying(false);
    setPosition(Math.max(start, Math.min(end, seekRequest.timestamp)));
  }, [start, end, seekRequest]);
  useEffect(() => {
    currentPosition.current = position;
    onPosition(position);
  }, [position, onPosition]);

  useEffect(() => {
    if (!playing || disabled) return;
    const origin = currentPosition.current;
    const wall = performance.now();
    let animation = requestAnimationFrame(function tick(now) {
      const next = Math.min(end, origin + (now - wall) * speed / 1000);
      setPosition(next);
      if (next < end) animation = requestAnimationFrame(tick);
      else setPlaying(false);
    });
    return () => cancelAnimationFrame(animation);
  }, [playing, disabled, end, speed]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !current) return;
    const context = element.getContext('2d');
    if (!context) return;
    let cancelled = false;
    const frameImage = current.image;
    if (!frameImage) {
      context.clearRect(0, 0, element.width, element.height);
      setDrawError(true);
      return;
    }
    void createImageBitmap(frameImage).then(image => {
      try {
        if (cancelled) return;
        element.width = image.width;
        element.height = image.height;
        context.drawImage(image, 0, 0);
        setDrawError(false);
        const fitted = current.result.fittedPose;
        if (!fitted?.pose || poseIsFlagged(fitted, step?.pose_flagged)) return;
        context.strokeStyle = '#64f6dd'; // Tracking overlay needs contrast against camera pixels.
        context.lineWidth = Math.max(1.5, image.width / 650);
        context.lineJoin = 'round';
        for (const polygon of projectedWireframe(fitted, step?.geometry_option_index)) {
          if (!polygon.length) continue;
          context.beginPath();
          context.moveTo(...polygon[0]);
          for (const point of polygon.slice(1)) context.lineTo(...point);
          context.closePath();
          context.stroke();
        }
      } finally { image.close(); }
    }).catch(() => { if (!cancelled) setDrawError(true); });
    return () => { cancelled = true; };
  }, [current, step]);

  function seek(timestamp: number) {
    setPlaying(false);
    setPosition(Math.max(start, Math.min(end, timestamp)));
  }

  function advance(direction: -1 | 1) {
    const time = steppedTimestamp(clip.frames, position, direction);
    if (time !== undefined) seek(time);
  }

  return <section className="video-recon-replay" aria-label={t('还原回放', 'Solve replay')} onKeyDown={event => {
    if (disabled || event.defaultPrevented) return;
    const direction = frameArrow(event.nativeEvent, event.target instanceof Element ? event.target : null);
    if (direction) { event.preventDefault(); advance(direction); }
  }}>
    <ReviewControls playing={playing} speed={speed} start={start} end={end} origin={clip.start}
      position={position} index={index} length={clip.frames.length} disabled={disabled}
      onPlay={() => { if (position >= end) setPosition(start); setPlaying(value => !value); }}
      onSpeed={setSpeed} onSeek={seek} onStep={advance} />
    <div className={hasRecording ? 'video-recon-columns' : undefined}>
      {hasRecording && <div className="video-recon-stage">
        <canvas ref={canvas} aria-label={t('回放相机画面', 'Replay camera frame')} />
        {drawError && <p role="status">{t('无法显示此帧的相机画面。', 'The camera image is unavailable for this frame.')}</p>}
      </div>}
      <ProjectedCube pose={pose} sourceTimestamp={current?.timestamp ?? position} timestamp={timecode(position - clip.start)}
        solved={solved} steps={steps} timeline={timeline} sourceFrame={frame} sourceFps={clip.clockFps} playbackSpeed={playing ? speed : 1} />
    </div>
  </section>;
}
