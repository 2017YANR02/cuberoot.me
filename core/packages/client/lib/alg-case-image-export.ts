import { algCaseSvg } from './alg_pdf/case_svg';
import { saveBlob, svgBlob, svgToRasterBlob } from './puzzle-image/image-export';
import { imageFilename, type CaseImage } from './alg-case-images';

export interface CaseImageExportOptions {
  format: 'png' | 'svg';
  background: 'transparent' | 'white';
  size: number;
  zip: boolean;
  filename: string;
  signal: AbortSignal;
  onProgress(done: number, total: number): void;
}

/** Give standalone SVGs intrinsic dimensions and preserve their native aspect ratio. */
export function prepareCaseSvg(source: string, size: number, background: 'transparent' | 'white') {
  // Standalone files cannot inherit website CSS variables (notably SQ1 shape diagrams).
  const style = getComputedStyle(document.documentElement);
  const resolved = source.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g,
    (_, token: string, fallback: string | undefined) => style.getPropertyValue(token).trim() || fallback || 'currentColor');
  const doc = new DOMParser().parseFromString(resolved, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Invalid SVG');
  const vb = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const w = vb?.[2] ?? parseFloat(svg.getAttribute('width') || '160');
  const h = vb?.[3] ?? parseFloat(svg.getAttribute('height') || '160');
  if (!(w > 0 && h > 0 && Number.isFinite(w + h))) throw new Error('Invalid SVG dimensions');
  const width = Math.max(1, Math.round(size * w / Math.max(w, h)));
  const height = Math.max(1, Math.round(size * h / Math.max(w, h)));
  if (!vb) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('color', style.color);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  if (background === 'white') {
    // Export paper colour, independent of the website theme; this is not cube geometry.
    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(vb?.[0] ?? 0));
    rect.setAttribute('y', String(vb?.[1] ?? 0));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', 'white');
    svg.prepend(rect);
  }
  return { svg: new XMLSerializer().serializeToString(svg), width, height };
}

export async function downloadCaseImages(images: CaseImage[], options: CaseImageExportOptions) {
  const { signal } = options;
  const failures: string[] = [];
  const files: Record<string, Uint8Array> = Object.create(null);
  const used = new Set<string>();
  let downloaded = 0;
  for (const [index, image] of images.entries()) {
    signal.throwIfAborted();
    try {
      const source = await algCaseSvg(image.input);
      signal.throwIfAborted();
      if (!source) throw new Error('No image available');
      const prepared = prepareCaseSvg(source, options.size, options.background);
      const blob = options.format === 'svg' ? svgBlob(prepared.svg)
        : await svgToRasterBlob(prepared.svg, prepared);
      signal.throwIfAborted();
      const stem = imageFilename(image.name);
      let name = `${stem}.${options.format}`;
      for (let suffix = 2; used.has(name.toLowerCase()); suffix++) name = `${stem}-${suffix}.${options.format}`;
      used.add(name.toLowerCase());
      if (options.zip) files[name] = new Uint8Array(await blob.arrayBuffer());
      else saveBlob(blob, name);
      downloaded++;
    } catch (error) {
      signal.throwIfAborted();
      failures.push(image.name);
      console.error('[alg] image export failed', image.name, error);
    }
    options.onProgress(index + 1, images.length);
    // Yield between images so progress, close and cancel remain responsive.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  if (options.zip && downloaded) {
    const { zip } = await import('fflate');
    const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      const abort = () => { terminate(); reject(signal.reason); };
      const terminate = zip(files, { level: 0 }, (error, data) => {
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(data as Uint8Array<ArrayBuffer>);
      });
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    signal.throwIfAborted();
    saveBlob(new Blob([bytes], { type: 'application/zip' }), `${imageFilename(options.filename)}.zip`);
  }
  return { downloaded, failures };
}
