'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Camera, Film, HelpCircle, Unplug, Upload } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import PageHeading from '@/components/PageHeading';
import HeaderToggles from '@/components/HeaderToggles';
import { INITIAL_VIDEO_TRANSFORM, VideoImageTools, videoImageTransformCss } from '@/components/VideoImageTools';
import { useVideoViewport } from '@/hooks/useVideoViewport';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { createVideoWorkspace, type VideoWorkspace, type WorkspaceTab } from '@/lib/video-recon/workspace';
import { prepareOfflineVideoRecon } from '@/lib/video-recon/offline';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import { CameraTimer } from './CameraTimer';
import { ProjectedCube } from './ProjectedCube';
import { ReviewControls } from './ReviewControls';
import { SolveRange } from './SolveRange';
import { SourceCropDialog } from './SourceCropDialog';
import { TpsGraph } from './TpsGraph';
import './video-recon.css';

const NO_MOVES: readonly MoveStep[] = [];
const VIDEO_MODES: WorkspaceTab[] = ['detector', 'timer'];
const noWorkspace = () => null;
const noSubscription = () => () => {};

function VideoReconProgress({ label, value, detail }: { label: string; value?: number; detail?: string }) {
  if (value === undefined) return <LoadingIndicator>{label}</LoadingIndicator>;
  return <div className="video-recon-progress">
    <div className="video-recon-section-heading">
      <span role="status">{label}</span>
      <strong aria-hidden="true">{detail ? `${detail} · ` : ''}{value}%</strong>
    </div>
    <progress aria-label={label} aria-valuetext={detail ? `${detail} · ${value}%` : undefined} max={100} value={value} />
  </div>;
}

export default function VideoReconClient() {
  const t = useT();
  const stage = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraPreview = useRef<HTMLVideoElement>(null);
  const [workspace, setWorkspace] = useState<VideoWorkspace>();
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useQueryState('mode', parseAsStringEnum(VIDEO_MODES).withDefault('detector'));
  const view = useSyncExternalStore(workspace?.subscribe ?? noSubscription, workspace?.getSnapshot ?? noWorkspace, noWorkspace);
  const detector = (view?.activeTab ?? mode) === 'detector';
  const [imageTransform, setImageTransform] = useState(INITIAL_VIDEO_TRANSFORM);
  const fileSelected = detector && (view?.sourceKind === 'image' || view?.sourceKind === 'video');
  const viewport = useVideoViewport(viewportRef, fileSelected, !!view?.cropPreview);
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
  const pendingResult = reconstructing && !view.mediaError && view.status !== 'error';
  const showResults = reviewing || pendingResult;
  const liveResult = pendingResult ? view.liveReconstruction : undefined;
  const resultTime = liveResult?.timestamp ?? view?.presentedTimestamp ?? 0;
  const fileCanCrop = view?.sourceKind === 'image' || view?.trimming;
  const searchSteps = view?.searchResult?.steps ?? NO_MOVES;
  const shownSteps = pendingResult ? liveResult?.steps ?? NO_MOVES : searchSteps;
  const measured = view?.measuredCubeTimeline;
  const modelDownload = view?.modelDownload;
  const downloadProgress = modelDownload && modelDownload.totalBytes > 0
    ? Math.floor(modelDownload.receivedBytes / modelDownload.totalBytes * 100) : undefined;
  const downloadSize = modelDownload
    ? `${(modelDownload.receivedBytes / 1_000_000).toFixed(1)} / ${(modelDownload.totalBytes / 1_000_000).toFixed(1)} MB` : undefined;
  const downloading = downloadProgress !== undefined && downloadProgress < 100;
  const frameProgress = reconstructing && !view.videoInputComplete && view.solveEnd > view.solveStart
    ? Math.max(0, Math.min(99, Math.floor(100 * (view.position - view.solveStart) / (view.solveEnd - view.solveStart))))
    : undefined;
  const cameraConnected = !detector && view?.sourceKind === 'camera';
  const mediaError = view?.mediaError || view?.poseError;
  const renderReviewControls = (label: string) => workspace && view && reviewing && (
    <ReviewControls label={label} playing={view.running} speed={view.playbackSpeed}
      end={view.solveEnd} position={view.presentedTimestamp} index={view.currentReviewIndex} length={view.reviewLength}
      onPlay={() => void workspace.togglePlayback()} onSpeed={workspace.changePlaybackSpeed}
      onSeekIndex={workspace.seekReviewIndex} onStep={workspace.stepReview} />
  );
  function openMedia(file?: File) {
    if (!file) return;
    viewport.reset();
    setImageTransform(INITIAL_VIDEO_TRANSFORM);
    void workspace?.openFile(file);
  }
  return <main className="video-recon-page">
    <header className="video-recon-heading">
      <div className="video-recon-title">
        <PageHeading backHref="/recon">{title}</PageHeading>
        {detector && <Link href="/video-recon-about" className="video-recon-title-help"
          aria-label={t('视频复盘说明', 'Video Reconstruction Guide')}>
          <HelpCircle size={18} strokeWidth={1.75} aria-hidden />
        </Link>}
      </div>
      <div className="video-recon-modes" role="group" aria-label={t('复盘工具', 'Reconstruction tools')}>
        <button type="button" className="btn-secondary" aria-pressed={detector} disabled={view?.timerBusy}
          onClick={() => void setMode('detector')}><Film size={17} aria-hidden />{detectorLabel}</button>
        <button type="button" className="btn-secondary" aria-pressed={!detector} disabled={view?.timerBusy}
          onClick={() => void setMode('timer')}><Camera size={17} aria-hidden />{timerLabel}</button>
      </div>
      <HeaderToggles />
    </header>
    <div className={showResults ? 'video-recon-columns video-recon-results' : !detector ? 'video-recon-columns video-recon-camera-layout' : undefined}>
      <section className="video-recon-panel video-recon-source-panel" data-site-surface="panel" aria-label={detector ? detectorLabel : timerLabel}>
        <div className="video-recon-section-heading">
          <h2>{detector ? t('源画面', 'Source') : t('摄像头画面', 'Camera preview')}</h2>
          {detector && view?.sourceName && <span className="video-recon-file-name" dir="auto">{view.sourceName}</span>}
          {cameraConnected && workspace && <button type="button" className="btn-secondary" disabled={view.timerBusy} onClick={workspace.stopSource}>
            <Unplug size={16} aria-hidden />{t('断开摄像头', 'Disconnect camera')}
          </button>}
        </div>
        <div className="video-recon-stage" data-dragging={dragOver} onDragOver={event => {
          if (!detector) return;
          event.preventDefault();
          setDragOver(true);
        }} onDragLeave={() => setDragOver(false)} onDrop={event => {
          if (!detector) return;
          event.preventDefault();
          setDragOver(false);
          openMedia(event.dataTransfer.files[0]);
        }}>
          <div ref={viewportRef} className="video-recon-source-viewport"
            hidden={!view || view.sourceKind === 'none' || showCamera} data-zoomed={viewport.zoomed}
            style={viewport.style} {...viewport.interaction}>
            <canvas ref={stage} style={fileSelected ? { transform: videoImageTransformCss(imageTransform) } : undefined}
              aria-label={t('检测后的源画面', 'Processed source frame')} />
          </div>
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
        {detector && workspace && view && view.sourceKind !== 'none' && <div className="video-recon-actions">
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <Upload size={16} aria-hidden />{t('更换', 'Replace')}
          </button>
          {fileSelected && <VideoImageTools transform={imageTransform} onTransform={setImageTransform}
            cropDisabled={view.cropLocked || view.cropLoading || !fileCanCrop} onCrop={() => void workspace.editCrop()} />}
          {reviewing && <button type="button" className="btn-secondary" onClick={() => void workspace.editSolveRange()}>
            {t('调整还原区间', 'Adjust solve range')}
          </button>}
        </div>}
        {renderReviewControls(t('视频播放控件', 'Video playback controls'))}
        {workspace && view?.trimming && <SolveRange view={view} workspace={workspace} />}
        {view?.status === 'loading' && <VideoReconProgress
          label={downloading ? t('正在下载识别模型', 'Downloading detector models')
            : downloadProgress === 100 ? t('正在初始化识别模型', 'Initializing detector models')
              : t('正在准备识别模型', 'Preparing detector models')}
          value={downloading ? downloadProgress : undefined} detail={downloadSize} />}
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
      </section>
      {showResults && view && <ProjectedCube live={pendingResult}
        pose={pendingResult ? liveResult?.cube?.pose : view.coloredProjection} sourceTimestamp={resultTime}
        solved={view.cubeSolved} steps={shownSteps}
        timeline={view.projectedTimeline}
        sourceFrame={liveResult?.cube?.frame ?? (reviewing ? view.result?.fittedPose?.sourceFrame : undefined) ?? Math.round(resultTime * view.sourceFps)}
        sourceFps={view.sourceFps} playbackSpeed={view.running ? view.playbackSpeed : 1}
        controls={renderReviewControls(t('实况魔方播放控件', 'Tracked cube playback controls'))}
        analysis={reviewing && workspace && view.reconstructedScramble && measured && searchSteps.some(step => step.state_moves.length)
          ? { scramble:view.reconstructedScramble, steps:searchSteps, measured,
            fps:view.sourceFps, start:view.solveStart, end:view.solveEnd, position:view.presentedTimestamp,
            onSeek:timestamp => void workspace.requestReview(timestamp) }
          : undefined} />}
      {workspace && view && showResults && <TpsGraph compact pending={pendingResult && resultTime <= view.solveStart}
        live={pendingResult} steps={shownSteps}
        fps={view.sourceFps} start={view.solveStart} end={view.solveEnd} cursor={resultTime} complete={reviewing && view.cubeSolved}
        onSeek={reviewing ? timestamp => void workspace.requestReview(timestamp) : undefined} />}
      {workspace && view && <CameraTimer active={!detector} workspace={workspace} view={view} />}
    </div>
    {workspace && view?.cropPreview && <SourceCropDialog key={view.cropPreview.url} {...view.cropPreview} initial={view.sourceCrop}
      onApply={crop => void workspace.applyCrop(crop)} onCancel={workspace.closeCrop} />}
    <input ref={fileInput} type="file" accept="image/*,video/*" aria-label={t('视频或图片', 'Video or image')} hidden
      onChange={event => {
        openMedia(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }} />
  </main>;
}
