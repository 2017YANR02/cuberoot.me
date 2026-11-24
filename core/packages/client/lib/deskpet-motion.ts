export const GENERIC_ENTER_MS = 450;

/** Reveal after being shown again. A clip carries its own motion. */
export function enterKeyframes(clip: boolean): Keyframe[] {
  return clip
    ? [{ offset: 0, opacity: 0 }, { offset: .16, opacity: 1 }, { offset: 1, opacity: 1 }]
    : [
      { offset: 0, opacity: 0, transform: 'translateY(10%) scale(.92)' },
      { offset: .6, opacity: 1, transform: 'translateY(-2%) scale(1.02)' },
      { offset: 1, opacity: 1, transform: 'none' },
    ];
}

const frames = new Map<string, Promise<Blob>>();
/**
 * Bytes for a one-shot frame, fetched once per page. Each play wraps them in
 * a new object URL so the SVG timeline starts from its first frame instead of
 * sharing an image that has already finished.
 */
export function loadMotionBlob(url: string) {
  let blob = frames.get(url);
  if (!blob) {
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error('Desk pet frame unavailable');
      return response.blob();
    });
    frames.set(url, request);
    request.catch(() => { if (frames.get(url) === request) frames.delete(url); });
    blob = request;
  }
  return blob;
}
