import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { buildColorTimeline } from '@/lib/video-recon/engine/cube-colors';
import { TIMER_TAIL_SECONDS, type TimerReconstructionResult } from '@/lib/video-recon/engine/cube-timer';
import { frameArrow, reviewIndex, steppedTimestamp } from '@/lib/video-recon/engine/frame-review';
import type { PlaybackSpeed } from '@/lib/video-recon/engine/playback-timing';
import { buildCubeReplayTimelines, projectedCubeAtFrame } from '@/lib/video-recon/engine/projected-cube';
import { poseIsFlagged, projectedWireframe } from '@/lib/video-recon/engine/reconstruction-view';
import { timerReplayFrameId, type TimerReplay as ReplayClip } from '@/lib/video-recon/engine/timer-replay';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import { ProjectedCube, useVideoCubeEngine } from './ProjectedCube';
import { ReviewControls } from './ReviewControls';

export type ReplaySeek = { timestamp: number; revision: number };

export function TimerReplay({ clip, reconstruction, disabled, seekRequest, onPosition, sourceFile, sourceOnly, tailSeconds = TIMER_TAIL_SECONDS }: {
  clip: ReplayClip;
  reconstruction: TimerReconstructionResult;
  disabled?: boolean;
  seekRequest?: ReplaySeek;
  onPosition: (position: number) => void;
  tailSeconds?: number;
  sourceFile?: File;
  sourceOnly?: boolean;
}) {
  const t = useT();
  const [cubeEngine, setCubeEngine] = useVideoCubeEngine();
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const start = clip.frames[0]?.timestamp ?? clip.start;
  const end = clip.frames.at(-1)?.timestamp ?? start;
  const [position, setPosition] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [drawError, setDrawError] = useState(false);
  const currentPosition = useRef(position);
  const { steps, solved, measured, timeline, coverage } = useMemo(() => {
    const steps = reconstruction.result?.steps ?? [];
    const solved = ['solved', 'already_solved'].includes(reconstruction.result?.status ?? '');
    const lastStep = steps.at(-1);
    const coverageIndex = !solved && lastStep
      ? clip.frames.findLastIndex(row => timerReplayFrameId(row, clip.clockFps) <= lastStep.frame_index)
      : -1;
    const coverage = coverageIndex >= 0 ? { ordinal: coverageIndex + 1, timestamp: clip.frames[coverageIndex].timestamp } : undefined;
    let timelines: ReturnType<typeof buildCubeReplayTimelines> = { measured: [], projected: [] };
    if (!sourceOnly) try {
      const colors = buildColorTimeline(reconstruction.config?.scramble ?? '', steps);
      timelines = buildCubeReplayTimelines(clip.frames, colors, {
        fps: clip.clockFps, solved, steps, turningStartFrame: reconstruction.config?.turning_start_frame,
      });
    } catch { /* The saved clip can be reviewed without a valid cube state. */ }
    return { steps, solved, measured: timelines.measured, timeline: timelines.projected, coverage };
  }, [clip.frames, clip.clockFps, reconstruction, sourceOnly]);
  const hasRecording = useMemo(() => clip.frames.some(frame => !!frame.image), [clip.frames]);
  const index = reviewIndex(clip.frames, position);
  const current = clip.frames[index];
  const frame = current ? timerReplayFrameId(current, clip.clockFps) : Math.round(position * clip.clockFps);
  const step = steps.find(step => step.frame_index === frame);
  // The timeline only contains accepted states. Beyond its end it holds the
  // last state, while the source video can continue into unrecognized frames.
  const pose = projectedCubeAtFrame(timeline, frame);
  const sourceFps = reconstruction.config?.source_fps ?? (clip.clockFps === 1000 ? 30 : clip.clockFps);
  const solveStart = reconstruction.config?.requested_start_seconds ?? clip.start;
  const stop = Math.max(solveStart, reconstruction.config?.requested_stop_seconds ?? (reconstruction.config?.source_end_seconds ?? clip.end) - tailSeconds);
  const scramble = reconstruction.config?.scramble;
  const showAnalysis = clip.complete && scramble && steps.some(move => move.state_moves.length)
    && (reconstruction.status === 'solved' || reconstruction.status === 'failed');

  useEffect(() => { setPlaying(false); setPosition(start); }, [clip.id, sourceFile, start]);
  useEffect(() => {
    const element = video.current;
    if (!sourceFile || !element) return;
    const url = URL.createObjectURL(sourceFile);
    element.src = url;
    return () => { element.pause(); element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url); };
  }, [sourceFile]);
  useEffect(() => {
    const element = video.current;
    if (!sourceFile || !element || playing || Math.abs(element.currentTime - position) < 0.001) return;
    element.currentTime = position;
  }, [sourceFile, playing, position]);
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
    const element = sourceFile ? video.current : null;
    let cancelled = false;
    if (element) {
      element.currentTime = origin;
      element.playbackRate = speed;
      void element.play().catch(() => { if (!cancelled) setPlaying(false); });
    }
    let animation = requestAnimationFrame(function tick(now) {
      const next = Math.min(end, element ? element.currentTime : origin + (now - wall) * speed / 1000);
      setPosition(next);
      if (next < end && !element?.ended) animation = requestAnimationFrame(tick);
      else setPlaying(false);
    });
    return () => { cancelled = true; cancelAnimationFrame(animation); element?.pause(); };
  }, [playing, disabled, end, speed, sourceFile]);

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
    <ReviewControls playing={playing} speed={speed} end={end} origin={start}
      position={position} index={index} length={clip.frames.length} disabled={disabled}
      onPlay={() => { if (position >= end) setPosition(start); setPlaying(value => !value); }}
      onSpeed={setSpeed} onSeekIndex={frame => {
        const row = clip.frames[frame];
        if (row) seek(row.timestamp);
      }} onStep={advance} />
    {coverage && reconstruction.status === 'failed' && <p className="video-recon-muted" role="status">
      {t(`部分复盘 · 已识别至第 ${coverage.ordinal} 帧（${timecode(coverage.timestamp - start)}）`,
        `Partial reconstruction · Recognized through frame ${coverage.ordinal} (${timecode(coverage.timestamp - start)})`)}
      {pose && index >= coverage.ordinal && t('。当前显示最后一个有效状态。', '. Showing the last available cube state.')}
    </p>}
    <div className={!sourceOnly && (sourceFile || hasRecording) ? 'video-recon-columns' : undefined}>
      {sourceFile && <div className="video-recon-stage">
        <video ref={video} muted playsInline preload="auto" aria-label={t('回放原录像', 'Original recording')} />
      </div>}
      {!sourceFile && hasRecording && <div className="video-recon-stage">
        <canvas ref={canvas} aria-label={t('回放相机画面', 'Replay camera frame')} />
        {drawError && <p role="status">{t('无法显示此帧的相机画面。', 'The camera image is unavailable for this frame.')}</p>}
      </div>}
      {!sourceOnly && <ProjectedCube engine={cubeEngine} onEngineChange={setCubeEngine} pose={pose} sourceTimestamp={current?.timestamp ?? position}
        solved={solved} steps={steps} timeline={timeline} sourceFrame={frame} sourceFps={sourceFps} clockFps={clip.clockFps} playbackSpeed={playing ? speed : 1}
        analysis={showAnalysis ? { scramble, steps, measured, fps:sourceFps, clockFps:clip.clockFps,
          start:solveStart, end:stop, position, onSeek:seek, inferredScramble: !!reconstruction.result?.inferred_scramble } : undefined} />}
    </div>
  </section>;
}
