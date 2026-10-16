import { renderTimerScrambleSvg } from '@cuberoot/timer-ui/scramble-preview';

/** watchOS displays a raster image; the existing phone renderer owns puzzle state. */
export async function watchTimerPreview(event: string, scramble: string): Promise<string | undefined> {
  const svg = await renderTimerScrambleSvg(event, scramble);
  if (!svg) return undefined;
  const source = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const viewBox = source.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
  const aspect = viewBox && viewBox[2] > 0 && viewBox[3] > 0 ? viewBox[2] / viewBox[3] : 4 / 3;
  const width = 480;
  source.setAttribute('width', String(width)); source.setAttribute('height', String(Math.round(width / aspect)));
  source.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Watch preview timed out')), 5000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Watch preview failed')); };
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    // Preserve Retina detail. Transport shrinks the batch, never the picture.
    canvas.width = width; canvas.height = Math.max(1, Math.round(width / aspect));
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}
