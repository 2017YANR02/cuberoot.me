export interface PdfChartPoint { date: string; value: number; label: string }

export interface RichTextNode {
  pdfChart?: PdfChartPoint[];
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string }>;
  content?: RichTextNode[];
}

export interface ExportSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
}

export interface ExportBlock {
  kind: 'paragraph' | 'heading' | 'code' | 'rule';
  segments: ExportSegment[];
  level: number;
  quote: boolean;
  list?: { type: 'bullet' | 'ordered'; depth: number; index: number };
}

const EMPTY_SEGMENT: Omit<ExportSegment, 'text'> = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
};

function segmentsFrom(node: RichTextNode, inherited: Omit<ExportSegment, 'text'> = EMPTY_SEGMENT): ExportSegment[] {
  const marks = new Set(node.marks?.map((mark) => mark.type).filter(Boolean));
  const style = {
    bold: inherited.bold || marks.has('bold'),
    italic: inherited.italic || marks.has('italic'),
    strike: inherited.strike || marks.has('strike'),
    code: inherited.code || marks.has('code'),
  };
  if (node.type === 'hardBreak') return [{ text: '\n', ...style }];
  if (typeof node.text === 'string') return [{ text: node.text, ...style }];
  return (node.content || []).flatMap((child) => segmentsFrom(child, style));
}

function blockFromNode(node: RichTextNode, quote: boolean): ExportBlock | null {
  if (node.type === 'horizontalRule') {
    return { kind: 'rule', segments: [], level: 0, quote };
  }
  if (!['paragraph', 'heading', 'codeBlock'].includes(node.type || '')) return null;
  const rawLevel = Number(node.attrs?.level);
  return {
    kind: node.type === 'heading' ? 'heading' : node.type === 'codeBlock' ? 'code' : 'paragraph',
    segments: segmentsFrom(node),
    level: node.type === 'heading' && Number.isFinite(rawLevel) ? Math.min(6, Math.max(1, rawLevel)) : 0,
    quote,
  };
}

function flattenList(node: RichTextNode, blocks: ExportBlock[], depth: number, quote: boolean): void {
  const type = node.type === 'orderedList' ? 'ordered' : 'bullet';
  (node.content || []).forEach((item, itemIndex) => {
    let markerPending = true;
    for (const child of item.content || []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        flattenList(child, blocks, depth + 1, quote);
        continue;
      }
      const childBlocks: ExportBlock[] = [];
      flattenNode(child, childBlocks, quote);
      childBlocks.forEach((block) => {
        if (markerPending && block.kind !== 'rule') {
          block.list = { type, depth, index: itemIndex + 1 };
          markerPending = false;
        }
        blocks.push(block);
      });
    }
    if (markerPending) {
      blocks.push({
        kind: 'paragraph', segments: [], level: 0, quote,
        list: { type, depth, index: itemIndex + 1 },
      });
    }
  });
}

function flattenNode(node: RichTextNode, blocks: ExportBlock[], quote = false): void {
  if (node.type === 'blockquote') {
    (node.content || []).forEach((child) => flattenNode(child, blocks, true));
    return;
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    flattenList(node, blocks, 0, quote);
    return;
  }
  const block = blockFromNode(node, quote);
  if (block) {
    blocks.push(block);
    return;
  }
  (node.content || []).forEach((child) => flattenNode(child, blocks, quote));
}

export function documentExportBlocks(document: RichTextNode): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  flattenNode(document, blocks);
  return blocks.length ? blocks : [{ kind: 'paragraph', segments: [], level: 0, quote: false }];
}

export function documentExportText(document: RichTextNode): string {
  return documentExportBlocks(document)
    .map((block) => block.segments.map((segment) => segment.text).join(''))
    .join('\n');
}

export function documentExportFilename(title: string, extension: 'docx' | 'pdf'): string {
  const stem = title
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120) || 'document';
  return `${stem}.${extension}`;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildDocumentDocx(title: string, document: RichTextNode): Promise<Blob> {
  const {
    AlignmentType, BorderStyle, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun,
  } = await import('docx');
  const blocks = documentExportBlocks(document);
  const font = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei', cs: 'Arial' };
  const headingLevels = [
    HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
  ];
  const headingSizes = [34, 30, 26, 24, 22, 21];
  const children = blocks.map((block) => {
    if (block.kind === 'rule') {
      return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9CDD4', space: 6 } },
        spacing: { before: 120, after: 120 },
      });
    }
    const runs = block.segments.length
      ? block.segments.flatMap((segment) => segment.text.split(/\r?\n/).map((text, index) => new TextRun({
        text,
        break: index > 0 ? 1 : undefined,
        bold: segment.bold || block.kind === 'heading',
        italics: segment.italic,
        strike: segment.strike,
        font: segment.code || block.kind === 'code'
          ? { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: 'Microsoft YaHei', cs: 'Consolas' }
          : font,
        size: block.kind === 'heading' ? headingSizes[block.level - 1] : 21,
      })))
      : [new TextRun({ text: '', font, size: 21 })];
    const listDepth = Math.min(8, block.list?.depth || 0);
    return new Paragraph({
      children: runs,
      heading: block.kind === 'heading' ? headingLevels[block.level - 1] : undefined,
      bullet: block.list?.type === 'bullet' ? { level: listDepth } : undefined,
      numbering: block.list?.type === 'ordered'
        ? { reference: 'document-numbering', level: listDepth }
        : undefined,
      indent: block.quote ? { left: 420 } : undefined,
      border: block.quote
        ? { left: { style: BorderStyle.SINGLE, size: 14, color: 'AEB4BE', space: 12 } }
        : undefined,
      shading: block.kind === 'code' ? { fill: 'F3F4F6' } : undefined,
      spacing: block.kind === 'heading'
        ? { before: 280, after: 100, line: 300 }
        : { before: 0, after: 120, line: 300 },
      keepNext: block.kind === 'heading',
      keepLines: block.kind === 'heading',
    });
  });
  const numberingLevels = Array.from({ length: 9 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
  }));
  const output = new Document({
    title,
    creator: 'CubeRoot',
    lastModifiedBy: 'CubeRoot',
    numbering: { config: [{ reference: 'document-numbering', levels: numberingLevels }] },
    sections: [{
      properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children,
    }],
  });
  return Packer.toBlob(output);
}

type PdfLineSegment = ExportSegment & { width: number };

type PdfBlock = ExportBlock | {kind:'table'; rows:ExportSegment[][][]} | {kind:'chart'; points:PdfChartPoint[]};
function pdfBlocks(node: RichTextNode): PdfBlock[] {
  if (node.type === 'doc') return (node.content ?? []).flatMap(pdfBlocks);
  if (node.type === 'table') return [{kind:'table', rows:(node.content ?? []).map(row => (row.content ?? []).map(cell => segmentsFrom(cell)))}];
  if (node.type === 'pdfChart') return [{kind:'chart', points:node.pdfChart ?? []}];
  return documentExportBlocks(node);
}

const NO_LINE_START = /^[，。！？、；：％‰）〕〉》」』】〗〙〛’”…,.;:!?%\)\]\}]/u;
const NO_LINE_END = /[（〔〈《「『【〖〘〚‘“\(\[\{]$/u;

/** Keep punctuation with its neighbour even across Markdown style boundaries. */
export function wrapDocumentPdfSegments(
  segments: ExportSegment[], maxWidth: number,
  measure: (text: string, segment: ExportSegment) => number,
): PdfLineSegment[][] {
  const groups: PdfLineSegment[][] = [];
  const segmenter = new Intl.Segmenter(undefined, {granularity:'grapheme'});
  for (const segment of segments) {
    // Separate punctuation from Latin words so an opening quote binds forwards.
    const tokens = segment.text.match(/\r?\n|[\u3400-\u9fff\uf900-\ufaff]|[\p{P}\p{S}]|[^\s\p{P}\p{S}\u3400-\u9fff\uf900-\ufaff]+|[ \t]+/gu) ?? [];
    for (const token of tokens) {
      const parts = measure(token, segment) > maxWidth
        ? Array.from(segmenter.segment(token), item => item.segment) : [token];
      for (const part of parts) {
        const previous = groups.at(-1);
        const tail = previous?.at(-1)?.text ?? '';
        const run = {...segment, text:part, width:measure(part, segment)};
        if (previous && !/\r?\n/.test(tail + part) && (NO_LINE_START.test(part) || NO_LINE_END.test(tail))) previous.push(run);
        else groups.push([run]);
      }
    }
  }
  const lines: PdfLineSegment[][] = [[]];
  let width = 0;
  for (const group of groups) {
    const value = group.map(run => run.text).join('');
    if (/^\r?\n$/.test(value)) { lines.push([]); width = 0; continue; }
    if (!width && /^[ \t]+$/.test(value)) continue;
    const groupWidth = group.reduce((sum, run) => sum + run.width, 0);
    if (width && width + groupWidth > maxWidth) { lines.push([]); width = 0; }
    for (const run of group) {
      const line = lines.at(-1)!;
      const last = line.at(-1);
      if (last && last.bold === run.bold && last.italic === run.italic && last.strike === run.strike && last.code === run.code) {
        last.text += run.text; last.width += run.width;
      } else line.push({...run});
    }
    width += groupWidth;
  }
  return lines;
}

export async function buildDocumentPdf(title: string, document: RichTextNode, options?: {brand?: boolean; subtitle?: string}): Promise<Blob> {
  const [{ jsPDF }, fonts] = await Promise.all([import('jspdf'), import('@/lib/pdf-fonts')]);
  // SVG integration extends jsPDF.API before each instance copies it.
  const branding = options?.brand ? await import('@/lib/pdf-logo') : null;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  await fonts.loadPdfFonts(pdf);
  const plainText = documentExportText(document);
  const useCjk = fonts.hasCjk(plainText);
  if (useCjk) await fonts.ensureCjkFont(pdf);
  const fontName = useCjk ? fonts.FONT_CJK : fonts.FONT_SANS;
  pdf.setProperties({ title, creator: 'CubeRoot' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 56;
  const bottom = 54;
  const top = options?.brand ? 110 : 58;
  let y = top;

  const setSegmentFont = (segment: Pick<ExportSegment, 'bold'> & {code?:boolean}, size: number) => {
    pdf.setFont(segment.code && !useCjk ? fonts.FONT_MONO : fontName, segment.bold && !segment.code ? 'bold' : 'normal');
    pdf.setFontSize(size);
  };
  const measure = (text: string, segment: ExportSegment, size: number) => {
    setSegmentFont(segment, size);
    return pdf.getTextWidth(text);
  };
  const wrap = (segments: ExportSegment[], size: number, maxWidth: number) =>
    wrapDocumentPdfSegments(segments, maxWidth, (text, segment) => measure(text, segment, size));
  const newPage = () => { pdf.addPage(); y = top; };

  for (const block of pdfBlocks(document)) {
    if (block.kind === 'table') {
      const columns = Math.max(0, ...block.rows.map(row => row.length));
      if (!columns) continue;
      const cellWidth = (pageWidth - margin * 2) / columns;
      const size = 9, lineHeight = 14, padding = 6;
      const prepared = block.rows.map(row => Array.from({length:columns}, (_, index) => wrap(row[index] ?? [], size, cellWidth - padding * 2)));
      const header = prepared[0];
      const rowHeight = (cells:PdfLineSegment[][][]) => Math.max(1, ...cells.map(cell => cell.length)) * lineHeight + padding * 2;
      const paint = (cells:PdfLineSegment[][][], headerRow:boolean) => {
        const height = rowHeight(cells);
        if (headerRow) {
          pdf.setFillColor(240, 243, 247);
          pdf.rect(margin, y, pageWidth - margin * 2, height, 'F');
        }
        cells.forEach((lines, column) => {
          lines.forEach((line, index) => {
            let x = margin + column * cellWidth + padding;
            for (const run of line) {
              setSegmentFont({...run, bold:headerRow || run.bold}, size);
              pdf.setTextColor(28, 30, 34);
              pdf.text(run.text, x, y + padding + size + index * lineHeight);
              x += run.width;
            }
          });
        });
        pdf.setDrawColor(220, 224, 230); pdf.setLineWidth(0.4);
        pdf.line(margin, y + height, pageWidth - margin, y + height);
        y += height;
      };
      const headerHeight = rowHeight(header);
      if (y + headerHeight + (prepared[1] ? Math.min(rowHeight(prepared[1]), 100) : 0) > pageHeight - bottom) newPage();
      paint(header, true);
      for (const cells of prepared.slice(1)) {
        if (y + rowHeight(cells) > pageHeight - bottom) { newPage(); paint(header, true); }
        // Split unusually tall rows without losing cells; repeat column headings.
        let offset = 0;
        const lineCount = Math.max(1, ...cells.map(cell => cell.length));
        while (offset < lineCount) {
          const capacity = Math.max(1, Math.floor((pageHeight - bottom - y - padding * 2) / lineHeight));
          const count = Math.min(capacity, lineCount - offset);
          paint(cells.map(cell => cell.slice(offset, offset + count)), false);
          offset += count;
          if (offset < lineCount) { newPage(); paint(header, true); }
        }
      }
      y += 14; continue;
    }
    if (block.kind === 'chart') {
      const points = block.points.filter(point => Number.isFinite(Date.parse(point.date)) && Number.isFinite(point.value)).slice().sort((a,b) => a.date.localeCompare(b.date));
      if (!points.length) continue;
      const height = 180;
      if (y + height + 30 > pageHeight - bottom) newPage();
      const left = margin + 50, right = pageWidth - margin - 10;
      const chartTop = y + 12, chartBottom = y + height - 20;
      const minX = Date.parse(points[0].date), maxX = Date.parse(points.at(-1)!.date);
      const byValue = points.slice().sort((a,b) => a.value - b.value);
      const min = byValue[0], max = byValue.at(-1)!;
      const range = max.value - min.value || Math.max(1, max.value * 0.1);
      const low = min.value - range * 0.08, high = max.value + range * 0.08;
      const x = (point:PdfChartPoint) => left + (maxX === minX ? 0.5 : (Date.parse(point.date) - minX) / (maxX - minX)) * (right - left);
      const positionY = (value:number) => chartBottom - (value - low) / (high - low) * (chartBottom - chartTop);
      pdf.setFont(fontName, 'normal'); pdf.setFontSize(8);
      for (const point of min === max ? [min] : [min,max]) {
        pdf.setDrawColor(222, 225, 230); pdf.setLineWidth(0.5);
        pdf.line(left, positionY(point.value), right, positionY(point.value));
        pdf.setTextColor(90, 95, 104); pdf.text(point.label, left - 8, positionY(point.value) + 3, {align:'right'});
      }
      pdf.text(points[0].date, left, chartBottom + 16);
      if (points[0].date !== points.at(-1)!.date) pdf.text(points.at(-1)!.date, right, chartBottom + 16, {align:'right'});
      pdf.setDrawColor(35, 105, 180); pdf.setFillColor(35, 105, 180); pdf.setLineWidth(1.2);
      points.forEach((point,index) => {
        if (index) pdf.line(x(points[index - 1]), positionY(points[index - 1].value), x(point), positionY(point.value));
        pdf.circle(x(point), positionY(point.value), 2, 'F');
      });
      y += height + 20; continue;
    }
    if (block.kind === 'rule') {
      if (y + 20 > pageHeight - bottom) newPage();
      pdf.setDrawColor(190, 194, 201);
      pdf.setLineWidth(0.7);
      pdf.line(margin, y + 4, pageWidth - margin, y + 4);
      y += 20;
      continue;
    }
    const size = block.kind === 'heading' ? [20, 16, 14, 12.5, 11.5, 10.5][block.level - 1] : 10.5;
    const lineHeight = size * (block.kind === 'heading' ? 1.35 : 1.55);
    const before = block.kind === 'heading' ? (block.level <= 2 ? 15 : 10) : 2;
    const after = block.kind === 'heading' ? 6 : 7;
    const listIndent = block.list ? 18 + Math.min(8, block.list.depth) * 18 : 0;
    const quoteIndent = block.quote ? 14 : 0;
    const x = margin + listIndent + quoteIndent;
    const prefix = block.list
      ? `${block.list.type === 'bullet' ? '•' : `${block.list.index}.`} `
      : '';
    const prefixSegment: ExportSegment = { text: prefix, ...EMPTY_SEGMENT };
    const segments = prefix ? [prefixSegment, ...block.segments] : block.segments;
    const styledSegments = segments.length ? segments.map((segment) => ({
      ...segment,
      bold: segment.bold || block.kind === 'heading',
      code: segment.code || block.kind === 'code',
    })) : [{ text: '', ...EMPTY_SEGMENT }];
    const lines = wrap(styledSegments, size, pageWidth - margin - x);
    if (y + before + lineHeight + (block.kind === 'heading' ? lineHeight : 0) > pageHeight - bottom) newPage();
    y += before;
    for (const line of lines) {
      if (y + lineHeight > pageHeight - bottom) newPage();
      if (block.quote) {
        pdf.setDrawColor(174, 180, 190);
        pdf.setLineWidth(1.5);
        pdf.line(margin + listIndent, y - size, margin + listIndent, y + lineHeight - size);
      }
      let cursor = x;
      for (const segment of line) {
        setSegmentFont(segment, size);
        if (segment.code) {
          pdf.setFillColor(242, 244, 247);
          pdf.rect(cursor - 1, y - size, segment.width + 2, lineHeight, 'F');
        }
        pdf.setTextColor(28, 30, 34);
        pdf.text(segment.text, cursor, y);
        if (segment.strike && segment.text) {
          pdf.setDrawColor(28, 30, 34);
          pdf.setLineWidth(0.5);
          pdf.line(cursor, y - size * 0.32, cursor + segment.width, y - size * 0.32);
        }
        cursor += segment.width;
      }
      y += lineHeight;
    }
    y += after;
  }
  if (options?.brand && branding) {
    const {loadPdfLogo, drawPdfLogo} = branding;
    const logo = await loadPdfLogo('mark');
    const count = pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      pdf.setPage(page);
      const width = await drawPdfLogo(pdf, logo, margin, 26, 25);
      pdf.setFont(fontName, 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(90, 95, 104);
      pdf.setFontSize(15);
      pdf.setTextColor(28, 30, 34);
      pdf.text('CubeRoot', margin + (width ? width + 8 : 0), 43);
      pdf.setFontSize(10);
      pdf.setTextColor(90, 95, 104);
      pdf.text('cuberoot.me', pageWidth - margin, 43, {align:'right'});
      pdf.setFontSize(9);
      pdf.text(options.subtitle ?? '', margin, 73);
      pdf.setDrawColor(222, 225, 230);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 84, pageWidth - margin, 84);
      pdf.text(`${page} / ${count}`, pageWidth - margin, pageHeight - 28, {align:'right'});
    }
  }
  return pdf.output('blob');
}

export async function exportDocumentDocx(title: string, document: RichTextNode): Promise<void> {
  saveBlob(await buildDocumentDocx(title, document), documentExportFilename(title, 'docx'));
}

export async function exportDocumentPdf(title: string, document: RichTextNode): Promise<void> {
  saveBlob(await buildDocumentPdf(title, document), documentExportFilename(title, 'pdf'));
}
