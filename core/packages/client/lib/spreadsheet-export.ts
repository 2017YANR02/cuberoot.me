import { saveBlob } from '@/lib/document-export';
import { calculateSpreadsheetFormulas } from '@/lib/spreadsheet-formulas';
import { cellAddress, columnLabel, formatCalculatedValue, parseCellAddress, usedBounds, type SpreadsheetSheet } from '@/lib/spreadsheet-model';

function safeFilename(title: string, extension: string): string {
  const stem = title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 120) || 'spreadsheet';
  return `${stem}.${extension}`;
}

function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*\[\]:]/g, '').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tail = ` ${suffix++}`;
    candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function buildSpreadsheetXlsx(sheets: SpreadsheetSheet[]): Promise<Blob> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of sheets) {
    const worksheet: Record<string, unknown> = {};
    const bounds = usedBounds(sheet.cells);
    for (const [address, raw] of Object.entries(sheet.cells)) {
      if (!raw) continue;
      const cell = raw.startsWith('=')
        ? { t: 'n', f: raw.slice(1), v: 0 }
        : /^(true|false)$/i.test(raw)
          ? { t: 'b', v: raw.toLowerCase() === 'true' }
          : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())
            ? { t: 'n', v: Number(raw) }
            : { t: 's', v: raw };
      worksheet[address] = cell;
    }
    worksheet['!ref'] = `A1:${columnLabel(bounds.columns - 1)}${bounds.rows}`;
    worksheet['!cols'] = Array.from({ length: bounds.columns }, (_, index) => ({
      wpx: sheet.widths[String(index)] || 100,
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet as never, safeSheetName(sheet.name, used));
  }
  (workbook as typeof workbook & { CalcPr?: Record<string, boolean> }).CalcPr = { fullCalcOnLoad: true, forceFullCalc: true };
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function parseSpreadsheetFile(file: File): Promise<Array<{ name: string; cells: Record<string, string> }>> {
  if (file.size === 0) throw new Error('Spreadsheet file is empty');
  if (file.size > 20 * 1024 * 1024) throw new Error('Spreadsheet must be 20 MB or smaller');
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellFormula: true });
  if (!workbook.SheetNames.length) throw new Error('Spreadsheet has no worksheets');
  let totalCells = 0;
  let totalText = 0;
  return workbook.SheetNames.slice(0, 50).map((name) => {
    const worksheet = workbook.Sheets[name];
    const cells: Record<string, string> = {};
    for (const [address, entry] of Object.entries(worksheet)) {
      const point = parseCellAddress(address);
      if (address.startsWith('!') || !point || point.row >= 10_000 || point.column >= 200) continue;
      const cell = entry as { f?: string; v?: unknown; t?: string };
      const raw = cell.f ? `=${cell.f}` : cell.v instanceof Date
        ? cell.v.toISOString().slice(0, 10)
        : cell.v === undefined || cell.v === null ? '' : String(cell.v);
      if (!raw) continue;
      totalCells += 1;
      if (totalCells > 100_000) throw new Error('Spreadsheet exceeds 100,000 non-empty cells');
      totalText += raw.length;
      if (totalText > 20_000_000) throw new Error('Spreadsheet text exceeds 20,000,000 characters');
      cells[address.toUpperCase()] = raw.slice(0, 50_000);
    }
    return { name, cells };
  });
}

export async function exportSpreadsheetXlsx(title: string, sheets: SpreadsheetSheet[]): Promise<void> {
  saveBlob(await buildSpreadsheetXlsx(sheets), safeFilename(title, 'xlsx'));
}

export function buildSpreadsheetCsv(sheet: SpreadsheetSheet, allSheets: SpreadsheetSheet[] = [sheet]): Blob {
  const bounds = usedBounds(sheet.cells);
  const calculated = calculateSpreadsheetFormulas(allSheets);
  if (calculated.error) throw new Error(calculated.error);
  const quote = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = Array.from({ length: bounds.rows }, (_, row) => Array.from({ length: bounds.columns }, (_, column) => {
    const address = cellAddress(row, column);
    const raw = sheet.cells[address] || '';
    return quote(raw.startsWith('=') ? formatCalculatedValue(calculated.values[sheet.id]?.[address]) : raw);
  }).join(','));
  return new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
}

export async function exportSpreadsheetCsv(title: string, sheet: SpreadsheetSheet, allSheets: SpreadsheetSheet[] = [sheet]): Promise<void> {
  saveBlob(buildSpreadsheetCsv(sheet, allSheets), safeFilename(`${title}-${sheet.name}`, 'csv'));
}

export async function buildSpreadsheetPdf(title: string, sheet: SpreadsheetSheet, allSheets: SpreadsheetSheet[] = [sheet]): Promise<Blob> {
  const [{ jsPDF }, fonts] = await Promise.all([import('jspdf'), import('@/lib/pdf-fonts')]);
  const bounds = usedBounds(sheet.cells);
  const calculated = calculateSpreadsheetFormulas(allSheets);
  if (calculated.error) throw new Error(calculated.error);
  const rawText = Object.values(sheet.cells).join(' ');
  const pdf = new jsPDF({ orientation: bounds.columns > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4', compress: true });
  await fonts.loadPdfFonts(pdf);
  const cjk = fonts.hasCjk(rawText + title + sheet.name);
  if (cjk) await fonts.ensureCjkFont(pdf);
  const font = cjk ? fonts.FONT_CJK : fonts.FONT_SANS;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const rowHeight = 18;
  const columnsPerPage = Math.max(1, Math.min(bounds.columns, Math.floor((pageWidth - margin * 2 - 28) / 82)));
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - margin * 2 - 42) / rowHeight) - 1);
  let firstPage = true;
  for (let columnStart = 0; columnStart < bounds.columns; columnStart += columnsPerPage) {
    for (let rowStart = 0; rowStart < bounds.rows; rowStart += rowsPerPage) {
      if (!firstPage) pdf.addPage();
      firstPage = false;
      pdf.setFont(font, 'bold'); pdf.setFontSize(11); pdf.setTextColor(28, 30, 34);
      pdf.text(`${title} — ${sheet.name}`, margin, margin);
      const tableTop = margin + 18;
      const indexWidth = 28;
      const cellWidth = (pageWidth - margin * 2 - indexWidth) / columnsPerPage;
      const rowEnd = Math.min(bounds.rows, rowStart + rowsPerPage);
      const columnEnd = Math.min(bounds.columns, columnStart + columnsPerPage);
      pdf.setFont(font, 'normal'); pdf.setFontSize(7.5);
      for (let row = rowStart - 1; row < rowEnd; row += 1) {
        const y = tableTop + (row - rowStart + 1) * rowHeight;
        for (let column = columnStart - 1; column < columnEnd; column += 1) {
          const x = margin + (column < columnStart ? 0 : indexWidth + (column - columnStart) * cellWidth);
          const width = column < columnStart ? indexWidth : cellWidth;
          pdf.setDrawColor(190, 194, 201); pdf.rect(x, y, width, rowHeight);
          const raw = row >= rowStart && column >= columnStart ? sheet.cells[cellAddress(row, column)] || '' : '';
          const value = row < rowStart
            ? column < columnStart ? '' : columnLabel(column)
            : column < columnStart ? String(row + 1)
              : raw.startsWith('=') ? formatCalculatedValue(calculated.values[sheet.id]?.[cellAddress(row, column)]) : raw;
          const text = pdf.splitTextToSize(value, width - 5)[0] || '';
          pdf.text(text, x + 2.5, y + 12, { baseline: 'alphabetic' });
        }
      }
    }
  }
  return pdf.output('blob');
}

export async function exportSpreadsheetPdf(title: string, sheet: SpreadsheetSheet, allSheets: SpreadsheetSheet[] = [sheet]): Promise<void> {
  saveBlob(await buildSpreadsheetPdf(title, sheet, allSheets), safeFilename(`${title}-${sheet.name}`, 'pdf'));
}
