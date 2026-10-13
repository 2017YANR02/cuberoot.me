import { renderScramblePreviewSvg } from '@/components/scramble-preview-svg';
import { svgToRasterBlob, saveBlob } from '@/lib/puzzle-image/image-export';

export interface ScrambleImageSheet {
  title: string;
  event: string;
  rows: { label: string; scramble: string | null; caption?: string }[];
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Export the existing batch, keeping raw algorithms for the canonical preview renderer.
 * Five rows per image bounds raster memory; large batches are downloaded as one ZIP.
 * White paper / black ink are export colours, independent of the site theme.
 */
export async function downloadScrambleImages(sheets: ScrambleImageSheet[], missing: string, progress: (done: number, total: number) => void): Promise<void> {
  const pages = sheets.flatMap(sheet => Array.from({ length: Math.ceil(sheet.rows.length / 5) }, (_, index) => ({ ...sheet, rows: sheet.rows.slice(index * 5, index * 5 + 5), page: index + 1 })));
  if (!pages.length) return;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas unavailable');
  await document.fonts.ready;
  function lines(text: string, width: number, font: string): string[] {
    measure!.font = font;
    const result: string[] = [];
    let line = '';
    // Character fallback also wraps long unspaced notation and Chinese titles.
    for (const word of text.split(/(\s+)/)) {
      if (word.includes('\n')) { result.push(line); line = ''; continue; }
      if (line && measure!.measureText(line + word).width > width) { result.push(line.trim()); line = ''; }
      for (const char of word) {
        if (line && measure!.measureText(line + char).width > width) { result.push(line.trim()); line = ''; }
        line += char;
      }
    }
    if (line.trim()) result.push(line.trim());
    return result;
  }
  const files: Record<string, Uint8Array> = {};
  for (let index = 0; index < pages.length; index++) {
    const sheet = pages[index];
    const title = lines(sheet.title, 960, 'bold 28px sans-serif');
    let y = 48 + title.length * 36;
    const parts = title.map((line, i) => `<text x="40" y="${48 + i * 36}" font-size="28" font-weight="bold">${escapeXml(line)}</text>`);
    for (const row of sheet.rows) {
      const text = lines(row.scramble || missing, 610, '22px monospace');
      const captions = lines(row.caption || '', 610, '18px sans-serif');
      const height = Math.max(170, 55 + text.length * 30 + captions.length * 25);
      parts.push(`<path d="M40 ${y} H1000" stroke="#ccc"/><text x="40" y="${y + 38}" font-size="22">${escapeXml(row.label)}</text>`);
      text.forEach((line, i) => parts.push(`<text x="95" y="${y + 38 + i * 30}" font-family="monospace" font-size="22">${escapeXml(line)}</text>`));
      captions.forEach((line, i) => parts.push(`<text x="95" y="${y + 48 + text.length * 30 + i * 25}" font-size="18">${escapeXml(line)}</text>`));
      const svg = row.scramble ? renderScramblePreviewSvg({ event: sheet.event, scramble: row.scramble }) : null;
      if (svg) {
        const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        parts.push(`<image x="740" y="${y + 12}" width="250" height="145" href="${escapeXml(encoded)}"/>`);
      }
      y += height;
    }
    parts.push(`<text x="40" y="${y + 32}" font-size="16">CubeRoot · ${sheet.page}</text>`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="${y + 60}" font-family="sans-serif" fill="black"><rect width="100%" height="100%" fill="white"/>${parts.join('')}</svg>`;
    const blob = await svgToRasterBlob(svg, { width: 1040, height: y + 60 });
    const filename = `${index + 1}-${sheet.title.replace(/[^\w\u3400-\u9fff-]+/g, '_').slice(0, 80)}.png`;
    if (pages.length === 1) saveBlob(blob, filename);
    else files[filename] = new Uint8Array(await blob.arrayBuffer());
    progress(index + 1, pages.length);
  }
  if (pages.length > 1) {
    const { zipSync } = await import('fflate');
    saveBlob(new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), 'cuberoot-scrambles.zip');
  }
}
