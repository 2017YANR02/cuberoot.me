export interface SimulatedVideoCamera {
  stream: MediaStream;
  name: string;
  play(): Promise<void>;
  rewind(): void;
  close(): void;
}

/** A local file supplies a regular camera track. Keep sending the first and
 * last frames while paused so the timer can capture its opening and tail. */
export async function openSimulatedVideoCamera(file: File, onEnded: () => void, signal: AbortSignal): Promise<SimulatedVideoCamera> {
  signal.throwIfAborted();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.captureStream !== 'function') {
    throw new Error('This browser does not support a simulated camera.');
  }
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  let stream: MediaStream | undefined;
  let frameTimer: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    clearInterval(frameTimer);
    stream?.getTracks().forEach(track => track.stop());
    video.removeEventListener('ended', onEnded);
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => complete(signal.reason);
      const loaded = () => complete();
      const failed = () => complete(new Error('This browser cannot play this video. Try an H.264 MP4.'));
      function complete(error?: unknown) {
        signal.removeEventListener('abort', abort);
        video.removeEventListener('loadeddata', loaded);
        video.removeEventListener('error', failed);
        if (error !== undefined) reject(error);
        else resolve();
      }
      signal.addEventListener('abort', abort, { once: true });
      video.addEventListener('loadeddata', loaded, { once: true });
      video.addEventListener('error', failed, { once: true });
      video.src = url;
    });
    signal.throwIfAborted();
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('The file does not contain a playable video.');
    }
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const fps = 30;
    const draw = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) context.drawImage(video, 0, 0, canvas.width, canvas.height);
    };
    stream = canvas.captureStream(fps);
    draw();
    frameTimer = setInterval(draw, 1000 / fps);
    video.addEventListener('ended', onEnded);
    return {
      stream,
      name: file.name,
      play: () => video.play(),
      rewind() { video.pause(); video.currentTime = 0; },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
import type { VideoWorkspace } from '../workspace';
import type { TimerReconstructionResult } from './cube-timer';


/** Same file-decoding and reconstruction path used to recover a live recording. */
export async function reviewSimulationFile(id: string, file: File, signal: AbortSignal,
  onWorkspace: (workspace: VideoWorkspace) => void): Promise<TimerReconstructionResult | undefined> {
  const { createVideoWorkspace } = await import('../workspace');
  signal.throwIfAborted();
  const workspace = createVideoWorkspace(document.createElement('canvas'), 'record');
  try {
    return await new Promise((resolve, reject) => {
      const abort = () => { dispose(); reject(signal.reason); };
      const stop = workspace.subscribe(() => {
        const view = workspace.getSnapshot();
        if (view.cameraRecordingPhase === 'complete') {
          dispose(); resolve(view.cameraRecordingResult);
        } else if ((!view.recordingReview && view.cameraRecordingPhase === 'error') || view.recordingReview === 'range') {
          dispose(); resolve(undefined);
        }
      });
      function dispose() {
        stop();
        signal.removeEventListener('abort', abort);
      }
      signal.addEventListener('abort', abort, { once: true });
      onWorkspace(workspace);
      workspace.reviewSimulatedCameraFile(id, file);
      void workspace.loadModel();
    });
  } finally {
    workspace.cleanup();
  }
}
