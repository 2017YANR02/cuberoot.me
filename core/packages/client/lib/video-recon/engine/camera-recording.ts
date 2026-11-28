export function startCameraRecording(stream: MediaStream) {
  const track = stream.getVideoTracks().find(track => track.readyState === 'live');
  if (!track) throw new Error('Camera video is unavailable.');
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser does not support camera recording.');

  const mimeType = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type));
  const { width, height } = track.getSettings();
  const pixels = (width ?? 0) * (height ?? 0);
  const videoBitsPerSecond = pixels >= 3840 * 2160 ? 40_000_000 : pixels >= 1920 * 1080 ? 10_000_000 : undefined;
  const recorder = new MediaRecorder(new MediaStream([track]), { mimeType, videoBitsPerSecond });
  const chunks: Blob[] = [];
  let stopRequested = false;
  let settle: (file: File) => void;
  let fail: (error: Error) => void;
  const result = new Promise<File>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // Browsers can end recording independently when the camera goes offline.
  // Keep that outcome available to stop() without an unhandled rejection.
  void result.catch(() => {});

  function detach() {
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
  }

  function discard(cause: unknown) {
    detach();
    chunks.length = 0;
    fail(cause instanceof Error ? cause : new Error('Camera recording failed.'));
  }

  function requestStop() {
    if (stopRequested || recorder.state === 'inactive') return;
    stopRequested = true;
    recorder.stop();
  }

  recorder.ondataavailable = event => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.onerror = () => discard(new Error('Camera recording failed.'));
  recorder.onstop = () => {
    detach();
    const type = (chunks[0]?.type || recorder.mimeType).split(';')[0];
    if (!chunks.length) {
      fail(new Error('The camera did not record any video.'));
      return;
    }
    const extension = type === 'video/mp4' ? 'mp4' : 'webm';
    const file = new File(chunks, `cube-camera-${Date.now()}.${extension}`, { type });
    chunks.length = 0;
    settle(file);
  };

  recorder.start(1000);
  return {
    result,
    stop() {
      try { requestStop(); }
      catch (cause) { discard(cause); }
      return result;
    },
    cancel() {
      discard(new DOMException('Camera recording was cancelled.', 'AbortError'));
      try { requestStop(); }
      catch { /* The browser no longer has an active recording to stop. */ }
    },
  };
}
