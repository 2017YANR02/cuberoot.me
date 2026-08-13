export interface RichTextNode {
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

function segmentTokens(text: string): string[] {
  return text.match(/\r?\n|[\u3400-\u9fff\uf900-\ufaff]|[^\s\u3400-\u9fff\uf900-\ufaff]+|[ \t]+/gu) || [];
}

export async function buildDocumentPdf(title: string, document: RichTextNode): Promise<Blob> {
  const [{ jsPDF }, fonts] = await Promise.all([import('jspdf'), import('@/lib/pdf-fonts')]);
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
  let y = 58;

  const setSegmentFont = (segment: Pick<ExportSegment, 'bold'>, size: number) => {
    pdf.setFont(fontName, segment.bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
  };
  const measure = (text: string, segment: ExportSegment, size: number) => {
    setSegmentFont(segment, size);
    return pdf.getTextWidth(text);
  };
  const append = (line: PdfLineSegment[], segment: ExportSegment, text: string, width: number) => {
    const previous = line.at(-1);
    if (previous && previous.bold === segment.bold && previous.italic === segment.italic
      && previous.strike === segment.strike && previous.code === segment.code) {
      previous.text += text;
      previous.width += width;
    } else {
      line.push({ ...segment, text, width });
    }
  };
  const wrap = (segments: ExportSegment[], size: number, maxWidth: number): PdfLineSegment[][] => {
    const lines: PdfLineSegment[][] = [[]];
    let lineWidth = 0;
    const nextLine = () => { lines.push([]); lineWidth = 0; };
    for (const segment of segments) {
      for (const token of segmentTokens(segment.text)) {
        if (token === '\n' || token === '\r\n') { nextLine(); continue; }
        if (/^[ \t]+$/.test(token) && lineWidth === 0) continue;
        let tokenWidth = measure(token, segment, size);
        if (tokenWidth <= maxWidth) {
          if (lineWidth > 0 && lineWidth + tokenWidth > maxWidth) nextLine();
          append(lines.at(-1)!, segment, token, tokenWidth);
          lineWidth += tokenWidth;
          continue;
        }
        for (const character of Array.from(token)) {
          const characterWidth = measure(character, segment, size);
          if (lineWidth > 0 && lineWidth + characterWidth > maxWidth) nextLine();
          append(lines.at(-1)!, segment, character, characterWidth);
          lineWidth += characterWidth;
        }
      }
    }
    return lines;
  };
  const newPage = () => { pdf.addPage(); y = 58; };

  for (const block of documentExportBlocks(document)) {
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
  return pdf.output('blob');
}

export async function exportDocumentDocx(title: string, document: RichTextNode): Promise<void> {
  saveBlob(await buildDocumentDocx(title, document), documentExportFilename(title, 'docx'));
}

export async function exportDocumentPdf(title: string, document: RichTextNode): Promise<void> {
  saveBlob(await buildDocumentPdf(title, document), documentExportFilename(title, 'pdf'));
}
