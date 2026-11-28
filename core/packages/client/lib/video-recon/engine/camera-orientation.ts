import { drawOrientedFrame, orientedDimensions, type VideoRotation } from '../../video-tools/orientation';

const edge = 12;
const rotations: VideoRotation[] = [0, 90, 180, 270];

function sensorPixel(rotation: VideoRotation, x: number, y: number) {
  switch (rotation) {
    case 90: return (edge - 1 - x) * edge + y;
    case 180: return (edge - 1 - y) * edge + edge - 1 - x;
    case 270: return x * edge + edge - 1 - y;
    default: return y * edge + x;
  }
}

// Compare two small square thumbnails of the same camera. On iOS the video
// element applies the lens orientation even when the track processor exposes
// sensor pixels with no rotation metadata. Width and height alone cannot
// distinguish left from right, or upright from upside down.
export function matchCameraRotation(raw: Uint8ClampedArray, reference: Uint8ClampedArray): VideoRotation | undefined {
  const scores = rotations.map(rotation => {
    let error = 0;
    for (let y = 0; y < edge; y++) {
      for (let x = 0; x < edge; x++) {
        const a = sensorPixel(rotation, x, y) * 4;
        const b = (y * edge + x) * 4;
        for (let channel = 0; channel < 3; channel++) error += Math.abs(raw[a + channel] - reference[b + channel]);
      }
    }
    return { rotation, error: error / (edge * edge * 3) };
  }).sort((a, b) => a.error - b.error);
  const [best, next] = scores;
  if (best.error < 36 && best.error + 2 < next.error * 0.8) return best.rotation;
}

export function createCameraOrientation(track: MediaStreamTrack) {
  if (typeof OffscreenCanvas === 'undefined' || !/iPhone|iPad|iPod|Macintosh.*Mobile\//i.test(navigator.userAgent)) return;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  void video.play().catch(() => {});
  const sample = new OffscreenCanvas(edge * 2, edge).getContext('2d', { willReadFrequently: true });
  const output = new OffscreenCanvas(1, 1);
  const painter = output.getContext('2d');
  let rotation: VideoRotation = 0;
  let geometry = '';
  let nextCheck = 0;
  return {
    orient(frame: ImageBitmap) {
      const now = performance.now();
      const current = [screen.orientation?.angle, video.videoWidth, video.videoHeight, frame.width, frame.height].join('/');
      if (sample && video.videoWidth && video.videoHeight && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && (current !== geometry || now >= nextCheck)) {
        geometry = current;
        sample.drawImage(frame, 0, 0, edge, edge);
        sample.drawImage(video, edge, 0, edge, edge);
        const match = matchCameraRotation(sample.getImageData(0, 0, edge, edge).data, sample.getImageData(edge, 0, edge, edge).data);
        if (match !== undefined) rotation = match;
        nextCheck = now + (match === undefined ? 200 : 1000);
      }
      if (!rotation || !painter) return frame;
      const { width, height } = orientedDimensions(frame.width, frame.height, rotation);
      if (output.width !== width) output.width = width;
      if (output.height !== height) output.height = height;
      drawOrientedFrame(painter, frame, frame.width, frame.height, rotation);
      frame.close();
      return output.transferToImageBitmap();
    },
    close() {
      video.pause();
      video.srcObject = null;
    },
  };
}
