'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Camera, Crop, Download, Eraser, Film, Unplug, Upload } from '@app-foundation/icons/lucide';
import PageHeading from '@/components/PageHeading';
import HeaderToggles from '@/components/HeaderToggles';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { createVideoWorkspace, type VideoWorkspace, type WorkspaceTab } from '@/lib/video-recon/workspace';
import { prepareOfflineVideoRecon } from '@/lib/video-recon/offline';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import { CameraTimer } from './CameraTimer';
import { ProjectedCube } from './ProjectedCube';
import { ReviewControls } from './ReviewControls';
import { SolveRange } from './SolveRange';
import { SourceCropDialog } from './SourceCropDialog';
import { TimerReplay } from './TimerReplay';
import { TpsGraph } from './TpsGraph';
import './video-recon.css';

const VideoSolveAnalysis = dynamic(() => import('./VideoSolveAnalysis').then(module => module.VideoSolveAnalysis));
const NO_MOVES: readonly MoveStep[] = [];
const VIDEO_MODES: WorkspaceTab[] = ['detector', 'timer'];
const noWorkspace = () => null;
const noSubscription = () => () => {};

function VideoReconProgress({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return <LoadingIndicator>{label}</LoadingIndicator>;
  return <div className="video-recon-progress">
    <div className="video-recon-section-heading">
      <span role="status">{label}</span>
      <strong aria-hidden="true">{value}%</strong>
    </div>
    <progress aria-label={label} max={100} value={value} />
  </div>;
}

export default function VideoReconClient() {
  const t = useT();
  const stage = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraPreview = useRef<HTMLVideoElement>(null);
  const [workspace, setWorkspace] = useState<VideoWorkspace>();
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useQueryState('mode', parseAsStringEnum(VIDEO_MODES).withDefault('detector'));
  const view = useSyncExternalStore(workspace?.subscribe ?? noSubscription, workspace?.getSnapshot ?? noWorkspace, noWorkspace);
  const detector = (view?.activeTab ?? mode) === 'detector';
  const initialMode = useRef(mode);

  useEffect(() => {
    const canvas = stage.current;
    if (!canvas) return;
    const session = createVideoWorkspace(canvas, initialMode.current);
    setWorkspace(session);
    let mounted = true;
    void prepareOfflineVideoRecon().then(() => { if (mounted) void session.loadModel(); });
    window.addEventListener('keydown', session.reviewKeydown);
    const pagehide = (event: PageTransitionEvent) => { if (!event.persisted) session.cleanup(); };
    window.addEventListener('pagehide', pagehide);
    return () => {
      mounted = false;
      window.removeEventListener('keydown', session.reviewKeydown);
      window.removeEventListener('pagehide', pagehide);
      session.cleanup();
    };
  }, []);

  useEffect(() => { workspace?.selectTab(mode); }, [mode, workspace]);

  const stream = view?.stream;
  const showCamera = view?.showCameraPreview;
  useEffect(() => {
    const video = cameraPreview.current;
    if (!video || !stream || !showCamera) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => { video.srcObject = null; };
  }, [stream, showCamera]);

  const title = t('视频复盘', 'Video Reconstruction');
  const detectorLabel = t('视频检测', 'Video detector');
  const timerLabel = t('摄像头计时', 'Camera timer');
  const reviewing = detector && view?.sourceKind === 'video' && view.reconstructionComplete && !view.trimming;
  const reconstructing = detector && view?.sourceKind === 'video' && !view.trimming && !view.reconstructionComplete;
  const fileSelected = !!view && (view.sourceKind === 'image' || view.sourceKind === 'video');
  const fileCanCrop = view?.sourceKind === 'image' || view?.trimming;
  const searchSteps = view?.searchResult?.steps ?? NO_MOVES;
  const downloadProgress = view?.modelProgress;
  const downloading = downloadProgress !== undefined && downloadProgress < 100;
  const frameProgress = reconstructing && !view.videoInputComplete && view.solveEnd > view.solveStart
    ? Math.max(0, Math.min(99, Math.floor(100 * (view.position - view.solveStart) / (view.solveEnd - view.solveStart))))
    : undefined;
  const selectedSource = view?.sourceKind === 'camera' ? t('实时摄像头', 'Live camera') : view?.sourceName;
  const guide = detector
    ? t('上传固定机位的视频和已知打乱，复盘三阶还原。图片也可用于检测。', 'Use a fixed-camera video and the known scramble to reconstruct a 3×3 solve. You can also detect a cube in an image.')
    : t('用摄像头记录还原，计时结束后查看逐帧回放。', 'Record a solve with your camera and review it frame by frame.');
  const mediaError = view?.mediaError || view?.poseError;
  const renderReviewControls = (label: string) => workspace && view && reviewing && (
    <ReviewControls label={label} playing={view.running} speed={view.playbackSpeed}
      start={view.solveStart} end={view.solveEnd} position={view.presentedTimestamp} index={view.currentReviewIndex} length={view.reviewLength}
      onPlay={() => void workspace.togglePlayback()} onSpeed={workspace.changePlaybackSpeed}
      onSeek={time => void workspace.requestReview(time)} onStep={workspace.stepReview} />
  );
  return <main className="video-recon-page">
    <header className="video-recon-heading">
      <PageHeading backHref="/recon">{title}</PageHeading>
      <div className="video-recon-modes" role="group" aria-label={t('复盘工具', 'Reconstruction tools')}>
        <button type="button" className="btn-secondary" aria-pressed={detector} disabled={view?.timerBusy}
          onClick={() => void setMode('detector')}><Film size={17} aria-hidden />{detectorLabel}</button>
        <button type="button" className="btn-secondary" aria-pressed={!detector} disabled={view?.timerBusy}
          onClick={() => void setMode('timer')}><Camera size={17} aria-hidden />{timerLabel}</button>
      </div>
      <HeaderToggles />
    </header>
    <p className="video-recon-intro">{guide}</p>
    <div className={reviewing || !detector && view?.latestTimerReplay ? 'video-recon-columns' : undefined}>
      <section className="video-recon-panel" data-site-surface="panel" aria-label={detector ? detectorLabel : timerLabel}>
        <div className="video-recon-section-heading">
          <h2>{detector ? t('源画面', 'Source') : t('摄像头画面', 'Camera preview')}</h2>
          {selectedSource && <span className="video-recon-file-name" dir="auto">{selectedSource}</span>}
        </div>
        <div className="video-recon-stage" data-dragging={dragOver} onDragOver={event => {
          if (!detector) return;
          event.preventDefault();
          setDragOver(true);
        }} onDragLeave={() => setDragOver(false)} onDrop={event => {
          if (!detector) return;
          event.preventDefault();
          setDragOver(false);
          void workspace?.openFile(event.dataTransfer.files[0]);
        }}>
          <canvas ref={stage} hidden={!view || view.sourceKind === 'none' || showCamera}
            aria-label={t('检测后的源画面', 'Processed source frame')} />
          <video ref={cameraPreview} hidden={!showCamera} muted autoPlay playsInline aria-label={t('摄像头预览', 'Camera preview')} />
          {(!view || view.sourceKind === 'none') && <div className="video-recon-empty">
            {detector ? <Film size={34} strokeWidth={1.5} aria-hidden /> : <Camera size={34} strokeWidth={1.5} aria-hidden />}
            <strong>{detector ? t('拖放视频或图片', 'Drop a video or image') : t('摄像头尚未连接', 'Camera disconnected')}</strong>
            {detector
              ? <button type="button" className="btn-primary" disabled={!workspace} onClick={() => fileInput.current?.click()}>
                <Upload size={17} aria-hidden />{t('选择文件', 'Choose file')}
              </button>
              : <button type="button" className="btn-primary" disabled={!workspace || view?.status !== 'ready'} onClick={() => void workspace?.camera()}>
                <Camera size={17} aria-hidden />{t('连接摄像头', 'Connect camera')}
              </button>}
          </div>}
        </div>
        {workspace && view && view.sourceKind !== 'none' && <div className="video-recon-actions">
          {detector && <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <Upload size={16} aria-hidden />{t('更换文件', 'Replace file')}
          </button>}
          {fileSelected && <button type="button" className="btn-secondary" disabled={view.cropLocked || view.cropLoading || !fileCanCrop}
            onClick={() => void workspace.editCrop()}>
            <Crop size={16} aria-hidden />{view.cropLocked ? t('裁剪已锁定', 'Crop locked') : t('裁剪画面', 'Crop frame')}
          </button>}
          {reviewing && <button type="button" className="btn-secondary" onClick={() => void workspace.editSolveRange()}>
            {t('调整还原区间', 'Adjust solve range')}
          </button>}
          <button type="button" className="btn-secondary" disabled={view.timerBusy} onClick={workspace.stopSource}>
            {detector ? <Eraser size={16} aria-hidden /> : <Unplug size={16} aria-hidden />}
            {detector ? t('清除', 'Clear') : t('断开摄像头', 'Disconnect camera')}
          </button>
        </div>}
        {renderReviewControls(t('视频播放控件', 'Video playback controls'))}
        {workspace && view?.trimming && <SolveRange view={view} workspace={workspace} />}
        {view?.status === 'loading' && <VideoReconProgress
          label={downloading ? t('正在下载识别模型', 'Downloading detector models')
            : downloadProgress === 100 ? t('正在初始化识别模型', 'Initializing detector models')
              : t('正在准备识别模型', 'Preparing detector models')}
          value={downloading ? downloadProgress : undefined} />}
        {view?.status !== 'loading' && (reconstructing || view?.timerBuffering) && <VideoReconProgress
          label={frameProgress === undefined ? t('正在复盘 · 重建动作', 'Reconstructing · Recovering moves')
            : t('正在复盘 · 分析视频帧', 'Reconstructing · Analyzing video frames')}
          value={frameProgress} />}
        {reviewing && !view.cubeSolved && <div className="video-recon-muted" role="status">
          <strong>{t('未能完成复盘', 'Reconstruction incomplete')}</strong>
          <span> · {searchSteps.length ? t('已保留识别出的动作。', 'Recovered moves are available.') : t('未识别到可用动作。', 'No moves were recovered.')}</span>
          {view.searchError && <details><summary>{t('技术详情', 'Technical details')}</summary>{view.searchError}</details>}
        </div>}
        {mediaError && <div className="video-recon-error" role="alert">
          <strong>{t('无法处理当前画面。', 'Could not process the current source.')}</strong>
          <details><summary>{t('技术详情', 'Technical details')}</summary>{mediaError}</details>
        </div>}
        {workspace && view?.status === 'error' && <div className="video-recon-error" role="alert">
          <strong>{t('无法初始化检测器。', 'Could not initialize the detector.')}</strong>
          <p>{t('请使用支持 WebGPU 的浏览器，并通过 HTTPS 或本地地址访问。', 'Use a browser with WebGPU over HTTPS or localhost.')}</p>
          <details><summary>{t('技术详情', 'Technical details')}</summary>{view.error}</details>
          <button type="button" className="btn-secondary" onClick={() => void workspace.loadModel()}>{t('重新加载检测器', 'Reload detector')}</button>
        </div>}
        <footer className="video-recon-section-heading video-recon-muted">
          <span>{t('媒体在本机处理', 'Media is processed on this device')}
            {view?.sourceKind && view.sourceKind !== 'none' ? ` · ${(showCamera ? view.captureFps : view.fps).toFixed(1)} FPS` : ''}
          </span>
          <button type="button" className="btn-secondary" disabled={!view?.savedFrames || view.timerBusy} onClick={() => void workspace?.downloadDetections()}>
            <Download size={16} aria-hidden />{t('下载检测数据', 'Download detections')}
            {view?.savedFrames ? ` (${view.savedFrames})` : ''}
          </button>
        </footer>
      </section>
      {reviewing && <ProjectedCube pose={view.coloredProjection} sourceTimestamp={view.presentedTimestamp}
        timestamp={timecode(view.presentedTimestamp)} solved={view.cubeSolved} steps={searchSteps} timeline={view.projectedTimeline}
        sourceFrame={view.result?.fittedPose?.sourceFrame ?? Math.round(view.presentedTimestamp * view.sourceFps)}
        sourceFps={view.sourceFps} playbackSpeed={view.running ? view.playbackSpeed : 1}
        controls={renderReviewControls(t('实况魔方播放控件', 'Tracked cube playback controls'))}
        analysis={workspace && view.reconstructedScramble && view.measuredCubeTimeline && searchSteps.some(step => step.state_moves.length)
          ? <VideoSolveAnalysis scramble={view.reconstructedScramble} steps={searchSteps} measured={view.measuredCubeTimeline}
            fps={view.sourceFps} start={view.solveStart} end={view.solveEnd} position={view.presentedTimestamp}
            onSeek={timestamp => void workspace.requestReview(timestamp)} />
          : undefined} />}
      {!detector && workspace && view?.latestTimerReplay && view.latestReplayReconstruction && <section className="video-recon-panel" data-site-surface="panel">
        <h2>{t('最近一次回放', 'Latest solve replay')}</h2>
        <TimerReplay key={view.latestTimerReplay.id} clip={view.latestTimerReplay} reconstruction={view.latestReplayReconstruction}
          disabled={view.timerBusy} seekRequest={view.latestReplaySeek} onPosition={workspace.setLatestReplayPosition} />
      </section>}
    </div>
    {workspace && view && <CameraTimer active={!detector} workspace={workspace} view={view} />}
    {workspace && reviewing && <TpsGraph steps={searchSteps} fps={view.sourceFps} start={view.solveStart} end={view.solveEnd}
      cursor={view.presentedTimestamp} complete={view.cubeSolved} onSeek={timestamp => void workspace.requestReview(timestamp)} />}
    {workspace && view?.cropPreview && <SourceCropDialog key={view.cropPreview.url} {...view.cropPreview} initial={view.sourceCrop}
      onApply={crop => void workspace.applyCrop(crop)} onCancel={workspace.closeCrop} />}
    <input ref={fileInput} type="file" accept="image/*,video/*" aria-label={t('视频或图片', 'Video or image')} hidden
      onChange={event => {
        void workspace?.openFile(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }} />
  </main>;
}
