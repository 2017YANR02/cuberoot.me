import {documentExportBlocks, documentExportFilename, renderDocumentPdf, type RichTextNode} from '@cuberoot/shared/document-export';
export {documentExportBlocks, documentExportText, documentExportFilename, wrapDocumentPdfSegments, type RichTextNode, type PdfChartPoint, type ExportSegment, type ExportBlock} from '@cuberoot/shared/document-export';

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

export async function buildDocumentPdf(title:string,document:RichTextNode,options?:{brand?:boolean;subtitle?:string}):Promise<Blob> {
  const [{jsPDF}, fonts, svg] = await Promise.all([import('jspdf'), import('./pdf-fonts'), import('./pdf-svg')]);
  const branding = options?.brand ? await import('./pdf-logo') : null;
  const logo = branding ? await branding.loadPdfLogo('mark') : null;
  const pdf = new jsPDF({unit:'pt',format:'a4',compress:true});
  await renderDocumentPdf(pdf,title,document,{
    fonts,
    drawSvg: (doc,image,x,y,w,h) => svg.embedSvg(doc,svg.svgStringToElement(image),x,y,w,h),
    drawLogo: branding ? (doc,x,y,h) => branding.drawPdfLogo(doc,logo,x,y,h) : undefined,
  },options);
  return pdf.output('blob');
}

export async function exportDocumentDocx(title: string, document: RichTextNode): Promise<void> {
  saveBlob(await buildDocumentDocx(title, document), documentExportFilename(title, 'docx'));
}

export async function exportDocumentPdf(title: string, document: RichTextNode): Promise<void> {
  saveBlob(await buildDocumentPdf(title, document), documentExportFilename(title, 'pdf'));
}
