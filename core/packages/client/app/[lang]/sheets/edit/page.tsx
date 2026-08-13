'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronLeft, Download, FileDown, Italic, PaintBucket, Palette, Plus, Printer, Redo2, Share2, Strikethrough, Trash2, Undo2 } from 'lucide-react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import AppLink from '@/components/AppLink';
import { CollaborativeSharePanel } from '@/components/collaboration/CollaborativeSharePanel';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { websocketApiUrl } from '@/lib/api-base';
import { getSessionToken, getWcaToken, useAuthUser } from '@/lib/auth-store';
import { fetchDocument, updateDocumentTitle, type DocumentDetails } from '@/lib/document-api';
import { buildSpreadsheetPdf, exportSpreadsheetCsv, exportSpreadsheetPdf, exportSpreadsheetXlsx } from '@/lib/spreadsheet-export';
import { calculateSpreadsheetFormulas, rewriteFormulasForSheetRename } from '@/lib/spreadsheet-formulas';
import {
  cellAddress, columnLabel, formatSpreadsheetCellValue, normalizedRange,
  parseClipboardTable, rangeAddresses, rangeToTsv,
  sortSpreadsheetRangeRows, type CellFontFamily, type CellNumberFormat,
  type CellRange, type CellStyle, type SpreadsheetSheet,
} from '@/lib/spreadsheet-model';
import './spreadsheet.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type SheetMap = Y.Map<unknown>;
type EditorSession = { ydoc: Y.Doc; provider: HocuspocusProvider; undo: Y.UndoManager };
const ROW_HEIGHT = 25;
const HEADER_HEIGHT = 26;
const ROW_HEADER_WIDTH = 46;
const DEFAULT_COLUMN_WIDTH = 100;

function mapValue<T>(sheet: SheetMap, key: string): T { return sheet.get(key) as T; }
function cellsMap(sheet: SheetMap): Y.Map<string> { return mapValue(sheet, 'cells'); }
function stylesMap(sheet: SheetMap): Y.Map<CellStyle> { return mapValue(sheet, 'styles'); }
function widthsMap(sheet: SheetMap): Y.Map<number> { return mapValue(sheet, 'widths'); }

function snapshot(sheet: SheetMap): SpreadsheetSheet {
  return {
    id: String(sheet.get('id')),
    name: String(sheet.get('name')),
    rowCount: Number(sheet.get('rowCount')) || 100,
    columnCount: Number(sheet.get('columnCount')) || 26,
    cells: cellsMap(sheet).toJSON(), styles: stylesMap(sheet).toJSON(), widths: widthsMap(sheet).toJSON(),
  };
}

function newSheet(name: string): SheetMap {
  const sheet = new Y.Map<unknown>();
  sheet.set('id', crypto.randomUUID()); sheet.set('name', name); sheet.set('rowCount', 100); sheet.set('columnCount', 26);
  sheet.set('cells', new Y.Map<string>()); sheet.set('styles', new Y.Map<CellStyle>()); sheet.set('widths', new Y.Map<number>());
  return sheet;
}

function ToolbarButton({ active, disabled, label, onClick, children }: { active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`sheet-tool${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

function SheetMenu({ label, open, hiddenOnMobile, onToggle, children }: {
  label: string; open: boolean; hiddenOnMobile?: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);
  return <div className={`sheet-menu${hiddenOnMobile ? ' is-secondary' : ''}`}>
    <button type="button" className="sheet-menu-trigger" aria-expanded={open} onClick={onToggle}>{label}</button>
    {open && <div ref={panelRef} className="sheet-menu-panel">{children}</div>}
  </div>;
}

function SheetMenuItem({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="sheet-menu-item" disabled={disabled} onClick={onClick}>{children}</button>;
}

function SpreadsheetGrid({ session, readOnly, activeSheetId, onActiveSheet, onError, onExport, onPrint }: {
  session: EditorSession; readOnly: boolean; activeSheetId: string; onActiveSheet: (id: string) => void;
  onError: (message: string) => void; onExport: (format: 'xlsx' | 'csv' | 'pdf') => void; onPrint: () => void;
}) {
  const user = useAuthUser();
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState<CellRange>({ start: { row: 0, column: 0 }, end: { row: 0, column: 0 } });
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [zoom, setZoom] = useState(100);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const ySheets = session.ydoc.getArray<SheetMap>('sheets');
  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    ySheets.observeDeep(update);
    if (ySheets.length === 0 && !readOnly) session.ydoc.transact(() => ySheets.push([newSheet('Sheet 1')]));
    return () => ySheets.unobserveDeep(update);
  }, [readOnly, session.ydoc, ySheets]);
  const sheets = useMemo(() => ySheets.toArray(), [version, ySheets]);
  const snapshots = useMemo(() => sheets.map(snapshot), [sheets]);
  const activeIndex = Math.max(0, sheets.findIndex((sheet) => String(sheet.get('id')) === activeSheetId));
  const active = sheets[activeIndex];
  const data = snapshots[activeIndex];
  useEffect(() => { if (sheets.length && !activeSheetId) onActiveSheet(String(sheets[0].get('id'))); }, [activeSheetId, onActiveSheet, sheets]);

  const calculated = useMemo(() => calculateSpreadsheetFormulas(snapshots), [snapshots]);
  useEffect(() => {
    if (calculated.error) onError(calculated.error);
  }, [calculated.error, onError]);

  const focus = selection.end;
  const focusAddress = cellAddress(focus.row, focus.column);
  const focusRaw = data?.cells[focusAddress] || '';
  const selectedStyle = data?.styles[focusAddress] || {};
  useEffect(() => { if (!editing) setDraft(focusRaw); }, [editing, focusRaw]);
  useEffect(() => {
    session.provider.awareness?.setLocalStateField('user', { name: user?.name || user?.wcaId || tr({ zh: '协作者', en: 'Collaborator' }), color: 'var(--primary)' });
    session.provider.awareness?.setLocalStateField('spreadsheet', { sheetId: data?.id, range: normalizedRange(selection) });
  }, [data?.id, selection, session.provider, user?.name, user?.wcaId]);
  useEffect(() => {
    const resize = () => setViewportHeight(gridRef.current?.clientHeight || 600);
    resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const up = () => setDragging(false); window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up);
  }, []);
  useEffect(() => {
    if (!openMenu) return;
    const close = (event: PointerEvent) => { if (!menuBarRef.current?.contains(event.target as Node)) setOpenMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenMenu(null); };
    window.addEventListener('pointerdown', close); window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, [openMenu]);
  if (!active || !data) return <p className="sheet-loading"><T zh="正在准备表格…" en="Preparing spreadsheet…" /></p>;

  const commit = (raw = draft, point = focus) => {
    if (readOnly) return;
    const address = cellAddress(point.row, point.column);
    session.ydoc.transact(() => raw ? cellsMap(active).set(address, raw.slice(0, 50_000)) : cellsMap(active).delete(address));
    setEditing(false);
  };
  const move = (rowDelta: number, columnDelta: number, extend = false) => {
    const next = { row: Math.min(data.rowCount - 1, Math.max(0, focus.row + rowDelta)), column: Math.min(data.columnCount - 1, Math.max(0, focus.column + columnDelta)) };
    setSelection((current) => extend ? { ...current, end: next } : { start: next, end: next });
  };
  const paste = (text: string) => {
    if (readOnly) return;
    const table = parseClipboardTable(text);
    session.ydoc.transact(() => table.forEach((rowValues, rowOffset) => rowValues.forEach((value, columnOffset) => {
      const row = focus.row + rowOffset; const column = focus.column + columnOffset;
      if (row >= data.rowCount || column >= data.columnCount) return;
      const address = cellAddress(row, column); if (value) cellsMap(active).set(address, value.slice(0, 50_000)); else cellsMap(active).delete(address);
    })));
    setSelection({ start: focus, end: { row: Math.min(data.rowCount - 1, focus.row + table.length - 1), column: Math.min(data.columnCount - 1, focus.column + Math.max(0, ...table.map((row) => row.length - 1))) } });
  };
  const patchStyle = (patch: Partial<CellStyle>) => {
    if (readOnly) return;
    session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
      const current = stylesMap(active).get(address) || {};
      const next = { ...current, ...patch };
      for (const [key, value] of Object.entries(next)) {
        if (value === false || value === undefined || value === '') delete next[key as keyof CellStyle];
      }
      if (Object.keys(next).length === 0) stylesMap(active).delete(address); else stylesMap(active).set(address, next);
    }));
  };
  const deleteSelection = () => { if (!readOnly) session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => cellsMap(active).delete(address))); };
  const keyboard = (event: React.KeyboardEvent) => {
    if (editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); void navigator.clipboard.writeText(rangeToTsv(data.cells, selection)); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? session.undo.redo() : session.undo.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); session.undo.redo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b' && !readOnly) { event.preventDefault(); patchStyle({ bold: !selectedStyle.bold }); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i' && !readOnly) { event.preventDefault(); patchStyle({ italic: !selectedStyle.italic }); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); return; }
    const directions: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, event.shiftKey ? -1 : 1], Enter: [event.shiftKey ? -1 : 1, 0] };
    if (directions[event.key]) { event.preventDefault(); move(...directions[event.key], event.shiftKey && event.key.startsWith('Arrow')); return; }
    if (!readOnly && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { setDraft(event.key); setEditing(true); }
  };
  const addSheet = () => {
    if (readOnly || ySheets.length >= 50) return;
    let suffix = ySheets.length + 1;
    let name = tr({ zh: `工作表 ${suffix}`, en: `Sheet ${suffix}` });
    while (snapshots.some((sheet) => sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      suffix += 1;
      name = tr({ zh: `工作表 ${suffix}`, en: `Sheet ${suffix}` });
    }
    session.ydoc.transact(() => ySheets.push([newSheet(name)]));
    onActiveSheet(String(ySheets.get(ySheets.length - 1).get('id')));
  };
  const renameSheet = (sheetId: string) => {
    if (readOnly) return;
    const target = sheets.find((sheet) => String(sheet.get('id')) === sheetId);
    if (!target) return;
    const oldName = String(target.get('name'));
    const name = window.prompt(tr({ zh: '工作表名称', en: 'Sheet name' }), oldName)?.replace(/[\\/?*\[\]:]/g, '').trim().slice(0, 100);
    if (!name || name === oldName) return;
    if (snapshots.some((sheet) => sheet.id !== sheetId && sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      onError(tr({ zh: '工作表名称不能重复。', en: 'Sheet names must be unique.' }));
      return;
    }
    let formulaPatches: Record<string, Record<string, string>>;
    try { formulaPatches = rewriteFormulasForSheetRename(snapshots, oldName, name); }
    catch (cause) { onError(cause instanceof Error ? cause.message : tr({ zh: '工作表重命名失败。', en: 'Could not rename sheet.' })); return; }
    session.ydoc.transact(() => {
      for (const sheet of sheets) {
        const patches = formulaPatches[String(sheet.get('id'))];
        if (!patches) continue;
        for (const [address, formula] of Object.entries(patches)) cellsMap(sheet).set(address, formula);
      }
      target.set('name', name);
    });
    onActiveSheet(sheetId);
  };
  const removeSheet = () => {
    if (readOnly || ySheets.length <= 1 || !window.confirm(tr({ zh: `删除“${data.name}”？此操作可通过撤销恢复。`, en: `Delete “${data.name}”? You can restore it with Undo.` }))) return;
    session.ydoc.transact(() => ySheets.delete(activeIndex, 1)); onActiveSheet(String(ySheets.get(Math.max(0, activeIndex - 1)).get('id')));
  };
  const changeDimension = (axis: 'row' | 'column', delta: 1 | -1) => {
    if (readOnly) return;
    const key = axis === 'row' ? 'rowCount' : 'columnCount'; const current = Number(active.get(key));
    const minimum = axis === 'row' ? 20 : 10; const maximum = axis === 'row' ? 10_000 : 200;
    const next = Math.min(maximum, Math.max(minimum, current + delta * (axis === 'row' ? 20 : 5)));
    session.ydoc.transact(() => active.set(key, next));
  };
  const runMenu = (action: () => void) => { setOpenMenu(null); action(); };
  const applyNumberFormat = (numberFormat: CellNumberFormat) => patchStyle({ numberFormat: numberFormat === 'general' ? undefined : numberFormat });
  const adjustDecimals = (delta: 1 | -1) => {
    const format = selectedStyle.numberFormat || 'number';
    const fallback = format === 'currency' ? 2 : format === 'percent' ? 0 : 2;
    patchStyle({ numberFormat: format, decimals: Math.min(10, Math.max(0, (selectedStyle.decimals ?? fallback) + delta)) });
  };
  const sortSelection = (direction: 'asc' | 'desc') => {
    if (readOnly) return;
    try {
      const sorted = sortSpreadsheetRangeRows(data.cells, data.styles, selection, direction, tr({ zh: 'zh-CN', en: 'en-US' }));
      session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
        if (sorted.cells[address]) cellsMap(active).set(address, sorted.cells[address]); else cellsMap(active).delete(address);
        if (sorted.styles[address]) stylesMap(active).set(address, sorted.styles[address]); else stylesMap(active).delete(address);
      }));
      onError('');
    } catch {
      onError(tr({ zh: '所选范围含公式，暂不能排序。请只选择普通数据。', en: 'The selected range contains formulas. Select plain data before sorting.' }));
    }
  };
  const trimSelection = () => {
    if (readOnly) return;
    session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
      const raw = cellsMap(active).get(address);
      if (!raw || raw.startsWith('=')) return;
      const trimmed = raw.trim(); if (trimmed) cellsMap(active).set(address, trimmed); else cellsMap(active).delete(address);
    }));
  };
  const scale = zoom / 100;
  const rowHeight = Math.max(20, Math.round(ROW_HEIGHT * scale));
  const headerHeight = Math.max(22, Math.round(HEADER_HEIGHT * scale));
  const rowHeaderWidth = Math.max(38, Math.round(ROW_HEADER_WIDTH * scale));
  const widths = Array.from({ length: data.columnCount }, (_, index) => Math.round(Math.min(400, Math.max(48, data.widths[String(index)] || DEFAULT_COLUMN_WIDTH)) * scale));
  const offsets: number[] = [rowHeaderWidth]; widths.forEach((width, index) => { offsets[index + 1] = offsets[index] + width; });
  const totalWidth = offsets[data.columnCount];
  const firstRow = Math.max(0, Math.floor((scrollTop - headerHeight) / rowHeight) - 2);
  const lastRow = Math.min(data.rowCount - 1, firstRow + Math.ceil(viewportHeight / rowHeight) + 5);
  const visibleRows = Array.from({ length: lastRow - firstRow + 1 }, (_, index) => firstRow + index);
  const range = normalizedRange(selection);
  const awareness = session.provider.awareness;
  const remoteSelections = Array.from(awareness?.getStates().entries() || [])
    .filter(([clientId, state]) => clientId !== awareness?.clientID && state.spreadsheet?.sheetId === data.id)
    .map(([, state]) => state.spreadsheet.range as CellRange).filter(Boolean);
  const selectionValues = rangeAddresses(selection).map((address) => {
    const raw = data.cells[address] || '';
    const value = raw.startsWith('=') ? calculated.values[data.id]?.[address] : raw;
    const text = value === null || value === undefined ? '' : String(value).trim();
    return { raw, numeric: typeof value === 'number' ? value : text ? Number(text) : Number.NaN };
  });
  const nonEmptyCount = selectionValues.filter(({ raw }) => raw !== '').length;
  const numericValues = selectionValues.map(({ numeric }) => numeric).filter(Number.isFinite);
  const selectionSum = numericValues.reduce((sum, value) => sum + value, 0);

  return <div className="sheet-editor-area">
    <div ref={menuBarRef} className="sheet-menu-bar">
      <SheetMenu label={tr({ zh: '文件', en: 'File' })} open={openMenu === 'file'} onToggle={() => setOpenMenu(openMenu === 'file' ? null : 'file')}>
        <SheetMenuItem onClick={() => runMenu(onPrint)}><T zh="打印" en="Print" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem onClick={() => runMenu(() => onExport('xlsx'))}><T zh="导出 Excel" en="Export Excel" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(() => onExport('csv'))}><T zh="导出 CSV" en="Export CSV" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(() => onExport('pdf'))}><T zh="导出 PDF" en="Export PDF" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '编辑', en: 'Edit' })} open={openMenu === 'edit'} onToggle={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => session.undo.undo())}><T zh="撤销 Ctrl+Z" en="Undo Ctrl+Z" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => session.undo.redo())}><T zh="重做 Ctrl+Y" en="Redo Ctrl+Y" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(deleteSelection)}><T zh="清除所选内容" en="Clear selection" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '查看', en: 'View' })} open={openMenu === 'view'} onToggle={() => setOpenMenu(openMenu === 'view' ? null : 'view')}>
        {[75, 90, 100, 110, 125].map((value) => <SheetMenuItem key={value} onClick={() => runMenu(() => setZoom(value))}>{value === zoom ? '✓ ' : ''}{value}%</SheetMenuItem>)}
      </SheetMenu>
      <SheetMenu label={tr({ zh: '插入', en: 'Insert' })} open={openMenu === 'insert'} onToggle={() => setOpenMenu(openMenu === 'insert' ? null : 'insert')}>
        <SheetMenuItem disabled={readOnly || ySheets.length >= 50} onClick={() => runMenu(addSheet)}><T zh="新工作表" en="New sheet" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '格式', en: 'Format' })} open={openMenu === 'format'} onToggle={() => setOpenMenu(openMenu === 'format' ? null : 'format')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ bold: !selectedStyle.bold }))}><T zh="粗体" en="Bold" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ italic: !selectedStyle.italic }))}><T zh="斜体" en="Italic" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ strikethrough: !selectedStyle.strikethrough }))}><T zh="删除线" en="Strikethrough" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyNumberFormat('general'))}><T zh="自动格式" en="Automatic format" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyNumberFormat('currency'))}><T zh="货币" en="Currency" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyNumberFormat('percent'))}><T zh="百分比" en="Percent" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '数据', en: 'Data' })} open={openMenu === 'data'} hiddenOnMobile onToggle={() => setOpenMenu(openMenu === 'data' ? null : 'data')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => sortSelection('asc'))}><T zh="按首列升序排列范围" en="Sort range by first column A–Z" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => sortSelection('desc'))}><T zh="按首列降序排列范围" en="Sort range by first column Z–A" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(trimSelection)}><T zh="清除首尾空格" en="Trim whitespace" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '工具', en: 'Tools' })} open={openMenu === 'tools'} hiddenOnMobile onToggle={() => setOpenMenu(openMenu === 'tools' ? null : 'tools')}>
        <SheetMenuItem onClick={() => runMenu(() => window.alert(tr({ zh: `所选范围：${nonEmptyCount} 个非空单元格，${numericValues.length} 个数值，合计 ${selectionSum}`, en: `Selection: ${nonEmptyCount} non-empty cells, ${numericValues.length} numbers, sum ${selectionSum}` })))}><T zh="所选范围统计" en="Selection summary" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '帮助', en: 'Help' })} open={openMenu === 'help'} hiddenOnMobile onToggle={() => setOpenMenu(openMenu === 'help' ? null : 'help')}>
        <SheetMenuItem onClick={() => runMenu(() => window.alert(tr({ zh: '方向键移动；Shift+方向键扩选；Enter 下移；Tab 右移；Ctrl/Cmd+B 粗体；Ctrl/Cmd+I 斜体；Delete 清空。', en: 'Arrow keys move; Shift+Arrow extends; Enter moves down; Tab moves right; Ctrl/Cmd+B bolds; Ctrl/Cmd+I italicizes; Delete clears.' })))}><T zh="键盘快捷键" en="Keyboard shortcuts" /></SheetMenuItem>
      </SheetMenu>
    </div>
    <div className="sheet-toolbar">
      <ToolbarButton label={tr({ zh: '撤销', en: 'Undo' })} disabled={readOnly} onClick={() => session.undo.undo()}><Undo2 size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '重做', en: 'Redo' })} disabled={readOnly} onClick={() => session.undo.redo()}><Redo2 size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '打印', en: 'Print' })} onClick={onPrint}><Printer size={17} /></ToolbarButton><span className="sheet-tool-separator" />
      <select className="sheet-tool-select is-zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label={tr({ zh: '缩放', en: 'Zoom' })}>{[75, 90, 100, 110, 125].map((value) => <option key={value} value={value}>{value}%</option>)}</select>
      <span className="sheet-tool-separator" />
      <ToolbarButton label={tr({ zh: '货币格式', en: 'Currency format' })} active={selectedStyle.numberFormat === 'currency'} disabled={readOnly} onClick={() => applyNumberFormat('currency')}><span className="sheet-symbol">¥</span></ToolbarButton>
      <ToolbarButton label={tr({ zh: '百分比格式', en: 'Percent format' })} active={selectedStyle.numberFormat === 'percent'} disabled={readOnly} onClick={() => applyNumberFormat('percent')}><span className="sheet-symbol">%</span></ToolbarButton>
      <ToolbarButton label={tr({ zh: '减少小数位', en: 'Decrease decimal places' })} disabled={readOnly} onClick={() => adjustDecimals(-1)}><span className="sheet-decimal-symbol">.0←</span></ToolbarButton>
      <ToolbarButton label={tr({ zh: '增加小数位', en: 'Increase decimal places' })} disabled={readOnly} onClick={() => adjustDecimals(1)}><span className="sheet-decimal-symbol">.00→</span></ToolbarButton>
      <select className="sheet-tool-select is-number" value={selectedStyle.numberFormat || 'general'} disabled={readOnly} onChange={(event) => applyNumberFormat(event.target.value as CellNumberFormat)} aria-label={tr({ zh: '数字格式', en: 'Number format' })}><option value="general"><T zh="自动" en="Automatic" /></option><option value="number"><T zh="数字" en="Number" /></option><option value="currency"><T zh="货币" en="Currency" /></option><option value="percent"><T zh="百分比" en="Percent" /></option></select>
      <span className="sheet-tool-separator" />
      <select className="sheet-tool-select is-font" value={selectedStyle.fontFamily || 'sans'} disabled={readOnly} onChange={(event) => patchStyle({ fontFamily: event.target.value as CellFontFamily })} aria-label={tr({ zh: '字体', en: 'Font' })}><option value="sans"><T zh="默认" en="Default" /></option><option value="serif"><T zh="衬线" en="Serif" /></option><option value="mono"><T zh="等宽" en="Monospace" /></option></select>
      <ToolbarButton label={tr({ zh: '减小字号', en: 'Decrease font size' })} disabled={readOnly} onClick={() => patchStyle({ fontSize: Math.max(6, (selectedStyle.fontSize || 12) - 1) })}><span className="sheet-symbol">−</span></ToolbarButton>
      <input className="sheet-font-size-input" type="number" min="6" max="48" value={selectedStyle.fontSize || 12} disabled={readOnly} onChange={(event) => patchStyle({ fontSize: Math.min(48, Math.max(6, Number(event.target.value) || 12)) })} aria-label={tr({ zh: '字号', en: 'Font size' })} />
      <ToolbarButton label={tr({ zh: '增大字号', en: 'Increase font size' })} disabled={readOnly} onClick={() => patchStyle({ fontSize: Math.min(48, (selectedStyle.fontSize || 12) + 1) })}><Plus size={15} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '粗体', en: 'Bold' })} active={selectedStyle.bold} disabled={readOnly} onClick={() => patchStyle({ bold: !selectedStyle.bold })}><Bold size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '斜体', en: 'Italic' })} active={selectedStyle.italic} disabled={readOnly} onClick={() => patchStyle({ italic: !selectedStyle.italic })}><Italic size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '删除线', en: 'Strikethrough' })} active={selectedStyle.strikethrough} disabled={readOnly} onClick={() => patchStyle({ strikethrough: !selectedStyle.strikethrough })}><Strikethrough size={17} /></ToolbarButton>
      <label className="sheet-color-label" title={tr({ zh: '文字颜色', en: 'Text color' })}><Palette size={16} /><input className="sheet-color-input" type="color" value={selectedStyle.color || '#111111'} disabled={readOnly} onChange={(event) => patchStyle({ color: event.target.value })} /><span className="sr-only"><T zh="文字颜色" en="Text color" /></span></label>
      <label className="sheet-color-label" title={tr({ zh: '填充颜色', en: 'Fill color' })}><PaintBucket size={16} /><input className="sheet-color-input" type="color" value={selectedStyle.fill || '#ffffff'} disabled={readOnly} onChange={(event) => patchStyle({ fill: event.target.value })} /><span className="sr-only"><T zh="填充颜色" en="Fill color" /></span></label>
      <span className="sheet-tool-separator" />
      <ToolbarButton label={tr({ zh: '左对齐', en: 'Align left' })} active={selectedStyle.align === 'left'} disabled={readOnly} onClick={() => patchStyle({ align: 'left' })}><AlignLeft size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '居中', en: 'Align center' })} active={selectedStyle.align === 'center'} disabled={readOnly} onClick={() => patchStyle({ align: 'center' })}><AlignCenter size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '右对齐', en: 'Align right' })} active={selectedStyle.align === 'right'} disabled={readOnly} onClick={() => patchStyle({ align: 'right' })}><AlignRight size={17} /></ToolbarButton>
      {readOnly && <span className="sheet-readonly"><T zh="只读" en="Read only" /></span>}
    </div>
    <div className="sheet-formula-row"><span className="sheet-name-box">{focusAddress}</span><span className="sheet-fx">fx</span><input className="sheet-formula-input" value={editing ? draft : focusRaw} readOnly={readOnly} onFocus={() => { setDraft(focusRaw); setEditing(true); }} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); move(1, 0); } if (event.key === 'Escape') { setDraft(focusRaw); setEditing(false); } }} aria-label={tr({ zh: '公式栏', en: 'Formula bar' })} /></div>
    <div ref={gridRef} className="sheet-grid-scroll" role="grid" aria-rowcount={data.rowCount} aria-colcount={data.columnCount} tabIndex={0} onKeyDown={keyboard} onPaste={(event) => { if (!editing) { event.preventDefault(); paste(event.clipboardData.getData('text/plain')); } }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div className="sheet-grid-canvas" style={{ width: totalWidth, height: headerHeight + data.rowCount * rowHeight, fontSize: `${zoom}%` }}>
        <div className="sheet-corner" aria-hidden="true" style={{ width: rowHeaderWidth, height: headerHeight }} />
        <div className="sheet-column-heads" role="row">{widths.map((width, column) => <div className="sheet-column-head" role="columnheader" aria-colindex={column + 1} key={column} style={{ left: offsets[column], width, top: -headerHeight, height: headerHeight }}><span>{columnLabel(column)}</span><button type="button" className="sheet-column-resize" aria-label={tr({ zh: `调整 ${columnLabel(column)} 列宽`, en: `Resize column ${columnLabel(column)}` })} onPointerDown={(event) => {
          if (readOnly) return; event.preventDefault(); const startX = event.clientX; const startWidth = width;
          const movePointer = (moveEvent: PointerEvent) => widthsMap(active).set(String(column), Math.min(400, Math.max(48, (startWidth + moveEvent.clientX - startX) / scale)));
          const stop = () => { window.removeEventListener('pointermove', movePointer); window.removeEventListener('pointerup', stop); };
          window.addEventListener('pointermove', movePointer); window.addEventListener('pointerup', stop);
        }} /></div>)}</div>
        {visibleRows.map((row) => <div className="sheet-grid-row" role="row" aria-rowindex={row + 1} key={row} style={{ top: headerHeight + row * rowHeight, width: totalWidth, height: rowHeight }}>
          <div className="sheet-row-head" role="rowheader" style={{ width: rowHeaderWidth, height: rowHeight }}>{row + 1}</div>
          {widths.map((width, column) => {
            const address = cellAddress(row, column); const style = data.styles[address] || {}; const raw = data.cells[address] || '';
            const display = formatSpreadsheetCellValue(raw, calculated.values[data.id]?.[address], style, tr({ zh: 'zh-CN', en: 'en-US' }));
            const selected = row >= range.start.row && row <= range.end.row && column >= range.start.column && column <= range.end.column;
            const remote = remoteSelections.some((item) => { const n = normalizedRange(item); return row >= n.start.row && row <= n.end.row && column >= n.start.column && column <= n.end.column; });
            const isEditing = editing && row === focus.row && column === focus.column;
            return <div key={column} className={`sheet-cell${selected ? ' is-selected' : ''}${remote ? ' is-remote' : ''}`} role="gridcell" aria-colindex={column + 1} aria-selected={selected} style={{ left: offsets[column], width, height: rowHeight, lineHeight: `${Math.max(14, rowHeight - 7)}px`, fontWeight: style.bold ? 700 : undefined, fontStyle: style.italic ? 'italic' : undefined, textDecoration: style.strikethrough ? 'line-through' : undefined, fontFamily: style.fontFamily === 'serif' ? 'Georgia, serif' : style.fontFamily === 'mono' ? 'var(--font-mono, monospace)' : undefined, fontSize: `${(style.fontSize || 12) * scale}px`, textAlign: style.align, backgroundColor: style.fill, color: style.color }} onPointerDown={(event) => { if (event.button !== 0) return; setDragging(true); setEditing(false); setSelection({ start: { row, column }, end: { row, column } }); }} onPointerEnter={() => { if (dragging) setSelection((current) => ({ ...current, end: { row, column } })); }} onDoubleClick={() => { if (!readOnly) { setDraft(raw); setEditing(true); } }}>
              {isEditing ? <input className="sheet-cell-input" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); move(1, 0); } if (event.key === 'Escape') { setDraft(raw); setEditing(false); } }} /> : display}
            </div>;
          })}
        </div>)}
      </div>
    </div>
    <div className="sheet-bottom-bar"><button type="button" className="sheet-tab-add" onClick={addSheet} disabled={readOnly || ySheets.length >= 50} aria-label={tr({ zh: '新增工作表', en: 'Add sheet' })}><Plus size={17} /></button><div className="sheet-tabs">{snapshots.map((item) => <button type="button" key={item.id} className={`sheet-tab${item.id === data.id ? ' is-active' : ''}`} onClick={() => onActiveSheet(item.id)} onDoubleClick={() => renameSheet(item.id)}>{item.name}</button>)}</div><button type="button" className="sheet-dimension" onClick={() => changeDimension('row', 1)} disabled={readOnly}><T zh="加 20 行" en="Add 20 rows" /></button><button type="button" className="sheet-dimension" onClick={() => changeDimension('column', 1)} disabled={readOnly}><T zh="加 5 列" en="Add 5 columns" /></button><button type="button" className="sheet-tab-delete" onClick={removeSheet} disabled={readOnly || ySheets.length <= 1} aria-label={tr({ zh: '删除当前工作表', en: 'Delete current sheet' })}><Trash2 size={15} /></button><span className="sheet-selection-summary"><T zh={`计数 ${nonEmptyCount}　合计 ${selectionSum}`} en={`Count ${nonEmptyCount}  Sum ${selectionSum}`} /></span></div>
  </div>;
}

export default function SpreadsheetEditorPage() {
  const [id] = useQueryState('id', parseAsString.withDefault(''));
  const user = useAuthUser();
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [session, setSession] = useState<EditorSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [peopleOnline, setPeopleOnline] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [activeSheetId, setActiveSheetId] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id || !user) return;
    try {
      const next = await fetchDocument(id);
      if (next.document.kind !== 'spreadsheet') throw new Error(tr({ zh: '这不是协作表格。', en: 'This resource is not a spreadsheet.' }));
      setDetails(next); setTitle(next.document.title); setError('');
    } catch (cause) { setError((cause as Error).message); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!id || !details || !user) return;
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: websocketApiUrl('/v1/documents/realtime'), name: `document.${id}`, document: ydoc, token: getSessionToken() || getWcaToken(),
      onStatus: ({ status: next }) => setStatus(next),
      onAuthenticationFailed: ({ reason }) => setError(reason || tr({ zh: '表格认证失败', en: 'Spreadsheet authentication failed' })),
      onAwarenessChange: ({ states }) => setPeopleOnline(states.map((state) => typeof state.user === 'object' && state.user && typeof state.user.name === 'string' ? state.user.name : '').filter((name, index, all) => name && all.indexOf(name) === index)),
    });
    const undo = new Y.UndoManager(ydoc.getArray('sheets'));
    setSession({ ydoc, provider, undo });
    return () => { undo.destroy(); provider.destroy(); ydoc.destroy(); setSession(null); setPeopleOnline([]); };
  }, [details?.document.role, id, user]);
  const saveTitle = async () => {
    const cleaned = title.trim(); if (!details?.canManage || !cleaned || cleaned === details.document.title) { if (!cleaned && details) setTitle(details.document.title); return; }
    try { await updateDocumentTitle(details.document.id, cleaned); setDetails({ ...details, document: { ...details.document, title: cleaned } }); }
    catch (cause) { setError((cause as Error).message); }
  };
  const exportFile = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (!session) return;
    setExporting(true); setError(''); setExportOpen(false);
    try {
      const sheets = session.ydoc.getArray<SheetMap>('sheets').toArray().map(snapshot);
      const active = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];
      if (format === 'xlsx') await exportSpreadsheetXlsx(title, sheets);
      else if (format === 'csv') await exportSpreadsheetCsv(title, active, sheets);
      else await exportSpreadsheetPdf(title, active, sheets);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr({ zh: '导出失败', en: 'Export failed' })); }
    finally { setExporting(false); }
  };
  const printFile = async () => {
    if (!session) return;
    const preview = window.open('', '_blank');
    setExporting(true); setError('');
    try {
      const sheets = session.ydoc.getArray<SheetMap>('sheets').toArray().map(snapshot);
      const active = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];
      const blob = await buildSpreadsheetPdf(title, active, sheets);
      const url = URL.createObjectURL(blob);
      if (preview) preview.location.href = url;
      else {
        const link = document.createElement('a'); link.href = url; link.download = `${title || 'spreadsheet'}.pdf`; link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      preview?.close();
      setError(cause instanceof Error ? cause.message : tr({ zh: '打印预览失败', en: 'Print preview failed' }));
    } finally { setExporting(false); }
  };
  if (!id) return <main className="sheet-workspace"><p className="docs-error"><T zh="缺少表格 ID。" en="Missing spreadsheet ID." /></p></main>;
  return <main className="sheet-workspace">
    <header className="sheet-topbar"><AppLink href="/sheets" prefetch={false} className="sheet-back" aria-label={tr({ zh: '返回表格列表', en: 'Back to spreadsheets' })}><ChevronLeft size={20} /></AppLink><input className="sheet-title-input" value={title} readOnly={!details?.canManage} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-label={tr({ zh: '表格标题', en: 'Spreadsheet title' })} /><div className={`sheet-sync is-${status}`}><span />{status === 'connected' ? <T zh="已同步" en="Synced" /> : status === 'connecting' ? <T zh="连接中" en="Connecting" /> : <T zh="离线，等待重连" en="Offline, retrying" />}</div>{peopleOnline.length > 0 && <span className="sheet-presence" title={peopleOnline.join(', ')}>{peopleOnline.length}<T zh=" 人在线" en=" online" /></span>}<div className="sheet-export-wrap"><button type="button" className="sheet-action" onClick={() => setExportOpen((open) => !open)} disabled={exporting}><Download size={16} /><T zh="导出" en="Export" /></button>{exportOpen && <div className="sheet-export-menu"><button type="button" className="sheet-export-option" onClick={() => void exportFile('xlsx')}><Download size={15} />Excel (.xlsx)</button><button type="button" className="sheet-export-option" onClick={() => void exportFile('csv')}><Download size={15} />CSV</button><button type="button" className="sheet-export-option" onClick={() => void exportFile('pdf')}><FileDown size={15} />PDF</button></div>}</div>{details?.canManage && <button type="button" className="sheet-action" onClick={() => setShareOpen(true)}><Share2 size={16} /><T zh="共享" en="Share" /></button>}<WcaAuth /></header>
    {error && <p className="sheet-page-error" role="alert">{error}</p>}
    {!user && !details && <div className="sheet-auth-needed"><T zh="请先登录，再打开共享给你的表格。" en="Sign in to open a spreadsheet shared with you." /></div>}
    {user && !details && !error && <p className="sheet-loading"><T zh="正在加载表格…" en="Loading spreadsheet…" /></p>}
    {details && session && <SpreadsheetGrid session={session} readOnly={details.document.role === 'viewer'} activeSheetId={activeSheetId} onActiveSheet={setActiveSheetId} onError={setError} onExport={(format) => { void exportFile(format); }} onPrint={() => { void printFile(); }} />}
    {shareOpen && details && <CollaborativeSharePanel id={id} kind="spreadsheet" details={details} reload={load} close={() => setShareOpen(false)} />}
  </main>;
}
