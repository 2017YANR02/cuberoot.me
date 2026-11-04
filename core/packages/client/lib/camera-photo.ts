/** Capture the complete, unmirrored preview frame at the photo pipeline's input size. */
export async function captureCameraPhoto(video: HTMLVideoElement): Promise<File> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('CameraNotReady');
  const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CanvasUnavailable');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (!blob) throw new Error('CaptureFailed');
  return new File([blob], 'cube-photo.jpg', { type: blob.type });
}
