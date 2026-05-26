import { jsPDF } from 'jspdf';
import type { PaletteColor, PdfConfig, RGB } from '../state/types';
import { buildColorLookup } from '../engine/palette';

const PT2MM = 25.4 / 72;
const FONT_FACE = 'helvetica';
const FONT_MONO = 'courier';

interface Rect { x: number; y: number; width: number; height: number; }

interface GenerateArgs {
  mosaic: ImageData;          // final pixel-wise mosaic (width = pixelWidth)
  miniatureDataUrl: string;   // dataURL of the stickered preview canvas (for title + per-page miniature)
  cubeDimen: number;          // 1 = pixel art, 3 = 3x3x3 cubes
  palette: PaletteColor[];    // full palette (for color names/letters)
  config: PdfConfig;
  fileName: string;           // source file name, no extension
  onProgress?: (progress: number) => void;   // 0..1
}

export async function generatePdf(args: GenerateArgs): Promise<void> {
  const { mosaic, miniatureDataUrl, cubeDimen, palette, config, fileName, onProgress } = args;
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = pageW * 0.07;

  const areaBlock = blockArea(pageW, pageH, margin);
  const areaMini = miniatureArea(pageW, pageH, margin, mosaic.width, mosaic.height);
  const lookup = buildColorLookup(palette);

  const blocksW = Math.ceil(mosaic.width / cubeDimen / config.blockWidthCubes);
  const blocksH = Math.ceil(mosaic.height / cubeDimen / config.blockHeightCubes);

  drawTitlePage(doc, mosaic, cubeDimen, config, titlePicArea(pageW, pageH, margin));
  doc.setFont(FONT_FACE);
  drawHeader(doc, mosaic, cubeDimen, titleHeaderArea(pageW, pageH, margin));
  drawFooter(doc, mosaic, cubeDimen, palette, titleFooterArea(pageW, pageH, margin));

  const start = config.bottomToTop ? blocksH - 1 : 0;
  const end = config.bottomToTop ? -1 : blocksH;
  const inc = config.bottomToTop ? -1 : 1;

  const total = blocksW * blocksH;
  let done = 0;

  for (let bi = start; bi !== end; bi += inc) {
    for (let bj = 0; bj < blocksW; bj++) {
      doc.addPage();
      doc.setTextColor(0);
      doc.addImage(miniatureDataUrl, 'PNG', areaMini.mini.x, areaMini.mini.y, areaMini.mini.width, areaMini.mini.height);
      doc.setLineWidth(0.5);
      doc.setDrawColor(200);
      doc.rect(areaMini.mini.x, areaMini.mini.y, areaMini.mini.width, areaMini.mini.height, 'D');
      drawMiniRect(doc, bi, bj, config, cubeDimen, mosaic, areaMini.mini);
      const name = blockName(bi, bj, blocksH);
      drawTextInRect(doc, name.name, false, areaMini.blockName.x, areaMini.blockName.y, areaMini.blockName.width, areaMini.blockName.height);
      drawBlock(doc, bi, bj, cubeDimen, config, mosaic, lookup, areaBlock);

      done++;
      onProgress?.(done / total);
      // Yield to UI every row
      if (bj === blocksW - 1) await new Promise(r => setTimeout(r, 0));
    }
  }

  doc.save(`Mosaic ${fileName} ${dateStr()}.pdf`);
}

function dateStr() {
  const t = new Date();
  return `${t.getDate()}-${t.getMonth() + 1}-${t.getFullYear()}`;
}

function blockName(row: number, col: number, blocksH: number) {
  const letter = String.fromCharCode(65 + col);
  const number = String(blocksH - row);
  return { row: number, column: letter, name: letter + number };
}

function drawBlock(
  doc: jsPDF,
  bi: number, bj: number,
  cubeDimen: number,
  config: PdfConfig,
  mosaic: ImageData,
  lookup: ReturnType<typeof buildColorLookup>,
  rect: Rect,
) {
  const stickerSize = Math.min(
    rect.width / cubeDimen / config.blockWidthCubes,
    rect.height / cubeDimen / config.blockHeightCubes,
  );
  const cubeSize = cubeDimen * stickerSize;
  const d = mosaic.data;

  for (let ci = 0; ci < config.blockHeightCubes; ci++) {
    for (let cj = 0; cj < config.blockWidthCubes; cj++) {
      const cubePosX = rect.x + cj * cubeSize;
      const cubePosY = rect.y + ci * cubeSize;
      const cubeX = bj * config.blockWidthCubes * cubeDimen + cj * cubeDimen;
      const cubeY = bi * config.blockHeightCubes * cubeDimen + ci * cubeDimen;

      doc.setLineWidth(1);
      doc.setDrawColor(100);

      for (let si = 0; si < cubeDimen; si++) {
        for (let sj = 0; sj < cubeDimen; sj++) {
          const x = cubeX + sj;
          const y = cubeY + si;
          if (x >= mosaic.width || y >= mosaic.height) continue;
          const idx = (x + y * mosaic.width) * 4;
          const rgb: RGB = [d[idx], d[idx + 1], d[idx + 2]];

          if (config.bwPrinter) doc.setFillColor(255, 255, 255);
          else doc.setFillColor(rgb[0], rgb[1], rgb[2]);

          doc.rect(cubePosX + sj * stickerSize, cubePosY + si * stickerSize, stickerSize, stickerSize, 'FD');

          if (config.drawLetters) {
            const bgDark = rgb[0] + rgb[1] + rgb[2] < 128;
            let letterRgb: RGB;
            if (config.bwPrinter) {
              const v = bgDark ? 255 : 0;
              letterRgb = [v, v, v];
            } else {
              const add = 30;
              const delta = bgDark ? add : -add;
              letterRgb = [
                clamp(rgb[0] + delta, 0, 255),
                clamp(rgb[1] + delta, 0, 255),
                clamp(rgb[2] + delta, 0, 255),
              ];
            }
            const pad = stickerSize / 10;
            doc.setTextColor(letterRgb[0], letterRgb[1], letterRgb[2]);
            drawTextInRect(
              doc, lookup.letter(rgb), true,
              cubePosX + sj * stickerSize + pad,
              cubePosY + si * stickerSize + pad,
              stickerSize - 2 * pad, stickerSize - 2 * pad,
            );
          }
        }
      }

      if (cubeDimen > 1 && cubeX < mosaic.width && cubeY < mosaic.height) {
        doc.setDrawColor(0);
        doc.setLineWidth(2);
        doc.rect(cubePosX, cubePosY, cubeSize, cubeSize, 'D');
      }
    }
  }
}

function drawMiniRect(doc: jsPDF, bi: number, bj: number, config: PdfConfig, cubeDimen: number, mosaic: ImageData, areaMini: Rect) {
  const pxSize = areaMini.width / mosaic.width;
  const bw = config.blockWidthCubes * cubeDimen * pxSize;
  const bh = config.blockHeightCubes * cubeDimen * pxSize;
  doc.setDrawColor(255);
  doc.setLineWidth(2);
  doc.rect(areaMini.x + bj * bw, areaMini.y + bi * bh, bw, bh, 'D');
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(areaMini.x + bj * bw, areaMini.y + bi * bh, bw, bh, 'D');
}

function drawTitlePage(doc: jsPDF, mosaic: ImageData, cubeDimen: number, config: PdfConfig, rect: Rect) {
  const lettersMargin = rect.width * 0.1;
  const inner: Rect = {
    x: rect.x + lettersMargin,
    y: rect.y + lettersMargin,
    width: rect.width - 2 * lettersMargin,
    height: rect.height - 2 * lettersMargin,
  };
  const stickerSize = Math.min(inner.width / mosaic.width, inner.height / mosaic.height);
  const ehs = inner.width - stickerSize * mosaic.width;
  const evs = inner.height - stickerSize * mosaic.height;
  inner.x += ehs / 2;
  inner.width -= ehs;
  inner.y += evs / 2;
  inner.height -= evs;

  doc.setLineWidth(stickerSize / 20);
  doc.setDrawColor(150);
  const d = mosaic.data;
  for (let i = 0; i < mosaic.height; i++) {
    for (let j = 0; j < mosaic.width; j++) {
      const idx = (j + i * mosaic.width) * 4;
      doc.setFillColor(d[idx], d[idx + 1], d[idx + 2]);
      doc.rect(inner.x + j * stickerSize, inner.y + i * stickerSize, stickerSize, stickerSize, 'FD');
    }
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.setFont(FONT_MONO);
  const bwPx = config.blockWidthCubes * cubeDimen;
  const bhPx = config.blockHeightCubes * cubeDimen;
  const blocksH = Math.ceil(mosaic.height / bhPx);
  for (let px = 0; px <= mosaic.width; px += bwPx) {
    const lx = inner.x + px * stickerSize;
    doc.line(lx, rect.y, lx, rect.y + rect.height);
    if (px < mosaic.width) {
      const t = blockName(0, px / bwPx, blocksH).column;
      drawTextInRect(doc, t, true, lx, inner.y - lettersMargin * 1.1, bwPx * stickerSize, lettersMargin * 0.9);
      drawTextInRect(doc, t, true, lx, inner.y + inner.height, bwPx * stickerSize, lettersMargin * 0.9);
    }
  }
  for (let py = 0; py <= mosaic.height; py += bhPx) {
    const ly = inner.y + py * stickerSize;
    doc.line(rect.x, ly, rect.x + rect.width, ly);
    if (py < mosaic.height) {
      const t = blockName(py / bhPx, 0, blocksH).row;
      const fontSize = 20;
      doc.setFontSize(fontSize);
      const th = fontSize * PT2MM;
      doc.text(t, inner.x - th * (0.5 + t.length * 0.5), ly + th);
      doc.text(t, inner.x + inner.width + th / 6, ly + th);
    }
  }
}

function drawTextInRect(doc: jsPDF, text: string, centered: boolean, x: number, y: number, rectW: number, rectH: number) {
  let textSize = Math.ceil(rectH / PT2MM);
  const oldSize = textSize;
  let realW = Infinity;
  do {
    textSize--;
    if (textSize <= 0) break;
    doc.setFontSize(textSize);
    realW = doc.getStringUnitWidth(text) * textSize * PT2MM;
  } while (realW > rectW);

  if (centered) x -= (realW - rectW) / 2;
  y += (textSize + (oldSize - textSize) / 2) * PT2MM;
  doc.text(text, x, y);
}

function drawTextInMidRect(doc: jsPDF, text: string, rect: Rect, fontSize: number) {
  doc.setFontSize(fontSize);
  let unitW = 0;
  for (const line of text.split('\n')) {
    const w = doc.getStringUnitWidth(line);
    if (w > unitW) unitW = w;
  }
  const realW = unitW * fontSize * PT2MM;
  const x = rect.x + (rect.width - realW) / 2;
  const y = rect.y + rect.height / 2;
  doc.text(text, x, y);
}

function drawHeader(doc: jsPDF, mosaic: ImageData, cubeDimen: number, rect: Rect) {
  const cw = mosaic.width / cubeDimen;
  const ch = mosaic.height / cubeDimen;
  const text = `${cw}x${ch} = ${cw * ch}${cubeDimen === 1 ? ' pixels' : ' cubes'}`;
  drawTextInMidRect(doc, text, rect, 26);
}

function drawFooter(doc: jsPDF, mosaic: ImageData, cubeDimen: number, palette: PaletteColor[], rect: Rect) {
  const text = nearlySolvedText(mosaic, cubeDimen, palette) + 'Made with Rubik\'s cube mosaic tool';
  drawTextInMidRect(doc, text, rect, 12);
}

function nearlySolvedText(mosaic: ImageData, cubeDimen: number, palette: PaletteColor[]): string {
  if (cubeDimen < 1) return '';
  const fill = cubeDimen * cubeDimen;
  const allCubes = new Map<string, number>();
  const lookup = buildColorLookup(palette);
  const d = mosaic.data;
  const w = mosaic.width, h = mosaic.height;
  for (let i = 0; i < w; i += cubeDimen) {
    for (let j = 0; j < h; j += cubeDimen) {
      const cols = new Map<string, number>();
      for (let pi = i; pi < i + cubeDimen; pi++) {
        for (let pj = j; pj < j + cubeDimen; pj++) {
          if (pi >= w || pj >= h) continue;
          const idx = (pi + pj * w) * 4;
          const key = `${d[idx]};${d[idx + 1]};${d[idx + 2]}`;
          cols.set(key, (cols.get(key) ?? 0) + 1);
        }
      }
      cols.forEach((count, key) => {
        if (count >= fill - 2) {
          const [r, g, b] = key.split(';').map(Number) as RGB;
          const name = lookup.name([r, g, b]);
          allCubes.set(name, (allCubes.get(name) ?? 0) + 1);
        }
      });
    }
  }
  if (allCubes.size === 0) return '';
  const parts: string[] = [];
  allCubes.forEach((n, name) => parts.push(`${n} ${name}`));
  const prefix = cubeDimen === 1 ? 'Pixels: ' : 'Solved (or almost solved) cubes: ';
  return prefix + parts.join(', ') + '.\n';
}

// Area calculators (mirror source)
function blockArea(pageW: number, pageH: number, margin: number): Rect {
  const heightNoMargin = pageH - 2 * margin;
  const splitCoeff = 0.3;
  return {
    x: margin,
    y: margin + splitCoeff * heightNoMargin,
    width: pageW - 2 * margin,
    height: heightNoMargin * (1 - splitCoeff),
  };
}

function titlePicArea(pageW: number, pageH: number, margin: number): Rect {
  const topCoeff = 0.15;
  const heightNoMargin = pageH - 2 * margin;
  return {
    x: margin,
    y: margin + topCoeff * heightNoMargin,
    width: pageW - 2 * margin,
    height: pageH - 2 * margin - 2 * topCoeff * heightNoMargin,
  };
}

function titleHeaderArea(pageW: number, pageH: number, margin: number): Rect {
  const heightNoMargin = pageH - 2 * margin;
  return { x: margin, y: margin, width: pageW - 2 * margin, height: 0.15 * heightNoMargin * 0.9 };
}

function titleFooterArea(pageW: number, pageH: number, margin: number): Rect {
  const heightNoMargin = pageH - 2 * margin;
  const footerH = 0.15 * heightNoMargin * 0.9;
  return { x: margin, y: pageH - margin - footerH, width: pageW - 2 * margin, height: footerH };
}

function miniatureArea(pageW: number, pageH: number, margin: number, pixW: number, pixH: number) {
  const heightWoMargin = pageH - 2 * margin;
  const splitCoeff = 0.3;
  const allowedW = (pageW - 2 * margin) * 0.5;
  const allowedH = splitCoeff * heightWoMargin * 0.95;
  const calcW = allowedH / pixH * pixW;
  const calcH = allowedW / pixW * pixH;
  let mini: Rect = { x: margin, y: margin, width: allowedW, height: calcH };
  if (calcH > allowedH) mini = { x: margin, y: margin, width: calcW, height: allowedH };
  const blockName: Rect = { x: margin + mini.width, y: margin, width: allowedW, height: allowedH };
  return { mini, blockName };
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
